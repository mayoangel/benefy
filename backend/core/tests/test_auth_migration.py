"""Comprueba la conservación de perfiles al introducir Supabase Auth."""

from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class SupabaseMigrationTests(TransactionTestCase):
    def test_conserva_identificador_anterior_y_perfil_sin_vincular(self):
        previous = [('core', '0003_alter_usuarionegocio_sucursal')]
        current = [('core', '0004_usuario_supabase_auth')]
        executor = MigrationExecutor(connection)
        executor.migrate(previous)
        try:
            old_user = executor.loader.project_state(previous).apps.get_model('core', 'Usuario')
            user = old_user.objects.create(firebase_uid='legacy-identity',
                nombre='Cliente', apellido='Anterior', correo='legacy@example.com')
            executor = MigrationExecutor(connection)
            executor.migrate(current)
            new_user = executor.loader.project_state(current).apps.get_model('core', 'Usuario')
            migrated = new_user.objects.get(pk=user.pk)
            self.assertEqual(migrated.legacy_firebase_uid, 'legacy-identity')
            self.assertEqual(migrated.correo, 'legacy@example.com')
            self.assertIsNone(migrated.supabase_uid)
            self.assertTrue(migrated.is_active)
        finally:
            # Devolver el esquema al último estado conocido para no afectar
            # a otras pruebas TransactionTestCase.
            latest = MigrationExecutor(connection).loader.graph.leaf_nodes()
            MigrationExecutor(connection).migrate(latest)
