from unittest.mock import patch
from urllib.error import URLError
from uuid import NAMESPACE_URL, uuid5

from django.core.management import CommandError
from django.test import SimpleTestCase, override_settings

from core.services.showcase_auth import AdminAuth, SHOWCASE, accounts


@override_settings(SUPABASE_URL='https://project.example.invalid')
class ShowcaseAuthTests(SimpleTestCase):
    def users(self):
        return [{'id': str(uuid5(NAMESPACE_URL, name)), 'email': email,
                 'email_confirmed_at': '2026-01-01T00:00:00Z',
                 'app_metadata': {'benefy_seed': SHOWCASE}} for name, email in accounts().items()]

    def admin_client(self):
        with patch.dict('os.environ', {'SUPABASE_SEED_ADMIN_KEY': 'synthetic-admin-key'}):
            return AdminAuth()

    @patch.dict('os.environ', {'BENEFY_SHOWCASE_PASSWORDS': '{"customers":"synthetic-password"}'})
    def test_existing_confirmed_accounts_preserve_ids_and_passwords(self):
        client = self.admin_client()
        with patch.object(client, 'request') as request:
            result = client.provision(self.users())
        request.assert_not_called()
        self.assertEqual(result['business'], uuid5(NAMESPACE_URL, 'business'))

    @patch.dict('os.environ', {'BENEFY_SHOWCASE_PASSWORDS': '{"customers":"synthetic-password"}'})
    def test_missing_accounts_are_confirmed_without_email_endpoints(self):
        client = self.admin_client()
        users = self.users()
        with patch.object(client, 'request', side_effect=users[1:]) as request:
            result = client.provision(users[:1])
        self.assertEqual(len(result), len(accounts()))
        for call in request.call_args_list:
            self.assertEqual(call.args[0], 'admin/users')
            self.assertEqual(call.args[2], 'POST')
            self.assertTrue(call.args[1]['email_confirm'])

    @patch.dict('os.environ', {'BENEFY_SHOWCASE_PASSWORDS': '{"customers":"synthetic-password"}'})
    def test_unmanaged_collision_stops_before_writes(self):
        client = self.admin_client()
        users = self.users()
        users[0]['app_metadata'] = {}
        with patch.object(client, 'request') as request, self.assertRaises(CommandError):
            client.provision(users)
        request.assert_not_called()

    def test_network_errors_never_expose_the_admin_key(self):
        client = self.admin_client()
        with patch('core.services.showcase_auth.build_opener') as opener:
            opener.return_value.open.side_effect = URLError('synthetic-admin-key')
            with self.assertRaises(CommandError) as caught:
                client.users()
        self.assertNotIn('synthetic-admin-key', str(caught.exception))
