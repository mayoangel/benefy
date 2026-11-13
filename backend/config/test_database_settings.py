"""Prueba el aislamiento de entornos sin conectarse a ninguna base de datos."""

import json
import os
from pathlib import Path
import subprocess
import sys

from django.test import SimpleTestCase


class DatabaseSettingsTests(SimpleTestCase):
    def load_settings(self, **overrides):
        environment = os.environ.copy()
        environment.update({
            'ENVIRONMENT': 'production', 'DEBUG': 'False',
            'SECRET_KEY': 'test-only-' + 'x' * 60,
            'ALLOWED_HOSTS': 'backend',
            'DB_HOST': 'example.pooler.supabase.com', 'DB_PORT': '5432',
            'DB_NAME': 'postgres', 'DB_USER': 'test-user',
            'DB_PASSWORD': 'test-password', 'DB_SSLROOTCERT': '',
        })
        environment.pop('DB_SSLMODE', None)
        environment.update(overrides)
        return subprocess.run(
            [sys.executable, '-c',
             'import json; from config.settings import DATABASES; '
             'db = DATABASES["default"]; '
             'print(json.dumps({key: db[key] for key in ("ENGINE", "HOST", "PORT", "NAME", "OPTIONS")}))'],
            cwd=Path(__file__).resolve().parent.parent,
            env=environment, capture_output=True, text=True,
        )

    def test_production_requires_ssl_and_uses_explicit_target(self):
        result = self.load_settings()
        self.assertEqual(result.returncode, 0, result.stderr)
        database = json.loads(result.stdout)
        self.assertEqual(database['HOST'], 'example.pooler.supabase.com')
        self.assertEqual(database['OPTIONS']['sslmode'], 'require')
        self.assertEqual(database['ENGINE'], 'django.db.backends.postgresql')

    def test_local_uses_same_engine_without_ssl(self):
        result = self.load_settings(ENVIRONMENT='development', DEBUG='True',
                                    DB_HOST='db', DB_NAME='benefy_db', DB_SSLMODE='disable')
        self.assertEqual(result.returncode, 0, result.stderr)
        database = json.loads(result.stdout)
        self.assertEqual(database['HOST'], 'db')
        self.assertEqual(database['OPTIONS']['sslmode'], 'disable')
        self.assertEqual(database['ENGINE'], 'django.db.backends.postgresql')

    def test_production_rejects_insecure_or_missing_configuration(self):
        for overrides in ({'DEBUG': 'True'}, {'DB_SSLMODE': 'disable'},
                          {'DB_SSLMODE': 'prefer'}, {'DB_PASSWORD': ''},
                          {'SECRET_KEY': 'short'}):
            with self.subTest(overrides=overrides):
                result = self.load_settings(**overrides)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn('ImproperlyConfigured', result.stderr)
