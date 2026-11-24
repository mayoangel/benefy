"""Pruebas HTTP del contrato interno de /chat."""

import json
import os
import time
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

import main
import service_auth

SECRET = 'x' * 32


def carga():
    return {'negocio_id': 1, 'message': 'Hola', 'history': []}


class ChatRouteAuthTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(main.app)

    def headers(self, body, timestamp=None, signature=None):
        timestamp = timestamp or str(int(time.time()))
        return {
            'Authorization': 'Bearer token-usuario',
            'Content-Type': 'application/json',
            'X-Benef-Timestamp': timestamp,
            'X-Benef-Signature': signature or service_auth.firmar(timestamp, body),
        }

    @patch.dict(os.environ, {'BENEF_AI_SERVICE_TOKEN': SECRET})
    def test_sin_firma_es_401(self):
        body = json.dumps(carga(), separators=(',', ':')).encode()
        response = self.client.post(
            '/chat',
            content=body,
            headers={'Authorization': 'Bearer token-usuario', 'Content-Type': 'application/json'},
        )
        self.assertEqual(response.status_code, 401)

    @patch.dict(os.environ, {'BENEF_AI_SERVICE_TOKEN': SECRET})
    def test_firma_alterada_es_401(self):
        body = json.dumps(carga(), separators=(',', ':')).encode()
        response = self.client.post(
            '/chat',
            content=body,
            headers=self.headers(body, signature='f' * 64),
        )
        self.assertEqual(response.status_code, 401)

    @patch.dict(os.environ, {'BENEF_AI_SERVICE_TOKEN': SECRET})
    def test_timestamp_viejo_es_401(self):
        body = json.dumps(carga(), separators=(',', ':')).encode()
        old = str(int(time.time()) - 3600)
        response = self.client.post(
            '/chat',
            content=body,
            headers=self.headers(body, timestamp=old),
        )
        self.assertEqual(response.status_code, 401)

    @patch.dict(os.environ, {'BENEF_AI_SERVICE_TOKEN': SECRET, 'GEMINI_API_KEY': ''})
    @patch('chat.validar_acceso_chat', return_value=None)
    def test_firma_valida_llega_al_chat_y_sin_gemini_es_503(self, _acceso):
        body = json.dumps(carga(), separators=(',', ':')).encode()
        response = self.client.post('/chat', content=body, headers=self.headers(body))
        self.assertEqual(response.status_code, 503)


if __name__ == '__main__':
    unittest.main()
