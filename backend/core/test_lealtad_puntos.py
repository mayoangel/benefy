"""Pruebas de lotes, FIFO, expiración y ajustes de puntos."""

from datetime import timedelta
from uuid import uuid4

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from core import models
from core.services.lealtad import puntos, visitas
from core.services.lealtad.errores import PuntosInsuficientes
from core.test_helpers import (
    crear_dinamica_puntos,
    crear_negocio,
    crear_sucursal,
    crear_usuario,
)


class PuntosFIFOTests(TestCase):
    def setUp(self):
        self.consumer = crear_usuario()
        self.business = crear_negocio()
        self.branch = crear_sucursal(self.business)

    def test_consumo_fifo_por_expiracion_mas_proxima(self):
        ahora = timezone.now()
        a = puntos.otorgar_puntos(
            usuario=self.consumer, negocio=self.business, cantidad=10,
            origen='ajuste', referencia='a',
            fecha_expiracion=ahora + timedelta(days=1), ahora=ahora,
        )
        b = puntos.otorgar_puntos(
            usuario=self.consumer, negocio=self.business, cantidad=10,
            origen='ajuste', referencia='b',
            fecha_expiracion=ahora + timedelta(days=2), ahora=ahora,
        )
        c = puntos.otorgar_puntos(
            usuario=self.consumer, negocio=self.business, cantidad=10,
            origen='ajuste', referencia='c', fecha_expiracion=None, ahora=ahora,
        )
        movimientos = puntos.consumir_puntos(
            usuario=self.consumer, negocio=self.business, cantidad=15,
            referencia='consumo-1', ahora=ahora,
        )
        self.assertEqual(len(movimientos), 2)
        a.refresh_from_db()
        b.refresh_from_db()
        c.refresh_from_db()
        self.assertEqual(a.cantidad_disponible, 0)
        self.assertEqual(b.cantidad_disponible, 5)
        self.assertEqual(c.cantidad_disponible, 10)
        self.assertEqual(
            models.SaldoPuntos.objects.get().saldo_actual, 15,
        )

    def test_lote_sin_expiracion_se_consume_al_final(self):
        ahora = timezone.now()
        con_vencimiento = puntos.otorgar_puntos(
            usuario=self.consumer, negocio=self.business, cantidad=5,
            origen='ajuste', referencia='con-vencimiento',
            fecha_expiracion=ahora + timedelta(days=10), ahora=ahora,
        )
        sin_vencimiento = puntos.otorgar_puntos(
            usuario=self.consumer, negocio=self.business, cantidad=5,
            origen='ajuste', referencia='sin-vencimiento', ahora=ahora,
        )
        puntos.consumir_puntos(
            usuario=self.consumer, negocio=self.business, cantidad=3,
            referencia='consumo-2', ahora=ahora,
        )
        con_vencimiento.refresh_from_db()
        sin_vencimiento.refresh_from_db()
        self.assertEqual(con_vencimiento.cantidad_disponible, 2)
        self.assertEqual(sin_vencimiento.cantidad_disponible, 5)

    def test_expiracion_genera_un_solo_movimiento(self):
        ahora = timezone.now()
        lote = puntos.otorgar_puntos(
            usuario=self.consumer, negocio=self.business, cantidad=7,
            origen='ajuste', referencia='expirado',
            fecha_expiracion=ahora - timedelta(days=1),
            ahora=ahora - timedelta(days=10),
        )
        self.assertEqual(puntos.expirar_puntos(ahora=ahora), 7)
        self.assertEqual(puntos.expirar_puntos(ahora=ahora), 0)
        lote.refresh_from_db()
        self.assertEqual(lote.cantidad_disponible, 0)
        self.assertEqual(
            models.MovimientoPuntos.objects.filter(tipo='expirado').count(), 1,
        )
        self.assertEqual(models.SaldoPuntos.objects.get().saldo_actual, 0)

    def test_no_se_consumen_puntos_vencidos(self):
        ahora = timezone.now()
        puntos.otorgar_puntos(
            usuario=self.consumer, negocio=self.business, cantidad=5,
            origen='ajuste', referencia='vencido',
            fecha_expiracion=ahora - timedelta(days=1),
            ahora=ahora - timedelta(days=10),
        )
        with self.assertRaises(PuntosInsuficientes):
            puntos.consumir_puntos(
                usuario=self.consumer, negocio=self.business, cantidad=1,
                referencia='consumo-vencido', ahora=ahora,
            )


class AjustesPuntosAPITests(TestCase):
    def setUp(self):
        self.admin = crear_usuario(rol='admin_sistema')
        self.consumer = crear_usuario()
        self.business = crear_negocio()
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def ajustar(self, cantidad, clave=None, usuario=None):
        return self.client.post('/api/v1/admin/puntos/ajustar/', {
            'usuario': (usuario or self.consumer).pk,
            'negocio': self.business.pk,
            'cantidad': cantidad,
            'motivo': 'Ajuste de prueba',
            'clave_idempotencia': str(clave or uuid4()),
        }, format='json')

    def test_ajuste_positivo_y_negativo_auditado(self):
        response = self.ajustar(20)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['saldo_actual'], 20)
        self.assertEqual(
            models.MovimientoPuntos.objects.get(tipo='ajuste').cantidad, 20,
        )
        self.assertEqual(
            models.MovimientoPuntos.objects.get(tipo='ajuste').creado_por, self.admin,
        )

        response = self.ajustar(-5)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['saldo_actual'], 15)

    def test_ajuste_no_permite_saldo_negativo(self):
        self.ajustar(5)
        response = self.ajustar(-10)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['codigo'], 'saldo_negativo')
        self.assertEqual(models.SaldoPuntos.objects.get().saldo_actual, 5)

    def test_ajuste_exige_admin(self):
        self.client.force_authenticate(self.consumer)
        self.assertEqual(self.ajustar(10).status_code, 403)

    def test_idempotencia_de_ajuste(self):
        clave = uuid4()
        primera = self.ajustar(10, clave=clave)
        segunda = self.ajustar(10, clave=clave)
        self.assertEqual(primera.status_code, 201)
        self.assertEqual(segunda.status_code, 201)
        self.assertEqual(models.SaldoPuntos.objects.get().saldo_actual, 10)
        conflicto = self.ajustar(99, clave=clave)
        self.assertEqual(conflicto.status_code, 409)
        self.assertEqual(conflicto.data['codigo'], 'conflicto_idempotencia')


class PuntosNoRetroactivosTests(TestCase):
    def setUp(self):
        self.consumer = crear_usuario()
        self.business = crear_negocio()
        self.dinamica = crear_dinamica_puntos(self.business, puntos=10)

    def test_cambiar_regla_no_altera_puntos_ya_otorgados(self):
        dia_1 = timezone.now() - timedelta(days=2)
        dia_2 = timezone.now() - timedelta(days=1)
        visitas.registrar_visita(
            usuario=self.consumer, qr_uuid=self.business.qr_uuid, ahora=dia_1,
        )
        self.dinamica.regla_conversion = 5
        self.dinamica.save(update_fields=['regla_conversion'])
        visitas.registrar_visita(
            usuario=self.consumer, qr_uuid=self.business.qr_uuid, ahora=dia_2,
        )
        self.assertEqual(models.SaldoPuntos.objects.get().saldo_actual, 15)
        self.assertEqual(
            list(models.LotePuntos.objects.order_by('fecha_otorgamiento').values_list(
                'cantidad_otorgada', flat=True,
            )),
            [10, 5],
        )
