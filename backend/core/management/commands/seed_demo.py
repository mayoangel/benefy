"""Seed protegido: plan por defecto, confirmación y respaldo para destinos remotos."""
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from urllib.parse import urlsplit

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from core.services.demo_auth import ACCOUNT_NAMES, provision_accounts
from core.services.demo_seed import seed_dataset, stable_uuid


def target_fingerprint():
    db = settings.DATABASES['default']
    identity = [db.get(key, '') for key in ('HOST', 'PORT', 'NAME', 'USER')]
    identity.append(settings.SUPABASE_URL.rstrip('/'))
    return hashlib.sha256(json.dumps(identity, separators=(',', ':')).encode()).hexdigest()[:24]


def is_local_database():
    db = settings.DATABASES['default']
    # No basta ENVIRONMENT=development: la demo existente utiliza una DB remota.
    return (db['HOST'] in ('postgres', 'db', 'localhost', '127.0.0.1')
            and (db['NAME'] == 'benefy_devdemo' or db['NAME'].startswith('test_')))


def verify_remote_authorization(options, target):
    if not options['allow_remote'] or options['expected_target'] != target:
        raise CommandError('Escritura remota bloqueada: requiere --allow-remote, destino confirmado y respaldo verificado.')
    try:
        receipt_path = Path(options['backup_receipt']).resolve()
        receipt = json.loads(receipt_path.read_text(encoding='utf-8'))
        filename = receipt['file']
        if Path(filename).name != filename:
            raise ValueError
        backup = receipt_path.parent / filename
        created = datetime.fromisoformat(receipt['created_at'])
        age = (datetime.now(timezone.utc) - created).total_seconds()
        with backup.open('rb') as stream:
            if stream.read(5) != b'PGDMP':
                raise ValueError
            stream.seek(0)
            digest = hashlib.file_digest(stream, 'sha256').hexdigest()
        if receipt['target'] != target or digest != receipt['sha256'] or not 0 <= age <= 86400:
            raise ValueError
    except (TypeError, KeyError, ValueError, OSError):
        raise CommandError('Respaldo inválido, de otro destino, alterado o con más de 24 horas. No se escribieron datos.') from None


class Command(BaseCommand):
    help = 'Muestra un plan; --apply añade datos aislados sin borrar ni reasignar identidades.'

    def add_arguments(self, parser):
        parser.add_argument('--dataset', choices=['legacy', 'showcase'], default='legacy')
        parser.add_argument('--reset', action='store_true')
        parser.add_argument('--expected-project')
        parser.add_argument('--apply', action='store_true')
        parser.add_argument('--offline-profiles', action='store_true')
        parser.add_argument('--allow-remote', action='store_true')
        parser.add_argument('--expected-target')
        parser.add_argument('--backup-receipt')
        parser.add_argument('--target-only', action='store_true')

    def handle(self, *args, **options):
        if options['dataset'] == 'showcase':
            from core.services.showcase_runner import run_showcase
            return run_showcase(options, self.stdout)
        if options['reset']:
            raise CommandError('El reinicio solo existe en el dataset showcase y exige su protección específica.')
        target = target_fingerprint()
        if options['target_only']:
            self.stdout.write(target)
            return
        if not options['apply']:
            self.stdout.write(json.dumps({'mode': 'plan', 'target': target, 'local_database': is_local_database(),
                'accounts': len(ACCOUNT_NAMES), 'businesses': 1, 'branches': 1,
                'history': '36 visitas, puntos, tarjetas, recompensas, cupones y canjes mediante servicios reales',
                'existing_data': 'se conservan identificadores, permisos y datos existentes'}))
            return
        if settings.IS_PRODUCTION:
            raise CommandError('El seed no se ejecuta con settings de producción.')
        local = is_local_database()
        if not local:
            verify_remote_authorization(options, target)
        if options['offline_profiles']:
            if not local:
                raise CommandError('Los perfiles sin Auth solo están permitidos en una DB local aislada.')
            identities = {name: stable_uuid('offline:' + name) for name in ACCOUNT_NAMES}
        else:
            # Un dump de una DB local no respalda Auth remoto. Exigir ambos en el mismo proyecto.
            db = settings.DATABASES['default']
            host = db['HOST']
            project = host.split('.')[1] if host.startswith('db.') and host.endswith('.supabase.co') else (
                db['USER'].split('.', 1)[1] if host.endswith('.pooler.supabase.com') and '.' in db['USER'] else None)
            auth_project = (urlsplit(settings.SUPABASE_URL).hostname or '').split('.')[0]
            if local or not project or project != auth_project:
                raise CommandError('Provisionar Auth exige que PostgreSQL y Auth sean del mismo proyecto Supabase respaldado. Para pruebas locales utiliza --offline-profiles.')
            verify_remote_authorization(options, target)
            identities = provision_accounts()
        counts = seed_dataset(identities)
        self.stdout.write(json.dumps({'mode': 'applied', 'target': target, 'counts': counts,
            'auth': 'offline profiles only' if options['offline_profiles'] else 'Supabase Auth'}))
