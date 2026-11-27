"""Pruebas del contrato conversacional y de las tools de Benef AI."""

import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException
from fastapi.responses import JSONResponse
from pydantic import ValidationError

import chat
import knowledge
from queries import AnaliticaConsulta


def contexto_valido():
    return {
        'usuario': {
            'nombre_completo': 'Ana Pérez',
            'rol_comercio': 'dueno',
            'es_dueno': True,
        },
        'negocio': {
            'id': 1,
            'nombre': 'Café Aurora',
            'zona_horaria': 'America/Tijuana',
        },
        'sucursal_actual': {'id': 11, 'nombre': 'Centro'},
        'sucursales_autorizadas': [
            {'id': 11, 'nombre': 'Centro'},
            {'id': 12, 'nombre': 'Río'},
        ],
        'plan': {
            'plan': {
                'codigo': 'free',
                'nombre_visible': 'Plan gratis',
                'nombre': 'Free',
            },
            'limites': {
                'sucursales': {'uso': 1, 'limite': 1, 'excedido': False},
            },
            'excedentes': [],
        },
        'tiempo': {
            'ahora': '2026-11-27T10:00:00-08:00',
            'fecha_actual': '2026-11-27',
            'zona_horaria': 'America/Tijuana',
            'periodos': {
                'hoy': {
                    'nombre': 'hoy',
                    'desde': '2026-11-27',
                    'hasta': '2026-11-27',
                    'anterior': {
                        'desde': '2026-11-26',
                        'hasta': '2026-11-26',
                    },
                },
                'mes_pasado': {
                    'nombre': 'el mes pasado',
                    'desde': '2026-10-01',
                    'hasta': '2026-10-31',
                    'anterior': {
                        'desde': '2026-08-31',
                        'hasta': '2026-09-30',
                    },
                },
            },
        },
        'capacidades': {
            'ver_clientes': True,
            'ver_cupones': True,
            'puede_escribir': False,
        },
    }


class ContextoPromptTests(unittest.TestCase):
    def test_incluye_identidad_negocio_plan_y_fechas_del_servidor(self):
        texto = chat._system_instruction(contexto_valido())
        self.assertIn('Ana Pérez', texto)
        self.assertIn('Café Aurora', texto)
        self.assertIn('Plan gratis', texto)
        self.assertIn('2026-11-27', texto)
        self.assertIn('América', texto.replace('America', 'América'))
        self.assertIn('No inventes cifras', texto)
        self.assertIn('No calcules fechas relativas', texto)

    def test_historial_conserva_turnos_y_roles_reales(self):
        history = [
            chat.ChatTurn(role='user', content='¿Tengo alianzas?'),
            chat.ChatTurn(role='assistant', content='Sí, con Café Norte.'),
        ]
        payload = chat._interaction_history(SimpleNamespace(
            history=history, message='¿Cuándo termina?',
        ))
        self.assertEqual([item['type'] for item in payload], [
            'user_input', 'model_output', 'user_input',
        ])
        self.assertEqual(payload[-1]['content'][0]['text'], '¿Cuándo termina?')


