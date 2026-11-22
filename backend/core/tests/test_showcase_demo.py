from io import StringIO
from django.core.management import call_command
from django.test import TestCase
from core import models
from core.management.commands.seed_demo import Command
from core.services.showcase_reset import clear_application_data, schema_fingerprint, verify_project
from django.core.management import CommandError
from unittest.mock import patch
from core.services.showcase_reset import remote_inventory


class ShowcaseDemoTests(TestCase):
    def test_reset_requires_an_explicit_option(self):
        parser = Command().create_parser('manage.py', 'seed_demo')
        self.assertIn('reset', {action.dest for action in parser._actions})

    def test_showcase_preserves_balances_and_is_idempotent(self):
        call_command('seed_demo', apply=True, offline_profiles=True, stdout=StringIO())
        self.assertEqual(models.Negocio.objects.count(), 4)
        self.assertEqual(models.Sucursal.objects.count(), 6)
        self.assertEqual(models.Usuario.objects.count(), 64)
        self.assertGreater(models.RegistroActividad.objects.count(), 1000)
        before = {m.__name__: list(m.objects.order_by('pk').values_list('pk', flat=True)) for m in (
            models.Usuario, models.RegistroActividad, models.CuponUsuario, models.Canje, models.MovimientoPuntos)}
        membership = models.UsuarioNegocio.objects.filter(rol_comercio='empleado').first()
        membership.status = False
        membership.save()
        call_command('seed_demo', apply=True, offline_profiles=True, stdout=StringIO())
        membership.refresh_from_db()
        self.assertFalse(membership.status)
        self.assertEqual(before, {m.__name__: list(m.objects.order_by('pk').values_list('pk', flat=True)) for m in (
            models.Usuario, models.RegistroActividad, models.CuponUsuario, models.Canje, models.MovimientoPuntos)})

    def test_cleanup_preserves_catalogue_and_schema(self):
        call_command('seed_demo', apply=True, offline_profiles=True, stdout=StringIO())
        before = schema_fingerprint()
        catalog = list(models.PlanSuscripcion.objects.values_list('pk', flat=True))
        clear_application_data()
        self.assertFalse(models.Usuario.objects.exists())
        self.assertFalse(models.Negocio.objects.exists())
        self.assertEqual(catalog, list(models.PlanSuscripcion.objects.values_list('pk', flat=True)))
        self.assertEqual(before, schema_fingerprint())

    def test_wrong_project_is_always_rejected(self):
        with self.assertRaises(CommandError):
            verify_project('another-project')

    def test_external_schema_reference_blocks_cleanup_even_with_same_table_name(self):
        with patch('core.services.showcase_reset.connection.cursor') as factory:
            cursor = factory.return_value.__enter__.return_value
            cursor.fetchall.side_effect = [[('uid',)], [('other_schema', 'core_usuario', 'public', 'core_usuario')]]
            cursor.fetchone.side_effect = [(0,), (0,)]
            with self.assertRaises(CommandError):
                remote_inventory([{'id': 'uid'}])
