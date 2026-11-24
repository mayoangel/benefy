"""Pruebas del chat sin invocar Gemini ni el backend."""

import unittest
from unittest.mock import patch

from fastapi import HTTPException
from pydantic import ValidationError

import chat
from types import SimpleNamespace


class ChatContractTests(unittest.TestCase):
    def request(self, history=None):
        return chat.ChatRequest(
            negocio_id=1,
            message="¿Cuántas visitas tuvimos?",
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
                chat.chat(self.request(), "token")
        self.assertEqual(ctx.exception.status_code, 503)

    def test_timeout_gemini_configurable(self):
        with patch.dict("os.environ", {"GEMINI_TIMEOUT_MS": "45000"}):
            self.assertEqual(chat._gemini_timeout_ms(), 45000)
        with patch.dict("os.environ", {"GEMINI_TIMEOUT_MS": "invalido"}):
            self.assertEqual(chat._gemini_timeout_ms(), 30000)
        with patch.dict("os.environ", {"GEMINI_TIMEOUT_MS": "999"}):
            self.assertEqual(chat._gemini_timeout_ms(), 30000)


if __name__ == "__main__":
    unittest.main()
