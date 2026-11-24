"""Pruebas del chat sin invocar Gemini ni el backend real."""

import os
import unittest
from unittest.mock import patch
from types import SimpleNamespace

from fastapi import HTTPException
from pydantic import ValidationError

import chat


class ChatContractTests(unittest.TestCase):
    def request(self, history=None, message="¿Cuántas visitas tuvimos?"):
        return chat.ChatRequest(
            negocio_id=1,
            message=message,
            history=history or [],
        )

    def test_historial_se_limita_y_conserva_el_mensaje_actual(self):
        history = [
            chat.ChatTurn(role="user", content=f"mensaje {i}")
            for i in range(20)
        ]
        with self.assertRaises(ValidationError):
            chat.ChatRequest(negocio_id=1, message="actual", history=history)

        corto = [
            chat.ChatTurn(role="user", content=f"mensaje {i}")
            for i in range(12)
        ]
        payload = chat._interaction_history(
            SimpleNamespace(history=corto, message="actual"),
        )
        texto = payload[0]["content"][0]["text"]
        self.assertIn("mensaje 0", texto)
        self.assertIn("mensaje 11", texto)
        self.assertTrue(texto.endswith("user: actual"))

        largo = [
            chat.ChatTurn(role="user", content=f"mensaje {i}")
            for i in range(20)
        ]
        payload = chat._interaction_history(
            SimpleNamespace(history=largo, message="actual"),
        )
        texto = payload[0]["content"][0]["text"]
        self.assertNotIn("mensaje 0", texto)
        self.assertIn("mensaje 19", texto)

    def test_rechaza_contexto_demasiado_grande(self):
        history = [
            chat.ChatTurn(role="user", content="x" * 2000)
            for _ in range(12)
        ]
        with self.assertRaises(ValidationError):
            chat.ChatRequest(negocio_id=1, message="actual", history=history)

    def test_rechaza_turnos_en_blanco(self):
        with self.assertRaises(ValidationError):
            chat.ChatTurn(role="user", content="   ")

    def test_tool_desconocida_no_se_ejecuta(self):
        resultado = chat._run_tool("otra_tool", {}, 1, "token")
        self.assertEqual(resultado["error"], "Tipo de consulta no permitido.")

    def test_tool_reporta_http_exception_sin_filtrar_token(self):
        def falla(*args, **kwargs):
            raise HTTPException(status_code=403, detail="sin acceso")

        with patch.dict(
            chat.TOOL_HANDLERS,
            {"metricas": (chat.FiltrosOperacion, falla)},
            clear=False,
        ):
            resultado = chat._run_tool(
                "consultar_datos_negocio",
                {"consulta": "metricas", "negocio_id": 1},
                1,
                "token-secreto",
            )
        self.assertEqual(resultado["status"], 403)
        self.assertNotIn("token-secreto", str(resultado))

    @patch("chat.validar_acceso_chat", return_value=None)
    def test_chat_sin_gemini_es_503(self, _):
        with patch.dict("os.environ", {"GEMINI_API_KEY": ""}, clear=False):
            with self.assertRaises(HTTPException) as ctx:
                chat.chat(self.request(), "token", None)
        self.assertEqual(ctx.exception.status_code, 503)

    def test_timeout_gemini_configurable(self):
        with patch.dict(os.environ, {"GEMINI_TIMEOUT_MS": "45000"}):
            self.assertEqual(chat._gemini_timeout_ms(), 45000)
        with patch.dict(os.environ, {"GEMINI_TIMEOUT_MS": "invalido"}):
            self.assertEqual(chat._gemini_timeout_ms(), 30000)
        with patch.dict(os.environ, {"GEMINI_TIMEOUT_MS": "999"}):
            self.assertEqual(chat._gemini_timeout_ms(), 30000)

    @patch("chat.validar_acceso_chat", return_value=None)
    def test_respuesta_de_gemini_sin_tools(self, _):
        interaction = SimpleNamespace(output_text="Hay 8 visitas válidas.", steps=[])

        class FakeInteractions:
            def create(self, **kwargs):
                return interaction

        class FakeClient:
            def __init__(self, **kwargs):
                self.interactions = FakeInteractions()

            def close(self):
                pass

        with patch.dict(os.environ, {"GEMINI_API_KEY": "test-key"}), \
                patch("chat.genai.Client", FakeClient):
            response = chat.chat(self.request(), "token", None)

        self.assertEqual(response.answer, "Hay 8 visitas válidas.")
        self.assertEqual(response.tools_used, [])

    @patch("chat.validar_acceso_chat", return_value=None)
    @patch("chat._run_tool", return_value={"data": {"visitas_validas": 8}})
    def test_ejecuta_tool_y_devuelve_herramientas_usadas(self, _run_tool, _acceso):
        class Step:
            type = "function_call"
            name = "consultar_datos_negocio"
            arguments = {"consulta": "metricas"}
            id = "call-1"

            def model_dump(self, exclude_none=True):
                return {
                    "type": self.type,
                    "name": self.name,
                    "arguments": self.arguments,
                    "call_id": self.id,
                }

        class FakeInteractions:
            def __init__(self):
                self.llamadas = 0

            def create(self, **kwargs):
                self.llamadas += 1
                if self.llamadas == 1:
                    return SimpleNamespace(output_text=None, steps=[Step()])
                return SimpleNamespace(output_text="Tuvimos 8 visitas válidas.", steps=[])

        class FakeClient:
            def __init__(self, **kwargs):
                self.interactions = FakeInteractions()

            def close(self):
                pass

        with patch.dict(os.environ, {"GEMINI_API_KEY": "test-key"}), \
                patch("chat.genai.Client", FakeClient):
            response = chat.chat(self.request(), "token", None)

        self.assertEqual(response.answer, "Tuvimos 8 visitas válidas.")
        self.assertEqual(response.tools_used, ["metricas"])
        _run_tool.assert_called_once()

    @patch("chat.validar_acceso_chat", return_value=None)
    def test_error_de_gemini_es_502(self, _):
        class FakeClient:
            def __init__(self, **kwargs):
                self.interactions = self

            def create(self, **kwargs):
                raise RuntimeError("proveedor caído")

            def close(self):
                pass

        with patch.dict(os.environ, {"GEMINI_API_KEY": "test-key"}), \
                patch("chat.genai.Client", FakeClient):
            with self.assertRaises(HTTPException) as ctx:
                chat.chat(self.request(), "token", None)
        self.assertEqual(ctx.exception.status_code, 502)
        self.assertNotIn("proveedor caído", ctx.exception.detail)

    @patch("chat.validar_acceso_chat", return_value=None)
    def test_respuesta_vacia_es_502(self, _):
        interaction = SimpleNamespace(output_text="   ", steps=[])

        class FakeInteractions:
            def create(self, **kwargs):
                return interaction

        class FakeClient:
            def __init__(self, **kwargs):
                self.interactions = FakeInteractions()

            def close(self):
                pass

        with patch.dict(os.environ, {"GEMINI_API_KEY": "test-key"}), \
                patch("chat.genai.Client", FakeClient):
            with self.assertRaises(HTTPException) as ctx:
                chat.chat(self.request(), "token", None)
        self.assertEqual(ctx.exception.status_code, 502)

    @patch("chat.validar_acceso_chat", return_value=None)
    def test_tool_no_permitida_es_502(self, _):
        class Step:
            type = "function_call"
            name = "otra_tool"
            arguments = {}
            id = "call-1"

            def model_dump(self, exclude_none=True):
                return {"type": self.type, "name": self.name, "call_id": self.id}

        interaction = SimpleNamespace(output_text=None, steps=[Step()])

        class FakeInteractions:
            def create(self, **kwargs):
                return interaction

        class FakeClient:
            def __init__(self, **kwargs):
                self.interactions = FakeInteractions()

            def close(self):
                pass

        with patch.dict(os.environ, {"GEMINI_API_KEY": "test-key"}), \
                patch("chat.genai.Client", FakeClient):
            with self.assertRaises(HTTPException) as ctx:
                chat.chat(self.request(), "token", None)
        self.assertEqual(ctx.exception.status_code, 502)


if __name__ == "__main__":
    unittest.main()
