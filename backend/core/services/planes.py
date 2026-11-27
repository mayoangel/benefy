"""Capacidades y límites comerciales por plan.

El plan pertenece al negocio. Los límites se guardan como JSON validado para
poder ajustarlos sin crear migraciones. ``None`` significa ilimitado y ``0``
significa que el recurso no está permitido.
"""

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import APIException

from core import models


LIMITES_PLAN = (
    'sucursales',
    'programas_puntos',
    'tarjetas_sellos',
    'recompensas',
    'supervisores',
    'empleados',
    'alianzas_activas',
    'alianzas_con_free',
    'alianzas_con_premium',
)

CARACTERISTICAS_PLAN = (
    'metricas_avanzadas',
    'exportacion_reportes',
    'personalizacion_avanzada',
    'alianzas',
    'alianzas_proponer',
)

# Funciones que ya tienen implementación operativa. Las demás se anuncian como
# próximas y no deben presentarse como disponibles.
CARACTERISTICAS_IMPLEMENTADAS = ('alianzas', 'alianzas_proponer')

NOMBRES_RECURSOS = {
    'sucursales': 'sucursales',
    'programas_puntos': 'programas de puntos',
    'tarjetas_sellos': 'tarjetas de sellos',
    'recompensas': 'recompensas',
    'supervisores': 'supervisores',
    'empleados': 'empleados',
    'alianzas_activas': 'alianzas activas',
    'alianzas_con_free': 'alianzas activas con negocios del plan gratis',
    'alianzas_con_premium': 'alianzas activas con negocios del plan premium',
}


def nombre_visible_plan(plan):
    """Nombre comercial del plan para mensajes dirigidos al negocio."""
    return {
        'free': 'plan gratis',
        'premium': 'plan premium',
    }.get(getattr(plan, 'codigo', ''), getattr(plan, 'nombre', 'plan actual'))


class ErrorConfiguracionPlan(Exception):
    """El catálogo de planes está incompleto o mal configurado."""


class ErrorPlan(Exception):
    """La operación de plan solicitada no es válida."""


class LimitePlan(APIException):
    """Error estable que el frontend puede interpretar."""

    status_code = 403
    default_detail = 'El plan actual no permite esta operación.'

    def __init__(self, detalle):
        super().__init__(detail={'codigo': 'limite_plan', 'detalle': detalle})


def validar_limites(valor):
    """Valida el catálogo cerrado de límites y devuelve una copia normalizada."""
    if not isinstance(valor, dict):
        raise ValueError('Los límites deben ser un objeto JSON.')
    desconocidas = set(valor) - set(LIMITES_PLAN)
    if desconocidas:
        raise ValueError(
            'Límites desconocidos: ' + ', '.join(sorted(desconocidas)) + '.'
        )
    faltantes = set(LIMITES_PLAN) - set(valor)
    if faltantes:
        raise ValueError(
            'Faltan límites obligatorios: ' + ', '.join(sorted(faltantes)) + '.'
        )

    normalizados = {}
    for clave in LIMITES_PLAN:
        cantidad = valor[clave]
        if cantidad is None:
            normalizados[clave] = None
            continue
        if isinstance(cantidad, bool) or not isinstance(cantidad, int) or cantidad < 0:
            raise ValueError(
                f'El límite de {clave} debe ser null o un entero no negativo.'
            )
        normalizados[clave] = cantidad
    return normalizados


def validar_caracteristicas(valor):
    """Valida el catálogo de capacidades; las ausentes se consideran falsas."""
    if not isinstance(valor, dict):
        raise ValueError('Las características deben ser un objeto JSON.')
    desconocidas = set(valor) - set(CARACTERISTICAS_PLAN)
    if desconocidas:
        raise ValueError(
            'Características desconocidas: '
            + ', '.join(sorted(desconocidas)) + '.'
        )
    normalizadas = {}
    for clave in CARACTERISTICAS_PLAN:
        bandera = valor.get(clave, False)
        if not isinstance(bandera, bool):
            raise ValueError(f'La característica {clave} debe ser booleana.')
        normalizadas[clave] = bandera
    return normalizadas


def _limites(plan):
    try:
        return validar_limites(plan.limites)
    except ValueError as exc:
        raise ErrorConfiguracionPlan(
            f'La configuración del plan {plan.nombre} no es válida: {exc}'
        ) from exc


