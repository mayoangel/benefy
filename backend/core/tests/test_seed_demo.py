from io import StringIO
from datetime import datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
import tempfile
from unittest.mock import patch

from django.core.management import call_command, CommandError
from django.test import TestCase

from core import models
from core.management.commands.seed_demo import target_fingerprint, verify_remote_authorization


class SeedDemoTests(TestCase):
    def test_default_is_read_only_plan(self):
        output = StringIO()
        call_command('seed_demo', stdout=output)
        self.assertEqual(models.Usuario.objects.count(), 0)
        self.assertEqual(models.Negocio.objects.count(), 0)
        self.assertIn('plan', output.getvalue())

    def test_remote_writes_fail_before_any_auth_or_database_write(self):
        with patch('core.management.commands.seed_demo.is_local_database', return_value=False), patch('core.services.showcase_runner.AdminAuth') as auth:
            with self.assertRaises(CommandError):
                call_command('seed_demo', apply=True, offline_profiles=True, stdout=StringIO())
            auth.assert_not_called()
        self.assertFalse(models.Usuario.objects.exists())

    def test_backup_receipt_rejects_wrong_target_tampering_and_staleness(self):
        with tempfile.TemporaryDirectory() as directory:
            backup = Path(directory) / 'backup.dump'
            backup.write_bytes(b'PGDMPsynthetic-format-fixture')
            target = target_fingerprint()
            receipt = {'target': target, 'file': backup.name,
                       'sha256': hashlib.sha256(backup.read_bytes()).hexdigest(),
                       'created_at': datetime.now(timezone.utc).isoformat()}
            path = Path(directory) / 'backup.json'
            path.write_text(json.dumps(receipt))
            options = {'allow_remote': True, 'expected_target': target, 'backup_receipt': str(path)}
            verify_remote_authorization(options, target)
            for change in ({'target': 'another-destination'}, {'sha256': 'changed'},
                           {'created_at': (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()}):
                path.write_text(json.dumps({**receipt, **change}))
                with self.assertRaises(CommandError):
                    verify_remote_authorization(options, target)
