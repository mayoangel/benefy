"""Registro de visitas por QR y anulación administrativa."""

import uuid
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone

from core import models
from core.services.lealtad import puntos, tarjetas
from core.services.lealtad.errores import (
    NegocioInactivo,
    QRInvalido,
    SoloConsumidores,
)
from core.utils.tiempo import ahora_utc, fecha_negocio


def resolver_qr(qr_uuid):
    """Devuelve (negocio, sucursal) para un QR de sucursal o de negocio."""
    try:
        qr_uuid = uuid.UUID(str(qr_uuid))
    except (TypeError, ValueError, AttributeError):
        raise QRInvalido('El código QR no es válido.')

    sucursal = models.Sucursal.objects.select_related('negocio').filter(
        qr_uuid=qr_uuid,
    ).first()
    if sucursal is not None:
        return sucursal.negocio, sucursal

    negocio = models.Negocio.objects.filter(qr_uuid=qr_uuid).first()
    if negocio is not None:
        return negocio, None
    raise QRInvalido('El código QR no corresponde a ningún negocio.')


def registrar_visita(*, usuario, qr_uuid, metodo_validacion='qr', ahora=None):
    """Registra una visita válida y aplica puntos y tarjetas una sola vez al día."""
    if usuario.rol != 'consumidor':
        raise SoloConsumidores('Solo los consumidores pueden registrar visitas.')
    ahora = ahora or ahora_utc()
    negocio, sucursal = resolver_qr(qr_uuid)

    if not negocio.status:
        raise NegocioInactivo('El negocio está inactivo.')
    if sucursal is not None and not sucursal.status:
        raise NegocioInactivo('La sucursal está inactiva.')

    fecha = fecha_negocio(negocio, ahora)

    with transaction.atomic():
        existente = models.RegistroActividad.objects.filter(
            usuario=usuario,
            negocio=negocio,
            fecha_negocio=fecha,
            tipo='visita',
        ).order_by('fecha', 'id').first()
        if existente is not None:
            return {
                'visita': existente,
                'already_registered': True,
                'puntos_otorgados': 0,
                'tarjetas': [],
                'cupones_emitidos': [],
            }

        try:
            with transaction.atomic():
                visita = models.RegistroActividad.objects.create(
                    usuario=usuario,
                    negocio=negocio,
                    sucursal=sucursal,
                    metodo_validacion=metodo_validacion,
                    tipo='visita',
                    fecha_negocio=fecha,
                    es_valida=True,
                )
        except IntegrityError:
            existente = models.RegistroActividad.objects.filter(
                usuario=usuario,
                negocio=negocio,
                fecha_negocio=fecha,
                tipo='visita',
            ).order_by('fecha', 'id').first()
            return {
                'visita': existente,
                'already_registered': True,
                'puntos_otorgados': 0,
                'tarjetas': [],
                'cupones_emitidos': [],
            }

        puntos_otorgados = 0
        dinamica = models.Dinamica.objects.filter(
            negocio=negocio,
            tipo='puntos',
            status=True,
            fecha_inicio__lte=ahora,
        ).filter(
            Q(fecha_fin__isnull=True) | Q(fecha_fin__gte=ahora),
        ).order_by('-fecha_registro').first()
        if dinamica is not None:
            cantidad = int(dinamica.regla_conversion or 0)
            if cantidad > 0:
                expiracion = None
                if dinamica.dias_expiracion_puntos:
                    expiracion = ahora + timedelta(days=dinamica.dias_expiracion_puntos)
                puntos.otorgar_puntos(
                    usuario=usuario,
                    negocio=negocio,
                    cantidad=cantidad,
                    origen='visita',
                    referencia=f'visita:{visita.pk}',
                    fecha_expiracion=expiracion,
                    dinamica=dinamica,
                    descripcion=f'Visita en {negocio.nombre}.',
                    ahora=ahora,
                )
                puntos_otorgados = cantidad

        resultados_tarjetas = tarjetas.avanzar_tarjetas(
            usuario=usuario, negocio=negocio, ahora=ahora,
        )
        cupones = [r['cupon'] for r in resultados_tarjetas if r['cupon']]

        return {
            'visita': visita,
            'already_registered': False,
            'puntos_otorgados': puntos_otorgados,
            'tarjetas': resultados_tarjetas,
            'cupones_emitidos': cupones,
        }


def anular_visita(*, visita_id, motivo, administrador, ahora=None):
    """Anula una visita conservando el registro y la auditoría."""
    ahora = ahora or timezone.now()
    if not motivo or not motivo.strip():
        raise ValueError('El motivo de la anulación es obligatorio.')
    with transaction.atomic():
        visita = models.RegistroActividad.objects.select_for_update().get(pk=visita_id)
        if visita.tipo != 'visita':
            raise ValueError('Solo se pueden anular registros de tipo visita.')
        if not visita.es_valida:
            return visita
        visita.es_valida = False
        visita.anulada_en = ahora
        visita.anulada_por = administrador
        visita.motivo_anulacion = motivo
        visita.save(update_fields=[
            'es_valida', 'anulada_en', 'anulada_por', 'motivo_anulacion',
        ])
        return visita
