"""Lotes, movimientos y saldo de puntos."""

from django.db import IntegrityError, transaction
from django.db.models import F, Sum

from core import models
from core.services.lealtad.errores import (
    ConflictoIdempotencia,
    PuntosInsuficientes,
    SaldoNegativo,
)
from core.utils.tiempo import ahora_utc


def _bloquear_saldo(usuario, negocio):
    """Crea el saldo si no existe y lo bloquea para la transacción actual."""
    models.SaldoPuntos.objects.bulk_create(
        [models.SaldoPuntos(usuario=usuario, negocio=negocio)],
        ignore_conflicts=True,
    )
    return models.SaldoPuntos.objects.select_for_update().get(
        usuario=usuario, negocio=negocio,
    )


def expirar_puntos(*, usuario=None, negocio=None, ahora=None):
    """Expira los lotes vencidos y devuelve la cantidad total expirada."""
    ahora = ahora or ahora_utc()
    total = 0
    with transaction.atomic():
        lotes = models.LotePuntos.objects.select_for_update().filter(
            cantidad_disponible__gt=0,
            fecha_expiracion__isnull=False,
            fecha_expiracion__lte=ahora,
        )
        if usuario is not None:
            lotes = lotes.filter(usuario=usuario)
        if negocio is not None:
            lotes = lotes.filter(negocio=negocio)

        saldos = {}
        for lote in lotes.order_by('fecha_expiracion', 'id'):
            if models.MovimientoPuntos.objects.filter(
                lote=lote, tipo='expirado',
            ).exists():
                continue
            clave = (lote.usuario_id, lote.negocio_id)
            if clave not in saldos:
                saldos[clave] = _bloquear_saldo(lote.usuario, lote.negocio)
            saldo = saldos[clave]
            cantidad = lote.cantidad_disponible
            models.MovimientoPuntos.objects.create(
                usuario=lote.usuario,
                negocio=lote.negocio,
                lote=lote,
                tipo='expirado',
                cantidad=-cantidad,
                descripcion='Expiración automática del lote.',
            )
            lote.cantidad_disponible = 0
            lote.save(update_fields=['cantidad_disponible'])
            saldo.saldo_actual = max(0, saldo.saldo_actual - cantidad)
            saldo.save(update_fields=['saldo_actual', 'fecha_actualizacion'])
            total += cantidad
    return total


def otorgar_puntos(
    *, usuario, negocio, cantidad, origen, referencia=None,
    fecha_expiracion=None, creado_por=None, dinamica=None,
    tipo_movimiento='otorgado', descripcion='', ahora=None,
):
    """Crea un lote y su movimiento de otorgamiento en una transacción."""
    cantidad = int(cantidad)
    if cantidad <= 0:
        raise ValueError('La cantidad de puntos debe ser mayor que cero.')
    ahora = ahora or ahora_utc()
    with transaction.atomic():
        saldo = _bloquear_saldo(usuario, negocio)
        lote = models.LotePuntos.objects.create(
            usuario=usuario,
            negocio=negocio,
            dinamica=dinamica,
            origen=origen,
            cantidad_otorgada=cantidad,
            cantidad_disponible=cantidad,
            fecha_otorgamiento=ahora,
            fecha_expiracion=fecha_expiracion,
            referencia=referencia,
            creado_por=creado_por,
        )
        models.MovimientoPuntos.objects.create(
            usuario=usuario,
            negocio=negocio,
            lote=lote,
            tipo=tipo_movimiento,
            cantidad=cantidad,
            referencia=referencia,
            descripcion=descripcion or 'Puntos otorgados.',
            creado_por=creado_por,
        )
        saldo.saldo_actual = F('saldo_actual') + cantidad
        saldo.save(update_fields=['saldo_actual', 'fecha_actualizacion'])
    lote.refresh_from_db()
    return lote


