"""Contexto autorizado de Benef AI calculado en Django."""

from django.core.exceptions import PermissionDenied

from core import models, permissions
from core.services import planes
from core.services.benef_ai_tiempo import contexto_temporal


def _plan_visible(negocio):
    resumen = planes.resumen_plan(negocio)
    codigo = resumen['plan']['codigo']
    resumen['plan']['nombre_visible'] = {
        'free': 'Plan gratis',
        'premium': 'Plan premium',
    }.get(codigo, resumen['plan']['nombre'])
    return resumen


def _membresias(usuario, negocio):
    return list(
        models.UsuarioNegocio.objects.filter(
            usuario=usuario,
            negocio=negocio,
            status=True,
        ).select_related('sucursal').order_by('pk')
    )


def _sucursal_autorizada(membresias, sucursal_id, es_dueno, negocio):
    if sucursal_id is None:
        return None
    sucursal = models.Sucursal.objects.filter(
        pk=sucursal_id,
        negocio=negocio,
        status=True,
    ).first()
    if sucursal is None:
        raise PermissionDenied('La sucursal no existe o está inactiva.')
    if es_dueno:
        return sucursal
    autorizadas = {
        membresia.sucursal_id
        for membresia in membresias
        if membresia.rol_comercio in ('supervisor', 'empleado')
        and membresia.sucursal_id
    }
    if sucursal.pk not in autorizadas:
        raise PermissionDenied('No tienes acceso a esa sucursal.')
    return sucursal


def construir_contexto_benef_ai(
    usuario, negocio, *, sucursal_id=None, ahora=None,
):
    """Devuelve identidad, alcance, plan y tiempo confiables para el agente."""
    if permissions.es_admin_sistema(usuario):
        raise PermissionDenied(
            'Benef AI está disponible únicamente para usuarios de negocio.'
        )
    if not permissions.puede_acceder_negocio(usuario, negocio):
        raise PermissionDenied('No tienes acceso a este negocio.')

    membresias = _membresias(usuario, negocio)
    if not membresias:
        raise PermissionDenied('No tienes una membresía activa en este negocio.')

    es_dueno = any(
        membresia.rol_comercio == 'dueno' and membresia.sucursal_id is None
        for membresia in membresias
    )
    sucursal = _sucursal_autorizada(membresias, sucursal_id, es_dueno, negocio)

    if es_dueno:
        rol = 'dueno'
        sucursales = list(
            models.Sucursal.objects.filter(negocio=negocio, status=True)
            .order_by('nombre')
        )
    else:
        roles = {membresia.rol_comercio for membresia in membresias}
        rol = 'supervisor' if 'supervisor' in roles else 'empleado'
        ids = {
            membresia.sucursal_id
            for membresia in membresias
            if membresia.sucursal_id
        }
        sucursales = list(
            models.Sucursal.objects.filter(
                pk__in=ids, negocio=negocio, status=True,
            ).order_by('nombre')
        )

    plan = _plan_visible(negocio)
    return {
        'usuario': {
            'nombre_completo': f'{usuario.nombre} {usuario.apellido}'.strip(),
            'rol_comercio': rol,
            'es_dueno': es_dueno,
        },
        'negocio': {
            'id': negocio.pk,
            'nombre': negocio.nombre,
            'zona_horaria': negocio.zona_horaria,
            'categoria': negocio.categoria.nombre if negocio.categoria_id else None,
        },
        'sucursal_actual': (
            {'id': sucursal.pk, 'nombre': sucursal.nombre}
            if sucursal is not None else None
        ),
        'sucursales_autorizadas': [
            {'id': item.pk, 'nombre': item.nombre, 'ciudad': item.ciudad}
            for item in sucursales
        ],
        'plan': plan,
        'tiempo': contexto_temporal(negocio, ahora),
        'capacidades': {
            'ver_resumen': True,
            'ver_visitas': True,
            'ver_clientes': es_dueno,
            'ver_puntos_y_tarjetas': es_dueno,
            'ver_recompensas': True,
            'ver_cupones': es_dueno,
            'ver_canjes': True,
            'ver_alianzas': True,
            'ver_sucursales': True,
            'ver_equipo': True,
            'ver_plan': True,
            'ver_negocio': True,
            'puede_escribir': False,
        },
        'nota': (
            'Este contexto y los permisos provienen de Django. El agente es de '
            'solo lectura y no puede cambiar de negocio ni suplantar identidades.'
        ),
    }
