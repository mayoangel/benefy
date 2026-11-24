"""Operaciones administrativas de Supabase Auth desde el servidor."""

from http.client import HTTPException
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, Request, build_opener

from django.conf import settings


class ErrorSupabaseAdmin(Exception):
    """Fallo controlado al invocar la Admin API de Supabase."""

    def __init__(self, detalle, status_code=None):
        super().__init__(detalle)
        self.detalle = detalle
        self.status_code = status_code


class SupabaseAdminNoConfigurado(ErrorSupabaseAdmin):
    def __init__(self):
        super().__init__(
            'La eliminación de identidades Supabase no está configurada.',
        )


class NoRedirects(HTTPRedirectHandler):
    """Evita reenviar la service role key a un destino distinto."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def configurado():
    return bool(settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY)


def eliminar_usuario(uid, timeout=10):
    """Elimina una identidad de Supabase Auth.

    Devuelve ``True`` si se eliminó y ``False`` si ya no existía. Un ``404`` es
    idempotente: la identidad ya estaba borrada.
    """
    if not configurado():
        raise SupabaseAdminNoConfigurado()
    if not uid:
        raise ErrorSupabaseAdmin('La identidad de Supabase no está disponible.')

    url = f'{settings.SUPABASE_URL}/auth/v1/admin/users/{uid}'
    request = Request(
        url,
        method='DELETE',
        headers={
            'Authorization': f'Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}',
            'apikey': settings.SUPABASE_SERVICE_ROLE_KEY,
            'Accept': 'application/json',
        },
    )
    try:
        with build_opener(NoRedirects()).open(request, timeout=timeout) as response:
            return response.status != 404
    except HTTPError as error:
        if error.code == 404:
            return False
        raise ErrorSupabaseAdmin(
            f'Supabase Auth rechazó la eliminación (HTTP {error.code}).',
            status_code=error.code,
        ) from None
    except (URLError, TimeoutError, OSError, ValueError, HTTPException):
        raise ErrorSupabaseAdmin(
            'No se pudo contactar a Supabase Auth para eliminar la identidad.',
        ) from None
