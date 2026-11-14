"""Pruebas del canje iniciado por el cliente."""

from datetime import timedelta

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from core import models
from core.test_helpers import (
    crear_cupon,
    crear_negocio,
    crear_recompensa,
    crear_usuario,
)


class CanjeClienteTests(TestCase):
    def setUp(self):
        self.consumer = crear_usuario()
        self.other = crear_usuario()
        self.business = crear_negocio()
        self.reward = crear_recompensa(self.business, costo=10, titulo='Café')
        self.coupon = crear_cupon(self.consumer, self.business, self.reward)
        self.client = APIClient()

    def canjear(self, usuario=None, cupon=None):
        self.client.force_authenticate(usuario or self.consumer)
        return self.client.post(
            f'/api/v1/cupones/{(cupon or self.coupon).uuid}/canjear/',
        )

    def test_canje_consume_cupon_y_devuelve_pantalla(self):
        response = self.canjear()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['cupon']['status'], 'canjeado')
        self.assertEqual(response.data['canje']['duracion_segundos'], 300)
        self.assertIsNotNone(response.data['canje']['token_validacion'])
        self.assertIsNotNone(response.data['canje']['servidor_ahora'])
        self.coupon.refresh_from_db()
        self.assertEqual(self.coupon.status, 'canjeado')
        canje = models.Canje.objects.get()
        self.assertEqual(canje.origen, 'cliente')
        self.assertEqual(canje.metodo, 'visual')
        self.assertIsNone(canje.sucursal)
        self.assertEqual(canje.negocio, self.business)

    def test_doble_canje_es_rechazado(self):
        self.assertEqual(self.canjear().status_code, 200)
        response = self.canjear()
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['codigo'], 'cupon_no_disponible')
        self.assertEqual(models.Canje.objects.count(), 1)

    def test_cupon_vencido_es_rechazado(self):
        vencido = crear_cupon(
            self.consumer, self.business, self.reward, dias=-1,
        )
        response = self.canjear(cupon=vencido)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['codigo'], 'cupon_no_disponible')

    def test_cupon_ajeno_es_rechazado(self):
        response = self.canjear(usuario=self.other)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data['codigo'], 'cupon_ajeno')
        self.assertEqual(models.Canje.objects.count(), 0)

    def test_cupon_anulado_es_rechazado(self):
        self.coupon.status = 'anulado'
        self.coupon.save(update_fields=['status'])
        response = self.canjear()
        self.assertEqual(response.status_code, 409)

    @override_settings(CANJE_VALIDACION_SEGUNDOS=60)
    def test_duracion_configurable(self):
        response = self.canjear()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['canje']['duracion_segundos'], 60)
        expira = response.data['canje']['expira_en']
        ahora = response.data['canje']['servidor_ahora']
        self.assertGreaterEqual(
            (expira - ahora).total_seconds(), 55,
        )
