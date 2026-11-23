"""Fábricas mínimas para las pruebas del motor de lealtad."""

from datetime import timedelta
from uuid import uuid4

from django.utils import timezone

from core import models


def crear_usuario(rol='consumidor'):
    return models.Usuario.objects.create(
        supabase_uid=uuid4(),
        nombre=f'Usuario {uuid4().hex[:6]}',
        apellido='Prueba',
        correo=f'{uuid4().hex}@example.com',
        rol=rol,
    )


LIMITES_FREE = {
    'sucursales': 1,
    'programas_puntos': 1,
    'tarjetas_sellos': 2,
    'recompensas': 5,
    'supervisores': 1,
    'empleados': 3,
    'alianzas_activas': 1,
    'alianzas_con_free': 1,
    'alianzas_con_premium': 1,
}

LIMITES_PREMIUM = {
    'sucursales': 5,
    'programas_puntos': 1,
    'tarjetas_sellos': 10,
    'recompensas': 30,
    'supervisores': 5,
    'empleados': 20,
    'alianzas_activas': 4,
    'alianzas_con_free': 1,
    'alianzas_con_premium': 3,
}

CARACTERISTICAS_FREE = {
    'metricas_avanzadas': False,
    'exportacion_reportes': False,
    'personalizacion_avanzada': False,
    'alianzas': True,
    'alianzas_proponer': False,
}

CARACTERISTICAS_PREMIUM = {
    'metricas_avanzadas': True,
    'exportacion_reportes': True,
    'personalizacion_avanzada': True,
    'alianzas': True,
    'alianzas_proponer': True,
}


def asegurar_planes():
    """Restaura el catálogo si una prueba TransactionTestCase vació la base."""
    free, _ = models.PlanSuscripcion.objects.get_or_create(
        codigo='free',
        defaults={
            'nombre': 'Free',
            'descripcion': 'Plan gratuito.',
            'orden': 10,
            'limites': dict(LIMITES_FREE),
            'caracteristicas': dict(CARACTERISTICAS_FREE),
            'status': True,
        },
    )
    premium, _ = models.PlanSuscripcion.objects.get_or_create(
        codigo='premium',
        defaults={
            'nombre': 'Premium',
            'descripcion': 'Plan de pago.',
            'orden': 20,
            'limites': dict(LIMITES_PREMIUM),
            'caracteristicas': dict(CARACTERISTICAS_PREMIUM),
            'status': True,
        },
    )
    for intervalo in ('mensual', 'anual'):
        models.PlanPrecio.objects.get_or_create(
            plan=premium, intervalo=intervalo,
            defaults={'monto': None, 'divisa': 'MXN', 'status': True},
        )
    return free, premium


def crear_negocio(nombre='Negocio', zona_horaria='America/Tijuana', status=True):
    categoria = models.CategoriaNegocio.objects.create(
        nombre=f'Categoria {uuid4().hex[:8]}',
    )
    return models.Negocio.objects.create(
        nombre=f'{nombre} {uuid4().hex[:6]}',
        direccion='Centro',
        correo=f'{uuid4().hex}@example.com',
        categoria=categoria,
        zona_horaria=zona_horaria,
        status=status,
    )


def asignar_plan(negocio, codigo='premium'):
    """Cambia el plan del negocio para pruebas que necesitan más cupo."""
    from core.services import planes

    asegurar_planes()
    plan = models.PlanSuscripcion.objects.get(codigo=codigo)
    actual = planes.suscripcion_actual(negocio)
    if actual is not None and actual.plan_id == plan.pk:
        return actual
    return planes.cambiar_plan(
        negocio=negocio,
        plan=plan,
        actor=None,
        motivo='Asignación de prueba.',
        origen='manual',
    )


def crear_sucursal(negocio, nombre='Sucursal', status=True):
    return models.Sucursal.objects.create(
        nombre=f'{nombre} {uuid4().hex[:6]}',
        direccion='Centro',
        ciudad='Tijuana',
        negocio=negocio,
        status=status,
    )


def crear_dinamica_puntos(
    negocio, puntos=10, dias_expiracion=None, status=True,
    fecha_inicio=None, fecha_fin=None,
):
    return models.Dinamica.objects.create(
        nombre=f'Puntos {uuid4().hex[:6]}',
        tipo='puntos',
        regla_conversion=puntos,
        dias_expiracion_puntos=dias_expiracion,
        fecha_inicio=fecha_inicio or timezone.now() - timedelta(days=30),
        fecha_fin=fecha_fin,
        status=status,
        negocio=negocio,
    )


def crear_recompensa(
    negocio, costo=0, titulo='Recompensa', vigencia_dias=30,
    cantidad_disponible=None, status=True, dinamica=None, es_meta=False,
):
    return models.Recompensa.objects.create(
        titulo=f'{titulo} {uuid4().hex[:6]}',
        descripcion='Beneficio de prueba',
        tipo='gratis',
        costo_desbloqueo=costo,
        terminos_condiciones='Válido en cualquier sucursal.',
        negocio=negocio,
        dinamica=dinamica,
        es_meta=es_meta,
        vigencia_dias=vigencia_dias,
        cantidad_disponible=cantidad_disponible,
        status=status,
    )


def crear_tarjeta(
    negocio, meta=3, repetible=False, status=True, titulo='Tarjeta',
    fecha_inicio=None, fecha_fin=None,
):
    dinamica = models.Dinamica.objects.create(
        nombre=f'Tarjeta {uuid4().hex[:6]}',
        tipo='sellos',
        meta=meta,
        es_repetible=repetible,
        fecha_inicio=fecha_inicio or timezone.now() - timedelta(days=30),
        fecha_fin=fecha_fin,
        status=status,
        negocio=negocio,
    )
    recompensa = crear_recompensa(
        negocio, titulo=titulo, dinamica=dinamica, es_meta=True,
    )
    return dinamica, recompensa


def crear_cupon(usuario, negocio, recompensa, dias=30, status='disponible'):
    return models.CuponUsuario.objects.create(
        usuario=usuario,
        negocio=negocio,
        recompensa=recompensa,
        status=status,
        fecha_expiracion=timezone.now() + timedelta(days=dias),
        titulo_beneficio=recompensa.titulo,
        descripcion_beneficio=recompensa.descripcion,
        tipo_beneficio=recompensa.tipo,
        condiciones_beneficio=recompensa.terminos_condiciones,
    )
