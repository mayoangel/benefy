"""Pruebas del proxy Django hacia Benef AI y de su autenticación interna."""

import io
import json
from unittest.mock import patch
from urllib.error import HTTPError, URLError

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from core import models, throttling
from core.services import benef_ai
from core.tests.helpers import crear_negocio, crear_sucursal, crear_usuario

SECRETO = 'x' * 32
URL_IA = 'https://benef-ai.example.com'


class BenefAIChatViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.owner = crear_usuario()
        self.supervisor = crear_usuario()
        self.employee = crear_usuario()
        self.outsider = crear_usuario()
        self.admin = crear_usuario(rol='admin_sistema')
        self.consumer = crear_usuario()
        self.business = crear_negocio('Café Chat')
        self.foreign = crear_negocio('Ajeno Chat')
        self.branch = crear_sucursal(self.business, 'Centro')
        models.UsuarioNegocio.objects.create(
            usuario=self.owner, negocio=self.business,
            rol_comercio='dueno', sucursal=None,
        )
        models.UsuarioNegocio.objects.create(
            usuario=self.supervisor, negocio=self.business,
            rol_comercio='supervisor', sucursal=self.branch,
        )
        models.UsuarioNegocio.objects.create(
            usuario=self.employee, negocio=self.business,
            rol_comercio='empleado', sucursal=self.branch,
        )
        models.UsuarioNegocio.objects.create(
            usuario=self.outsider, negocio=self.foreign,
            rol_comercio='dueno', sucursal=None,
        )

    def post(self, user, payload=None, business=None, with_token=True):
        self.client.force_authenticate(user)
        extra = {'HTTP_AUTHORIZATION': 'Bearer token-de-prueba'} if with_token else {}
        return self.client.post(
            f'/api/v1/negocios/{(business or self.business).pk}/benef-ai/chat/',
            payload or {'message': '¿Cuántas visitas tuvimos?'},
            format='json',
            **extra,
        )

    def test_requiere_autenticacion(self):
        self.client.force_authenticate(user=None)
        response = self.client.post(
            f'/api/v1/negocios/{self.business.pk}/benef-ai/chat/',
            {'message': 'Hola'},
            format='json',
        )
        self.assertEqual(response.status_code, 401)

    @patch('core.views_benef_ai.benef_ai.consultar', return_value={
        'answer': 'Tuvimos 8 visitas válidas.',
        'tools_used': ['metricas', 'visitas'],
    })
    def test_dueno_recibe_respuesta_del_asistente(self, consultar):
        response = self.post(self.owner, {
            'message': '  ¿Cuántas visitas tuvimos?  ',
            'history': [
                {'role': 'user', 'content': 'Hola'},
                {'role': 'assistant', 'content': '¿Qué necesitas?'},
            ],
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['answer'], 'Tuvimos 8 visitas válidas.')
        self.assertEqual(response.data['tools_used'], ['metricas', 'visitas'])
        consultar.assert_called_once()
        self.assertEqual(consultar.call_args.kwargs['negocio_id'], self.business.pk)
        self.assertEqual(consultar.call_args.kwargs['mensaje'], '¿Cuántas visitas tuvimos?')
        self.assertEqual(consultar.call_args.kwargs['access_token'], 'token-de-prueba')
        self.assertEqual(consultar.call_args.kwargs['historial'], [
            {'role': 'user', 'content': 'Hola'},
            {'role': 'assistant', 'content': '¿Qué necesitas?'},
        ])

    @patch('core.views_benef_ai.benef_ai.consultar', return_value={
        'answer': 'ok', 'tools_used': [],
    })
    def test_supervisor_y_empleado_autorizados(self, _consultar):
        self.assertEqual(self.post(self.supervisor).status_code, 200)
        self.assertEqual(self.post(self.employee).status_code, 200)

    @patch('core.views_benef_ai.benef_ai.consultar', return_value={
        'answer': 'ok', 'tools_used': [],
    })
    def test_aislamiento_entre_negocios(self, consultar):
        response = self.post(self.outsider)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data['codigo'], 'sin_acceso')
        consultar.assert_not_called()

    @patch('core.views_benef_ai.benef_ai.consultar', return_value={
        'answer': 'ok', 'tools_used': [],
    })
    def test_consumidor_y_admin_no_usan_el_asistente(self, consultar):
        consumer = self.post(self.consumer)
        self.assertEqual(consumer.status_code, 403)
        admin = self.post(self.admin)
        self.assertEqual(admin.status_code, 403)
        self.assertEqual(admin.data['codigo'], 'benef_ai_solo_negocios')
        consultar.assert_not_called()

    def test_negocio_inactivo_es_404(self):
        self.business.status = False
        self.business.save(update_fields=['status'])
        response = self.post(self.owner)
        self.assertEqual(response.status_code, 404)

    def test_sin_header_de_sesion_es_401(self):
        response = self.post(self.owner, with_token=False)
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.data['codigo'], 'sin_sesion')

    def test_valida_mensaje_vacio_y_demasiado_largo(self):
        self.assertEqual(self.post(self.owner, {'message': '   '}).status_code, 400)
        self.assertEqual(
            self.post(self.owner, {'message': 'x' * 2001}).status_code,
            400,
        )

    def test_valida_historial_estructura_y_longitud(self):
        malo = self.post(self.owner, {
            'message': 'Hola',
            'history': [{'role': 'system', 'content': 'No permitido'}],
        })
        self.assertEqual(malo.status_code, 400)

        demasiados = self.post(self.owner, {
            'message': 'Hola',
            'history': [
                {'role': 'user', 'content': 'x'} for _ in range(13)
            ],
        })
        self.assertEqual(demasiados.status_code, 400)

        contexto = self.post(self.owner, {
            'message': 'Hola',
            'history': [
                {'role': 'user', 'content': 'x' * 2000} for _ in range(7)
            ],
        })
        self.assertEqual(contexto.status_code, 400)

    @patch('core.views_benef_ai.benef_ai.consultar', return_value={
        'answer': 'ok', 'tools_used': [],
    })
    def test_rate_limit_responde_429(self, consultar):
        with patch.object(
            throttling.BenefAIChatThrottle, 'get_rate', return_value='0/hour',
        ):
            response = self.post(self.owner)
        self.assertEqual(response.status_code, 429)
        self.assertIn('límite', response.data['detail'])
        consultar.assert_not_called()

    def test_errores_del_asistente_se_traducen_sin_filtrar_detalles(self):
        casos = [
            (benef_ai.ErrorBenefAI('benef_ai_timeout', 'Tardó demasiado.', 504), 504),
            (benef_ai.ErrorBenefAI('benef_ai_no_disponible', 'No disponible.', 503), 503),
            (benef_ai.ErrorBenefAI('benef_ai_error', 'Error interno.', 502), 502),
            (benef_ai.ErrorBenefAI('limite_benef_ai', 'Límite.', 429), 429),
        ]
        for error, status_code in casos:
            with self.subTest(codigo=error.codigo):
                with patch('core.views_benef_ai.benef_ai.consultar', side_effect=error):
                    response = self.post(self.owner)
                self.assertEqual(response.status_code, status_code)
                self.assertEqual(response.data['codigo'], error.codigo)
                self.assertNotIn('token', json.dumps(response.data))


