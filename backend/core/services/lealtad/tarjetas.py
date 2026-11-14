"""Ciclos de tarjetas de visitas y emisión de la recompensa meta."""

import logging
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.db.models import Q

from core import models
from core.services.lealtad.errores import ConfiguracionInvalida, ErrorLealtad, RecompensaVencida
from core.utils.tiempo import ahora_utc

logger = logging.getLogger(__name__)


def _recompensa_meta(dinamica):
    return models.Recompensa.objects.filter(dinamica=dinamica, es_meta=True).first()


def _snapshot(ciclo, recompensa):
    ciclo.recompensa = recompensa
    ciclo.recompensa_titulo = recompensa.titulo
    ciclo.recompensa_descripcion = recompensa.descripcion
    ciclo.recompensa_tipo = recompensa.tipo
    ciclo.recompensa_descuento = recompensa.descuento
    ciclo.recompensa_condiciones = recompensa.terminos_condiciones
    ciclo.recompensa_vigencia_dias = recompensa.vigencia_dias
    ciclo.recompensa_fecha_expiracion = recompensa.fecha_expiracion


def _crear_ciclo(*, usuario, dinamica, numero, ahora):
    recompensa = _recompensa_meta(dinamica)
    if not recompensa:
        raise ConfiguracionInvalida(
            f'La tarjeta "{dinamica.nombre}" no tiene una recompensa meta configurada.'
        )
    if not dinamica.meta or dinamica.meta <= 0:
        raise ConfiguracionInvalida(
            f'La tarjeta "{dinamica.nombre}" no tiene una meta válida.'
        )
    ciclo = models.CicloTarjeta(
        usuario=usuario,
        dinamica=dinamica,
        negocio=dinamica.negocio,
        numero_ciclo=numero,
        sellos_actuales=0,
        meta=dinamica.meta,
        estado='en_curso',
        fecha_inicio=ahora,
    )
    _snapshot(ciclo, recompensa)
    ciclo.save()
    return ciclo


def _obtener_o_crear_ciclo(*, usuario, dinamica, ahora):
    ciclo = models.CicloTarjeta.objects.select_for_update().filter(
        usuario=usuario, dinamica=dinamica, estado='en_curso',
    ).first()
    if ciclo:
        return ciclo
    ultimo = models.CicloTarjeta.objects.filter(
        usuario=usuario, dinamica=dinamica,
    ).order_by('-numero_ciclo').values_list('numero_ciclo', flat=True).first()
    try:
        with transaction.atomic():
            return _crear_ciclo(
                usuario=usuario,
                dinamica=dinamica,
                numero=(ultimo or 0) + 1,
                ahora=ahora,
            )
    except IntegrityError:
        return models.CicloTarjeta.objects.select_for_update().get(
            usuario=usuario, dinamica=dinamica, estado='en_curso',
        )


def emitir_cupon_meta(ciclo, ahora=None):
    """Emite una sola vez el cupón de la recompensa meta del ciclo."""
    ahora = ahora or ahora_utc()
    if ciclo.cupon_id:
        return ciclo.cupon
    if ciclo.estado != 'completado':
        raise ConfiguracionInvalida('Solo un ciclo completado puede emitir su recompensa.')
    if ciclo.recompensa_vigencia_dias:
        expiracion = ahora + timedelta(days=ciclo.recompensa_vigencia_dias)
    elif ciclo.recompensa_fecha_expiracion:
        expiracion = ciclo.recompensa_fecha_expiracion
    else:
        raise ConfiguracionInvalida(
            'La recompensa meta no tiene una vigencia configurada.'
        )
    if expiracion <= ahora:
        raise RecompensaVencida('La recompensa meta ya venció.')

    cupon = models.CuponUsuario.objects.create(
        usuario=ciclo.usuario,
        recompensa=ciclo.recompensa,
        negocio=ciclo.negocio,
        origen='meta',
        status='disponible',
        fecha_expiracion=expiracion,
        titulo_beneficio=ciclo.recompensa_titulo,
        descripcion_beneficio=ciclo.recompensa_descripcion,
        tipo_beneficio=ciclo.recompensa_tipo,
        descuento_beneficio=ciclo.recompensa_descuento,
        condiciones_beneficio=ciclo.recompensa_condiciones,
        costo_pagado=0,
    )
    ciclo.cupon = cupon
    ciclo.save(update_fields=['cupon'])
    return cupon


def _esta_vigente(dinamica, ahora):
    if not dinamica.status:
        return False
    if dinamica.fecha_inicio and dinamica.fecha_inicio > ahora:
        return False
    if dinamica.fecha_fin and dinamica.fecha_fin < ahora:
        return False
    return True


def avanzar_tarjetas(*, usuario, negocio, ahora=None):
    """Avanza un sello en cada tarjeta elegible y completa las que llegan a la meta."""
    ahora = ahora or ahora_utc()
    resultados = []
    with transaction.atomic():
        vigentes = models.Dinamica.objects.filter(
            negocio=negocio,
            tipo='sellos',
            status=True,
            fecha_inicio__lte=ahora,
        ).filter(
            Q(fecha_fin__isnull=True) | Q(fecha_fin__gte=ahora),
        )
        con_ciclo = models.Dinamica.objects.filter(
            negocio=negocio,
            tipo='sellos',
            ciclotarjeta__usuario=usuario,
            ciclotarjeta__estado='en_curso',
        )
        dinamicas = (vigentes | con_ciclo).distinct().select_related('negocio')

        for dinamica in dinamicas:
            try:
                with transaction.atomic():
                    ciclo = models.CicloTarjeta.objects.select_for_update().filter(
                        usuario=usuario, dinamica=dinamica, estado='en_curso',
                    ).first()
                    if ciclo is None:
                        if not _esta_vigente(dinamica, ahora):
                            continue
                        ciclo = _obtener_o_crear_ciclo(
                            usuario=usuario, dinamica=dinamica, ahora=ahora,
                        )

                    if ciclo.sellos_actuales >= ciclo.meta:
                        continue

                    ciclo.sellos_actuales += 1
                    completado = ciclo.sellos_actuales >= ciclo.meta
                    campos = ['sellos_actuales']
                    cupon = None
                    if completado:
                        ciclo.estado = 'completado'
                        ciclo.fecha_fin = ahora
                        campos += ['estado', 'fecha_fin']
                    ciclo.save(update_fields=campos)

                    if completado:
                        cupon = emitir_cupon_meta(ciclo, ahora=ahora)
                        if dinamica.es_repetible and _esta_vigente(dinamica, ahora):
                            _crear_ciclo(
                                usuario=usuario,
                                dinamica=dinamica,
                                numero=ciclo.numero_ciclo + 1,
                                ahora=ahora,
                            )

                    resultados.append({
                        'dinamica': dinamica.pk,
                        'ciclo': ciclo.pk,
                        'numero_ciclo': ciclo.numero_ciclo,
                        'sellos_actuales': ciclo.sellos_actuales,
                        'meta': ciclo.meta,
                        'completado': completado,
                        'cupon': cupon.uuid if cupon else None,
                    })
            except ErrorLealtad:
                # Una tarjeta mal configurada no debe impedir la visita ni los puntos.
                logger.warning(
                    'No se pudo avanzar la tarjeta %s para el usuario %s.',
                    dinamica.pk, usuario.pk, exc_info=True,
                )
                continue
    return resultados
