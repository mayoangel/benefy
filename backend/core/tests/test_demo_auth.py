from io import BytesIO
import json
from unittest.mock import patch
from urllib.error import URLError
from uuid import NAMESPACE_URL, uuid5

from django.core.management.base import CommandError
from django.test import SimpleTestCase, override_settings

from core.services.demo_auth import ACCOUNT_NAMES, NAMESPACE, demo_email, provision_accounts


@override_settings(SUPABASE_URL='https://project.example.invalid')
class DemoAuthTests(SimpleTestCase):
    def accounts(self):
        return [{'id': str(uuid5(NAMESPACE_URL, name)), 'email': demo_email(name),
                 'app_metadata': {'benefy_seed': NAMESPACE}} for name in ACCOUNT_NAMES]

    def test_existing_accounts_keep_their_ids_and_passwords(self):
        users = self.accounts()
        with patch.dict('os.environ', {'SUPABASE_SEED_ADMIN_KEY': 'synthetic-admin-key', 'BENEFY_DEMO_PASSWORD': 'synthetic-demo-password'}), patch('core.services.demo_auth.build_opener') as opener:
            opener.return_value.open.return_value = BytesIO(json.dumps({'users': users}).encode())
            result = provision_accounts()
            self.assertEqual(opener.return_value.open.call_count, 1)
            self.assertEqual(result['owner'], uuid5(NAMESPACE_URL, 'owner'))
            self.assertEqual(opener.return_value.open.call_args.args[0].get_method(), 'GET')

    def test_missing_accounts_are_created_without_resetting_existing_account(self):
        users = self.accounts()
        responses = [BytesIO(json.dumps({'users': users[:1]}).encode())]
        responses.extend(BytesIO(json.dumps(user).encode()) for user in users[1:])
        with patch.dict('os.environ', {'SUPABASE_SEED_ADMIN_KEY': 'synthetic-admin-key', 'BENEFY_DEMO_PASSWORD': 'synthetic-demo-password'}), patch('core.services.demo_auth.build_opener') as opener:
            opener.return_value.open.side_effect = responses
            result = provision_accounts()
            self.assertEqual(len(result), len(ACCOUNT_NAMES))
            methods = [call.args[0].get_method() for call in opener.return_value.open.call_args_list]
            self.assertEqual(methods, ['GET'] + ['POST'] * (len(ACCOUNT_NAMES) - 1))
            for call in opener.return_value.open.call_args_list[1:]:
                data = json.loads(call.args[0].data)
                self.assertEqual(data['app_metadata'], {'benefy_seed': NAMESPACE})
                self.assertNotIn('role', data)

    def test_reserved_email_collision_stops_before_creating_users(self):
        users = self.accounts()
        users[0]['app_metadata'] = {}
        with patch.dict('os.environ', {'SUPABASE_SEED_ADMIN_KEY': 'synthetic-admin-key', 'BENEFY_DEMO_PASSWORD': 'synthetic-demo-password'}), patch('core.services.demo_auth.build_opener') as opener:
            opener.return_value.open.return_value = BytesIO(json.dumps({'users': users}).encode())
            with self.assertRaises(CommandError):
                provision_accounts()
            self.assertEqual(opener.return_value.open.call_count, 1)

    def test_auth_errors_never_expose_admin_key(self):
        with patch.dict('os.environ', {'SUPABASE_SEED_ADMIN_KEY': 'synthetic-admin-key', 'BENEFY_DEMO_PASSWORD': 'synthetic-demo-password'}), patch('core.services.demo_auth.build_opener') as opener:
            opener.return_value.open.side_effect = URLError('synthetic-admin-key')
            with self.assertRaises(CommandError) as caught:
                provision_accounts()
            self.assertNotIn('synthetic-admin-key', str(caught.exception))
