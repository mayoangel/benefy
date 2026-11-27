"""Validación y limpieza de avatares en Supabase Storage."""

import json
import uuid
from http.client import HTTPException
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, quote, unquote, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

from django.conf import settings


class FotoPerfilInvalida(Exception):
    codigo = 'foto_invalida'

    def __init__(self, detalle='La foto de perfil no es válida.'):
        super().__init__(detalle)
        self.detalle = detalle


class ErrorSupabaseStorage(Exception):
    def __init__(self, detalle, status_code=None):
        super().__init__(detalle)
        self.detalle = detalle
        self.status_code = status_code


class SupabaseStorageNoConfigurado(ErrorSupabaseStorage):
    def __init__(self):
        super().__init__(
            'La integración con Supabase Storage no está configurada.',
        )


class ImagenNegocioInvalida(Exception):
    def __init__(self, detalle='La imagen del negocio no es válida.'):
        super().__init__(detalle)
        self.detalle = detalle


def _storage_configurado():
    return bool(settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY)


def _headers():
    return {
        'Authorization': f'Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}',
        'apikey': settings.SUPABASE_SERVICE_ROLE_KEY,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    }


def _solicitud(method, url, body=None, timeout=10, permitir_404=False):
    if not _storage_configurado():
        raise SupabaseStorageNoConfigurado()
    data = json.dumps(body).encode('utf-8') if body is not None else None
    request = Request(url, data=data, method=method, headers=_headers())
    try:
        with build_opener(NoRedirects()).open(request, timeout=timeout) as response:
            raw = response.read()
            if not raw:
                return response.status, None
            try:
                return response.status, json.loads(raw.decode('utf-8'))
            except (UnicodeDecodeError, ValueError) as exc:
                raise ErrorSupabaseStorage(
                    'Supabase Storage devolvió una respuesta inválida.',
                ) from exc
    except HTTPError as error:
        if error.code == 404 and permitir_404:
            return 404, None
        raise ErrorSupabaseStorage(
            f'Supabase Storage rechazó la operación (HTTP {error.code}).',
            status_code=error.code,
        ) from None
    except (URLError, TimeoutError, OSError, ValueError, HTTPException):
        raise ErrorSupabaseStorage(
            'No se pudo contactar a Supabase Storage.',
        ) from None


def listar_avatares(supabase_uid, timeout=10):
    """Lista los objetos de la carpeta del usuario (máximo 100 por página)."""
    if not supabase_uid:
        raise ErrorSupabaseStorage('La identidad del usuario no está disponible.')
    bucket = settings.SUPABASE_STORAGE_BUCKET_AVATARS
    url = f'{settings.SUPABASE_URL}/storage/v1/object/list/{bucket}'
    status, payload = _solicitud(
        'POST',
        url,
        {'prefix': str(supabase_uid), 'limit': 100, 'offset': 0},
        timeout=timeout,
        permitir_404=True,
    )
    if status == 404 or payload is None:
        return []
    if not isinstance(payload, list):
        raise ErrorSupabaseStorage('Supabase Storage devolvió un listado inválido.')
    return payload


def eliminar_avatar(supabase_uid, timeout=10):
    """Elimina todos los objetos bajo la carpeta del usuario, por páginas.

    La operación es idempotente: un bucket inexistente o una carpeta vacía se
    considera limpieza completada.
    """
    if not supabase_uid:
        raise ErrorSupabaseStorage('La identidad del usuario no está disponible.')
    uid = str(supabase_uid)
    bucket = settings.SUPABASE_STORAGE_BUCKET_AVATARS
    url = f'{settings.SUPABASE_URL}/storage/v1/object/{bucket}'

    for _ in range(100):
        objetos = listar_avatares(uid, timeout=timeout)
        if not objetos:
            return True
        rutas = []
        for objeto in objetos:
            nombre = objeto.get('name') if isinstance(objeto, dict) else None
            if not isinstance(nombre, str) or not nombre.strip():
                continue
            nombre = nombre.strip().lstrip('/')
            ruta = nombre if nombre.startswith(f'{uid}/') else f'{uid}/{nombre}'
            partes = ruta.split('/')
            if ruta == uid or not ruta.startswith(f'{uid}/') or '..' in partes:
                continue
            rutas.append(ruta)
        if not rutas:
            raise ErrorSupabaseStorage(
                'No se pudieron identificar los objetos de avatar del usuario.',
            )
        _solicitud(
            'DELETE', url, {'prefixes': rutas},
            timeout=timeout, permitir_404=True,
        )
    raise ErrorSupabaseStorage(
        'La limpieza de avatares excedió el número de páginas permitido.',
    )


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


_EXTENSIONES_IMAGEN = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
}


