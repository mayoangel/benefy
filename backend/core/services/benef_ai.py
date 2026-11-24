"""Cliente interno de Benef AI para el proxy autenticado de Django."""

import hashlib
import hmac
import json
import time
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, Request, build_opener

from django.conf import settings

HERRAMIENTAS_PERMITIDAS = frozenset({
    'metricas', 'visitas', 'canjes', 'cupones', 'programas', 'recompensas',
    'plan', 'negocio', 'equipo', 'clientes', 'sucursales', 'invitaciones',
    'alianzas',
})
MAX_RESPUESTA_BYTES = 1_048_576


class ErrorBenefAI(Exception):
    """Error seguro para el portal; nunca contiene secretos ni tokens."""

    def __init__(self, codigo, detalle, status_code=502):
        super().__init__(detalle)
        self.codigo = codigo
        self.detalle = detalle
        self.status_code = status_code


class NoRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def configurado():
    return bool(settings.BENEF_AI_URL and settings.BENEF_AI_SERVICE_TOKEN)


def _firmar(service_token, timestamp, body):
    """Firma el cuerpo exacto que se enviará a Benef AI."""
    message = f'{timestamp}.'.encode('utf-8') + body
    return hmac.new(
        service_token.encode('utf-8'),
        message,
        hashlib.sha256,
    ).hexdigest()


def _validar_respuesta(payload):
    if not isinstance(payload, dict):
        raise ErrorBenefAI(
            'benef_ai_respuesta_invalida',
            'El asistente devolvió una respuesta inválida.',
            502,
        )
    answer = payload.get('answer')
    if not isinstance(answer, str) or not answer.strip():
        raise ErrorBenefAI(
            'benef_ai_respuesta_invalida',
            'El asistente no pudo generar una respuesta.',
            502,
        )
    tools = payload.get('tools_used')
    if tools is None:
        tools = []
    if not isinstance(tools, list) or any(not isinstance(item, str) for item in tools):
        raise ErrorBenefAI(
            'benef_ai_respuesta_invalida',
            'El asistente devolvió una respuesta inválida.',
            502,
        )
    herramientas = [
        item for item in tools[:20]
        if item in HERRAMIENTAS_PERMITIDAS
    ]
    return {
        'answer': answer.strip()[:12_000],
        'tools_used': herramientas,
    }


def consultar(negocio_id, mensaje, historial, access_token, timeout=None):
    """Llama a POST /chat de Benef AI con autenticación de servicio."""
    if not configurado():
        raise ErrorBenefAI(
            'benef_ai_no_configurado',
            'El asistente no está configurado en este entorno.',
            503,
        )
    if not access_token:
        raise ErrorBenefAI(
            'sin_sesion',
            'Tu sesión terminó. Inicia sesión nuevamente.',
            401,
        )

    payload = {
        'negocio_id': negocio_id,
        'message': mensaje,
        'history': historial,
    }
    body = json.dumps(
        payload, ensure_ascii=False, separators=(',', ':'),
    ).encode('utf-8')
    timestamp = str(int(time.time()))
    headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': f'Bearer {access_token}',
        'X-Benef-Timestamp': timestamp,
        'X-Benef-Signature': _firmar(
            settings.BENEF_AI_SERVICE_TOKEN, timestamp, body,
        ),
        'User-Agent': 'Benefy-Backend/1.0',
    }
    request = Request(
        f'{settings.BENEF_AI_URL}/chat',
        data=body,
        method='POST',
        headers=headers,
    )
    timeout = timeout or settings.BENEF_AI_TIMEOUT_SECONDS

    try:
        with build_opener(NoRedirects()).open(
            request, timeout=timeout,
        ) as response:
            raw = response.read(MAX_RESPUESTA_BYTES + 1)
    except HTTPError as exc:
        exc.read(4096)
        if exc.code == 403:
            raise ErrorBenefAI(
                'sin_acceso',
                'No tienes acceso a la información de este negocio.',
                403,
            ) from None
        if exc.code == 429:
            raise ErrorBenefAI(
                'limite_benef_ai',
                'El asistente alcanzó su límite temporal. Intenta más tarde.',
                429,
            ) from None
        if exc.code == 504:
            raise ErrorBenefAI(
                'benef_ai_timeout',
                'El asistente tardó demasiado en responder. Intenta de nuevo.',
                504,
            ) from None
        if exc.code == 503:
            raise ErrorBenefAI(
                'benef_ai_no_disponible',
                'El asistente no está disponible en este momento.',
                503,
            ) from None
        if exc.code in (400, 422):
            raise ErrorBenefAI(
                'benef_ai_solicitud_invalida',
                'El asistente no pudo procesar la solicitud.',
                400,
            ) from None
        raise ErrorBenefAI(
            'benef_ai_error',
            'No fue posible obtener una respuesta del asistente.',
            502,
        ) from None
    except (TimeoutError, URLError, OSError) as exc:
        if isinstance(exc, TimeoutError) or isinstance(
            getattr(exc, 'reason', None), TimeoutError,
        ):
            raise ErrorBenefAI(
                'benef_ai_timeout',
                'El asistente tardó demasiado en responder. Intenta de nuevo.',
                504,
            ) from None
        raise ErrorBenefAI(
            'benef_ai_no_disponible',
            'No fue posible comunicarse con el asistente.',
            503,
        ) from None

    if len(raw) > MAX_RESPUESTA_BYTES:
        raise ErrorBenefAI(
            'benef_ai_respuesta_invalida',
            'El asistente devolvió una respuesta demasiado grande.',
            502,
        )
    try:
        response_payload = json.loads(raw.decode('utf-8'))
    except (UnicodeDecodeError, ValueError):
        raise ErrorBenefAI(
            'benef_ai_respuesta_invalida',
            'El asistente devolvió una respuesta inválida.',
            502,
        ) from None
    return _validar_respuesta(response_payload)
