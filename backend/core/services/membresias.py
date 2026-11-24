"""Altas, cambios y bajas auditadas de membresías de negocio."""

from django.db import IntegrityError, transaction
from django.utils import timezone

from core import models


class ErrorMembresia(Exception):
    """Error de dominio al gestionar una membresía."""


def _snapshot(membresia):
    return {
        'usuario': membresia.usuario_id,
        'negocio': membresia.negocio_id,
        'sucursal': membresia.sucursal_id,
        'rol_comercio': membresia.rol_comercio,
        'status': membresia.status,
    }


def _auditar(*, membresia, accion, actor=None, anteriores=None, nuevos=None, motivo=''):
    models.AuditoriaMembresia.objects.create(
        membresia=membresia,
        usuario=membresia.usuario,
        usuario_correo=membresia.usuario.correo,
        negocio=membresia.negocio,
        negocio_nombre=membresia.negocio.nombre,
        sucursal=membresia.sucursal,
        sucursal_nombre=membresia.sucursal.nombre if membresia.sucursal_id else '',
        rol_comercio=membresia.rol_comercio,
        accion=accion,
        datos_anteriores=anteriores,
        datos_nuevos=nuevos,
        motivo=motivo or None,
        actor=actor,
        actor_correo=actor.correo if actor is not None else '',
    )


def _validar_combinacion(negocio, sucursal, rol_comercio):
    roles = dict(models.ROLES_COMERCIO)
    if rol_comercio not in roles:
        raise ErrorMembresia('El rol comercial no es válido.')
    if rol_comercio == 'dueno':
        if sucursal is not None:
            raise ErrorMembresia('El dueño no debe tener una sucursal asignada.')
        return
    if sucursal is None:
        raise ErrorMembresia('El supervisor y el empleado requieren una sucursal.')
    if sucursal.negocio_id != negocio.pk:
        raise ErrorMembresia('La sucursal no pertenece al negocio indicado.')


def _validar_propietario_restante(membresia):
    if not (
        membresia.rol_comercio == 'dueno'
        and membresia.sucursal_id is None
        and membresia.status
    ):
        return
    otros = models.UsuarioNegocio.objects.filter(
        negocio=membresia.negocio,
        rol_comercio='dueno',
        sucursal__isnull=True,
        status=True,
    ).exclude(pk=membresia.pk)
    if not otros.exists():
        raise ErrorMembresia(
            'El negocio debe conservar al menos un propietario activo.'
        )


def _buscar_existente(usuario, negocio, sucursal):
    filtro = models.UsuarioNegocio.objects.select_for_update().filter(
        usuario=usuario, negocio=negocio,
    )
    if sucursal is None:
        return filtro.filter(sucursal__isnull=True).first()
    return filtro.filter(sucursal=sucursal).first()


def crear_membresia(
    *, usuario, negocio, sucursal=None, rol_comercio='empleado',
    actor=None, motivo='',
):
    """Crea o reactiva una membresía y deja auditoría de la operación."""
    _validar_combinacion(negocio, sucursal, rol_comercio)
    try:
        with transaction.atomic():
            existente = _buscar_existente(usuario, negocio, sucursal)
            if existente is not None:
                if existente.status:
                    raise ErrorMembresia('La membresía ya existe y está activa.')
                anteriores = _snapshot(existente)
                existente.rol_comercio = rol_comercio
                existente.status = True
                existente.fecha_baja = None
                existente.baja_por = None
                existente.motivo_baja = None
                existente.save(update_fields=[
                    'rol_comercio', 'status', 'fecha_baja', 'baja_por',
                    'motivo_baja', 'fecha_actualizacion',
                ])
                _auditar(
                    membresia=existente,
                    accion='reactivacion',
                    actor=actor,
                    anteriores=anteriores,
                    nuevos=_snapshot(existente),
                    motivo=motivo or 'Reactivación de membresía.',
                )
                return existente

            membresia = models.UsuarioNegocio.objects.create(
                usuario=usuario,
                negocio=negocio,
                sucursal=sucursal,
                rol_comercio=rol_comercio,
                status=True,
            )
            _auditar(
                membresia=membresia,
                accion='alta',
                actor=actor,
                anteriores=None,
                nuevos=_snapshot(membresia),
                motivo=motivo or 'Alta de membresía.',
            )
            return membresia
    except IntegrityError:
        raise ErrorMembresia(
            'Ya existe una membresía para ese usuario, negocio y sucursal.'
        ) from None


