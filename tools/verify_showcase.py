"""Validación real de Auth/API. Nunca imprime contraseñas, sesiones ni claves."""
import argparse
import json
from pathlib import Path
import sys
import traceback
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from uuid import NAMESPACE_URL, uuid5

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import dev


def request(url, headers, data=None, method=None):
    req = Request(url, data=json.dumps(data).encode() if data is not None else None,
                  headers={**headers, 'Content-Type': 'application/json'}, method=method)
    try:
        with urlopen(req, timeout=30) as response:
            raw = response.read()
            return response.status, json.loads(raw) if raw else {}
    except HTTPError as error:
        try:
            body = json.loads(error.read())
        except ValueError:
            body = {}
        return error.code, body


def verify(exercise=False):
    values = dev.read_env(dev.CONFIG)
    if values['SUPABASE_URL'].rstrip('/') != 'https://rmwwrgahhuztylqkduya.supabase.co':
        raise RuntimeError('Destino de validación fuera del proyecto autorizado.')
    passwords = json.loads(values['BENEFY_SHOWCASE_PASSWORDS'])
    auth = values['SUPABASE_URL'].rstrip('/') + '/auth/v1/'
    public = {'apikey': values['SUPABASE_PUBLISHABLE_KEY']}
    results = {}
    sessions = {}
    owner_context = None
    try:
        for name in ('admin', 'business', 'user', 'supervisor', 'employee'):
            status, session = request(auth + 'token?grant_type=password', public,
                                      {'email': name + '@benefy.com', 'password': passwords[name]})
            assert status == 200 and session['user']['email_confirmed_at']
            sessions[name] = session
            headers = {'Authorization': 'Bearer ' + session['access_token']}
            status, context = request('http://127.0.0.1:5173/api/v1/mi/contexto/', headers)
            assert status == 200
            if name == 'admin':
                assert context['es_admin_sistema']
                status, businesses = request('http://127.0.0.1:5173/api/v1/negocios/listar/', headers)
                assert status == 200 and len(businesses) == 4
            elif name == 'business':
                owner_context = context
                assert len(context['membresias']) == 4 and all(m['rol_comercio'] == 'dueno' for m in context['membresias'])
                for business in context['negocios']:
                    status, metrics = request(f'http://127.0.0.1:5173/api/v1/negocios/{business["id"]}/metricas/?desde=2026-05-01', headers)
                    assert status == 200 and metrics['visitas_validas'] > 100
                    status, plan = request(f'http://127.0.0.1:5173/api/v1/negocios/{business["id"]}/plan/', headers)
                    assert status == 200 and not plan['excedentes']
            elif name == 'user':
                assert not context['puede_portal'] and not context['membresias']
                status, wallet = request('http://127.0.0.1:5173/api/v1/mi/billetera/', headers)
                assert status == 200 and len(wallet['saldos']) == 4 and wallet['tarjetas'] and wallet['cupones']
                status, history = request('http://127.0.0.1:5173/api/v1/mi/historial/', headers)
                assert status == 200 and history['visitas'] and history['movimientos'] and history['canjes']
            else:
                role = 'empleado' if name == 'employee' else 'supervisor'
                assert len(context['membresias']) == 4 and all(m['rol_comercio'] == role for m in context['membresias'])
                business_id = context['negocios'][0]['id']
                status, _ = request(f'http://127.0.0.1:5173/api/v1/negocios/{business_id}/clientes/', headers)
                assert status == 403
                status, metrics = request(f'http://127.0.0.1:5173/api/v1/negocios/{business_id}/metricas/', headers)
                assert status == 200 and metrics['alcance'] == 'sucursal'
            results[name] = {'login': True, 'confirmed': True, 'permissions': True}
        if exercise:
            owner_headers = {'Authorization': 'Bearer ' + sessions['business']['access_token']}
            user_headers = {'Authorization': 'Bearer ' + sessions['user']['access_token']}
            branch = owner_context['sucursales'][0]
            status, detail = request(f'http://127.0.0.1:5173/api/v1/sucursal/detalle/{branch["id"]}/', owner_headers)
            assert status == 200
            payload = {'qr_uuid': detail['qr_uuid'], 'metodo_validacion': 'qr'}
            for _ in range(2):
                status, visit = request('http://127.0.0.1:5173/api/v1/visitas/registrar/', user_headers, payload)
                assert status in (200, 201)
            assert visit['already_registered']
            business_id = branch['negocio']
            status, catalog = request(f'http://127.0.0.1:5173/api/v1/negocios/{business_id}/catalogo/', user_headers)
            assert status == 200
            reward = next(r for r in catalog['recompensas'] if r['costo_desbloqueo'] == 30)
            key = str(uuid5(NAMESPACE_URL, 'benefy-showcase-live-check:' + str(business_id)))
            status, coupon = request('http://127.0.0.1:5173/api/v1/cupones/adquirir/', user_headers,
                {'recompensa': reward['id'], 'clave_idempotencia': key})
            assert status in (200, 201)
            coupon = coupon.get('cupon', coupon)
            status, _ = request(f'http://127.0.0.1:5173/api/v1/cupones/{coupon["uuid"]}/canjear/', user_headers, {})
            assert status in (200, 201, 409)
            status, history = request('http://127.0.0.1:5173/api/v1/mi/historial/', user_headers)
            assert status == 200 and any(item['cupon'] == coupon['uuid'] for item in history['canjes'])
            results['operations'] = {'daily_visit_idempotency': True, 'reward_acquisition': True, 'redemption': True}
    finally:
        for name, session in sessions.items():
            headers = {**public, 'Authorization': 'Bearer ' + session['access_token']}
            status, _ = request(auth + 'logout?scope=local', headers, {}, 'POST')
            refresh_status, _ = request(auth + 'token?grant_type=refresh_token', public, {'refresh_token': session['refresh_token']})
            results.setdefault(name, {})['logout'] = status in (200, 204) and refresh_status >= 400
    assert all(result.get('logout') for name, result in results.items() if name in sessions)
    return results


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--exercise', action='store_true')
    args = parser.parse_args()
    try:
        print(json.dumps(verify(args.exercise)))
    except Exception as error:
        frame = traceback.extract_tb(error.__traceback__)[-1]
        print(json.dumps({'validation_error': type(error).__name__, 'line': frame.lineno,
                          'file': Path(frame.filename).name, 'sensitive_details_omitted': True}), file=sys.stderr)
        sys.exit(1)
