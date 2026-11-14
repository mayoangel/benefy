"""Pruebas de visitas, QR y límite diario por negocio."""

from datetime import datetime, timezone as dt_timezone
from uuid import uuid4

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from core import models
from core.services.lealtad import visitas
from core.test_helpers import (
    crear_dinamica_puntos,
    crear_negocio,
    crear_sucursal,
    crear_tarjeta,
    crear_usuario,
)


class VisitasAPITests(TestCase):
    def setUp(self):
        self.consumer = crear_usuario()
        self.business = crear_negocio()
        self.branch = crear_sucursal(self.business, 'Centro')
        self.other_branch = crear_sucursal(self.business, 'Norte')
        self.points = crear_dinamica_puntos(self.business, puntos=10)
        self.card, self.card_reward = crear_tarjeta(self.business, meta=3)
        self.client = APIClient()
        self.client.force_authenticate(self.consumer)

    def registrar(self, qr=None):
        return self.client.post('/api/v1/visitas/registrar/', {
            'qr_uuid': str(qr or self.business.qr_uuid),
        }, format='json')

    def test_primera_visita_otorga_puntos_y_avanza_tarjeta(self):
        response = self.registrar()
        self.assertEqual(response.status_code, 201)
        self.assertFalse(response.data['already_registered'])
        self.assertEqual(response.data['puntos_otorgados'], 10)
        self.assertEqual(response.data['tarjetas'][0]['sellos_actuales'], 1)

        self.assertEqual(models.RegistroActividad.objects.count(), 1)
        self.assertEqual(models.SaldoPuntos.objects.get().saldo_actual, 10)
        self.assertEqual(models.LotePuntos.objects.count(), 1)
        self.assertEqual(
            models.MovimientoPuntos.objects.get(tipo='otorgado').cantidad, 10,
        )
        self.assertEqual(models.CicloTarjeta.objects.get().sellos_actuales, 1)

    def test_duplicado_mismo_dia_responde_200_sin_beneficios(self):
        self.registrar()
        response = self.registrar()
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['already_registered'])
        self.assertEqual(response.data['puntos_otorgados'], 0)
        self.assertEqual(response.data['tarjetas'], [])
        self.assertEqual(models.RegistroActividad.objects.count(), 1)
        self.assertEqual(models.LotePuntos.objects.count(), 1)
        self.assertEqual(models.SaldoPuntos.objects.get().saldo_actual, 10)

    def test_dos_sucursales_del_mismo_negocio_no_duplican(self):
        self.assertEqual(self.registrar(self.branch.qr_uuid).status_code, 201)
        response = self.registrar(self.other_branch.qr_uuid)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['already_registered'])
        self.assertEqual(models.RegistroActividad.objects.count(), 1)

    def test_registro_de_compra_no_bloquea_la_visita(self):
        models.RegistroActividad.objects.create(
            usuario=self.consumer,
            negocio=self.business,
            sucursal=self.branch,
            tipo='compra',
            monto_transaccion='10.00',
            fecha_negocio=timezone.localdate(),
        )
        self.assertEqual(self.registrar().status_code, 201)

    def test_negocios_distintos_permiten_visita_el_mismo_dia(self):
        otro = crear_negocio('Otro')
        crear_dinamica_puntos(otro, puntos=5)
        self.assertEqual(self.registrar().status_code, 201)
        self.assertEqual(self.registrar(otro.qr_uuid).status_code, 201)
        self.assertEqual(models.RegistroActividad.objects.count(), 2)
        self.assertEqual(models.SaldoPuntos.objects.count(), 2)

    def test_qr_invalido_responde_404(self):
        response = self.registrar(uuid4())
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.data['codigo'], 'qr_invalido')

    def test_negocio_inactivo_responde_403(self):
        self.business.status = False
        self.business.save(update_fields=['status'])
        response = self.registrar()
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data['codigo'], 'negocio_inactivo')

    def test_solo_consumidores_registran_visitas(self):
        empleado = crear_usuario(rol='negocio')
        self.client.force_authenticate(empleado)
        response = self.registrar()
        self.assertEqual(response.status_code, 403)

    def test_visita_anulada_bloquea_un_nuevo_registro(self):
        primera = self.registrar()
        self.assertEqual(primera.status_code, 201)
        admin = crear_usuario(rol='admin_sistema')
        visitas.anular_visita(
            visita_id=primera.data['visita']['id'],
            motivo='Corrección de prueba',
            administrador=admin,
        )
        segunda = self.registrar()
        self.assertEqual(segunda.status_code, 200)
        self.assertTrue(segunda.data['already_registered'])
        self.assertEqual(models.LotePuntos.objects.count(), 1)


class VisitasZonaHorariaTests(TestCase):
    def setUp(self):
        self.consumer = crear_usuario()
        self.business = crear_negocio(zona_horaria='America/Tijuana')
        self.points = crear_dinamica_puntos(self.business, puntos=10)

    def test_dos_instantes_utc_pueden_ser_dos_dias_locales(self):
        # 2026-11-14 07:30 UTC = 2026-11-13 23:30 en Tijuana (PST).
        antes = datetime(2026, 11, 14, 7, 30, tzinfo=dt_timezone.utc)
        despues = datetime(2026, 11, 14, 8, 30, tzinfo=dt_timezone.utc)
        uno = visitas.registrar_visita(
            usuario=self.consumer, qr_uuid=self.business.qr_uuid, ahora=antes,
        )
        dos = visitas.registrar_visita(
            usuario=self.consumer, qr_uuid=self.business.qr_uuid, ahora=despues,
        )
        self.assertFalse(uno['already_registered'])
        self.assertFalse(dos['already_registered'])
        fechas = list(models.RegistroActividad.objects.order_by(
            'fecha_negocio',
        ).values_list('fecha_negocio', flat=True))
        self.assertEqual(len(fechas), 2)
        self.assertNotEqual(fechas[0], fechas[1])

    def test_mismo_dia_local_es_duplicado_aunque_cambie_la_hora_utc(self):
        primera = datetime(2026, 11, 14, 20, 0, tzinfo=dt_timezone.utc)
        segunda = datetime(2026, 11, 14, 23, 0, tzinfo=dt_timezone.utc)
        visitas.registrar_visita(
            usuario=self.consumer, qr_uuid=self.business.qr_uuid, ahora=primera,
        )
        resultado = visitas.registrar_visita(
            usuario=self.consumer, qr_uuid=self.business.qr_uuid, ahora=segunda,
        )
        self.assertTrue(resultado['already_registered'])
        self.assertEqual(models.RegistroActividad.objects.count(), 1)