class BenefAIServiceTests(TestCase):
    @override_settings(
        BENEF_AI_URL=URL_IA,
        BENEF_AI_SERVICE_TOKEN=SECRETO,
        BENEF_AI_TIMEOUT_SECONDS=12,
    )
    def test_envia_firma_hmac_y_token_de_usuario(self):
        capturado = {}

        class Respuesta:
            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

            def read(self, size=-1):
                return json.dumps({
                    'answer': 'Respuesta real',
                    'tools_used': ['metricas', 'otra_tool'],
                }).encode()

        class Opener:
            def open(self, request, timeout):
                capturado['request'] = request
                capturado['timeout'] = timeout
                return Respuesta()

        with patch('core.services.benef_ai.build_opener', return_value=Opener()):
            resultado = benef_ai.consultar(
                negocio_id=7,
                mensaje='Hola',
                historial=[{'role': 'user', 'content': 'Antes'}],
                access_token='token-usuario',
            )

        self.assertEqual(resultado['answer'], 'Respuesta real')
        self.assertEqual(resultado['tools_used'], ['metricas'])
        request = capturado['request']
        self.assertEqual(capturado['timeout'], 12)
        self.assertEqual(request.full_url, f'{URL_IA}/chat')
        self.assertEqual(request.get_header('Authorization'), 'Bearer token-usuario')
        timestamp = request.get_header('X-benef-timestamp')
        signature = request.get_header('X-benef-signature')
        self.assertTrue(timestamp)
        self.assertEqual(
            signature,
            benef_ai._firmar(SECRETO, timestamp, request.data),
        )
        body = json.loads(request.data.decode())
        self.assertEqual(body['negocio_id'], 7)
        self.assertEqual(body['message'], 'Hola')
        self.assertEqual(body['history'], [{'role': 'user', 'content': 'Antes'}])

    @override_settings(BENEF_AI_URL='', BENEF_AI_SERVICE_TOKEN='')
    def test_sin_configuracion_es_503(self):
        with self.assertRaises(benef_ai.ErrorBenefAI) as ctx:
            benef_ai.consultar(1, 'Hola', [], 'token')
        self.assertEqual(ctx.exception.status_code, 503)
        self.assertEqual(ctx.exception.codigo, 'benef_ai_no_configurado')

    @override_settings(BENEF_AI_URL=URL_IA, BENEF_AI_SERVICE_TOKEN=SECRETO)
    def test_timeout_y_red_se_traducen(self):
        with patch(
            'core.services.benef_ai.build_opener',
        ) as factory:
            factory.return_value.open.side_effect = TimeoutError()
            with self.assertRaises(benef_ai.ErrorBenefAI) as ctx:
                benef_ai.consultar(1, 'Hola', [], 'token')
        self.assertEqual(ctx.exception.status_code, 504)

        with patch(
            'core.services.benef_ai.build_opener',
        ) as factory:
            factory.return_value.open.side_effect = URLError('caído')
            with self.assertRaises(benef_ai.ErrorBenefAI) as ctx:
                benef_ai.consultar(1, 'Hola', [], 'token')
        self.assertEqual(ctx.exception.status_code, 503)

    @override_settings(BENEF_AI_URL=URL_IA, BENEF_AI_SERVICE_TOKEN=SECRETO)
    def test_http_errors_se_traducen(self):
        def error_http(status):
            return HTTPError(
                f'{URL_IA}/chat',
                status,
                'error',
                {},
                io.BytesIO(b'{"detail":"interno"}'),
            )

        for status, expected in ((504, 504), (503, 503), (403, 403), (429, 429)):
            with self.subTest(status=status):
                with patch('core.services.benef_ai.build_opener') as factory:
                    factory.return_value.open.side_effect = error_http(status)
                    with self.assertRaises(benef_ai.ErrorBenefAI) as ctx:
                        benef_ai.consultar(1, 'Hola', [], 'token')
                self.assertEqual(ctx.exception.status_code, expected)

    @override_settings(BENEF_AI_URL=URL_IA, BENEF_AI_SERVICE_TOKEN=SECRETO)
    def test_respuesta_invalida_es_502(self):
        class Respuesta:
            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

            def read(self, size=-1):
                return b'{"answer": ""}'

        class Opener:
            def open(self, request, timeout):
                return Respuesta()

        with patch('core.services.benef_ai.build_opener', return_value=Opener()):
            with self.assertRaises(benef_ai.ErrorBenefAI) as ctx:
                benef_ai.consultar(1, 'Hola', [], 'token')
        self.assertEqual(ctx.exception.status_code, 502)

    def test_firma_compatible_con_benef_ai(self):
        self.assertEqual(
            benef_ai._firmar('x' * 32, '1700000000', b'{"a":1}'),
            '957b87db4c7d287b0d2756d5f57bcf571479322e7049a798062a09e371afead2',
        )
