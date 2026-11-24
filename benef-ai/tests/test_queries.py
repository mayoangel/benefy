"""Pruebas mínimas y sin red para los contratos de Benef AI."""

import os
import unittest
from unittest.mock import patch

import requests
from fastapi import HTTPException

import queries


class BackendRequestTests(unittest.TestCase):
    @patch.dict(os.environ, {"BACKEND_API_URL": ""})
    def test_sin_backend_url_es_503(self):
        with self.assertRaises(HTTPException) as ctx:
            queries._backend_request("/mi/contexto/", "token")
        self.assertEqual(ctx.exception.status_code, 503)

    @patch.dict(os.environ, {"BACKEND_API_URL": "http://backend:8000/api/v1"})
    @patch("queries.requests.get", side_effect=requests.exceptions.Timeout)
    def test_timeout_es_504(self, _):
        with self.assertRaises(HTTPException) as ctx:
            queries._backend_request("/mi/contexto/", "token")
        self.assertEqual(ctx.exception.status_code, 504)

    @patch.dict(os.environ, {"BACKEND_API_URL": "http://backend:8000/api/v1"})
    @patch("queries.requests.get")
    def test_error_de_red_es_503(self, get):
        get.side_effect = requests.exceptions.ConnectionError()
        with self.assertRaises(HTTPException) as ctx:
            queries._backend_request("/mi/contexto/", "token")
        self.assertEqual(ctx.exception.status_code, 503)

    @patch.dict(os.environ, {"BACKEND_API_URL": "http://backend:8000/api/v1"})
    @patch("queries.requests.get")
    def test_respuesta_invalida_es_502(self, get):
        get.return_value.status_code = 200
        get.return_value.json.side_effect = ValueError()
        with self.assertRaises(HTTPException) as ctx:
            queries._backend_request("/mi/contexto/", "token")
        self.assertEqual(ctx.exception.status_code, 502)

    @patch.dict(os.environ, {"BACKEND_API_URL": "http://backend:8000/api/v1"})
    @patch("queries.requests.get")
    def test_conserva_estado_y_payload_del_backend(self, get):
        get.return_value.status_code = 403
        get.return_value.json.return_value = {"detail": "sin acceso"}
        status, payload = queries._backend_request("/mi/contexto/", "token")
        self.assertEqual(status, 403)
        self.assertEqual(payload, {"detail": "sin acceso"})


class AccessValidationTests(unittest.TestCase):
    def test_permite_negocio_del_contexto(self):
        with patch.object(queries, "_backend_request", return_value=(200, {
            "negocios": [{"id": 1}], "es_admin_sistema": False,
        })):
            self.assertIsNone(queries.validar_acceso_negocio("token", 1))

    def test_rechaza_negocio_ajeno(self):
        with patch.object(queries, "_backend_request", return_value=(200, {
            "negocios": [{"id": 1}], "es_admin_sistema": False,
        })):
            with self.assertRaises(HTTPException) as ctx:
                queries.validar_acceso_negocio("token", 2)
        self.assertEqual(ctx.exception.status_code, 403)

    def test_rechaza_admin_sistema(self):
        with patch.object(queries, "_backend_request", return_value=(200, {
            "negocios": [{"id": 1}], "es_admin_sistema": True,
        })):
            with self.assertRaises(HTTPException) as ctx:
                queries.validar_acceso_negocio("token", 1)
        self.assertEqual(ctx.exception.status_code, 403)

    def test_contexto_invalido_es_502(self):
        with patch.object(queries, "_backend_request", return_value=(200, [])):
            with self.assertRaises(HTTPException) as ctx:
                queries.validar_acceso_negocio("token", 1)
        self.assertEqual(ctx.exception.status_code, 502)


if __name__ == "__main__":
    unittest.main()
