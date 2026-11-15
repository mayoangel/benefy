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
