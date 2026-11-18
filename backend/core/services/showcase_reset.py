"""Reinicio explícito y limitado al proyecto de demostración autorizado."""
import hashlib
import json
from urllib.parse import urlsplit

from django.apps import apps
from django.conf import settings
from django.core.management.base import CommandError
from django.db import connection, transaction

AUTHORIZED_PROJECT = 'rmwwrgahhuztylqkduya'
# Orden de dependencias, sin TRUNCATE, CASCADE, DDL ni esquemas administrados.
RESET_MODELS = ('Notificacion', 'MovimientoPuntos', 'ProgresoUsuario', 'CicloTarjeta', 'Canje',
    'CuponUsuario', 'RegistroActividad', 'LotePuntos', 'SaldoPuntos', 'InvitacionMembresia',
    'RegistroComercial', 'AuditoriaMembresia', 'UsuarioNegocio', 'PlanCambioAuditoria', 'Pago',
    'Suscripcion', 'Recompensa', 'Dinamica', 'Alianza', 'Sucursal', 'Negocio', 'CategoriaNegocio', 'Usuario')


def verify_project(expected):
    db = settings.DATABASES['default']
    host = db['HOST']
    project = host.split('.')[1] if host.startswith('db.') and host.endswith('.supabase.co') else (
        db['USER'].split('.', 1)[1] if host.endswith('.pooler.supabase.com') and '.' in db['USER'] else None)
    auth_project = (urlsplit(settings.SUPABASE_URL).hostname or '').split('.')[0]
    if expected != AUTHORIZED_PROJECT or project != expected or auth_project != expected:
        raise CommandError('El reinicio solo está autorizado en el proyecto Supabase de demostración fijado en el código.')
    return project


def schema_fingerprint():
    queries = [
        "SELECT n.nspname,c.relname,a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth','storage') AND a.attnum>0 AND NOT a.attisdropped ORDER BY 1,2,3",
        "SELECT n.nspname,c.relname,pg_get_constraintdef(x.oid) FROM pg_constraint x JOIN pg_class c ON c.oid=x.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth','storage') ORDER BY 1,2,3",
        "SELECT n.nspname,c.relname,pg_get_triggerdef(t.oid) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal AND n.nspname IN ('public','auth','storage') ORDER BY 1,2,3",
        "SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname IN ('public','auth','storage') ORDER BY 1,2,3",
        "SELECT n.nspname,p.proname,md5(pg_get_functiondef(p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','auth','storage') AND p.prokind='f' ORDER BY 1,2,3",
        "SELECT app,name,applied FROM django_migrations ORDER BY app,name",
        "SELECT n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','auth','storage') ORDER BY 1,2",
    ]
    results = []
    with connection.cursor() as cursor:
        for query in queries:
            cursor.execute(query)
            results.append(cursor.fetchall())
    return hashlib.sha256(json.dumps(results, default=str).encode()).hexdigest()


def remote_inventory(auth_users):
    tables = {apps.get_model('core', name)._meta.db_table for name in RESET_MODELS}
    with connection.cursor() as cursor:
        cursor.execute('SELECT id::text FROM auth.users ORDER BY id')
        database_ids = {row[0] for row in cursor.fetchall()}
        if database_ids != {user['id'] for user in auth_users}:
            raise CommandError('El inventario Auth no coincide con PostgreSQL. No se puede acreditar el destino.')
        cursor.execute('SELECT count(*) FROM storage.objects')
        if cursor.fetchone()[0]:
            raise CommandError('Hay objetos Storage; el reinicio se bloquea para no afectar datos fuera de alcance.')
        cursor.execute('SELECT count(*) FROM core_pago')
        if cursor.fetchone()[0]:
            raise CommandError('Hay registros de pagos que requieren revisión antes de limpiar.')
        cursor.execute("SELECT ns.nspname,c.relname,fn.nspname,fr.relname FROM pg_constraint k JOIN pg_class c ON k.conrelid=c.oid JOIN pg_namespace ns ON c.relnamespace=ns.oid JOIN pg_class fr ON fr.oid=k.confrelid JOIN pg_namespace fn ON fn.oid=fr.relnamespace WHERE k.contype='f'")
        for schema, source, destination_schema, destination in cursor.fetchall():
            if destination_schema == 'public' and destination in tables and not (schema == 'public' and source in tables):
                raise CommandError('Una tabla fuera del alcance depende de datos a reemplazar. Se cancela el reinicio.')
    return {'schema': schema_fingerprint(), 'auth_ids': sorted(database_ids),
            'tables': {name: apps.get_model('core', name).objects.count() for name in RESET_MODELS}}


@transaction.atomic
def clear_application_data():
    from core.management.commands.seed_demo import is_local_database
    if not is_local_database():
        verify_project(AUTHORIZED_PROJECT)
    with connection.cursor() as cursor:
        cursor.execute('SELECT pg_advisory_xact_lock(%s)', [7026172026])
        for name in RESET_MODELS:
            table = apps.get_model('core', name)._meta.db_table
            cursor.execute('DELETE FROM "public".' + connection.ops.quote_name(table))