def _caracteristicas(plan):
    try:
        return validar_caracteristicas(plan.caracteristicas)
    except ValueError as exc:
        raise ErrorConfiguracionPlan(
            f'La configuración del plan {plan.nombre} no es válida: {exc}'
        ) from exc


def _plan_free():
    plan = models.PlanSuscripcion.objects.filter(
        codigo='free', status=True,
    ).first()
    if plan is None:
        raise ErrorConfiguracionPlan(
            'No existe el plan Free activo. Es un error de configuración.'
        )
    _limites(plan)
    return plan


def suscripcion_actual(negocio):
    """Suscripción con acceso al plan.

    Además de ``activa`` y ``prueba``, un estado ``pendiente`` conserva el
    acceso Premium únicamente mientras ``gracia_fin`` siga en el futuro. Al
    vencer la gracia, la suscripción impaga deja de conceder capacidades y el
    negocio vuelve a Free sin borrar su historial.
    """
    ahora = timezone.now()
    suscripciones = models.Suscripcion.objects.filter(
        negocio=negocio,
    ).select_related('plan').order_by('-fecha_inicio', '-pk')
    en_gracia = suscripciones.filter(
        status='pendiente',
        gracia_fin__gt=ahora,
    ).first()
    if en_gracia is not None:
        return en_gracia
    return suscripciones.filter(
        status__in=models.ESTADOS_SUSCRIPCION_VIGENTES,
    ).first()


def plan_actual(negocio):
    """Plan vigente o Free como respaldo mientras no exista suscripción."""
    suscripcion = suscripcion_actual(negocio)
    if suscripcion is not None:
        _limites(suscripcion.plan)
        return suscripcion.plan
    return _plan_free()


def limite(negocio, recurso):
    if recurso not in LIMITES_PLAN:
        raise ValueError(f'Recurso de plan desconocido: {recurso}.')
    return _limites(plan_actual(negocio))[recurso]


def _alianzas_activas(negocio):
    """Alianzas que ocupan cupo: activas y todavía no vencidas.

    Una alianza programada para iniciar después también reserva cupo para no
    aceptar compromisos futuros que excedan la capacidad del plan.
    """
    return models.Alianza.objects.filter(
        status='activa',
        fecha_fin__gte=timezone.now(),
    ).filter(
        Q(negocio1=negocio) | Q(negocio2=negocio),
    ).select_related('negocio1', 'negocio2')


def _contraparte(negocio, alianza):
    if alianza.negocio1_id == negocio.pk:
        return alianza.negocio2
    return alianza.negocio1


def _codigo_plan(negocio, cache):
    if negocio.pk not in cache:
        cache[negocio.pk] = plan_actual(negocio).codigo
    return cache[negocio.pk]


def _queryset_recurso(negocio, recurso):
    if recurso == 'sucursales':
        return models.Sucursal.objects.filter(negocio=negocio, status=True)
    if recurso == 'programas_puntos':
        return models.Dinamica.objects.filter(
            negocio=negocio, tipo='puntos', status=True,
        )
    if recurso == 'tarjetas_sellos':
        return models.Dinamica.objects.filter(
            negocio=negocio, tipo='sellos', status=True,
        )
    if recurso == 'recompensas':
        return models.Recompensa.objects.filter(negocio=negocio, status=True)
    if recurso == 'supervisores':
        return models.UsuarioNegocio.objects.filter(
            negocio=negocio, rol_comercio='supervisor', status=True,
        )
    if recurso == 'empleados':
        return models.UsuarioNegocio.objects.filter(
            negocio=negocio, rol_comercio='empleado', status=True,
        )
    if recurso == 'alianzas_activas':
        return _alianzas_activas(negocio)
    raise ValueError(f'Recurso de plan desconocido: {recurso}.')


def uso_actual(negocio, recurso, excluir_ids=()):
    if recurso in (
        'alianzas_activas', 'alianzas_con_free', 'alianzas_con_premium',
    ):
        alianzas = list(_alianzas_activas(negocio))
        if excluir_ids:
            excluidos = set(excluir_ids)
            alianzas = [alianza for alianza in alianzas if alianza.pk not in excluidos]
        if recurso == 'alianzas_activas':
            return len(alianzas)
        buscado = 'free' if recurso == 'alianzas_con_free' else 'premium'
        cache = {}
        return sum(
            1 for alianza in alianzas
            if _codigo_plan(_contraparte(negocio, alianza), cache) == buscado
        )

    queryset = _queryset_recurso(negocio, recurso)
    if excluir_ids:
        queryset = queryset.exclude(pk__in=excluir_ids)
    return queryset.count()


