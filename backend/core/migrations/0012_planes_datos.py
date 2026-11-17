"""Datos iniciales de planes Free y Premium y asignación a negocios."""

from django.db import migrations
from django.utils import timezone


LIMITES_FREE = {
    'sucursales': 1,
    'programas_puntos': 1,
    'tarjetas_sellos': 2,
    'recompensas': 5,
    'supervisores': 1,
    'empleados': 3,
}

LIMITES_PREMIUM = {
    'sucursales': 5,
    'programas_puntos': 1,
    'tarjetas_sellos': 10,
    'recompensas': 30,
    'supervisores': 5,
    'empleados': 20,
}

CARACTERISTICAS_FREE = {
    'metricas_avanzadas': False,
    'exportacion_reportes': False,
    'personalizacion_avanzada': False,
    'alianzas': False,
}

CARACTERISTICAS_PREMIUM = {
    'metricas_avanzadas': True,
    'exportacion_reportes': True,
    'personalizacion_avanzada': True,
    'alianzas': True,
}


def _codigo_legacy(plan):
    nombre = plan.nombre.strip().lower()
    if 'free' in nombre or 'gratis' in nombre:
        return 'free'
    if 'premium' in nombre:
        return 'premium'
    return f'plan-{plan.pk}'


def _codigo_disponible(Plan, codigo, excluir_pk=None):
    base = codigo
    contador = 2
    queryset = Plan.objects.filter(codigo=codigo)
    if excluir_pk is not None:
        queryset = queryset.exclude(pk=excluir_pk)
    while queryset.exists():
        codigo = f'{base}-{contador}'
        contador += 1
        queryset = Plan.objects.filter(codigo=codigo)
        if excluir_pk is not None:
            queryset = queryset.exclude(pk=excluir_pk)
    return codigo


def _precio_legacy(Precio, plan):
    if not plan.stripe_price_id:
        return
    Precio.objects.get_or_create(
        plan=plan,
        intervalo=plan.intervalo,
        defaults={
            'stripe_price_id': plan.stripe_price_id,
            'monto': None,
            'divisa': 'MXN',
            'status': True,
        },
    )


def _obtener_o_crear(Plan, codigo, nombre, orden, limites, caracteristicas, descripcion):
    plan = Plan.objects.filter(codigo=codigo).first()
    if plan is None:
        plan = Plan.objects.filter(nombre__iexact=nombre).first()
    if plan is not None:
        plan.codigo = codigo
        plan.nombre = nombre
        plan.descripcion = descripcion
        plan.orden = orden
        plan.limites = limites
        plan.caracteristicas = caracteristicas
        plan.status = True
        plan.save()
        return plan

    return Plan.objects.create(
        codigo=codigo,
        nombre=nombre,
        descripcion=descripcion,
        orden=orden,
        limites=limites,
        caracteristicas=caracteristicas,
        status=True,
        # Campos legacy aún presentes en 0012; se eliminan en 0013.
        intervalo='mensual',
        stripe_price_id=f'migracion-{codigo}',
        limite_sucursales=limites['sucursales'] or 0,
        limite_dinamicas=(
            (limites['tarjetas_sellos'] or 0) + (limites['recompensas'] or 0)
        ),
    )


def migrar(apps, schema_editor):
    Plan = apps.get_model('core', 'PlanSuscripcion')
    Precio = apps.get_model('core', 'PlanPrecio')
    Suscripcion = apps.get_model('core', 'Suscripcion')
    Negocio = apps.get_model('core', 'Negocio')
    Auditoria = apps.get_model('core', 'PlanCambioAuditoria')
    ahora = timezone.now()

    # 1. Planes previos: conserva su información y completa el nuevo contrato.
    for plan in Plan.objects.all():
        codigo = plan.codigo or _codigo_legacy(plan)
        plan.codigo = _codigo_disponible(Plan, codigo, excluir_pk=plan.pk)
        if plan.codigo not in ('free', 'premium'):
            if not plan.limites:
                plan.limites = dict(LIMITES_FREE)
            if not plan.caracteristicas:
                plan.caracteristicas = dict(CARACTERISTICAS_FREE)
        plan.save()
        _precio_legacy(Precio, plan)

    # 2. Catálogo comercial aprobado.
    free = _obtener_o_crear(
        Plan,
        'free',
        'Free',
        10,
        dict(LIMITES_FREE),
        dict(CARACTERISTICAS_FREE),
        'Plan gratuito permanente para negocios pequeños.',
    )
    premium = _obtener_o_crear(
        Plan,
        'premium',
        'Premium',
        20,
        dict(LIMITES_PREMIUM),
        dict(CARACTERISTICAS_PREMIUM),
        'Plan de pago con mayor capacidad y funciones avanzadas.',
    )

    for intervalo in ('mensual', 'anual'):
        Precio.objects.get_or_create(
            plan=premium,
            intervalo=intervalo,
            defaults={
                'stripe_price_id': None,
                'monto': None,
                'divisa': 'MXN',
                'status': True,
            },
        )

    # 3. Suscripciones previas: completa fecha lógica sin alterar su estado.
    for suscripcion in Suscripcion.objects.select_related('plan'):
        cambios = []
        if suscripcion.fecha_inicio is None:
            suscripcion.fecha_inicio = (
                suscripcion.periodo_actual_inicio or suscripcion.fecha_registro
            )
            cambios.append('fecha_inicio')
        if not suscripcion.plan.codigo:
            suscripcion.plan.codigo = _codigo_legacy(suscripcion.plan)
            suscripcion.plan.save(update_fields=['codigo'])
        if cambios:
            suscripcion.save(update_fields=cambios)

    # 4. Free para negocios sin suscripción vigente. No toca datos de lealtad.
    for negocio in Negocio.objects.all():
        if Suscripcion.objects.filter(
            negocio_id=negocio.pk,
            status__in=('activa', 'prueba'),
        ).exists():
            continue
        Suscripcion.objects.create(
            negocio_id=negocio.pk,
            plan=free,
            status='activa',
            origen='migracion',
            fecha_inicio=negocio.fecha_registro or ahora,
            stripe_subscription_id=None,
            periodo_actual_inicio=None,
            periodo_actual_fin=None,
            en_cancelacion=False,
        )
        Auditoria.objects.create(
            negocio_id=negocio.pk,
            plan_anterior=None,
            plan_nuevo=free,
            origen='migracion',
            motivo='Asignación de Free a negocio existente sin plan vigente.',
            actor=None,
            actor_correo='',
        )


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0011_planes_esquema'),
    ]

    operations = [
        migrations.RunPython(migrar, migrations.RunPython.noop),
    ]
