"""Verificación de solo lectura del catálogo Premium en Stripe Sandbox.

Comprueba que las claves sean de test, que los objetos no sean live y que los
Price IDs mensual y anual coincidan con el catálogo de Benefy. No crea ni
modifica objetos y no imprime secretos.
"""

from __future__ import annotations

import base64
import json
import os
import sys
from typing import Any
from urllib import error, request

STRIPE_API = 'https://api.stripe.com/v1'
MONTHLY_AMOUNT = 39900
ANNUAL_AMOUNT = 399000
CURRENCY = 'mxn'


class StripeCheckError(RuntimeError):
    """Error controlado; el mensaje no contiene la clave."""


def _stripe_get(path: str, secret: str, timeout: int) -> dict[str, Any]:
    credentials = base64.b64encode(f'{secret}:'.encode('utf-8')).decode('ascii')
    req = request.Request(
        STRIPE_API.rstrip('/') + '/' + path.lstrip('/'),
        headers={
            'Authorization': f'Basic {credentials}',
            'Accept': 'application/json',
        },
        method='GET',
    )
    try:
        with request.urlopen(req, timeout=timeout) as response:
            data = json.loads(response.read().decode('utf-8'))
    except error.HTTPError as exc:
        raise StripeCheckError(f'Stripe respondió HTTP {exc.code} en {path}.') from None
    except error.URLError as exc:
        raise StripeCheckError(f'No se pudo conectar con Stripe: {exc.reason}') from None
    except (TimeoutError, json.JSONDecodeError):
        raise StripeCheckError(f'Respuesta inválida de Stripe en {path}.') from None
    if not isinstance(data, dict):
        raise StripeCheckError(f'Respuesta inesperada de Stripe en {path}.')
    return data


def _value(obj: dict[str, Any], key: str) -> Any:
    if obj.get(key) is None:
        raise StripeCheckError(f'Stripe no devolvió {key}.')
    return obj[key]


def _price(
    price_id: str,
    *,
    amount: int,
    interval: str,
    product_id: str,
    secret: str,
    timeout: int,
) -> dict[str, Any]:
    price = _stripe_get(f'prices/{price_id}', secret, timeout)
    if price.get('livemode') is not False:
        raise StripeCheckError(f'El precio {price_id} no es de Test Mode.')
    if price.get('active') is not True:
        raise StripeCheckError(f'El precio {price_id} no está activo.')
    if _value(price, 'unit_amount') != amount:
        raise StripeCheckError(f'El precio {price_id} no tiene el monto esperado.')
    if str(_value(price, 'currency')).lower() != CURRENCY:
        raise StripeCheckError(f'El precio {price_id} no usa MXN.')
    recurring = price.get('recurring') or {}
    if recurring.get('interval') != interval:
        raise StripeCheckError(f'El precio {price_id} no tiene intervalo {interval}.')
    if product_id and price.get('product') != product_id:
        raise StripeCheckError(f'El precio {price_id} no pertenece al producto configurado.')
    return {
        'id': price_id,
        'amount': amount,
        'currency': CURRENCY,
        'interval': interval,
        'livemode': False,
    }


def main() -> int:
    secret = os.getenv('STRIPE_SECRET_KEY', '').strip()
    mode = os.getenv('STRIPE_MODE', 'test').strip().lower()
    product_id = os.getenv('STRIPE_PREMIUM_PRODUCT_ID', '').strip()
    monthly_id = os.getenv('STRIPE_PREMIUM_PRICE_ID', '').strip()
    annual_id = os.getenv('STRIPE_PREMIUM_ANNUAL_PRICE_ID', '').strip()
    try:
        timeout = int(os.getenv('STRIPE_CHECK_TIMEOUT', '15'))
    except ValueError:
        timeout = 15
    if timeout <= 0:
        timeout = 15

    checks: list[dict[str, Any]] = []
    if mode != 'test':
        print('STRIPE_MODE debe ser test.', file=sys.stderr)
        return 2
    if not secret.startswith(('sk_test_', 'rk_test_')):
        print('Falta una clave test de Stripe (sk_test_ o rk_test_).', file=sys.stderr)
        return 2
    if not monthly_id:
        print('Falta STRIPE_PREMIUM_PRICE_ID.', file=sys.stderr)
        return 2

    try:
        if product_id:
            product = _stripe_get(f'products/{product_id}', secret, timeout)
            if product.get('livemode') is not False or product.get('active') is not True:
                raise StripeCheckError('El producto no es de Test Mode o está inactivo.')
            checks.append({'name': 'producto', 'ok': True, 'id': product_id})
        else:
            checks.append(
                {'name': 'producto', 'ok': True, 'omitido': 'Sin STRIPE_PREMIUM_PRODUCT_ID.'},
            )

        checks.append(
            {
                'name': 'precio_mensual',
                'ok': True,
                'detalle': _price(
                    monthly_id,
                    amount=MONTHLY_AMOUNT,
                    interval='month',
                    product_id=product_id,
                    secret=secret,
                    timeout=timeout,
                ),
            },
        )
        if annual_id:
            checks.append(
                {
                    'name': 'precio_anual',
                    'ok': True,
                    'detalle': _price(
                        annual_id,
                        amount=ANNUAL_AMOUNT,
                        interval='year',
                        product_id=product_id,
                        secret=secret,
                        timeout=timeout,
                    ),
                },
            )
        else:
            checks.append(
                {
                    'name': 'precio_anual',
                    'ok': True,
                    'omitido': 'Sin STRIPE_PREMIUM_ANNUAL_PRICE_ID.',
                },
            )
    except StripeCheckError as exc:
        checks.append({'name': 'stripe', 'ok': False, 'error': str(exc)})
        print(json.dumps({'ok': False, 'checks': checks}, ensure_ascii=False, indent=2))
        return 1

    print(json.dumps({'ok': True, 'checks': checks}, ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
