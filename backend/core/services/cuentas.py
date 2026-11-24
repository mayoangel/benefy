"""Baja de cuenta: anonimización, revocación y borrado de identidad Supabase."""

from dataclasses import dataclass
from uuid import uuid4

from django.db import transaction
from django.db.models import F, Q
from django.utils import timezone

from core import models
from core.services import membresias, supabase_admin, supabase_storage

CONFIRMACION_ELIMINACION = 'eliminar mi cuenta'


class ErrorEliminacionCuenta(Exception):
    def __init__(self, codigo, detalle, status_code=409, datos=None):
        super().__init__(detalle)
        self.codigo = codigo
        self.detalle = detalle
        self.status_code = status_code
        self.datos = datos or {}


@dataclass
class ResultadoEliminacion:
    estado: str
    supabase_eliminado: bool
    detalle: str


def negocios_sin_propietario_alternativo(usuario):
    """Negocios activos donde el usuario es el único propietario vigente.

    Si existe otro propietario activo, la baja puede desactivar esta membresía
    sin dejar el negocio huérfano. Si el negocio está inactivo, no bloquea.
    """
    bloqueantes = []
    negocios = models.Negocio.objects.filter(
        status=True,
        usuarionegocio__usuario=usuario,
        usuarionegocio__rol_comercio='dueno',
        usuarionegocio__sucursal__isnull=True,
        usuarionegocio__status=True,
    ).distinct().order_by('nombre')
    for negocio in negocios:
        otro = models.UsuarioNegocio.objects.filter(
            negocio=negocio,
            rol_comercio='dueno',
            sucursal__isnull=True,
            status=True,
        ).exclude(usuario=usuario).exists()
        if not otro:
            bloqueantes.append({'id': negocio.pk, 'nombre': negocio.nombre})
    return bloqueantes


def _correo_anonimo():
    return f'eliminado+{uuid4().hex}@benefy.invalid'


def _expirar_beneficios(usuario, ahora):
    """Forfeita saldos y cupones disponibles conservando los asientos del ledger."""
    lotes = list(
        models.LotePuntos.objects.select_for_update().filter(
            usuario=usuario, cantidad_disponible__gt=0,
        ).select_related('negocio'),
    )
    for lote in lotes:
        cantidad = lote.cantidad_disponible
        models.MovimientoPuntos.objects.create(
            usuario=usuario,
            negocio=lote.negocio,
            lote=lote,
            tipo='expirado',
            cantidad=-cantidad,
            descripcion='Baja de cuenta: puntos no utilizables.',
        )
        lote.cantidad_disponible = 0
        lote.save(update_fields=['cantidad_disponible'])

    for saldo in models.SaldoPuntos.objects.select_for_update().filter(
        usuario=usuario,
    ):
        if saldo.saldo_actual:
            saldo.saldo_actual = 0
            saldo.save(update_fields=['saldo_actual', 'fecha_actualizacion'])

    models.CuponUsuario.objects.select_for_update().filter(
        usuario=usuario, status='disponible',
    ).update(
        status='anulado',
        anulada_en=ahora,
        motivo_anulacion='Baja de cuenta.',
    )
    models.CicloTarjeta.objects.select_for_update().filter(
        usuario=usuario, estado='en_curso',
    ).update(estado='anulado', fecha_fin=ahora)


def _desactivar_membresias(usuario):
    membresias_usuario = list(
        models.UsuarioNegocio.objects.select_for_update(of=('self',)).filter(
            usuario=usuario, status=True,
        ).select_related('negocio', 'sucursal'),
    )
    for membresia in membresias_usuario:
        # Un dueño de negocio activo se bloquea antes de entrar aquí. Si el
        # negocio está inactivo, se permite cerrar su membresía sin dejar un
        # negocio activo huérfano.
        membresias.desactivar_membresia(
            membresia=membresia,
            actor=usuario,
            motivo='Baja de cuenta.',
            validar_propietario=membresia.negocio.status,
        )