def actualizar_membresia(*, membresia, cambios, actor=None, motivo=''):
    """Actualiza una membresía existente y audita el estado anterior y nuevo."""
    with transaction.atomic():
        membresia = models.UsuarioNegocio.objects.select_for_update(
            of=('self',),
        ).select_related(
            'usuario', 'negocio', 'sucursal',
        ).get(pk=membresia.pk)
        anteriores = _snapshot(membresia)

        nueva_sucursal = cambios.get('sucursal', membresia.sucursal)
        nuevo_rol = cambios.get('rol_comercio', membresia.rol_comercio)
        nuevo_status = cambios.get('status', membresia.status)
        nuevo_negocio = cambios.get('negocio', membresia.negocio)
        _validar_combinacion(nuevo_negocio, nueva_sucursal, nuevo_rol)
        era_dueno_activo = (
            membresia.rol_comercio == 'dueno'
            and membresia.sucursal_id is None
            and membresia.status
        )
        sigue_dueno_activo = (
            nuevo_rol == 'dueno'
            and nueva_sucursal is None
            and nuevo_status
            and nuevo_negocio.pk == membresia.negocio_id
        )
        if era_dueno_activo and not sigue_dueno_activo:
            _validar_propietario_restante(membresia)

        conflicto = models.UsuarioNegocio.objects.filter(
            usuario=cambios.get('usuario', membresia.usuario),
            negocio=nuevo_negocio,
            sucursal=nueva_sucursal,
        ).exclude(pk=membresia.pk)
        if conflicto.exists():
            raise ErrorMembresia(
                'Ya existe una membresía para ese usuario, negocio y sucursal.'
            )

        if 'usuario' in cambios:
            membresia.usuario = cambios['usuario']
        if 'negocio' in cambios:
            membresia.negocio = cambios['negocio']
        membresia.sucursal = nueva_sucursal
        membresia.rol_comercio = nuevo_rol
        if not nuevo_status and membresia.status:
            membresia.status = False
            membresia.fecha_baja = timezone.now()
            membresia.baja_por = actor
            membresia.motivo_baja = motivo or 'Baja de membresía.'
            accion = 'baja'
        elif nuevo_status and not membresia.status:
            membresia.status = True
            membresia.fecha_baja = None
            membresia.baja_por = None
            membresia.motivo_baja = None
            accion = 'reactivacion'
        else:
            membresia.status = nuevo_status
            accion = 'modificacion'

        try:
            membresia.save()
        except IntegrityError:
            raise ErrorMembresia(
                'Ya existe una membresía para ese usuario, negocio y sucursal.'
            ) from None

        _auditar(
            membresia=membresia,
            accion=accion,
            actor=actor,
            anteriores=anteriores,
            nuevos=_snapshot(membresia),
            motivo=motivo,
        )
        return membresia


def desactivar_membresia(
    *, membresia, actor=None, motivo='', validar_propietario=True,
):
    """Baja lógica de la membresía; conserva el registro y su auditoría."""
    with transaction.atomic():
        membresia = models.UsuarioNegocio.objects.select_for_update(
            of=('self',),
        ).select_related(
            'usuario', 'negocio', 'sucursal',
        ).get(pk=membresia.pk)
        if not membresia.status:
            return membresia
        if validar_propietario:
            _validar_propietario_restante(membresia)
        anteriores = _snapshot(membresia)
        membresia.status = False
        membresia.fecha_baja = timezone.now()
        membresia.baja_por = actor
        membresia.motivo_baja = motivo or 'Baja de membresía.'
        membresia.save(update_fields=[
            'status', 'fecha_baja', 'baja_por', 'motivo_baja',
            'fecha_actualizacion',
        ])
        _auditar(
            membresia=membresia,
            accion='baja',
            actor=actor,
            anteriores=anteriores,
            nuevos=_snapshot(membresia),
            motivo=motivo or 'Baja de membresía.',
        )
        return membresia
