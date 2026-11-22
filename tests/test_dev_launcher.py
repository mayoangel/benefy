import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]


class LauncherTests(unittest.TestCase):
    def launcher(self):
        spec = importlib.util.spec_from_file_location('benefy_dev', ROOT / 'dev.py')
        self.assertTrue(Path(spec.origin).exists(), 'Falta el launcher')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    def test_secrets_keep_literal_dollar_hash_and_equals(self):
        dev = self.launcher()
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / '.env'
            path.write_text('DB_PASSWORD="literal$hash#=value"\nDEBUG=True # comment\n', encoding='utf-8')
            self.assertEqual(dev.read_env(path), {'DB_PASSWORD': 'literal$hash#=value', 'DEBUG': 'True'})

    def test_init_never_overwrites_existing_environment(self):
        dev = self.launcher()
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / '.env'
            path.write_text('preserve', encoding='utf-8')
            with self.assertRaises(FileExistsError):
                dev.write_new_env(path, {'DB_PASSWORD': 'replacement'})
            self.assertEqual(path.read_text(), 'preserve')

    def test_frontend_never_receives_private_variables(self):
        dev = self.launcher()
        compose = (ROOT / 'compose.yaml').read_text(encoding='utf-8')
        frontend = compose.split('  web:')[1].split('  benef-ai:')[0]
        self.assertNotIn('DB_PASSWORD', frontend)
        self.assertNotIn('SECRET_KEY', frontend)
        self.assertNotIn('env_file:', frontend)
        self.assertIn('VITE_SUPABASE_PUBLISHABLE_KEY', frontend)

    def test_default_configuration_and_docker_project_are_benefy(self):
        dev = self.launcher()
        self.assertEqual(dev.CONFIG, ROOT / '.env')
        with patch.object(dev.subprocess, 'run') as run:
            dev.compose(['config', '--quiet'], {})
        command = run.call_args.args[0]
        self.assertEqual(command[command.index('--project-name') + 1], 'benefy')
        self.assertEqual(command[command.index('-f') + 1], str(ROOT / 'compose.yaml'))

    def test_missing_env_requires_explicit_configuration(self):
        dev = self.launcher()
        with tempfile.TemporaryDirectory() as directory:
            dev.CONFIG = Path(directory) / '.env'
            with self.assertRaisesRegex(ValueError, r'\.env\.example'):
                dev.initialize()

    def test_file_wins_over_stale_terminal_database_configuration(self):
        dev = self.launcher()
        with tempfile.TemporaryDirectory() as directory:
            dev.CONFIG = Path(directory) / '.env'
            dev.write_new_env(dev.CONFIG, {'SECRET_KEY': 'synthetic-local-secret', 'SUPABASE_URL': 'https://project.supabase.co',
                'SUPABASE_PUBLISHABLE_KEY': 'sb_publishable_synthetic', 'DB_HOST': 'db.project.supabase.co',
                'DB_NAME': 'postgres', 'DB_USER': 'postgres', 'DB_PASSWORD': 'file-password'})
            with patch.dict('os.environ', {'DB_PASSWORD': 'terminal-password'}):
                result = dev.compose_environment()
            self.assertEqual(result['DB_PASSWORD'], 'file-password')

    def test_different_supabase_projects_are_rejected(self):
        dev = self.launcher()
        with tempfile.TemporaryDirectory() as directory:
            dev.CONFIG = Path(directory) / '.env'
            dev.write_new_env(dev.CONFIG, {'SECRET_KEY': 'synthetic-local-secret', 'SUPABASE_URL': 'https://project.supabase.co',
                'SUPABASE_PUBLISHABLE_KEY': 'sb_publishable_synthetic', 'DB_HOST': 'db.other.supabase.co',
                'DB_NAME': 'postgres', 'DB_USER': 'postgres', 'DB_PASSWORD': 'synthetic-password'})
            with self.assertRaisesRegex(ValueError, 'proyectos diferentes'):
                dev.compose_environment()

    def test_showcase_shortcuts_refuse_any_other_project(self):
        dev = self.launcher()
        self.assertTrue(hasattr(dev, 'validated_showcase_project'), 'Falta la protección del comando de reinicio')
        with self.assertRaises(ValueError):
            dev.validated_showcase_project({'SUPABASE_URL': 'https://other.supabase.co',
                'DB_HOST': 'db.other.supabase.co', 'DB_USER': 'postgres'})


if __name__ == '__main__':
    unittest.main()
