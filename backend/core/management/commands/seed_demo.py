"""Seed protegido: plan por defecto, confirmación y respaldo para destinos remotos."""
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from urllib.parse import urlsplit

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

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
    help = 'Plan de la demo; --apply inicializa y --reset reemplaza solo el destino autorizado.'

    def add_arguments(self, parser):
        parser.add_argument('--reset', action='store_true')
        parser.add_argument('--expected-project')
        parser.add_argument('--apply', action='store_true')
        parser.add_argument('--offline-profiles', action='store_true')
        parser.add_argument('--allow-remote', action='store_true')
        parser.add_argument('--expected-target')
        parser.add_argument('--backup-receipt')
        parser.add_argument('--target-only', action='store_true')

    def handle(self, *args, **options):
        if options['target_only']:
            self.stdout.write(target_fingerprint())
            return
        from core.services.showcase_runner import run_showcase
        return run_showcase(options, self.stdout)
