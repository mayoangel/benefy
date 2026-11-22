"""Adquisición y canje de cupones."""

import uuid
from datetime import timedelta

from django.conf import settings
from django.db import IntegrityError, transaction

from core import models
from core.services.lealtad import puntos
from core.services.lealtad.errores import (
    AlianzaVencida,
    ConflictoIdempotencia,
    ConfiguracionInvalida,
    CuponAjeno,
    CuponNoDisponible,
    CuponNoEncontrado,
    IdempotenciaInvalida,
    NegocioInactivo,
    RecompensaInactiva,
    RecompensaVencida,
    SinStock,
)
from core.utils.tiempo import ahora_utc


def _normalizar_clave(clave):
    try:
        return str(uuid.UUID(str(clave)))
    except (TypeError, ValueError, AttributeError):
        raise IdempotenciaInvalida('La clave de idempotencia no es un UUID válido.')


def _validar_recompensa(recompensa, ahora):
    if not recompensa.status:
        raise RecompensaInactiva('La recompensa no está disponible en el catálogo.')
    if recompensa.negocio_id and not recompensa.negocio.status:
        raise NegocioInactivo('El negocio de la recompensa está inactivo.')
    if recompensa.dinamica_id:
        dinamica = recompensa.dinamica
        if not dinamica.status:
            raise RecompensaInactiva('La dinámica de la recompensa está inactiva.')
        if dinamica.fecha_inicio and dinamica.fecha_inicio > ahora:
            raise RecompensaVencida('La dinámica de la recompensa aún no inicia.')
        if dinamica.fecha_fin and dinamica.fecha_fin < ahora:
            raise RecompensaVencida('La dinámica de la recompensa ya finalizó.')
    if recompensa.alianza_id:
        alianza = recompensa.alianza
        if alianza.status != 'activa' or alianza.fecha_fin < ahora:
            raise AlianzaVencida('La alianza de la recompensa no está vigente.')
    if recompensa.cantidad_disponible is not None and recompensa.cantidad_disponible <= 0:
        raise SinStock('La recompensa no tiene existencias disponibles.')


def _calcular_expiracion(recompensa, ahora):
    if recompensa.vigencia_dias:
        expiracion = ahora + timedelta(days=recompensa.vigencia_dias)
    elif recompensa.fecha_expiracion:
        expiracion = recompensa.fecha_expiracion
    else:
        raise ConfiguracionInvalida(
            'La recompensa no tiene una fecha o duración de vigencia configurada.'
        )
    if recompensa.dinamica_id and recompensa.dinamica.fecha_fin:
        expiracion = min(expiracion, recompensa.dinamica.fecha_fin)
    if recompensa.alianza_id:
        expiracion = min(expiracion, recompensa.alianza.fecha_fin)
    if expiracion <= ahora:
        raise RecompensaVencida('La vigencia de la recompensa ya terminó.')
    return expiracion


def _buscar_por_idempotencia(usuario, clave):
    return models.CuponUsuario.objects.select_related('recompensa').filter(
        usuario=usuario, clave_idempotencia=clave,
    ).first()


def adquirir_cupon(*, usuario, recompensa_id, clave_idempotencia, ahora=None):
    """Adquiere un cupón de forma atómica y con idempotencia por usuario."""
    ahora = ahora or ahora_utc()
    clave = _normalizar_clave(clave_idempotencia)

    if models.MovimientoPuntos.objects.filter(
        usuario=usuario, referencia=clave,
    ).exists():
        raise ConflictoIdempotencia(
            'La clave de idempotencia ya se usó para otra operación.'
        )

    existente = _buscar_por_idempotencia(usuario, clave)
    if existente:
        if existente.recompensa_id != int(recompensa_id):
            raise ConflictoIdempotencia(
                'La clave de idempotencia ya se usó para otra recompensa.'
            )
        return existente, False

    try:
        with transaction.atomic():
            recompensa = models.Recompensa.objects.select_for_update(
                of=('self',),
            ).select_related(
                'negocio', 'dinamica', 'alianza',
            ).get(pk=recompensa_id)

            # Segunda comprobación tras el bloqueo: otra petición pudo ganar.
            existente = _buscar_por_idempotencia(usuario, clave)
            if existente:
                if existente.recompensa_id != recompensa.pk:
                    raise ConflictoIdempotencia(
                        'La clave de idempotencia ya se usó para otra recompensa.'
                    )
                return existente, False

            _validar_recompensa(recompensa, ahora)
            expiracion = _calcular_expiracion(recompensa, ahora)
            negocio = recompensa.negocio or (
                recompensa.dinamica.negocio if recompensa.dinamica_id else None
            )
            if negocio is None:
                raise ConfiguracionInvalida('La recompensa no tiene un negocio asociado.')

            if recompensa.cantidad_disponible is not None:
                recompensa.cantidad_disponible -= 1
                recompensa.save(update_fields=['cantidad_disponible'])

            if recompensa.costo_desbloqueo:
                puntos.consumir_puntos(
                    usuario=usuario,
                    negocio=negocio,
                    cantidad=recompensa.costo_desbloqueo,
                    referencia=f'adquisicion:{clave}',
                    descripcion=f'Adquisición de cupón: {recompensa.titulo}',
                    ahora=ahora,
                )

            cupon = models.CuponUsuario.objects.create(
                usuario=usuario,
                recompensa=recompensa,
                negocio=negocio,
                origen='puntos',
                status='disponible',
                fecha_expiracion=expiracion,
                titulo_beneficio=recompensa.titulo,
                descripcion_beneficio=recompensa.descripcion,
                tipo_beneficio=recompensa.tipo,
                descuento_beneficio=recompensa.descuento,
                condiciones_beneficio=recompensa.terminos_condiciones,
                costo_pagado=recompensa.costo_desbloqueo,
                clave_idempotencia=clave,
            )
            return cupon, True
    except IntegrityError:
        existente = _buscar_por_idempotencia(usuario, clave)
        if existente and existente.recompensa_id == int(recompensa_id):
            return existente, False
        raise


