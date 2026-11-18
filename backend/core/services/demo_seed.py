"""Datos aditivos de demo mediante los servicios reales de negocio."""
from datetime import timedelta
from uuid import NAMESPACE_URL, uuid5

from django.core.management.base import CommandError
from django.db import connection, transaction

from core import models
from core.services import membresias, planes
from core.services.demo_auth import NAMESPACE, ACCOUNT_NAMES, demo_email
from core.services.lealtad import cupones, visitas


def stable_uuid(name):
    return uuid5(NAMESPACE_URL, NAMESPACE + ':' + name)


@transaction.atomic
def seed_dataset(identities):
    # Serializa dos ejecuciones del seed; el lock se libera al terminar la transacción.
    with connection.cursor() as cursor:
        cursor.execute('SELECT pg_advisory_xact_lock(%s)', [7026172026])
    profiles = {}
    for name in ACCOUNT_NAMES:
        user, created = models.Usuario.objects.get_or_create(correo=demo_email(name), defaults={
            'nombre': 'Demo ' + name, 'apellido': 'Benefy', 'supabase_uid': identities[name],
            'rol': 'admin_sistema' if name == 'admin' else 'consumidor',
        })
        if user.supabase_uid != identities[name]:
            raise CommandError('Un perfil reservado tiene otra identidad; se conserva y se cancela el seed.')
        profiles[name] = user
    category, _ = models.CategoriaNegocio.objects.get_or_create(nombre='Benefy Demo', defaults={'descripcion': 'Datos de prueba aislados.'})
    business, created = models.Negocio.objects.get_or_create(slug=NAMESPACE + '-cafe', defaults={
        'nombre': 'Café Benefy Demo', 'correo': demo_email('business'), 'direccion': 'Dirección de demostración',
        'categoria': category, 'qr_uuid': stable_uuid('business'),
    })
    if business.qr_uuid != stable_uuid('business'):
        raise CommandError('El identificador del negocio reservado está ocupado; no se modifica.')
    if created:
        planes.asignar_free_inicial(business, actor=profiles['owner'], motivo='Seed de demostración.')
    branch, _ = models.Sucursal.objects.get_or_create(qr_uuid=stable_uuid('branch'), defaults={
        'negocio': business, 'nombre': 'Centro Demo', 'direccion': 'Dirección de demostración', 'ciudad': 'Tijuana',
    })
    if branch.negocio_id != business.pk:
        raise CommandError('La sucursal reservada pertenece a otro negocio.')
    for name, role in [('owner', 'dueno'), ('supervisor', 'supervisor'), ('employee', 'empleado')]:
        if not models.UsuarioNegocio.objects.filter(usuario=profiles[name], negocio=business).exists():
            membresias.crear_membresia(usuario=profiles[name], negocio=business,
                                      sucursal=None if role == 'dueno' else branch, rol_comercio=role,
                                      actor=profiles['owner'], motivo='Seed de demostración.')
    anchor = business.fecha_registro.replace(hour=18, minute=0, second=0, microsecond=0)
    start = anchor - timedelta(days=60)
    points, _ = models.Dinamica.objects.get_or_create(negocio=business, nombre=NAMESPACE + '-puntos', defaults={
        'tipo': 'puntos', 'regla_conversion': 10, 'dias_expiracion_puntos': 180, 'fecha_inicio': start,
    })
    card, _ = models.Dinamica.objects.get_or_create(negocio=business, nombre=NAMESPACE + '-tarjeta', defaults={
        'tipo': 'sellos', 'meta': 3, 'es_repetible': True, 'fecha_inicio': start,
    })
    reward, _ = models.Recompensa.objects.get_or_create(negocio=business, titulo=NAMESPACE + '-cafe', defaults={
        'descripcion': 'Café de demostración', 'tipo': 'gratis', 'costo_desbloqueo': 20,
        'terminos_condiciones': 'Solo demostración.', 'vigencia_dias': 90,
    })
    models.Recompensa.objects.get_or_create(dinamica=card, es_meta=True, defaults={
        'negocio': business, 'titulo': NAMESPACE + '-premio-tarjeta', 'descripcion': 'Premio de demostración',
        'tipo': 'gratis', 'costo_desbloqueo': 0, 'terminos_condiciones': 'Solo demostración.', 'vigencia_dias': 90,
    })
    for index in range(1, 4):
        customer = profiles[f'customer-{index}']
        for day in range(12):
            when = anchor - timedelta(days=30 - day * 2)
            result = visitas.registrar_visita(usuario=customer, qr_uuid=branch.qr_uuid, ahora=when)
            if not result['already_registered']:
                # auto_now_add no representa el instante histórico suministrado al motor.
                models.RegistroActividad.objects.filter(pk=result['visita'].pk).update(fecha=when)
                models.MovimientoPuntos.objects.filter(usuario=customer, negocio=business,
                    referencia=f"visita:{result['visita'].pk}", tipo='otorgado').update(fecha=when)
                for coupon in result['cupones_emitidos']:
                    models.CuponUsuario.objects.filter(uuid=coupon).update(fecha_emision=when)
        for number in range(2):
            when = anchor - timedelta(days=3 - number)
            coupon, new = cupones.adquirir_cupon(usuario=customer, recompensa_id=reward.pk,
                clave_idempotencia=str(stable_uuid(f'coupon:{index}:{number}')), ahora=when)
            if new:
                models.CuponUsuario.objects.filter(pk=coupon.pk).update(fecha_emision=when)
                models.MovimientoPuntos.objects.filter(usuario=customer, negocio=business,
                    referencia=f'adquisicion:{coupon.clave_idempotencia}').update(fecha=when)
                if number == 0:
                    redemption, _ = cupones.canjear_cupon(usuario=customer, cupon_uuid=coupon.uuid, ahora=when)
                    # El servicio devuelve el canje creado, no se inserta uno artificial.
                    models.Canje.objects.filter(pk=redemption.pk).update(fecha=when)
    return {name: model.objects.filter(negocio=business).count() for name, model in (
        ('visitas', models.RegistroActividad), ('cupones', models.CuponUsuario),
        ('canjes', models.Canje), ('lotes', models.LotePuntos), ('movimientos', models.MovimientoPuntos),
        ('ciclos', models.CicloTarjeta), ('membresias', models.UsuarioNegocio))}