def _limpiar_datos_personales(usuario):
    uid = usuario.supabase_uid

    models.Notificacion.objects.filter(usuario=usuario).delete()
    models.RegistroComercial.objects.filter(
        Q(usuario=usuario) | (Q(supabase_uid=uid) if uid else Q(pk__in=[])),
    ).update(
        correo=_correo_anonimo(),
        nombre_completo='',
        usuario=None,
        ultimo_error='',
    )

    # La auditoría conserva la operación, pero no el correo personal.
    models.AuditoriaMembresia.objects.filter(usuario=usuario).update(
        usuario_correo='',
    )
    models.AuditoriaMembresia.objects.filter(actor=usuario).update(
        actor_correo='',
    )

    usuario.nombre = 'Usuario'
    usuario.apellido = 'Eliminado'
    usuario.telefono = None
    usuario.foto_perfil = None
    usuario.correo = _correo_anonimo()
    usuario.supabase_uid = None
    usuario.legacy_firebase_uid = None
    usuario.qr_token = uuid4()
    usuario.is_active = False
    usuario.rol = 'consumidor'
    usuario.save(update_fields=[
        'nombre', 'apellido', 'telefono', 'foto_perfil', 'correo',
        'supabase_uid', 'legacy_firebase_uid', 'qr_token', 'is_active', 'rol',
        'fecha_actualizacion',
    ])


def _completar_externos(solicitud):
    if solicitud.estado == 'completada':
        return ResultadoEliminacion(
            estado='completada',
            supabase_eliminado=True,
            detalle='La cuenta ya estaba eliminada.',
        )

    uid = solicitud.supabase_uid
    if not uid:
        ahora = timezone.now()
        models.EliminacionCuenta.objects.filter(pk=solicitud.pk).update(
            estado='completada',
            supabase_uid=None,
            storage_limpiado_en=ahora,
            supabase_eliminado_en=ahora,
            storage_ultimo_error='',
            ultimo_error='',
        )
        return ResultadoEliminacion(
            estado='completada',
            supabase_eliminado=True,
            detalle='Cuenta eliminada.',
        )

    storage_ok = solicitud.storage_limpiado_en is not None
    auth_ok = solicitud.supabase_eliminado_en is not None

    if not storage_ok:
        try:
            supabase_storage.eliminar_avatar(uid)
        except supabase_storage.ErrorSupabaseStorage as exc:
            models.EliminacionCuenta.objects.filter(pk=solicitud.pk).update(
                storage_intentos=F('storage_intentos') + 1,
                storage_ultimo_error=str(exc.detalle)[:500],
            )
        else:
            storage_ok = True
            models.EliminacionCuenta.objects.filter(pk=solicitud.pk).update(
                storage_limpiado_en=timezone.now(),
                storage_ultimo_error='',
            )

    if not auth_ok:
        try:
            supabase_admin.eliminar_usuario(uid)
        except supabase_admin.ErrorSupabaseAdmin as exc:
            models.EliminacionCuenta.objects.filter(pk=solicitud.pk).update(
                intentos=F('intentos') + 1,
                ultimo_error=str(exc.detalle)[:500],
            )
        else:
            auth_ok = True
            models.EliminacionCuenta.objects.filter(pk=solicitud.pk).update(
                supabase_eliminado_en=timezone.now(),
                ultimo_error='',
            )

    if storage_ok and auth_ok:
        models.EliminacionCuenta.objects.filter(pk=solicitud.pk).update(
            estado='completada',
            supabase_uid=None,
            storage_ultimo_error='',
            ultimo_error='',
        )
        return ResultadoEliminacion(
            estado='completada',
            supabase_eliminado=True,
            detalle='Cuenta eliminada.',
        )

    return ResultadoEliminacion(
        estado='anonimizada',
        supabase_eliminado=auth_ok,
        detalle=(
            'La cuenta fue desactivada y anonimizada. La limpieza de avatares '
            'o la identidad de Supabase se reintentará automáticamente.'
        ),
    )


