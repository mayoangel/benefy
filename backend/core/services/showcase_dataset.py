"""Dataset de seis meses, generado por el motor de lealtad existente."""
from datetime import datetime, time, timedelta
from concurrent.futures import ThreadPoolExecutor
import random
from uuid import NAMESPACE_URL, uuid5
from zoneinfo import ZoneInfo

from django.core.management.base import CommandError
from django.db import connection, transaction
from django.db.models import Count, F, Sum
from django.utils import timezone

from core import access, models
from core.services import membresias, planes
from core.services.lealtad import cupones, puntos, visitas
from core.services.showcase_auth import SHOWCASE, accounts

ZONE = ZoneInfo('America/Tijuana')
BUSINESSES = [
    ('aurora', 'Café Aurora', 'Cafetería', 'premium', ['Centro', 'Río'], 10, 5, 90),
    ('norte', 'Barbería Norte', 'Barbería', 'free', ['Centro'], 15, 3, 180),
    ('impulso', 'Impulso Fitness', 'Gimnasio', 'premium', ['Río', 'Playas'], 20, 8, 120),
    ('verde', 'Casa Verde', 'Restaurante', 'free', ['Cacho'], 10, 4, 90),
]
FIRST = ['Mariana', 'Roberto', 'Valeria', 'Daniel', 'Sofía', 'Diego', 'Camila', 'Mateo', 'Lucía', 'Andrés', 'Elena', 'Nicolás']
LAST = ['García', 'Navarro', 'Cruz', 'López', 'Torres']


def stable_id(value):
    return uuid5(NAMESPACE_URL, SHOWCASE + ':' + value)


