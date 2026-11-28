"""Smoke de despliegue de Benefy.

Comprueba health checks, login con Supabase Auth, perfil, contexto y, cuando hay
un QR disponible, la resolución de una visita. No imprime tokens, contraseñas ni
datos personales. Por defecto no registra visitas; usa --registrar-visita solo en
un entorno controlado.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any
from urllib import error, request

TIMEOUT_DEFAULT = 15
API_PREFIX_DEFAULT = '/api/v1'


class SmokeError(RuntimeError):
    """Error controlado del smoke; el mensaje no contiene secretos."""

    def __init__(self, message: str, status: int | None = None) -> None:
        super().__init__(message)
        self.status = status


def _bool(value: Any) -> bool:
    return str(value).strip().lower() in ('1', 'true', 'yes', 'si', 'sí')


def _request_json(
    method: str,
    url: str,
    *,
    headers: dict[str, str] | None = None,
    payload: dict[str, Any] | None = None,
    timeout: int = TIMEOUT_DEFAULT,
) -> tuple[int, Any]:
    body = None
    request_headers = {'Accept': 'application/json'}
    if payload is not None:
        body = json.dumps(payload).encode('utf-8')
        request_headers['Content-Type'] = 'application/json'
    if headers:
        request_headers.update(headers)

    req = request.Request(url, data=body, headers=request_headers, method=method)
    try:
        with request.urlopen(req, timeout=timeout) as response:
            raw = response.read().decode('utf-8')
            return response.status, _decode(raw)
    except error.HTTPError as exc:
        # No se incluye el cuerpo: podría contener detalles internos o tokens.
        raise SmokeError(f'HTTP {exc.code} en {url}', status=exc.code) from None
    except error.URLError as exc:
        raise SmokeError(f'No se pudo conectar con {url}: {exc.reason}') from None
    except TimeoutError:
        raise SmokeError(f'Timeout al llamar {url}') from None


def _decode(raw: str) -> Any:
    if not raw.strip():
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        raise SmokeError('La respuesta no es JSON válido.') from None


def _join(base: str, path: str) -> str:
    return base.rstrip('/') + '/' + path.lstrip('/')


def _require(data: dict[str, Any], key: str, expected: Any | None = None) -> Any:
    value = data.get(key)
    if expected is not None and value != expected:
        raise SmokeError(f'Respuesta inválida: {key}={value!r}.')
    return value


def _add(
    checks: list[dict[str, Any]],
    name: str,
    fn: Any,
    *,
    required: bool = True,
) -> None:
    try:
        detail = fn()
        checks.append({'name': name, 'ok': True, 'detalle': detail})
    except SmokeError as exc:
        checks.append({'name': name, 'ok': False, 'error': str(exc)})
    except Exception as exc:  # noqa: BLE001 - el smoke debe terminar con salida limpia
        checks.append(
            {
                'name': name,
                'ok': False,
                'error': f'Error inesperado: {type(exc).__name__}',
            },
        )
    if not checks[-1]['ok'] and required:
        checks[-1]['requerido'] = True


def _health(base_url: str, timeout: int) -> tuple[dict[str, Any], dict[str, Any]]:
    live_status, live = _request_json(
        'GET', _join(base_url, '/health/live/'), timeout=timeout,
    )
    _require(live if isinstance(live, dict) else {}, 'status', 'ok')
    db_status, db = _request_json(
        'GET', _join(base_url, '/health/db/'), timeout=timeout,
    )
    _require(db if isinstance(db, dict) else {}, 'status', 'ok')
    _require(db if isinstance(db, dict) else {}, 'database', 'ok')
    return {'http': live_status}, {'http': db_status}


def _login(
    supabase_url: str,
    supabase_key: str,
    email: str,
    password: str,
    timeout: int,
) -> str:
    status, data = _request_json(
        'POST',
        _join(supabase_url, '/auth/v1/token?grant_type=password'),
        headers={'apikey': supabase_key},
        payload={'email': email, 'password': password},
        timeout=timeout,
    )
    if status != 200 or not isinstance(data, dict):
        raise SmokeError(f'Login HTTP {status}.')
    token = data.get('access_token')
    if not isinstance(token, str) or not token:
        raise SmokeError('Supabase no devolvió access_token.')
    return token


def _headers(token: str) -> dict[str, str]:
    return {'Authorization': f'Bearer {token}'}


def _profile(api_url: str, token: str, timeout: int) -> dict[str, Any]:
    status, data = _request_json(
        'GET', _join(api_url, '/autenticacion/perfil/'),
        headers=_headers(token), timeout=timeout,
    )
    if status != 200 or not isinstance(data, dict) or data.get('id') is None:
        raise SmokeError(f'Perfil HTTP {status}.')
    return {'http': status}


def _context(api_url: str, token: str, timeout: int) -> dict[str, Any]:
    status, data = _request_json(
        'GET', _join(api_url, '/mi/contexto/'),
        headers=_headers(token), timeout=timeout,
    )
    if status != 200 or not isinstance(data, dict):
        raise SmokeError(f'Contexto HTTP {status}.')
    return {
        'http': status,
        'negocios': len(data.get('negocios') or []),
        'sucursales': len(data.get('sucursales') or []),
    }


def _find_qr(api_url: str, token: str, timeout: int) -> str | None:
    try:
        status, data = _request_json(
            'GET', _join(api_url, '/sucursales/listar/'),
            headers=_headers(token), timeout=timeout,
        )
    except SmokeError as exc:
        # Una cuenta de consumidor no puede listar sucursales; el QR es opcional.
        if exc.status in (403, 404):
            return None
        raise
    if status != 200 or not isinstance(data, list):
        return None
    for branch in data:
        if isinstance(branch, dict) and branch.get('qr_uuid'):
            return str(branch['qr_uuid'])
    return None


def _resolve_qr(api_url: str, token: str, qr_uuid: str, timeout: int) -> dict[str, Any]:
    status, data = _request_json(
        'POST', _join(api_url, '/visitas/resolver/'),
        headers=_headers(token), payload={'qr_uuid': qr_uuid}, timeout=timeout,
    )
    if status != 200 or not isinstance(data, dict):
        raise SmokeError(f'Resolver QR HTTP {status}.')
    return {
        'http': status,
        'puede_registrar': bool(data.get('puede_registrar')),
        'sucursal': bool(data.get('sucursal')),
    }


def _register_visit(api_url: str, token: str, qr_uuid: str, timeout: int) -> dict[str, Any]:
    status, data = _request_json(
        'POST', _join(api_url, '/visitas/registrar/'),
        headers=_headers(token),
        payload={'qr_uuid': qr_uuid, 'metodo_validacion': 'qr'},
        timeout=timeout,
    )
    if status not in (200, 201) or not isinstance(data, dict):
        raise SmokeError(f'Registrar visita HTTP {status}.')
    return {
        'http': status,
        'already_registered': bool(data.get('already_registered')),
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        '--base-url',
        default=os.getenv('SMOKE_BASE_URL', ''),
        help='Origen público del backend, sin /api/v1. También SMOKE_BASE_URL.',
    )
    parser.add_argument(
        '--api-prefix',
        default=os.getenv('SMOKE_API_PREFIX', API_PREFIX_DEFAULT),
        help='Prefijo de la API. Por defecto /api/v1.',
    )
    parser.add_argument(
        '--supabase-url',
        default=os.getenv('SMOKE_SUPABASE_URL', ''),
        help='Origen de Supabase Auth. También SMOKE_SUPABASE_URL.',
    )
    parser.add_argument(
        '--supabase-key',
        default=os.getenv('SMOKE_SUPABASE_KEY', ''),
        help='Clave publicable de Supabase. También SMOKE_SUPABASE_KEY.',
    )
    parser.add_argument(
        '--email',
        default=os.getenv('SMOKE_EMAIL', ''),
        help='Cuenta de prueba. También SMOKE_EMAIL.',
    )
    parser.add_argument(
        '--password',
        default=os.getenv('SMOKE_PASSWORD', ''),
        help='Contraseña de la cuenta de prueba. También SMOKE_PASSWORD.',
    )
    parser.add_argument(
        '--qr-uuid',
        default=os.getenv('SMOKE_QR_UUID', ''),
        help='QR de sucursal o negocio para el flujo de lealtad. También SMOKE_QR_UUID.',
    )
    parser.add_argument(
        '--registrar-visita',
        action='store_true',
        default=_bool(os.getenv('SMOKE_REGISTRAR_VISITA', '')),
        help='Registra una visita real; consume el límite diario. Solo en un entorno controlado.',
    )
    parser.add_argument(
        '--health-only',
        action='store_true',
        help='Solo comprueba health checks; no requiere credenciales.',
    )
    parser.add_argument('--timeout', type=int, default=TIMEOUT_DEFAULT)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if not args.base_url:
        print('Falta --base-url o SMOKE_BASE_URL.', file=sys.stderr)
        return 2
    if args.timeout <= 0:
        print('--timeout debe ser positivo.', file=sys.stderr)
        return 2
    if not args.health_only:
        missing = [
            name
            for name, value in (
                ('--supabase-url/SMOKE_SUPABASE_URL', args.supabase_url),
                ('--supabase-key/SMOKE_SUPABASE_KEY', args.supabase_key),
                ('--email/SMOKE_EMAIL', args.email),
                ('--password/SMOKE_PASSWORD', args.password),
            )
            if not value
        ]
        if missing:
            print('Faltan credenciales: ' + ', '.join(missing), file=sys.stderr)
            return 2

    api_url = _join(args.base_url, args.api_prefix)
    checks: list[dict[str, Any]] = []
    try:
        live, database = _health(args.base_url, args.timeout)
        checks.append({'name': 'health_live', 'ok': True, 'detalle': live})
        checks.append({'name': 'health_db', 'ok': True, 'detalle': database})
    except SmokeError as exc:
        checks.append({'name': 'health', 'ok': False, 'error': str(exc)})

    if not args.health_only:
        token: str | None = None

        def login() -> dict[str, Any]:
            nonlocal token
            token = _login(
                args.supabase_url, args.supabase_key, args.email,
                args.password, args.timeout,
            )
            return {'http': 200}

        _add(checks, 'supabase_login', login)
        if token:
            _add(checks, 'perfil', lambda: _profile(api_url, token, args.timeout))
            _add(checks, 'contexto', lambda: _context(api_url, token, args.timeout))

            qr_uuid = args.qr_uuid.strip()
            qr_failed = False
            if not qr_uuid:
                try:
                    qr_uuid = _find_qr(api_url, token, args.timeout) or ''
                except SmokeError as exc:
                    checks.append(
                        {
                            'name': 'lealtad_resolver_qr',
                            'ok': False,
                            'error': str(exc),
                        },
                    )
                    qr_uuid = ''
                    qr_failed = True
            if qr_uuid:
                _add(
                    checks, 'lealtad_resolver_qr',
                    lambda: _resolve_qr(api_url, token, qr_uuid, args.timeout),
                )
                if args.registrar_visita:
                    _add(
                        checks, 'lealtad_registrar_visita',
                        lambda: _register_visit(api_url, token, qr_uuid, args.timeout),
                    )
            elif not qr_failed:
                checks.append(
                    {
                        'name': 'lealtad_resolver_qr',
                        'ok': True,
                        'omitido': 'No hay QR disponible para esta cuenta.',
                    },
                )

    ok = all(item.get('ok') for item in checks)
    print(json.dumps({'ok': ok, 'checks': checks}, ensure_ascii=False, indent=2))
    return 0 if ok else 1


if __name__ == '__main__':
    raise SystemExit(main())