def solicitar_eliminacion(usuario, confirmacion, ahora=None):
    """Anonimiza la cuenta y elimina la identidad Supabase de forma idempotente."""
    ahora = ahora or timezone.now()
    if not isinstance(confirmacion, str) or confirmacion.strip().casefold() != CONFIRMACION_ELIMINACION:
        raise ErrorEliminacionCuenta(
            'confirmacion_invalida',
            'Escribe exactamente "Eliminar mi cuenta" para confirmar.',
            status_code=400,
        )

    existente = models.EliminacionCuenta.objects.filter(usuario=usuario).first()
    if existente is not None and existente.estado == 'completada':
        return _completar_externos(existente)

    if not usuario.is_active:
        raise ErrorEliminacionCuenta(
            'cuenta_inactiva',
            'La cuenta ya no está activa.',
            status_code=409,
        )
    if usuario.rol == 'admin_sistema':
        raise ErrorEliminacionCuenta(
            'cuenta_admin',
            'Una cuenta administradora no puede autoeliminarse. Solicita el cambio a otro administrador.',
            status_code=409,
        )

    negocios = negocios_sin_propietario_alternativo(usuario)
    if negocios:
        raise ErrorEliminacionCuenta(
            'propietario_activo',
            'Transfiere la propiedad o cierra los negocios activos antes de eliminar la cuenta.',
            status_code=409,
            datos={'negocios': negocios},
        )

    if usuario.supabase_uid and not supabase_admin.configurado():
        raise ErrorEliminacionCuenta(
            'supabase_no_configurado',
            'La eliminación de identidades Supabase no está configurada.',
            status_code=503,
        )

    if existente is None:
        existente = models.EliminacionCuenta.objects.create(
            usuario=usuario,
            supabase_uid=usuario.supabase_uid,
        )
    elif existente.estado == 'anonimizada':
        return _completar_externos(existente)

    try:
        with transaction.atomic():
            usuario = models.Usuario.objects.select_for_update().get(pk=usuario.pk)
            if usuario.rol == 'admin_sistema':
                raise ErrorEliminacionCuenta(
                    'cuenta_admin',
                    'Una cuenta administradora no puede autoeliminarse.',
                    status_code=409,
                )
            negocios = negocios_sin_propietario_alternativo(usuario)
            if negocios:
                raise ErrorEliminacionCuenta(
                    'propietario_activo',
                    'Transfiere la propiedad o cierra los negocios activos antes de eliminar la cuenta.',
                    status_code=409,
                    datos={'negocios': negocios},
                )
            solicitud = models.EliminacionCuenta.objects.select_for_update().get(
                pk=existente.pk,
            )
            solicitud.supabase_uid = solicitud.supabase_uid or usuario.supabase_uid
            _expirar_beneficios(usuario, ahora)
            _desactivar_membresias(usuario)
            _limpiar_datos_personales(usuario)
            solicitud.estado = 'anonimizada'
            solicitud.anonimizada_en = ahora
            solicitud.ultimo_error = ''
            solicitud.save(update_fields=[
                'supabase_uid', 'estado', 'anonimizada_en', 'ultimo_error',
                'actualizada_en',
            ])
    except ErrorEliminacionCuenta:
        raise
    except Exception:
        models.EliminacionCuenta.objects.filter(pk=existente.pk).update(
            estado='fallida',
            ultimo_error='No se pudo completar la anonimización.',
        )
        raise

    existente.refresh_from_db()
    return _completar_externos(existente)


def reintentar_pendientes(limite=100):
    """Reintenta las identidades Supabase que quedaron pendientes."""
    pendientes = models.EliminacionCuenta.objects.filter(
        estado='anonimizada',
    ).order_by('solicitada_en', 'pk')[:limite]
    completadas = 0
    fallidas = 0
    for solicitud in pendientes:
        resultado = _completar_externos(solicitud)
        if resultado.estado == 'completada':
            completadas += 1
        else:
            fallidas += 1
    return {'completadas': completadas, 'pendientes': fallidas}
