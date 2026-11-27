"""Cliente Admin de Auth para el dataset de presentación, sin correo saliente."""
import json
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, build_opener
from uuid import UUID

from django.conf import settings
from django.core.management.base import CommandError
from core.authentication import NoRedirects

SHOWCASE = 'benefy-showcase-v2'


def accounts():
    principal = [
        ('admin', 'admin@benefy.com'),
        ('business', 'business@benefy.com'),
        ('business-aurora', 'aurora@benefy.com'),
        ('business-impulso', 'impulso@benefy.com'),
        ('business-verde', 'verde@benefy.com'),
        ('user', 'user@benefy.com'),
        ('supervisor', 'supervisor@benefy.com'),
        ('employee', 'employee@benefy.com'),
    ]
    return dict(principal + [(f'customer-{i:02}', f'cliente{i:02}@benefy.example.invalid') for i in range(1, 60)])


class AdminAuth:
    def __init__(self):
        self.key = os.getenv('SUPABASE_SEED_ADMIN_KEY', '')
        if not self.key:
            raise CommandError('Falta la clave administrativa local del seed.')

    def request(self, path, payload=None, method=None):
        headers = {'apikey': self.key, 'Content-Type': 'application/json'}
        # Las claves sb_secret_ son API keys, no JWTs.
        if not self.key.startswith('sb_secret_'):
            headers['Authorization'] = 'Bearer ' + self.key
        request = Request(settings.SUPABASE_URL.rstrip('/') + '/auth/v1/' + path,
                          data=json.dumps(payload).encode() if payload is not None else None,
                          headers=headers, method=method)
        try:
            with build_opener(NoRedirects()).open(request, timeout=30) as response:
                data = response.read()
                return json.loads(data) if data else {}
        except HTTPError as error:
            raise CommandError(f'Auth Admin rechazó la operación HTTP {error.code}; se omiten los datos sensibles.') from None
        except (URLError, OSError, ValueError):
            raise CommandError('No fue posible completar la operación Auth Admin.') from None

    def users(self):
        result = []
        for page in range(1, 1001):
            users = self.request(f'admin/users?page={page}&per_page=100').get('users', [])
            result.extend(users)
            if len(users) < 100:
                return result
        raise CommandError('Inventario Auth incompleto. Se cancela la operación.')

    def provision(self, old_users, reset=False, progress=lambda message: None):
        existing = {(user.get('email') or '').lower(): user for user in old_users}
        try:
            passwords = json.loads(os.environ['BENEFY_SHOWCASE_PASSWORDS'])
        except (KeyError, ValueError):
            raise CommandError('Falta la configuración local de contraseñas de demostración.') from None
        result = {}
        for index, (name, email) in enumerate(accounts().items()):
            password = passwords.get(name, passwords.get('customers'))
            if not isinstance(password, str) or len(password) < 6:
                raise CommandError('Falta una contraseña de demostración válida; no se imprime su valor.')
            user = existing.get(email)
            if user and not reset and user.get('app_metadata', {}).get('benefy_seed') != SHOWCASE:
                raise CommandError('Una cuenta coincide con el dataset pero no está gestionada por él. Usa reinicio autorizado.')
            attributes = {'email': email, 'email_confirm': True, 'password': password,
                          'app_metadata': {**((user.get('app_metadata') or {}) if user else {}), 'benefy_seed': SHOWCASE},
                          'user_metadata': {'nombre': 'Demostración Benefy'}}
            if user is None:
                user = self.request('admin/users', attributes, 'POST')
            elif reset:
                user = self.request('admin/users/' + user['id'], attributes, 'PUT')
            if not user.get('email_confirmed_at'):
                raise CommandError('Auth no confirmó el correo de una cuenta. No se desactiva la seguridad global.')
            result[name] = UUID(user['id'])
            if index % 10 == 0:
                progress(f'Auth: {index + 1}/{len(accounts())} cuentas verificadas.')
        return result