def profile_defaults(name, uid):
    if name.startswith('customer-'):
        i = int(name.split('-')[1])
        first, last = FIRST[i % len(FIRST)], LAST[i // len(FIRST)]
    else:
        first, last = {'admin': ('Ana', 'Administración'), 'business': ('Alejandro', 'Martínez'),
                       'user': ('Mariana', 'García'), 'supervisor': ('Daniel', 'López'),
                       'employee': ('Sofía', 'Torres')}[name]
    return {'supabase_uid': uid, 'nombre': first, 'apellido': last,
            'rol': 'admin_sistema' if name == 'admin' else 'consumidor'}


def create_resource(model, lookup, defaults):
    obj = model.objects.filter(**lookup).first()
    if obj is not None:
        return obj, False
    access.verificar_limite_creacion(model, {**lookup, **defaults})
    return model.objects.create(**lookup, **defaults), True


def seed_showcase(identities, progress=lambda message: None, parallel=False):
    profiles = {}
    with transaction.atomic():
        for name, email in accounts().items():
            user, _ = models.Usuario.objects.get_or_create(correo=email, defaults=profile_defaults(name, identities[name]))
            if user.supabase_uid != identities[name]:
                raise CommandError('Una identidad existente no coincide con Auth; se cancela sin reasignarla.')
            profiles[name] = user
    customer_names = ['user'] + [f'customer-{i:02}' for i in range(1, 60)]
    jobs = list(enumerate(BUSINESSES))
    if parallel:
        # Cada negocio tiene sus saldos, lotes y claves de operación independientes.
        with ThreadPoolExecutor(max_workers=4) as executor:
            futures = [executor.submit(_seed_business, spec, profiles, customer_names, progress) for spec in jobs]
            for future in futures:
                future.result()
    else:
        for spec in jobs:
            _seed_business(spec, profiles, customer_names, progress)
    puntos.expirar_puntos()
    return validate_showcase()


def _seed_business(spec, profiles, customer_names, progress):
    biz_index, (slug, title, category_name, plan_code, branch_names, grant, stamps, expiry) = spec
    try:
        with transaction.atomic():
            category, _ = models.CategoriaNegocio.objects.get_or_create(nombre=category_name)
            business, created = models.Negocio.objects.get_or_create(slug=SHOWCASE + '-' + slug, defaults={
                'nombre': title, 'descripcion': f'{title}: calidad, atención cercana y beneficios por cada visita.',
                'correo': slug + '@negocios.benefy.example.invalid', 'direccion': 'Tijuana, Baja California',
                'categoria': category, 'qr_uuid': stable_id('business:' + slug),
            })
            if business.qr_uuid != stable_id('business:' + slug):
                raise CommandError('El negocio coincide con un identificador ajeno al dataset.')
            if created:
                anchor = timezone.now().astimezone(ZONE).date()
                start = datetime.combine(anchor - timedelta(days=190), time(10), ZONE)
                models.Negocio.objects.filter(pk=business.pk).update(fecha_registro=start)
                business.fecha_registro = start
                planes.asignar_free_inicial(business, actor=profiles['business'], motivo='Inicialización de demostración.')
                if plan_code == 'premium':
                    planes.cambiar_plan(negocio=business, plan=models.PlanSuscripcion.objects.get(codigo='premium'),
                                        actor=profiles['admin'], motivo='Demostración de capacidades Premium.')
            anchor_date = business.fecha_registro.astimezone(ZONE).date() + timedelta(days=190)
            anchor = datetime.combine(anchor_date, time(12), ZONE)
            start = anchor - timedelta(days=190)
            branches = []
            for branch_name in branch_names:
                branch, new = create_resource(models.Sucursal, {'qr_uuid': stable_id(slug + ':' + branch_name)}, {
                    'nombre': branch_name, 'negocio': business, 'ciudad': 'Tijuana',
                    'direccion': {'Centro': 'Av. Revolución 1200', 'Río': 'Paseo de los Héroes 9500',
                                  'Playas': 'Paseo Ensenada 120', 'Cacho': 'Av. Brasil 480'}[branch_name],
                })
                if new:
                    models.Sucursal.objects.filter(pk=branch.pk).update(fecha_registro=start)
                branches.append(branch)
            for name, role in [('business', 'dueno'), ('supervisor', 'supervisor'), ('employee', 'empleado')]:
                branch = None if role == 'dueno' else branches[0]
                if not models.UsuarioNegocio.objects.filter(usuario=profiles[name], negocio=business).exists():
                    access.verificar_limite_creacion(models.UsuarioNegocio, {'negocio': business, 'rol_comercio': role, 'status': True})
                    membresias.crear_membresia(usuario=profiles[name], negocio=business, sucursal=branch,
                        rol_comercio=role, actor=profiles['business'], motivo='Equipo de demostración.')
            program, _ = create_resource(models.Dinamica, {'negocio': business, 'nombre': 'Puntos ' + title}, {
                'tipo': 'puntos', 'regla_conversion': grant, 'dias_expiracion_puntos': expiry, 'fecha_inicio': start,
            })
            card, _ = create_resource(models.Dinamica, {'negocio': business, 'nombre': 'Tu próxima recompensa · ' + title}, {
                'tipo': 'sellos', 'meta': stamps, 'es_repetible': True, 'fecha_inicio': start,
            })
            reward, _ = create_resource(models.Recompensa, {'negocio': business, 'titulo': ['Café de la casa', 'Arreglo de barba', 'Clase especial', 'Postre de temporada'][biz_index]}, {
                'descripcion': 'Un beneficio para agradecer tu preferencia.', 'tipo': 'gratis', 'costo_desbloqueo': 30,
                'terminos_condiciones': 'Una recompensa por visita. Sujeto a disponibilidad.', 'vigencia_dias': 60,
            })
            create_resource(models.Recompensa, {'negocio': business, 'titulo': '15% en tu próxima visita'}, {
                'descripcion': 'Un detalle para que vuelvas.', 'tipo': 'descuento', 'descuento': 15,
                'costo_desbloqueo': 80, 'terminos_condiciones': 'No acumulable.', 'vigencia_dias': 45,
            })
            create_resource(models.Recompensa, {'dinamica': card, 'es_meta': True}, {
                'negocio': business, 'titulo': 'Visita de cortesía · ' + title, 'descripcion': 'Tu constancia tiene premio.',
                'tipo': 'gratis', 'costo_desbloqueo': 0, 'terminos_condiciones': 'Válido al completar la tarjeta.', 'vigencia_dias': 60,
            })
        assigned = [name for index, name in enumerate(customer_names) if index % 4 == biz_index or name == 'user']
        for customer_index, name in enumerate(assigned):
            customer = profiles[name]
            rng = random.Random(str(stable_id(slug + ':' + name)))
            offsets = sorted(rng.sample(range(2, 180), 16) + [1, 180], reverse=True)
            with transaction.atomic():
                existing = set(models.RegistroActividad.objects.filter(usuario=customer, negocio=business, tipo='visita').values_list('fecha_negocio', flat=True))
                for visit_index, offset in enumerate(offsets):
                    when = anchor - timedelta(days=offset)
                    if when.date() in existing:
                        continue
                    branch = branches[rng.randrange(len(branches))]
                    result = visitas.registrar_visita(usuario=customer, qr_uuid=branch.qr_uuid, ahora=when)
                    if result['already_registered']:
                        continue
                    models.RegistroActividad.objects.filter(pk=result['visita'].pk).update(fecha=when)
                    models.MovimientoPuntos.objects.filter(usuario=customer, negocio=business,
                        referencia=f"visita:{result['visita'].pk}", tipo='otorgado').update(fecha=when)
                    models.CuponUsuario.objects.filter(uuid__in=result['cupones_emitidos']).update(fecha_emision=when)
                    if visit_index in (5, 11, 17):
                        coupon, new = cupones.adquirir_cupon(usuario=customer, recompensa_id=reward.pk,
                            clave_idempotencia=str(stable_id(f'coupon:{slug}:{name}:{visit_index}')), ahora=when)
                        if new:
                            models.CuponUsuario.objects.filter(pk=coupon.pk).update(fecha_emision=when)
                            models.MovimientoPuntos.objects.filter(usuario=customer, negocio=business,
                                referencia='adquisicion:' + coupon.clave_idempotencia).update(fecha=when)
                            if visit_index != 17:
                                redemption, _ = cupones.canjear_cupon(usuario=customer, cupon_uuid=coupon.uuid, ahora=when)
                                models.Canje.objects.filter(pk=redemption.pk).update(fecha=when)
            if customer_index % 3 == 0:
                progress(f'{title}: historial de {customer_index + 1}/{len(assigned)} clientes completado.')
    finally:
        if not connection.in_atomic_block:
            connection.close()


def validate_showcase():
    differences = puntos.verificar_saldos()
    duplicates = models.RegistroActividad.objects.filter(es_valida=True, tipo='visita').values('usuario', 'negocio', 'fecha_negocio').annotate(n=Count('id')).filter(n__gt=1).exists()
    wrong_canjes = models.Canje.objects.exclude(cupon__status='canjeado').filter(anulado=False).exists()
    wrong_lots = models.LotePuntos.objects.filter(cantidad_disponible__gt=F('cantidad_otorgada')).exists()
    wrong_memberships = models.UsuarioNegocio.objects.exclude(sucursal__isnull=True).exclude(sucursal__negocio=F('negocio')).exists()
    wrong_ledger = any((models.MovimientoPuntos.objects.filter(usuario_id=saldo.usuario_id, negocio_id=saldo.negocio_id).aggregate(total=Sum('cantidad'))['total'] or 0) != saldo.saldo_actual for saldo in models.SaldoPuntos.objects.all())
    wrong_scope = models.Negocio.objects.exclude(slug__startswith=SHOWCASE).exists()
    if differences or duplicates or wrong_canjes or wrong_lots or wrong_memberships or wrong_ledger or wrong_scope:
        raise CommandError('El dataset no superó la validación de saldos, visitas, canjes o referencias.')
    for business in models.Negocio.objects.filter(slug__startswith=SHOWCASE):
        if planes.resumen_plan(business).get('excedentes'):
            raise CommandError('Un negocio supera los límites de su plan.')
    return {model.__name__: model.objects.count() for model in (models.Usuario, models.Negocio, models.Sucursal,
        models.UsuarioNegocio, models.Dinamica, models.Recompensa, models.RegistroActividad, models.CuponUsuario,
        models.Canje, models.SaldoPuntos, models.LotePuntos, models.MovimientoPuntos, models.CicloTarjeta)}