def puede_crear(negocio, recurso, cantidad=1):
    maximo = limite(negocio, recurso)
    if maximo is None:
        return True
    return uso_actual(negocio, recurso) + cantidad <= maximo


def verificar_capacidad(
    negocio, recurso, cantidad=1, excluir_ids=(), accion='crear',
):
    """Bloquea el negocio y comprueba el cupo dentro de una transacción.

    El bloqueo de la fila del negocio serializa las comprobaciones concurrentes
    para que dos altas no consuman el mismo último cupo.
    """
    models.Negocio.objects.select_for_update().get(pk=negocio.pk)
    maximo = limite(negocio, recurso)
    if maximo is None:
        return {'limite': None, 'uso': uso_actual(negocio, recurso, excluir_ids)}
    uso = uso_actual(negocio, recurso, excluir_ids)
    if uso + cantidad > maximo:
        nombre = NOMBRES_RECURSOS.get(recurso, recurso)
        raise LimitePlan(
            f'El plan actual no permite {accion} más {nombre}.'
        )
    return {
        'limite': maximo,
        'uso': uso,
        'disponible': max(maximo - uso, 0),
    }


def verificar_capacidad_alianza(negocio, contraparte):
    """Bloquea ambos negocios y valida sus cupos de alianza al aceptar.

    El orden por PK evita interbloqueos cuando dos aceptaciones comparten
    negocios. El bloqueo de ambas filas serializa las comprobaciones y evita que
    dos solicitudes concurrentes consuman el mismo cupo.
    """
    list(models.Negocio.objects.select_for_update().filter(
        pk__in=(negocio.pk, contraparte.pk),
    ).order_by('pk'))
    cache = {}
    for actual, otra in ((negocio, contraparte), (contraparte, negocio)):
        plan = plan_actual(actual)
        maximos = _limites(plan)
        maximo_total = maximos['alianzas_activas']
        uso_total = uso_actual(actual, 'alianzas_activas')
        if maximo_total is not None and uso_total + 1 > maximo_total:
            raise LimitePlan(
                f'El {nombre_visible_plan(plan)} permite {maximo_total} alianzas activas.'
            )

        es_free = _codigo_plan(otra, cache) == 'free'
        clave = 'alianzas_con_free' if es_free else 'alianzas_con_premium'
        maximo = maximos[clave]
        uso = uso_actual(actual, clave)
        if maximo is not None and uso + 1 > maximo:
            raise LimitePlan(
                f'El {nombre_visible_plan(plan)} permite {maximo} '
                f'{NOMBRES_RECURSOS[clave]}.'
            )
    return True


def tiene_caracteristica(negocio, clave):
    if clave not in CARACTERISTICAS_PLAN:
        return False
    return bool(_caracteristicas(plan_actual(negocio)).get(clave, False))


def _datos_plan(plan):
    return {
        'id': plan.pk,
        'codigo': plan.codigo,
        'nombre': plan.nombre,
        'descripcion': plan.descripcion,
        'orden': plan.orden,
        'status': plan.status,
    }


def resumen_plan(negocio):
    suscripcion = suscripcion_actual(negocio)
    plan = suscripcion.plan if suscripcion is not None else _plan_free()
    maximos = _limites(plan)
    limites = {}
    excedentes = []
    for recurso in LIMITES_PLAN:
        maximo = maximos[recurso]
        uso = uso_actual(negocio, recurso)
        excedido = maximo is not None and uso > maximo
        if excedido:
            excedentes.append(recurso)
        limites[recurso] = {
            'limite': maximo,
            'uso': uso,
            'disponible': None if maximo is None else max(maximo - uso, 0),
            'excedido': excedido,
        }

    suscripcion_data = None
    if suscripcion is not None:
        suscripcion_data = {
            'id': suscripcion.pk,
            'status': suscripcion.status,
            'stripe_status': suscripcion.stripe_status,
            'origen': suscripcion.origen,
            'en_cancelacion': suscripcion.en_cancelacion,
            'gracia_fin': suscripcion.gracia_fin,
            'fecha_inicio': suscripcion.fecha_inicio,
            'fecha_fin': suscripcion.fecha_fin,
            'periodo_actual_inicio': suscripcion.periodo_actual_inicio,
            'periodo_actual_fin': suscripcion.periodo_actual_fin,
        }

    return {
        'negocio': negocio.pk,
        'plan': _datos_plan(plan),
        'suscripcion': suscripcion_data,
        'limites': limites,
        'caracteristicas': _caracteristicas(plan),
        'caracteristicas_implementadas': list(CARACTERISTICAS_IMPLEMENTADAS),
        'excedentes': excedentes,
    }


