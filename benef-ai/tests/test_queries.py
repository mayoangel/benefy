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


class ContextoChatTests(unittest.TestCase):
    def test_contexto_incluye_sucursal_y_conserva_error(self):
        capturado = {}

        def request(path, token, params=None):
            capturado.update(path=path, token=token, params=params)
            return 200, {"usuario": {"nombre_completo": "Ana"}}

        with patch.object(queries, "_backend_request", side_effect=request):
            datos = queries.consultar_contexto("token", 7, sucursal_id=11)
        self.assertEqual(datos["usuario"]["nombre_completo"], "Ana")
        self.assertEqual(capturado["path"], "/negocios/7/benef-ai/contexto/")
        self.assertEqual(capturado["params"], {"sucursal": 11})

    def test_contexto_invalido_es_502(self):
        with patch.object(queries, "_backend_request", return_value=(200, [])):
            with self.assertRaises(HTTPException) as ctx:
                queries.consultar_contexto("token", 7)
        self.assertEqual(ctx.exception.status_code, 502)


class AnaliticaChatTests(unittest.TestCase):
    def test_analitica_envia_parametros_acotados(self):
        capturado = {}
        consulta = queries.AnaliticaConsulta(
            negocio_id=7,
            tema="clientes",
            periodo="ultimos_30_dias",
            orden="visitas",
            limite=5,
            incluir_inactivos=True,
        )

        def backend_get(path, token, params=None, *, negocio_id, timeout=None):
            capturado.update(path=path, params=params, negocio_id=negocio_id)
            return {"resultados": []}

        with patch.object(queries, "_backend_get", side_effect=backend_get):
            datos = queries.consultar_analitica(consulta, "token")
        self.assertEqual(datos, {"resultados": []})
        self.assertEqual(capturado["path"], "/negocios/7/benef-ai/analitica/")
        self.assertEqual(capturado["params"]["tema"], "clientes")
        self.assertEqual(capturado["params"]["limite"], 5)
        self.assertEqual(capturado["params"]["incluir_inactivos"], "true")

    def test_conocimiento_devuelve_tema_y_temas_disponibles(self):
        datos = queries.consultar_conocimiento("cupones")
        self.assertEqual(datos["tema"], "cupones")
        self.assertIn("contenido", datos)
        self.assertIn("cupones", queries.temas_conocimiento())


if __name__ == "__main__":
    unittest.main()
