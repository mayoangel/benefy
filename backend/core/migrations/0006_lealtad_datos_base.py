# Corrección defensiva de datos existentes para el motor de lealtad.

import uuid
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.db import migrations
from django.utils import timezone


def _fecha_local(fecha, zona_horaria):
    try:
        zona = ZoneInfo(zona_horaria or 'America/Tijuana')
    except (ZoneInfoNotFoundError, ValueError):
        zona = ZoneInfo('America/Tijuana')
    return fecha.astimezone(zona).date()


def corregir_datos(apps, schema_editor):
    Negocio = apps.get_model('core', 'Negocio')
    Sucursal = apps.get_model('core', 'Sucursal')
    RegistroActividad = apps.get_model('core', 'RegistroActividad')
    Recompensa = apps.get_model('core', 'Recompensa')
    CuponUsuario = apps.get_model('core', 'CuponUsuario')
    Canje = apps.get_model('core', 'Canje')
    ProgresoUsuario = apps.get_model('core', 'ProgresoUsuario')
    CicloTarjeta = apps.get_model('core', 'CicloTarjeta')
    Dinamica = apps.get_model('core', 'Dinamica')

    zonas = dict(Negocio.objects.values_list('id', 'zona_horaria'))
    sucursales = dict(Sucursal.objects.values_list('id', 'negocio_id'))

    # Un QR único por negocio. En una migración con filas existentes, el
    # callable de AddField puede repetir el mismo UUID para todas las filas.
    vistos_qr = set()
    for negocio in Negocio.objects.order_by('id').iterator():
        if negocio.qr_uuid in vistos_qr:
            negocio.qr_uuid = uuid.uuid4()
            negocio.save(update_fields=['qr_uuid'])
        else:
            vistos_qr.add(negocio.qr_uuid)

    # Visitas: completar negocio y fecha local.
    for visita in RegistroActividad.objects.all().iterator():
        cambios = []
        if visita.negocio_id is None and visita.sucursal_id:
            visita.negocio_id = sucursales.get(visita.sucursal_id)
            cambios.append('negocio')
        if visita.fecha_negocio is None and visita.fecha:
            visita.fecha_negocio = _fecha_local(
                visita.fecha, zonas.get(visita.negocio_id),
            )
            cambios.append('fecha_negocio')
        if cambios:
            visita.save(update_fields=cambios)

    # Duplicados históricos: conservar la visita válida más antigua.
    vistos = set()
    for visita in RegistroActividad.objects.filter(
        tipo='visita', es_valida=True,
    ).order_by('usuario_id', 'negocio_id', 'fecha_negocio', 'fecha', 'id').iterator():
        clave = (visita.usuario_id, visita.negocio_id, visita.fecha_negocio)
        if clave in vistos:
            visita.es_valida = False
            visita.save(update_fields=['es_valida'])
        else:
            vistos.add(clave)

    # Dinámicas: dejar una sola dinámica de puntos activa por negocio.
    vistos_puntos = set()
    for dinamica in Dinamica.objects.filter(
        tipo='puntos', status=True,
    ).order_by('negocio_id', '-fecha_registro', '-id').iterator():
        if dinamica.negocio_id in vistos_puntos:
            dinamica.status = False
            dinamica.save(update_fields=['status'])
        else:
            vistos_puntos.add(dinamica.negocio_id)

    # Recompensas: completar negocio desde la dinámica.
    for recompensa in Recompensa.objects.select_related('dinamica').iterator():
        if recompensa.negocio_id is None and recompensa.dinamica_id:
            recompensa.negocio_id = recompensa.dinamica.negocio_id
            recompensa.save(update_fields=['negocio'])

    # Recompensas meta: conservar solo la primera por dinámica.
    vistos_meta = set()
    for recompensa in Recompensa.objects.filter(
        es_meta=True,
    ).order_by('dinamica_id', 'id').iterator():
        if recompensa.dinamica_id in vistos_meta:
            recompensa.es_meta = False
            recompensa.save(update_fields=['es_meta'])
        else:
            vistos_meta.add(recompensa.dinamica_id)

    # Cupones: completar negocio y snapshots básicos.
    for cupon in CuponUsuario.objects.select_related('recompensa__dinamica').iterator():
        cambios = []
        recompensa = cupon.recompensa
        if cupon.negocio_id is None:
            cupon.negocio_id = (
                recompensa.negocio_id
                or (recompensa.dinamica.negocio_id if recompensa.dinamica_id else None)
            )
            cambios.append('negocio')
        if not cupon.titulo_beneficio:
            cupon.titulo_beneficio = recompensa.titulo
            cambios.append('titulo_beneficio')
        if not cupon.descripcion_beneficio:
            cupon.descripcion_beneficio = recompensa.descripcion
            cambios.append('descripcion_beneficio')
        if not cupon.tipo_beneficio:
            cupon.tipo_beneficio = recompensa.tipo
            cambios.append('tipo_beneficio')
        if not cupon.condiciones_beneficio:
            cupon.condiciones_beneficio = recompensa.terminos_condiciones
            cambios.append('condiciones_beneficio')
        if not cupon.origen:
            cupon.origen = 'admin'
            cambios.append('origen')
        if cambios:
            cupon.save(update_fields=cambios)

    # Canjes legacy: completar negocio y marcar el flujo de personal.
    for canje in Canje.objects.select_related('sucursal').iterator():
        cambios = []
        if canje.negocio_id is None and canje.sucursal_id:
            canje.negocio_id = canje.sucursal.negocio_id
            cambios.append('negocio')
        if not canje.origen:
            canje.origen = 'personal'
            cambios.append('origen')
        if not canje.metodo:
            canje.metodo = 'personal'
            cambios.append('metodo')
        if cambios:
            canje.save(update_fields=cambios)

    # Progresos legacy de tarjetas: crear el ciclo 1.
    for progreso in ProgresoUsuario.objects.select_related('dinamica').iterator():
        if progreso.dinamica.tipo != 'sellos':
            continue
        if CicloTarjeta.objects.filter(
            usuario_id=progreso.usuario_id,
            dinamica_id=progreso.dinamica_id,
            numero_ciclo=1,
        ).exists():
            continue
        meta = progreso.dinamica.meta or 1
        sellos = min(int(progreso.saldo_acumulado or 0), meta)
        completado = bool(progreso.completado) or sellos >= meta
        recompensa = Recompensa.objects.filter(
            dinamica_id=progreso.dinamica_id, es_meta=True,
        ).first()
        CicloTarjeta.objects.create(
            usuario_id=progreso.usuario_id,
            dinamica_id=progreso.dinamica_id,
            negocio_id=progreso.dinamica.negocio_id,
            numero_ciclo=1,
            sellos_actuales=sellos,
            meta=meta,
            recompensa_id=recompensa.pk if recompensa else None,
            recompensa_titulo=recompensa.titulo if recompensa else '',
            recompensa_descripcion=recompensa.descripcion if recompensa else '',
            recompensa_tipo=recompensa.tipo if recompensa else 'gratis',
            recompensa_descuento=recompensa.descuento if recompensa else None,
            recompensa_condiciones=recompensa.terminos_condiciones if recompensa else '',
            recompensa_vigencia_dias=recompensa.vigencia_dias if recompensa else None,
            recompensa_fecha_expiracion=recompensa.fecha_expiracion if recompensa else None,
            estado='completado' if completado else 'en_curso',
            fecha_inicio=timezone.now(),
            fecha_fin=timezone.now() if completado else None,
        )


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0005_ciclotarjeta_lotepuntos_movimientopuntos_saldopuntos_and_more'),
    ]

    operations = [
        migrations.RunPython(corregir_datos, migrations.RunPython.noop),
    ]
