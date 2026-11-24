"""Pruebas de configuración y health checks de Benef AI."""

import unittest
from unittest.mock import patch

from fastapi.responses import JSONResponse

import main


class ConfiguracionTests(unittest.TestCase):
    def test_url_https_es_valida(self):
        main._validar_backend_url("https://api.example.com/api/v1")

    def test_url_privada_railway_es_valida(self):
        main._validar_backend_url("http://backend.railway.internal:8000/api/v1")

    def test_url_publica_http_es_rechazada(self):
        with self.assertRaises(RuntimeError):
            main._validar_backend_url("http://api.example.com/api/v1")

    def test_url_sin_api_v1_es_rechazada(self):
        with self.assertRaises(RuntimeError):
            main._validar_backend_url("https://api.example.com/api/")


class HealthTests(unittest.TestCase):
    def test_liveness_no_depende_de_backend(self):
        self.assertEqual(main.health_check()["status"], "ok")
        self.assertEqual(main.health_live()["status"], "ok")

    def test_readiness_sin_backend_es_503(self):
        with patch.object(main, "BACKEND_API_URL", ""):
            response = main.health_ready()
        self.assertIsInstance(response, JSONResponse)
        self.assertEqual(response.status_code, 503)

    def test_readiness_con_backend_es_ok(self):
        with patch.object(main, "BACKEND_API_URL", "https://api.example.com/api/v1"):
            response = main.health_ready()
        self.assertEqual(response["status"], "ok")
        self.assertTrue(response["backend_configurado"])


if __name__ == "__main__":
    unittest.main()