def canjear_cupon(*, usuario, cupon_uuid, ahora=None):
    """Canje iniciado por el cliente. Consume el cupón de forma irreversible."""
    ahora = ahora or ahora_utc()
    try:
        cupon_uuid = uuid.UUID(str(cupon_uuid))
    except (TypeError, ValueError, AttributeError):
        raise CuponNoEncontrado('El cupón no existe.')

    try:
        with transaction.atomic():
            cupon = models.CuponUsuario.objects.select_for_update(
                of=('self',),
            ).select_related(
                'recompensa', 'negocio',
            ).filter(uuid=cupon_uuid).first()
            if cupon is None:
                raise CuponNoEncontrado('El cupón no existe.')
            if cupon.usuario_id != usuario.pk:
                raise CuponAjeno('El cupón pertenece a otro usuario.')
            if cupon.status != 'disponible':
                raise CuponNoDisponible('El cupón ya fue utilizado o anulado.')
            if cupon.fecha_expiracion <= ahora:
                raise CuponNoDisponible('El cupón está vencido.')
            if models.Canje.objects.filter(cupon=cupon).exists():
                raise CuponNoDisponible('El cupón ya fue canjeado.')

            token = uuid.uuid4()
            expira_en = ahora + timedelta(seconds=settings.CANJE_VALIDACION_SEGUNDOS)
            canje = models.Canje.objects.create(
                cupon=cupon,
                sucursal=None,
                negocio=cupon.negocio,
                validado_por=None,
                origen='cliente',
                metodo='visual',
                token_validacion=token,
                expira_en=expira_en,
            )
            cupon.status = 'canjeado'
            cupon.save(update_fields=['status'])
            return canje, cupon
    except IntegrityError:
        raise CuponNoDisponible('El cupón ya fue canjeado.') from None


def anular_cupon(*, cupon_uuid, motivo, administrador, ahora=None):
    """Anulación administrativa auditada. No devuelve puntos."""
    ahora = ahora or ahora_utc()
    if not motivo or not motivo.strip():
        raise ConfiguracionInvalida('El motivo de la anulación es obligatorio.')
    try:
        cupon_uuid = uuid.UUID(str(cupon_uuid))
    except (TypeError, ValueError, AttributeError):
        raise CuponNoEncontrado('El cupón no existe.')
    with transaction.atomic():
        cupon = models.CuponUsuario.objects.select_for_update().filter(
            uuid=cupon_uuid,
        ).first()
        if cupon is None:
            raise CuponNoEncontrado('El cupón no existe.')
        if cupon.status == 'anulado':
            return cupon
        cupon.status = 'anulado'
        cupon.anulada_en = ahora
        cupon.anulada_por = administrador
        cupon.motivo_anulacion = motivo
        cupon.save(update_fields=[
            'status', 'anulada_en', 'anulada_por', 'motivo_anulacion',
        ])
        canje = models.Canje.objects.select_for_update().filter(cupon=cupon).first()
        if canje is not None and not canje.anulado:
            canje.anulado = True
            canje.anulado_en = ahora
            canje.anulado_por = administrador
            canje.motivo_anulacion = motivo
            canje.save(update_fields=[
                'anulado', 'anulado_en', 'anulado_por', 'motivo_anulacion',
            ])
        return cupon