def planes_por_negocio(negocios):
    """Mapa compacto ``negocio_id -> plan`` para el contexto del portal."""
    ids = [negocio.pk for negocio in negocios]
    if not ids:
        return {}
    ahora = timezone.now()
    suscripciones = models.Suscripcion.objects.filter(
        negocio_id__in=ids,
    ).filter(
        Q(status__in=models.ESTADOS_SUSCRIPCION_VIGENTES)
        | Q(status='pendiente', gracia_fin__gt=ahora)
    ).select_related('plan').order_by('negocio_id', '-fecha_inicio', '-pk')
    vigentes = {}
    for suscripcion in suscripciones:
        actual = vigentes.get(suscripcion.negocio_id)
        if actual is None or (
            suscripcion.status == 'pendiente'
            and actual.status != 'pendiente'
        ):
            vigentes[suscripcion.negocio_id] = suscripcion
    free = _plan_free()
    resultado = {}
    for negocio in negocios:
        suscripcion = vigentes.get(negocio.pk)
        plan = suscripcion.plan if suscripcion is not None else free
        resultado[negocio.pk] = _datos_plan(plan)
    return resultado


@transaction.atomic
def asignar_free_inicial(negocio, actor=None, motivo='Alta de negocio.'):
    """Asigna Free una sola vez, sin sobrescribir una suscripción vigente."""
    models.Negocio.objects.select_for_update().get(pk=negocio.pk)
    if suscripcion_actual(negocio) is not None:
        return None
    plan = _plan_free()
    suscripcion = models.Suscripcion.objects.create(
        negocio=negocio,
        plan=plan,
        status='activa',
        origen='automatico',
        fecha_inicio=timezone.now(),
    )
    models.PlanCambioAuditoria.objects.create(
        negocio=negocio,
        plan_anterior=None,
        plan_nuevo=plan,
        origen='automatico',
        motivo=motivo,
        actor=actor,
        actor_correo=getattr(actor, 'correo', '') or '',
    )
    return suscripcion


@transaction.atomic
def cambiar_plan(negocio, plan, actor, motivo, origen='manual'):
    """Cierra el plan vigente y crea el nuevo, conservando todo el historial."""
    if not plan.status:
        raise ErrorPlan('El plan solicitado está inactivo.')
    _limites(plan)
    models.Negocio.objects.select_for_update().get(pk=negocio.pk)
    ahora = timezone.now()
    actual = models.Suscripcion.objects.select_for_update().filter(
        negocio=negocio,
    ).filter(
        Q(status__in=models.ESTADOS_SUSCRIPCION_VIGENTES)
        | Q(status='pendiente', gracia_fin__gt=ahora)
    ).select_related('plan').order_by('-fecha_inicio', '-pk').first()

    if actual is not None and actual.plan_id == plan.pk:
        raise ErrorPlan('El negocio ya tiene ese plan vigente.')

    plan_anterior = (
        actual.plan if actual is not None else _plan_free()
    )
    if actual is not None:
        actual.status = 'cancelada'
        actual.en_cancelacion = False
        actual.fecha_fin = ahora
        actual.save(update_fields=[
            'status', 'en_cancelacion', 'fecha_fin', 'fecha_actualizacion',
        ])

    nueva = models.Suscripcion.objects.create(
        negocio=negocio,
        plan=plan,
        status='activa',
        origen=origen,
        fecha_inicio=ahora,
    )
    models.PlanCambioAuditoria.objects.create(
        negocio=negocio,
        plan_anterior=plan_anterior,
        plan_nuevo=plan,
        origen=origen,
        motivo=motivo,
        actor=actor,
        actor_correo=getattr(actor, 'correo', '') or '',
    )
    return nueva


def historial_plan(negocio):
    return models.PlanCambioAuditoria.objects.filter(
        negocio=negocio,
    ).select_related('plan_anterior', 'plan_nuevo', 'actor')
