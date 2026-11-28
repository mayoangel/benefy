import importlib.util
import io
import json
from pathlib import Path
import unittest
from contextlib import redirect_stderr, redirect_stdout
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]


def smoke_module():
    spec = importlib.util.spec_from_file_location(
        'benefy_smoke_deploy', ROOT / 'tools' / 'smoke_deploy.py',
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class SmokeDeployTests(unittest.TestCase):
    def test_join_normalizes_slashes(self):
        smoke = smoke_module()
        self.assertEqual(
            smoke._join('https://api.example.com/', '/health/live/'),
            'https://api.example.com/health/live/',
        )

    def test_health_only_no_requiere_credenciales(self):
        smoke = smoke_module()
        calls = []

        def fake_request(method, url, **kwargs):
            calls.append(url)
            if url.endswith('/health/live/'):
                return 200, {'status': 'ok'}
            if url.endswith('/health/db/'):
                return 200, {'status': 'ok', 'database': 'ok'}
            raise AssertionError(url)

        output = io.StringIO()
        with patch.object(smoke, '_request_json', side_effect=fake_request), \
                redirect_stdout(output):
            code = smoke.main(['--base-url', 'https://api.example.com', '--health-only'])

        self.assertEqual(code, 0)
        self.assertEqual(len(calls), 2)
        result = json.loads(output.getvalue())
        self.assertTrue(result['ok'])
        self.assertEqual(
            [check['name'] for check in result['checks']],
            ['health_live', 'health_db'],
        )

    def test_sin_credenciales_falla_antes_de_llamar_http(self):
        smoke = smoke_module()
        errors = io.StringIO()
        with patch.object(smoke, '_request_json') as request_mock, \
                redirect_stderr(errors):
            code = smoke.main(['--base-url', 'https://api.example.com'])

        self.assertEqual(code, 2)
        request_mock.assert_not_called()
        self.assertIn('Faltan credenciales', errors.getvalue())
        self.assertIn('--password/SMOKE_PASSWORD', errors.getvalue())

    def test_contrasena_no_aparece_en_el_reporte(self):
        smoke = smoke_module()

        def fake_request(method, url, **kwargs):
            if url.endswith('/health/live/'):
                return 200, {'status': 'ok'}
            if url.endswith('/health/db/'):
                return 200, {'status': 'ok', 'database': 'ok'}
            if url.endswith('/auth/v1/token?grant_type=password'):
                return 200, {'access_token': 'token-sintetico'}
            if url.endswith('/autenticacion/perfil/'):
                return 200, {'id': 1}
            if url.endswith('/mi/contexto/'):
                return 200, {'negocios': [], 'sucursales': []}
            if url.endswith('/sucursales/listar/'):
                raise smoke.SmokeError('HTTP 403 en sucursales', status=403)
            raise AssertionError(url)

        output = io.StringIO()
        with patch.object(smoke, '_request_json', side_effect=fake_request), \
                redirect_stdout(output):
            code = smoke.main([
                '--base-url', 'https://api.example.com',
                '--supabase-url', 'https://project.supabase.co',
                '--supabase-key', 'public-key',
                '--email', 'smoke@example.invalid',
                '--password', 'contrasena-sintetica',
            ])

        self.assertEqual(code, 0)
        self.assertNotIn('contrasena-sintetica', output.getvalue())
        self.assertNotIn('token-sintetico', output.getvalue())
        result = json.loads(output.getvalue())
        self.assertTrue(result['ok'])
        self.assertIn('lealtad_resolver_qr', [c['name'] for c in result['checks']])


if __name__ == '__main__':
    unittest.main()