class ChatContractTests(unittest.TestCase):
    def request(self, history=None, message='¿Cuántas visitas tuvimos?'):
        return chat.ChatRequest(
            negocio_id=1,
            message=message,
            history=history or [],
        )

    def test_historial_se_limita_y_conserva_el_mensaje_actual(self):
        history = [
            chat.ChatTurn(role='user', content=f'mensaje {i}')
            for i in range(13)
        ]
        with self.assertRaises(ValidationError):
            chat.ChatRequest(negocio_id=1, message='actual', history=history)

        corto = [
            chat.ChatTurn(role='user', content=f'mensaje {i}')
            for i in range(12)
        ]
        payload = chat._interaction_history(
            SimpleNamespace(history=corto, message='actual'),
        )
        self.assertEqual(len(payload), 13)
        self.assertEqual(payload[0]['content'][0]['text'], 'mensaje 0')
        self.assertEqual(payload[-1]['content'][0]['text'], 'actual')

    def test_rechaza_contexto_demasiado_grande_y_turnos_vacios(self):
        history = [
            chat.ChatTurn(role='user', content='x' * 2000)
            for _ in range(12)
        ]
        with self.assertRaises(ValidationError):
            chat.ChatRequest(negocio_id=1, message='actual', history=history)
        with self.assertRaises(ValidationError):
            chat.ChatTurn(role='user', content='   ')

    def test_sucursal_debe_ser_positiva_si_se_envia(self):
        with self.assertRaises(ValidationError):
            chat.ChatRequest(negocio_id=1, message='Hola', sucursal_id=0)

    def test_tool_desconocida_no_se_ejecuta(self):
        resultado = chat._run_tool('otra_tool', {}, 1, 'token')
        self.assertEqual(resultado['status'], 403)

    def test_tool_reporta_http_exception_sin_filtrar_token(self):
        def falla(*args, **kwargs):
            raise HTTPException(status_code=403, detail='sin acceso')

        with patch('chat.consultar_analitica', side_effect=falla):
            resultado = chat._run_tool(
                'consultar_analitica',
                {'tema': 'visitas', 'negocio_id': 1},
                1,
                'token-secreto',
            )
        self.assertEqual(resultado['status'], 403)
        self.assertNotIn('token-secreto', str(resultado))

    def test_validacion_de_tool_es_422(self):
        resultado = chat._run_tool(
            'consultar_analitica',
            {'tema': 'inventado'},
            1,
            'token',
        )
        self.assertEqual(resultado['status'], 422)

    def test_el_negocio_siempre_proviene_del_contexto_no_del_argumento(self):
        with patch('chat.consultar_analitica', return_value={'ok': True}) as consultar:
            chat._run_tool(
                'consultar_analitica',
                {'tema': 'visitas', 'negocio_id': 999},
                7,
                'token',
            )
        consulta = consultar.call_args.args[0]
        self.assertEqual(consulta.negocio_id, 7)

    def test_conocimiento_incluye_temas_y_limite_de_escritura(self):
        resultado = chat._run_tool(
            'consultar_conocimiento_benefy', {'tema': 'escritura'}, 1, 'token',
        )
        self.assertIn('solo lectura', resultado['data']['contenido'])
        self.assertEqual(resultado['data']['tema'], 'escritura')
        self.assertIsNotNone(knowledge.obtener_tema('cupones'))

    @patch('chat.consultar_contexto', return_value=contexto_valido())
    def test_chat_sin_gemini_es_503(self, _):
        with patch.dict('os.environ', {'GEMINI_API_KEY': ''}, clear=False):
            with self.assertRaises(HTTPException) as ctx:
                chat.chat(self.request(), 'token', None)
        self.assertEqual(ctx.exception.status_code, 503)

    @patch('chat.consultar_contexto', return_value=JSONResponse(
        status_code=403, content={'codigo': 'sin_acceso'},
    ))
    def test_contexto_sin_acceso_se_propaga_sin_llamar_gemini(self, _):
        respuesta = chat.chat(self.request(), 'token', None)
        self.assertEqual(respuesta.status_code, 403)

    @patch('chat.consultar_contexto', return_value=contexto_valido())
    def test_respuesta_de_gemini_sin_tools(self, _):
        interaction = SimpleNamespace(output_text='Hay 8 visitas válidas.', steps=[])

        class FakeInteractions:
            def create(self, **kwargs):
                return interaction

        class FakeClient:
            def __init__(self, **kwargs):
                self.interactions = FakeInteractions()

            def close(self):
                pass

        with patch.dict(os.environ, {'GEMINI_API_KEY': 'test-key'}), \
                patch('chat.genai.Client', FakeClient):
            response = chat.chat(self.request(), 'token', None)

        self.assertEqual(response.answer, 'Hay 8 visitas válidas.')
        self.assertEqual(response.tools_used, [])

    @patch('chat.consultar_contexto', return_value=contexto_valido())
    @patch('chat._run_tool', return_value={'data': {'visitas_validas': 8}})
    def test_ejecuta_tool_y_devuelve_herramientas_usadas(self, _run_tool, _contexto):
        class Step:
            type = 'function_call'
            name = 'consultar_analitica'
            arguments = {'tema': 'visitas', 'periodo': 'ultimos_7_dias'}
            id = 'call-1'

            def model_dump(self, exclude_none=True):
                return {
                    'type': self.type,
                    'name': self.name,
                    'arguments': self.arguments,
                    'call_id': self.id,
                }

        class FakeInteractions:
            def __init__(self):
                self.llamadas = 0

            def create(self, **kwargs):
                self.llamadas += 1
                if self.llamadas == 1:
                    return SimpleNamespace(output_text=None, steps=[Step()])
                return SimpleNamespace(output_text='Tuvimos 8 visitas válidas.', steps=[])

        class FakeClient:
            def __init__(self, **kwargs):
                self.interactions = FakeInteractions()

            def close(self):
                pass

        with patch.dict(os.environ, {'GEMINI_API_KEY': 'test-key'}), \
                patch('chat.genai.Client', FakeClient):
            response = chat.chat(self.request(), 'token', None)

        self.assertEqual(response.answer, 'Tuvimos 8 visitas válidas.')
        self.assertEqual(response.tools_used, ['visitas'])
        _run_tool.assert_called_once()

    @patch('chat.consultar_contexto', return_value=contexto_valido())
    def test_error_tecnico_de_todas_las_tools_no_permite_conclusiones(self, _):
        class Step:
            type = 'function_call'
            name = 'consultar_analitica'
            arguments = {'tema': 'visitas'}
            id = 'call-1'

            def model_dump(self, exclude_none=True):
                return {
                    'type': 'function_call', 'name': self.name,
                    'arguments': self.arguments, 'call_id': self.id,
                }

        class FakeInteractions:
            def __init__(self):
                self.llamadas = 0

            def create(self, **kwargs):
                self.llamadas += 1
                return SimpleNamespace(output_text=None, steps=[Step()])

        class FakeClient:
            def __init__(self, **kwargs):
                self.interactions = FakeInteractions()

            def close(self):
                pass

        with patch.dict(os.environ, {'GEMINI_API_KEY': 'test-key'}), \
                patch('chat.genai.Client', FakeClient), \
                patch('chat._run_tool', return_value={
                    'error': 'backend caído', 'status': 503,
                }):
            with self.assertRaises(HTTPException) as ctx:
                chat.chat(self.request(), 'token', None)
        self.assertEqual(ctx.exception.status_code, 502)
        self.assertIn('No fue posible consultar', ctx.exception.detail)

    @patch('chat.consultar_contexto', return_value=contexto_valido())
    def test_timeout_de_gemini_es_504(self, _):
        class FakeClient:
            def __init__(self, **kwargs):
                self.interactions = self

            def create(self, **kwargs):
                raise TimeoutError('timeout')

            def close(self):
                pass

        with patch.dict(os.environ, {'GEMINI_API_KEY': 'test-key'}), \
                patch('chat.genai.Client', FakeClient):
            with self.assertRaises(HTTPException) as ctx:
                chat.chat(self.request(), 'token', None)
        self.assertEqual(ctx.exception.status_code, 504)

    @patch('chat.consultar_contexto', return_value=contexto_valido())
    def test_error_de_gemini_es_502(self, _):
        class FakeClient:
            def __init__(self, **kwargs):
                self.interactions = self

            def create(self, **kwargs):
                raise RuntimeError('proveedor caído')

            def close(self):
                pass

        with patch.dict(os.environ, {'GEMINI_API_KEY': 'test-key'}), \
                patch('chat.genai.Client', FakeClient):
            with self.assertRaises(HTTPException) as ctx:
                chat.chat(self.request(), 'token', None)
        self.assertEqual(ctx.exception.status_code, 502)
        self.assertNotIn('proveedor caído', ctx.exception.detail)

    @patch('chat.consultar_contexto', return_value=contexto_valido())
    def test_respuesta_vacia_es_502(self, _):
        interaction = SimpleNamespace(output_text='   ', steps=[])

        class FakeInteractions:
            def create(self, **kwargs):
                return interaction

        class FakeClient:
            def __init__(self, **kwargs):
                self.interactions = FakeInteractions()

            def close(self):
                pass

        with patch.dict(os.environ, {'GEMINI_API_KEY': 'test-key'}), \
                patch('chat.genai.Client', FakeClient):
            with self.assertRaises(HTTPException) as ctx:
                chat.chat(self.request(), 'token', None)
        self.assertEqual(ctx.exception.status_code, 502)

    @patch('chat.consultar_contexto', return_value=contexto_valido())
    def test_tool_no_permitida_es_502(self, _):
        class Step:
            type = 'function_call'
            name = 'otra_tool'
            arguments = {}
            id = 'call-1'

            def model_dump(self, exclude_none=True):
                return {'type': self.type, 'name': self.name, 'call_id': self.id}

        interaction = SimpleNamespace(output_text=None, steps=[Step()])

        class FakeInteractions:
            def create(self, **kwargs):
                return interaction

        class FakeClient:
            def __init__(self, **kwargs):
                self.interactions = FakeInteractions()

            def close(self):
                pass

        with patch.dict(os.environ, {'GEMINI_API_KEY': 'test-key'}), \
                patch('chat.genai.Client', FakeClient):
            with self.assertRaises(HTTPException) as ctx:
                chat.chat(self.request(), 'token', None)
        self.assertEqual(ctx.exception.status_code, 502)

    def test_timeouts_configurables(self):
        with patch.dict(os.environ, {'GEMINI_TIMEOUT_MS': '45000'}):
            self.assertEqual(chat._gemini_timeout_ms(), 45000)
        with patch.dict(os.environ, {'GEMINI_TIMEOUT_MS': 'invalido'}):
            self.assertEqual(chat._gemini_timeout_ms(), 30000)
        with patch.dict(os.environ, {'BENEF_AI_TOTAL_TIMEOUT_MS': '60000'}):
            self.assertEqual(chat._total_timeout_ms(), 60000)
        with patch.dict(os.environ, {'BENEF_AI_TOTAL_TIMEOUT_MS': '1'}):
            self.assertEqual(chat._total_timeout_ms(), 40000)


class AnaliticaContractTests(unittest.TestCase):
    def test_periodo_y_fechas_son_excluyentes(self):
        with self.assertRaises(ValidationError):
            AnaliticaConsulta(
                negocio_id=1, tema='visitas', periodo='hoy',
                desde='2026-11-01', hasta='2026-11-02',
            )

    def test_desde_y_hasta_deben_ir_juntos(self):
        with self.assertRaises(ValidationError):
            AnaliticaConsulta(
                negocio_id=1, tema='visitas', desde='2026-11-01',
            )

    def test_limite_y_tema_validos(self):
        consulta = AnaliticaConsulta(
            negocio_id=1, tema='clientes', periodo='ultimos_30_dias',
            orden='visitas', limite=5, incluir_inactivos=True,
        )
        self.assertEqual(consulta.limite, 5)
        with self.assertRaises(ValidationError):
            AnaliticaConsulta(negocio_id=1, tema='clientes', limite=21)


if __name__ == '__main__':
    unittest.main()
