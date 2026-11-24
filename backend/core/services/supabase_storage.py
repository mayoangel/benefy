"""Validación de avatares publicados en Supabase Storage."""

from http.client import HTTPException
from urllib.error import HTTPError, URLError
from urllib.parse import unquote, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

from django.conf import settings


class FotoPerfilInvalida(Exception):
    codigo = 'foto_invalida'

    def __init__(self, detalle='La foto de perfil no es válida.'):
        super().__init__(detalle)
        self.detalle = detalle


class NoRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def _base_publica():
    bucket = settings.SUPABASE_STORAGE_BUCKET_AVATARS
    return f'{settings.SUPABASE_URL}/storage/v1/object/public/{bucket}/'


def _validar_pertenencia(url, supabase_uid):
    if not settings.SUPABASE_URL:
        raise FotoPerfilInvalida(
            'La validación de fotos no está configurada en este entorno.',
        )
    if not supabase_uid:
        raise FotoPerfilInvalida(
            'El perfil no tiene una identidad Supabase para validar la foto.',
        )

    base = urlsplit(_base_publica())
    parsed = urlsplit(url)
    if (
        parsed.scheme != 'https'
        or parsed.netloc != base.netloc
        or parsed.query
        or parsed.fragment
        or not parsed.path.startswith(base.path)
    ):
        raise FotoPerfilInvalida(
            'La foto debe pertenecer al bucket de avatares de Benefy.',
        )

    ruta = unquote(parsed.path[len(base.path):])
    partes = [parte for parte in ruta.split('/') if parte]
    uid = str(supabase_uid)
    if len(partes) < 2 or partes[0] != uid or '..' in partes:
        raise FotoPerfilInvalida(
            'La foto debe estar en la carpeta del usuario autenticado.',
        )
    return url


def validar_foto_perfil(url, supabase_uid):
    """Valida URL, pertenencia, tipo y tamaño del objeto en Supabase Storage.

    El bucket debe ser de lectura pública y escritura restringida por RLS. La
    comprobación HEAD confirma que el objeto existe y que su metadata declarada
    corresponde a una imagen permitida.
    """
    url = _validar_pertenencia(url, supabase_uid)
    request = Request(
        url,
        method='HEAD',
        headers={'Accept': 'image/*', 'User-Agent': 'Benefy/1.0'},
    )
    try:
        with build_opener(NoRedirects()).open(request, timeout=5) as response:
            content_type = (response.headers.get('Content-Type') or '').split(';', 1)[0].strip().lower()
            content_length = response.headers.get('Content-Length')
    except HTTPError as error:
        if error.code == 404:
            raise FotoPerfilInvalida(
                'La foto no existe en Supabase Storage.',
            ) from None
        raise FotoPerfilInvalida(
            'No se pudo verificar la foto en Supabase Storage.',
        ) from None
    except (URLError, TimeoutError, OSError, ValueError, HTTPException):
        raise FotoPerfilInvalida(
            'No se pudo verificar la foto en Supabase Storage.',
        ) from None

    if content_type not in settings.SUPABASE_STORAGE_ALLOWED_TYPES:
        raise FotoPerfilInvalida(
            'La foto debe ser JPEG, PNG o WebP.',
        )
    try:
        tamano = int(content_length or '')
    except (TypeError, ValueError):
        raise FotoPerfilInvalida(
            'No se pudo determinar el tamaño de la foto.',
        ) from None
    if tamano <= 0 or tamano > settings.SUPABASE_STORAGE_MAX_BYTES:
        raise FotoPerfilInvalida(
            'La foto excede el tamaño máximo permitido.',
        )
    return url
