"""Finalización idempotente del registro comercial.

Los metadatos de Supabase se usan únicamente como datos iniciales del negocio.
Los permisos se derivan de la identidad verificada, nunca de esos metadatos.
"""

from dataclasses import dataclass

from django.db import IntegrityError, transaction

from core import models
from core.services import membresias, planes


@dataclass
class ResultadoOnboarding:
    usuario: models.Usuario
    negocio: models.Negocio
    registro: models.RegistroComercial
    ya_existia: bool


class ErrorOnboarding(Exception):
    def __init__(self, codigo, detalle, status_code=409):
        super().__init__(detalle)
        self.codigo = codigo
        self.detalle = detalle
        self.status_code = status_code


def _texto(valor):
    return valor.strip() if isinstance(valor, str) else ''


def _datos_metadata(identity):
    metadata = identity.user_metadata or {}
    tipo = _texto(metadata.get('benefy_tipo_registro')).lower()
    negocio = _texto(
        metadata.get('benefy_nombre_negocio') or metadata.get('negocio'),
    )
    nombre = _texto(
        metadata.get('benefy_nombre_completo')
        or metadata.get('nombre_completo')
        or metadata.get('nombre'),
    )

    # Compatibilidad con registros creados antes de este cambio: el formulario
    # anterior guardaba ``negocio`` y ``nombre`` sin marca de tipo.
    if tipo and tipo != 'comercial':
        return None
    if not tipo and not negocio:
        return None
    if not negocio or not nombre:
        raise ErrorOnboarding(
            'registro_incompleto',
            'Faltan el nombre del negocio o el nombre completo del responsable.',
            status_code=400,
        )
    if len(negocio) > 150 or len(nombre) > 200:
        raise ErrorOnboarding(
            'registro_invalido',
            'El nombre del negocio o del responsable excede la longitud permitida.',
            status_code=400,
        )
    return {'nombre_negocio': negocio, 'nombre_completo': nombre}


def _dividir_nombre(nombre_completo):
    partes = nombre_completo.split()
    if not partes:
        return '', ''
    if len(partes) == 1:
        return partes[0][:100], ''
    return ' '.join(partes[:-1])[:100], partes[-1][:100]


def _bloquear_registro(identity, datos):
    try:
        return models.RegistroComercial.objects.select_for_update().get(
            supabase_uid=identity.uid,
        )
    except models.RegistroComercial.DoesNotExist:
        try:
            with transaction.atomic():
                return models.RegistroComercial.objects.create(
                    supabase_uid=identity.uid,
                    correo=identity.email,
                    nombre_negocio=datos['nombre_negocio'],
                    nombre_completo=datos['nombre_completo'],
                )
        except IntegrityError:
            return models.RegistroComercial.objects.select_for_update().get(
                supabase_uid=identity.uid,
            )


def _membresia_dueno(usuario):
    # Incluye inactivas: un negocio desactivado no debe provocar otro negocio.
    return models.UsuarioNegocio.objects.filter(
        usuario=usuario,
        rol_comercio='dueno',
        sucursal__isnull=True,
    ).select_related('negocio').order_by('-status', 'pk').first()


def _negocio_por_correo(identity, usuario):
    negocio = models.Negocio.objects.filter(
        correo__iexact=identity.email,
    ).first()
    if negocio is None:
        return None
    if models.UsuarioNegocio.objects.filter(
        usuario=usuario,
        negocio=negocio,
        rol_comercio='dueno',
        sucursal__isnull=True,
    ).exists():
        return negocio
    raise ErrorOnboarding(
        'correo_negocio_en_uso',
        'El correo de la cuenta ya está asociado a otro negocio.',
    )


def completar_registro_comercial(identity):
    datos = _datos_metadata(identity)
    if datos is None:
        raise ErrorOnboarding(
            'sin_registro_comercial',
            'Esta cuenta no tiene un registro comercial pendiente.',
        )

    with transaction.atomic():
        registro = _bloquear_registro(identity, datos)
        if registro.estado == 'completado' and registro.usuario_id and registro.negocio_id:
            return ResultadoOnboarding(
                usuario=registro.usuario,
                negocio=registro.negocio,
                registro=registro,
                ya_existia=True,
            )

        registro.nombre_negocio = datos['nombre_negocio']
        registro.nombre_completo = datos['nombre_completo']
        registro.correo = identity.email

        usuario = models.Usuario.objects.filter(supabase_uid=identity.uid).first()
        if usuario is None:
            if models.Usuario.objects.filter(correo__iexact=identity.email).exists():
                raise ErrorOnboarding(
                    'perfil_requiere_vinculacion',
                    'Ya existe un perfil con este correo. Contacta al administrador.',
                )
            nombre, apellido = _dividir_nombre(datos['nombre_completo'])
            usuario = models.Usuario.objects.create(
                supabase_uid=identity.uid,
                correo=identity.email,
                nombre=nombre,
                apellido=apellido,
                rol='consumidor',
            )

        existente = _membresia_dueno(usuario)
        if existente is not None:
            registro.usuario = usuario
            registro.negocio = existente.negocio
            registro.estado = 'completado'
            registro.ultimo_error = ''
            registro.save(update_fields=[
                'usuario', 'negocio', 'estado', 'ultimo_error',
                'nombre_negocio', 'nombre_completo', 'correo',
                'fecha_actualizacion',
            ])
            return ResultadoOnboarding(
                usuario=usuario,
                negocio=existente.negocio,
                registro=registro,
                ya_existia=True,
            )

        if registro.negocio_id:
            negocio = registro.negocio
        else:
            negocio = _negocio_por_correo(identity, usuario)
            if negocio is None:
                categoria, _ = models.CategoriaNegocio.objects.get_or_create(
                    nombre='General',
                    defaults={
                        'descripcion': 'Categoría general para nuevos negocios.',
                    },
                )
                negocio = models.Negocio.objects.create(
                    nombre=datos['nombre_negocio'],
                    direccion='',
                    correo=identity.email,
                    categoria=categoria,
                )

        if not models.UsuarioNegocio.objects.filter(
            usuario=usuario,
            negocio=negocio,
            rol_comercio='dueno',
            sucursal__isnull=True,
            status=True,
        ).exists():
            membresias.crear_membresia(
                usuario=usuario,
                negocio=negocio,
                sucursal=None,
                rol_comercio='dueno',
                actor=usuario,
                motivo='Alta de negocio desde registro comercial.',
            )

        planes.asignar_free_inicial(
            negocio,
            actor=usuario,
            motivo='Plan Free del registro comercial inicial.',
        )

        registro.usuario = usuario
        registro.negocio = negocio
        registro.estado = 'completado'
        registro.ultimo_error = ''
        registro.save(update_fields=[
            'usuario', 'negocio', 'estado', 'ultimo_error',
            'nombre_negocio', 'nombre_completo', 'correo',
            'fecha_actualizacion',
        ])
        return ResultadoOnboarding(
            usuario=usuario,
            negocio=negocio,
            registro=registro,
            ya_existia=False,
        )
