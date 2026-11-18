"""Provisionamiento opcional de cuentas reservadas; nunca cambia usuarios existentes."""
import json
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, build_opener
from urllib.parse import urlsplit
from uuid import UUID

from django.conf import settings
from django.core.management.base import CommandError

from core.authentication import NoRedirects

NAMESPACE = 'benefy-demo-v1'
ACCOUNT_NAMES = ('owner', 'supervisor', 'employee', 'admin', 'customer-1', 'customer-2', 'customer-3')


def demo_email(name):
    return f'{NAMESPACE}-{name}@example.invalid'


def provision_accounts():
    """Solo se llama tras autorizar el destino y verificar su respaldo."""
    key = os.getenv('SUPABASE_SEED_ADMIN_KEY', '')
    password = os.getenv('BENEFY_DEMO_PASSWORD', '')
    url = urlsplit(settings.SUPABASE_URL)
    if not key or len(password) < 12:
        raise CommandError('Configura SUPABASE_SEED_ADMIN_KEY y BENEFY_DEMO_PASSWORD (mínimo 12 caracteres), exclusivamente para seed.')
    if url.scheme != 'https' or not url.hostname or url.username or url.password or url.path not in ('', '/') or url.query or url.fragment:
        raise CommandError('Destino Auth HTTPS no válido.')

    def request(path, payload=None):
        req = Request(settings.SUPABASE_URL.rstrip('/') + '/auth/v1/admin/' + path,
                      data=json.dumps(payload).encode() if payload is not None else None,
                      headers={'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'})
        try:
            with build_opener(NoRedirects()).open(req, timeout=15) as response:
                return json.load(response)
        except (HTTPError, URLError, ValueError, OSError):
            raise CommandError('Auth Admin rechazó la operación; no se muestran respuesta ni credenciales. Reintenta tras revisar la configuración.') from None

    existing = {}
    for page in range(1, 1001):
        users = request(f'users?page={page}&per_page=100').get('users', [])
        for user in users:
            email = (user.get('email') or '').lower()
            if email in {demo_email(name) for name in ACCOUNT_NAMES}:
                existing[email] = user
        if len(users) < 100:
            break
    else:
        raise CommandError('Inventario Auth demasiado grande; no se ha creado ninguna cuenta.')
    # Comprobar todas las colisiones antes del primer POST.
    for user in existing.values():
        if user.get('app_metadata', {}).get('benefy_seed') != NAMESPACE:
            raise CommandError('Un correo reservado ya pertenece a una cuenta no gestionada por este seed. No se modifica ni vincula.')
    result = {}
    for name in ACCOUNT_NAMES:
        user = existing.get(demo_email(name))
        if user is None:
            user = request('users', {'email': demo_email(name), 'password': password,
                                    'email_confirm': True, 'app_metadata': {'benefy_seed': NAMESPACE},
                                    'user_metadata': {'nombre': 'Demo ' + name, 'apellido': 'Benefy'}})
        result[name] = UUID(user['id'])
    return result
