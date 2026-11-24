"""Pruebas de la firma HMAC entre Django y Benef AI."""

import os
import unittest
from unittest.mock import patch

from fastapi import HTTPException

import service_auth


SECRET = 'x' * 32
BODY = b'{"a":1}'
TIMESTAMP = '1700000000'
FIRMA_ESPERADA = '957b87db4c7d287b0d2756d5f57bcf571479322e7049a798062a09e371afead2'


class ServiceAuthTests(unittest.TestCase):
    @patch.dict(os.environ, {'BENEF_AI_SERVICE_TOKEN': SECRET})
    def test_vector_compatible_con_django(self):
        self.assertEqual(
            service_auth.firmar(TIMESTAMP, BODY),
            FIRMA_ESPERADA,
        )
        service_auth.validar_firma(
            TIMESTAMP, FIRMA_ESPERADA, BODY, now=1700000000,
        )

    @patch.dict(os.environ, {'BENEF_AI_SERVICE_TOKEN': SECRET})
    def test_rechaza_firma_alterada(self):
        with self.assertRaises(HTTPException) as ctx:
            service_auth.validar_firma(
                TIMESTAMP, 'f' * 64, BODY, now=1700000000,
            )
        self.assertEqual(ctx.exception.status_code, 401)

    @patch.dict(os.environ, {'BENEF_AI_SERVICE_TOKEN': SECRET})
    def test_rechaza_solicitud_expirada(self):
        with self.assertRaises(HTTPException) as ctx:
            service_auth.validar_firma(
                TIMESTAMP, FIRMA_ESPERADA, BODY, now=1700000401,
            )
        self.assertEqual(ctx.exception.status_code, 401)

    @patch.dict(os.environ, {'BENEF_AI_SERVICE_TOKEN': SECRET})
    def test_rechaza_timestamp_invalido(self):
        with self.assertRaises(HTTPException) as ctx:
            service_auth.validar_firma(
                'no-es-fecha', FIRMA_ESPERADA, BODY, now=1700000000,
            )
        self.assertEqual(ctx.exception.status_code, 401)

    @patch.dict(os.environ, {'BENEF_AI_SERVICE_TOKEN': 'corto'})
    def test_sin_token_valido_es_503(self):
        with self.assertRaises(HTTPException) as ctx:
            service_auth.validar_firma(
                TIMESTAMP, FIRMA_ESPERADA, BODY, now=1700000000,
            )
        self.assertEqual(ctx.exception.status_code, 503)

    @patch.dict(os.environ, {'BENEF_AI_SERVICE_TOKEN': SECRET})
    def test_cambiar_el_cuerpo_invalida_la_firma(self):
        with self.assertRaises(HTTPException) as ctx:
            service_auth.validar_firma(
                TIMESTAMP, FIRMA_ESPERADA, b'{"a":2}', now=1700000000,
            )
        self.assertEqual(ctx.exception.status_code, 401)


if __name__ == '__main__':
    unittest.main()
