"""Coordinación explícita entre Auth y datos de la aplicación, con respaldo previo."""
import json
import hashlib

from django.conf import settings
from django.core.management.base import CommandError
from django.db import connection
from core import models

from core.services.showcase_auth import AdminAuth, accounts
from core.services.showcase_dataset import seed_showcase, stable_id
from core.services.showcase_reset import clear_application_data, remote_inventory, schema_fingerprint, verify_project


def run_showcase(options, output):
    from core.management.commands.seed_demo import is_local_database
    if not options['apply'] or is_local_database():
        return _run_showcase(options, output)
    verify_project(options['expected_project'])
    with connection.cursor() as cursor:
        cursor.execute('SELECT pg_try_advisory_lock(%s)', [7026172026])
        if not cursor.fetchone()[0]:
            raise CommandError('Ya hay un proceso de seed activo. No se ejecuta otro reemplazo concurrente.')
    try:
        return _run_showcase(options, output)
    finally:
        with connection.cursor() as cursor:
            cursor.execute('SELECT pg_advisory_unlock(%s)', [7026172026])


def _run_showcase(options, output):
    from core.management.commands.seed_demo import is_local_database, target_fingerprint, verify_remote_authorization
    target = target_fingerprint()
    if not options['apply']:
        output.write(json.dumps({'mode': 'reset-plan' if options['reset'] else 'initialize-plan', 'target': target,
            'accounts': len(accounts()), 'customers': 60, 'businesses': 4, 'branches': 6, 'history_days': 180}))
        return
    if settings.IS_PRODUCTION:
        raise CommandError('Este seed requiere el entorno de desarrollo/demo.')
    local = is_local_database()
    if not options['reset'] and (models.Negocio.objects.exclude(slug__startswith='benefy-showcase-v2').exists()
            or models.Usuario.objects.exclude(correo__in=accounts().values()).exists()):
        raise CommandError('Existen datos anteriores; la inicialización no los mezcla. Se requiere reinicio explícito y autorizado.')
    if local:
        if not options['offline_profiles']:
            raise CommandError('La validación local requiere perfiles offline, sin afectar Auth remoto.')
        identities = {name: stable_id('offline:' + name) for name in accounts()}
        if options['reset']:
            clear_application_data()
        result = seed_showcase(identities, output.write)
    else:
        if options['offline_profiles']:
            raise CommandError('No se permiten perfiles offline en Supabase remoto.')
        verify_project(options['expected_project'])
        verify_remote_authorization(options, target)
        client = AdminAuth()
        auth_settings_before = hashlib.sha256(json.dumps(client.request('settings'), sort_keys=True).encode()).hexdigest()
        old_users = client.users()
        before = remote_inventory(old_users)
        identities = client.provision(old_users, reset=options['reset'], progress=output.write)
        if options['reset']:
            clear_application_data()
            desired = {str(uid) for uid in identities.values()}
            for user in old_users:
                if user['id'] not in desired:
                    client.request('admin/users/' + user['id'], method='DELETE')
            output.write('Datos anteriores retirados del destino verificado; catálogos y esquemas conservados.')
        result = seed_showcase(identities, output.write, parallel=True)
        if schema_fingerprint() != before['schema']:
            raise CommandError('Cambió la huella estructural. Revisa el respaldo y el esquema antes de continuar.')
        if hashlib.sha256(json.dumps(client.request('settings'), sort_keys=True).encode()).hexdigest() != auth_settings_before:
            raise CommandError('Cambió la configuración global de Auth; requiere revisión.')
        users = client.users()
        if {user['id'] for user in users} != {str(uid) for uid in identities.values()}:
            raise CommandError('Quedaron cuentas Auth fuera del dataset; revisar sin borrado automático adicional.')
        result['AuthUsers'] = len(users)
        result['schema_preserved'] = True
    output.write(json.dumps({'mode': 'applied', 'dataset': 'showcase', 'counts': result}))
