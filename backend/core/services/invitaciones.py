"""Invitaciones seguras a membresías comerciales."""

from datetime import timedelta

from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from django.utils import timezone

from core import models
from core.services import membresias, planes


class ErrorInvitacion(Exception):
    def __init__(self, codigo, detalle, status_code=400):
        super().__init__(detalle)
        self.codigo = codigo
        self.detalle = detalle
        self.status_code = status_code


def _validar_combinacion(negocio, sucursal, rol):
    if rol not in dict(models.ROLES_COMERCIO):
        raise ErrorInvitacion('rol_invalido', 'El rol comercial no es válido.')
    if rol == 'dueno':
        if sucursal is not None:
            raise ErrorInvitacion(
                'sucursal_invalida',
                'El propietario no debe tener una sucursal asignada.',
            )
        return
    if sucursal is None:
        raise ErrorInvitacion(
            'sucursal_requerida',
            'El supervisor y el empleado requieren una sucursal.',
        )
    if sucursal.negocio_id != negocio.pk:
        raise ErrorInvitacion(
            'sucursal_invalida',
            'La sucursal no pertenece al negocio indicado.',
        )
    if not sucursal.status:
        raise ErrorInvitacion(
            'sucursal_inactiva', 'La sucursal está inactiva.'
        )


def _recurso(rol):
    return {'supervisor': 'supervisores', 'empleado': 'empleados'}.get(rol)


def _normalizar_correo(correo):
    correo = str(correo or '').strip().lower()
    try:
        validate_email(correo)
    except DjangoValidationError:
        raise ErrorInvitacion(
            'correo_invalido', 'Ingresa un correo electrónico válido.'
        ) from None
    return correo


def crear_invitacion(
    *, negocio, correo, sucursal, rol_comercio, actor, motivo='', dias=7,
):
    correo = _normalizar_correo(correo)
    _validar_combinacion(negocio, sucursal, rol_comercio)
    if not negocio.status:
        raise ErrorInvitacion(
            'negocio_inactivo', 'El negocio está inactivo.', status_code=403,
        )

    existente = models.UsuarioNegocio.objects.filter(
        usuario__correo__iexact=correo,
        negocio=negocio,
        sucursal=sucursal,
        status=True,
    )
    if existente.exists():
        raise ErrorInvitacion(
            'miembro_existente',
            'Ese correo ya tiene una membresía activa en esta ubicación.',
            status_code=409,
        )

    if rol_comercio == 'dueno':
        invitado = models.Usuario.objects.filter(correo__iexact=correo).first()
        if invitado is not None:
            propiedad = membresias.propietario_activo(invitado)
            if propiedad is not None and propiedad.negocio_id != negocio.pk:
                raise ErrorInvitacion(
                    'propietario_unico',
                    membresias.MENSAJE_PROPIETARIO_UNICO,
                    status_code=409,
                )

    if models.InvitacionMembresia.objects.filter(
        negocio=negocio,
        correo=correo,
        sucursal=sucursal,
        rol_comercio=rol_comercio,
        estado='pendiente',
    ).exists():
        raise ErrorInvitacion(
            'invitacion_pendiente',
            'Ya existe una invitación pendiente para ese correo.',
            status_code=409,
        )

    recurso = _recurso(rol_comercio)
    if recurso is not None and not planes.puede_crear(negocio, recurso):
        raise ErrorInvitacion(
            'limite_plan',
            f'El plan actual no permite invitar más {planes.NOMBRES_RECURSOS[recurso]}.',
            status_code=403,
        )

    try:
        with transaction.atomic():
            return models.InvitacionMembresia.objects.create(
                negocio=negocio,
                sucursal=sucursal,
                rol_comercio=rol_comercio,
                correo=correo,
                creada_por=actor,
                creada_por_correo=getattr(actor, 'correo', '') or '',
                motivo=motivo or '',
                fecha_expiracion=timezone.now() + timedelta(days=dias),
            )
    except IntegrityError:
        raise ErrorInvitacion(
            'invitacion_pendiente',
            'Ya existe una invitación pendiente para ese correo.',
            status_code=409,
        ) from None


def aceptar_invitacion(*, token, usuario):
    with transaction.atomic():
        try:
            invitacion = models.InvitacionMembresia.objects.select_for_update(
                of=('self',),
            ).select_related('negocio', 'sucursal').get(token=token)
        except models.InvitacionMembresia.DoesNotExist:
            raise ErrorInvitacion(
                'invitacion_no_encontrada', 'La invitación no existe.',
                status_code=404,
            ) from None

        if invitacion.estado == 'aceptada':
            if invitacion.aceptada_por_id == usuario.pk:
                membresia = models.UsuarioNegocio.objects.filter(
                    usuario=usuario,
                    negocio=invitacion.negocio,
                    sucursal=invitacion.sucursal,
                ).first()
                if membresia is not None:
                    return membresia
            raise ErrorInvitacion(
                'invitacion_usada', 'La invitación ya fue utilizada.',
                status_code=409,
            )
        if invitacion.estado != 'pendiente':
            raise ErrorInvitacion(
                'invitacion_no_disponible',
                'La invitación fue revocada o expiró.',
                status_code=409,
            )
        if invitacion.fecha_expiracion < timezone.now():
            invitacion.estado = 'expirada'
            invitacion.fecha_respuesta = timezone.now()
            invitacion.save(update_fields=[
                'estado', 'fecha_respuesta',
            ])
            raise ErrorInvitacion(
                'invitacion_expirada', 'La invitación expiró.',
                status_code=409,
            )
        if usuario.correo.lower() != invitacion.correo.lower():
            raise ErrorInvitacion(
                'correo_no_coincide',
                'La invitación pertenece a otro correo electrónico.',
                status_code=403,
            )
        if not invitacion.negocio.status:
            raise ErrorInvitacion(
                'negocio_inactivo', 'El negocio está inactivo.',
                status_code=403,
            )

        recurso = _recurso(invitacion.rol_comercio)
        if recurso is not None:
            planes.verificar_capacidad(invitacion.negocio, recurso)

        existente = models.UsuarioNegocio.objects.filter(
            usuario=usuario,
            negocio=invitacion.negocio,
            sucursal=invitacion.sucursal,
            status=True,
        ).first()
        if existente is not None:
            membresia = existente
        else:
            try:
                membresia = membresias.crear_membresia(
                    usuario=usuario,
                    negocio=invitacion.negocio,
                    sucursal=invitacion.sucursal,
                    rol_comercio=invitacion.rol_comercio,
                    actor=usuario,
                    motivo=f'Aceptación de invitación {invitacion.pk}.',
                )
            except membresias.ErrorMembresia as exc:
                raise ErrorInvitacion(
                    'membresia_invalida', str(exc), status_code=409,
                ) from None

        invitacion.estado = 'aceptada'
        invitacion.aceptada_por = usuario
        invitacion.fecha_respuesta = timezone.now()
        invitacion.save(update_fields=[
            'estado', 'aceptada_por', 'fecha_respuesta',
        ])
        return membresia


def revocar_invitacion(*, invitacion):
    with transaction.atomic():
        invitacion = models.InvitacionMembresia.objects.select_for_update().get(
            pk=invitacion.pk,
        )
        if invitacion.estado != 'pendiente':
            raise ErrorInvitacion(
                'invitacion_no_disponible',
                'Solo se pueden revocar invitaciones pendientes.',
                status_code=409,
            )
        invitacion.estado = 'revocada'
        invitacion.fecha_respuesta = timezone.now()
        invitacion.save(update_fields=['estado', 'fecha_respuesta'])
        return invitacion