def crear_subida_firmada_negocio(negocio_id, tipo, content_type, size_bytes):
    """Emite una autorización de un solo objeto para subir una imagen de negocio."""
    if not _storage_configurado():
        raise SupabaseStorageNoConfigurado()
    if tipo not in ('logo', 'banner'):
        raise ImagenNegocioInvalida('El tipo de imagen no está habilitado.')
    if content_type not in settings.SUPABASE_STORAGE_ALLOWED_TYPES:
        raise ImagenNegocioInvalida('El formato de imagen no está habilitado.')
    if content_type not in _EXTENSIONES_IMAGEN:
        raise ImagenNegocioInvalida('El formato de imagen no está habilitado.')
    if size_bytes <= 0 or size_bytes > settings.SUPABASE_STORAGE_MAX_BYTES:
        raise ImagenNegocioInvalida('La imagen excede el tamaño máximo permitido.')

    bucket = settings.SUPABASE_STORAGE_BUCKET_BUSINESS_ASSETS
    ruta = (
        f'businesses/{negocio_id}/{tipo}/'
        f'{uuid.uuid4().hex}.{_EXTENSIONES_IMAGEN[content_type]}'
    )
    url = (
        f'{settings.SUPABASE_URL}/storage/v1/object/upload/sign/'
        f'{quote(bucket, safe="")}/{quote(ruta, safe="/")}'
    )
    _, payload = _solicitud('POST', url, {})
    signed_url = payload.get('url') if isinstance(payload, dict) else None
    if not isinstance(signed_url, str):
        raise ErrorSupabaseStorage(
            'Supabase Storage devolvió una URL de subida inválida.',
            status_code=502,
        )
    parsed = urlsplit(signed_url)
    if parsed.scheme or parsed.netloc:
        origin = urlsplit(settings.SUPABASE_URL)
        if parsed.scheme != 'https' or parsed.netloc != origin.netloc:
            raise ErrorSupabaseStorage(
                'Supabase Storage devolvió una URL de subida inválida.',
                status_code=502,
            )
    ruta_firmada = unquote(parsed.path)
    sufijo_esperado = (
        f'/object/upload/sign/{bucket}/{ruta}'
    )
    tokens = parse_qs(parsed.query).get('token', [])
    if not ruta_firmada.endswith(sufijo_esperado) or len(tokens) != 1 or not tokens[0]:
        raise ErrorSupabaseStorage(
            'Supabase Storage devolvió una URL de subida inválida.',
            status_code=502,
        )

    public_url = (
        f'{settings.SUPABASE_URL}/storage/v1/object/public/'
        f'{quote(bucket, safe="")}/{quote(ruta, safe="/")}'
    )
    return {
        'bucket': bucket,
        'path': ruta,
        'token': tokens[0],
        'public_url': public_url,
        'content_type': content_type,
        'max_bytes': settings.SUPABASE_STORAGE_MAX_BYTES,
        'expires_in': 7200,
    }


def validar_imagen_negocio(url, negocio_id, tipo):
    """Verifica que la URL apunta al objeto público esperado y valida su metadata."""
    if tipo not in ('logo', 'banner'):
        raise ImagenNegocioInvalida()
    if not settings.SUPABASE_URL:
        raise ImagenNegocioInvalida(
            'La validación de imágenes de negocio no está configurada.',
        )

    bucket = settings.SUPABASE_STORAGE_BUCKET_BUSINESS_ASSETS
    base = (
        f'{settings.SUPABASE_URL}/storage/v1/object/public/'
        f'{quote(bucket, safe="")}/'
    )
    base_parsed = urlsplit(base)
    parsed = urlsplit(url)
    if (
        parsed.scheme != 'https'
        or parsed.netloc != base_parsed.netloc
        or parsed.query
        or parsed.fragment
        or not parsed.path.startswith(base_parsed.path)
    ):
        raise ImagenNegocioInvalida(
            'La imagen debe pertenecer al bucket público de negocios.',
        )

    ruta = unquote(parsed.path[len(base_parsed.path):])
    partes = ruta.split('/')
    if (
        len(partes) != 4
        or partes[0] != 'businesses'
        or partes[1] != str(negocio_id)
        or partes[2] != tipo
        or '..' in partes
    ):
        raise ImagenNegocioInvalida(
            'La imagen debe estar en la carpeta del negocio y tipo correspondientes.',
        )

    nombre = partes[3]
    nombre_partes = nombre.rsplit('.', 1)
    if (
        len(nombre_partes) != 2
        or len(nombre_partes[0]) != 32
        or any(caracter not in '0123456789abcdef' for caracter in nombre_partes[0])
        or nombre_partes[1] not in ('jpg', 'png', 'webp')
    ):
        raise ImagenNegocioInvalida('El nombre del objeto no es válido.')
    mime_por_extension = {
        extension: content_type
        for content_type, extension in _EXTENSIONES_IMAGEN.items()
    }

    request = Request(
        url,
        method='HEAD',
        headers={'Accept': 'image/*', 'User-Agent': 'Benefy/1.0'},
    )
    try:
        with build_opener(NoRedirects()).open(request, timeout=5) as response:
            content_type = (
                response.headers.get('Content-Type') or ''
            ).split(';', 1)[0].strip().lower()
            content_length = response.headers.get('Content-Length')
    except HTTPError as error:
        if error.code == 404:
            raise ImagenNegocioInvalida(
                'La imagen no existe en Supabase Storage.',
            ) from None
        raise ImagenNegocioInvalida(
            'No se pudo verificar la imagen en Supabase Storage.',
        ) from None
    except (URLError, TimeoutError, OSError, ValueError, HTTPException):
        raise ImagenNegocioInvalida(
            'No se pudo verificar la imagen en Supabase Storage.',
        ) from None

    if (
        content_type not in settings.SUPABASE_STORAGE_ALLOWED_TYPES
        or mime_por_extension[nombre_partes[1]] != content_type
    ):
        raise ImagenNegocioInvalida(
            'El tipo MIME de la imagen no coincide con su extensión.',
        )
    try:
        tamano = int(content_length or '')
    except (TypeError, ValueError):
        raise ImagenNegocioInvalida(
            'No se pudo determinar el tamaño de la imagen.',
        ) from None
    if tamano <= 0 or tamano > settings.SUPABASE_STORAGE_MAX_BYTES:
        raise ImagenNegocioInvalida(
            'La imagen excede el tamaño máximo permitido.',
        )
    return url
