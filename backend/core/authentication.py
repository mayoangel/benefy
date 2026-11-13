"""Validación remota de access tokens mediante Supabase Auth /user."""

from dataclasses import dataclass
from http.client import HTTPException
import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
from uuid import UUID

from django.conf import settings
from rest_framework.authentication import BaseAuthentication, get_authorization_header
from rest_framework.exceptions import APIException, AuthenticationFailed

from core.models import Usuario


class AuthUnavailable(APIException):
    status_code = 503
    default_detail = 'Supabase Auth no está disponible o no está configurado.'


class NoRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # Nunca reenviar el bearer token a otro destino por una redirección.
        return None


@dataclass(frozen=True)
class SupabaseIdentity:
    uid: UUID
    email: str
    is_authenticated: bool = True
    is_anonymous: bool = False


def verify_token(token):
    url = urlsplit(settings.SUPABASE_URL)
    local = not settings.IS_PRODUCTION and url.hostname in ('localhost', '127.0.0.1', '::1')
    if (not url.hostname or url.username or url.password or url.query or url.fragment
            or url.path not in ('', '/') or not settings.SUPABASE_PUBLISHABLE_KEY
            or (url.scheme != 'https' and not (local and url.scheme == 'http'))):
        raise AuthUnavailable()
    request = Request(
        settings.SUPABASE_URL + '/auth/v1/user',
        headers={'Authorization': 'Bearer ' + token,
                 'apikey': settings.SUPABASE_PUBLISHABLE_KEY,
                 'Accept': 'application/json'},
    )
    try:
        with build_opener(NoRedirects()).open(request, timeout=5) as response:
            user = json.load(response)
    except HTTPError as error:
        if error.code in (401, 403):
            raise AuthenticationFailed('Token inválido, vencido o cuenta no disponible.') from None
        raise AuthUnavailable() from None
    except (URLError, TimeoutError, OSError, ValueError, HTTPException):
        raise AuthUnavailable() from None
    if not isinstance(user, dict):
        raise AuthUnavailable()
    try:
        uid = UUID(user['id'])
        email = user['email']
        if (user.get('is_anonymous', False) or user.get('role') != 'authenticated'
                or not user.get('email_confirmed_at') or not isinstance(email, str)
                or not email or len(email) > 255):
            raise ValueError
    except (KeyError, TypeError, ValueError, AttributeError):
        raise AuthenticationFailed('Se requiere una cuenta autenticada con correo confirmado.') from None
    return SupabaseIdentity(uid=uid, email=email)


class SupabaseAuthentication(BaseAuthentication):
    def authenticate(self, request):
        header = get_authorization_header(request).split()
        if not header:
            return None
        if len(header) != 2 or header[0].lower() != b'bearer' or len(header[1]) > 8192:
            raise AuthenticationFailed('Usa Authorization: Bearer <access_token>.')
        try:
            token = header[1].decode('ascii')
        except UnicodeDecodeError:
            raise AuthenticationFailed('Token inválido.') from None
        identity = verify_token(token)
        user = Usuario.objects.filter(supabase_uid=identity.uid).first()
        if user is not None and not user.is_active:
            raise AuthenticationFailed('La cuenta de Benefy está desactivada.')
        # Una identidad nueva solo puede completar su propio perfil.
        return (user if user is not None else identity, identity)

    def authenticate_header(self, request):
        return 'Bearer'