def consumir_puntos(
    *, usuario, negocio, cantidad, referencia, cupon=None,
    tipo_movimiento='consumido', descripcion='', creado_por=None, ahora=None,
):
    """Consume puntos FIFO por expiración más próxima y registra cada lote."""
    cantidad = int(cantidad)
    if cantidad <= 0:
        raise ValueError('La cantidad de puntos debe ser mayor que cero.')
    ahora = ahora or ahora_utc()
    with transaction.atomic():
        saldo = _bloquear_saldo(usuario, negocio)
        expirar_puntos(usuario=usuario, negocio=negocio, ahora=ahora)
        saldo.refresh_from_db()
        if saldo.saldo_actual < cantidad:
            raise PuntosInsuficientes(
                f'Saldo insuficiente: disponible {saldo.saldo_actual}, requerido {cantidad}.'
            )
        lotes = models.LotePuntos.objects.select_for_update().filter(
            usuario=usuario,
            negocio=negocio,
            cantidad_disponible__gt=0,
        ).exclude(
            fecha_expiracion__isnull=False,
            fecha_expiracion__lte=ahora,
        ).order_by(
            F('fecha_expiracion').asc(nulls_last=True),
            'fecha_otorgamiento',
            'id',
        )
        restante = cantidad
        movimientos = []
        for lote in lotes:
            if restante <= 0:
                break
            tomar = min(lote.cantidad_disponible, restante)
            lote.cantidad_disponible -= tomar
            lote.save(update_fields=['cantidad_disponible'])
            movimientos.append(models.MovimientoPuntos.objects.create(
                usuario=usuario,
                negocio=negocio,
                lote=lote,
                cupon=cupon,
                tipo=tipo_movimiento,
                cantidad=-tomar,
                referencia=referencia,
                descripcion=descripcion or 'Puntos consumidos.',
                creado_por=creado_por,
            ))
            restante -= tomar
        if restante > 0:
            raise PuntosInsuficientes(
                f'Saldo insuficiente: faltaron {restante} puntos.'
            )
        saldo.saldo_actual = F('saldo_actual') - cantidad
        saldo.save(update_fields=['saldo_actual', 'fecha_actualizacion'])
    return movimientos


def ajustar_puntos(
    *, usuario, negocio, cantidad, motivo, creado_por, clave_idempotencia, ahora=None,
):
    """Ajuste administrativo auditado. No permite saldos negativos."""
    cantidad = int(cantidad)
    if cantidad == 0:
        raise ValueError('El ajuste no puede ser cero.')
    if not motivo or not motivo.strip():
        raise ValueError('El motivo del ajuste es obligatorio.')

    if models.CuponUsuario.objects.filter(
        usuario=usuario, clave_idempotencia=clave_idempotencia,
    ).exists():
        raise ConflictoIdempotencia(
            'La clave de idempotencia ya se usó para otra operación.'
        )

    previos = models.MovimientoPuntos.objects.filter(
        usuario=usuario, referencia=clave_idempotencia,
    )
    if previos.exists():
        total = sum(mov.cantidad for mov in previos)
        if total == cantidad and all(mov.negocio_id == negocio.pk for mov in previos):
            return list(previos)
        raise ConflictoIdempotencia(
            'La clave de idempotencia ya se usó con otros parámetros.'
        )

    if cantidad > 0:
        lote = otorgar_puntos(
            usuario=usuario,
            negocio=negocio,
            cantidad=cantidad,
            origen='ajuste',
            referencia=clave_idempotencia,
            creado_por=creado_por,
            tipo_movimiento='ajuste',
            descripcion=motivo,
            ahora=ahora,
        )
        return [models.MovimientoPuntos.objects.get(
            lote=lote, referencia=clave_idempotencia, tipo='ajuste',
        )]

    try:
        with transaction.atomic():
            return consumir_puntos(
                usuario=usuario,
                negocio=negocio,
                cantidad=abs(cantidad),
                referencia=clave_idempotencia,
                tipo_movimiento='ajuste',
                descripcion=motivo,
                creado_por=creado_por,
                ahora=ahora,
            )
    except PuntosInsuficientes:
        raise SaldoNegativo('El ajuste dejaría un saldo negativo.') from None


def saldo_actual(usuario, negocio, ahora=None):
    """Devuelve el saldo disponible, expirando antes los lotes vencidos."""
    expirar_puntos(usuario=usuario, negocio=negocio, ahora=ahora)
    saldo = models.SaldoPuntos.objects.filter(usuario=usuario, negocio=negocio).first()
    return saldo.saldo_actual if saldo else 0


def lotes_disponibles(usuario, negocio, ahora=None):
    """Lotes con saldo disponible y no vencidos."""
    ahora = ahora or ahora_utc()
    return models.LotePuntos.objects.filter(
        usuario=usuario,
        negocio=negocio,
        cantidad_disponible__gt=0,
    ).exclude(
        fecha_expiracion__isnull=False,
        fecha_expiracion__lte=ahora,
    ).order_by(
        F('fecha_expiracion').asc(nulls_last=True),
        'fecha_otorgamiento',
        'id',
    )


def verificar_saldos():
    """Compara la caché de saldo con la suma de lotes disponibles."""
    diferencias = []
    for saldo in models.SaldoPuntos.objects.select_related('usuario', 'negocio'):
        disponible = models.LotePuntos.objects.filter(
            usuario=saldo.usuario,
            negocio=saldo.negocio,
        ).aggregate(total=Sum('cantidad_disponible'))['total'] or 0
        if disponible != saldo.saldo_actual:
            diferencias.append({
                'usuario': saldo.usuario_id,
                'negocio': saldo.negocio_id,
                'saldo': saldo.saldo_actual,
                'lotes': disponible,
            })
    return diferencias
