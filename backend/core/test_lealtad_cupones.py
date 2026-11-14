"""Pruebas de catálogo, adquisición, stock e idempotencia de cupones."""

from datetime import timedelta
from uuid import uuid4

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from core import models
from core.services.lealtad import puntos
from core.test_helpers import (
    crear_dinamica_puntos,
    crear_negocio,
    crear_recompensa,
    crear_tarjeta,
    crear_usuario,
)


class AdquisicionCuponesTests(TestCase):
    def setUp(self):
        self.consumer = crear_usuario()
        self.admin = crear_usuario(rol='admin_sistema')
        self.business = crear_negocio()
        self.reward = crear_recompensa(
            self.business, costo=50, titulo='Café gratis', cantidad_disponible=2,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.consumer)
        puntos.otorgar_puntos(
            usuario=self.consumer, negocio=self.business, cantidad=100,
            origen='ajuste', referencia='saldo-inicial',
        )

    def adquirir(self, reward=None, clave=None):
        return self.client.post('/api/v1/cupones/adquirir/', {
            'recompensa': (reward or self.reward).pk,
            'clave_idempotencia': str(clave or uuid4()),
        }, format='json')

    def test_adquisicion_descuenta_puntos_y_emite_cupon(self):
        response = self.adquirir()
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['saldo_restante'], 50)
        cupon = models.CuponUsuario.objects.get()
        self.assertEqual(cupon.status, 'disponible')
        self.assertEqual(cupon.costo_pagado, 50)
        self.assertEqual(cupon.titulo_beneficio, self.reward.titulo)
        self.reward.refresh_from_db()
        self.assertEqual(self.reward.cantidad_disponible, 1)
        self.assertEqual(
            models.MovimientoPuntos.objects.get(tipo='consumido').cantidad, -50,
        )

    def test_idempotencia_devuelve_el_mismo_cupon(self):
        clave = uuid4()
        primera = self.adquirir(clave=clave)
        segunda = self.adquirir(clave=clave)
        self.assertEqual(primera.status_code, 201)
        self.assertEqual(segunda.status_code, 200)
        self.assertEqual(primera.data['cupon']['uuid'], segunda.data['cupon']['uuid'])
        self.assertEqual(models.CuponUsuario.objects.count(), 1)
        self.assertEqual(models.SaldoPuntos.objects.get().saldo_actual, 50)

    def test_idempotencia_con_otra_recompensa_es_conflicto(self):
        otra = crear_recompensa(self.business, costo=10, titulo='Otra')
        clave = uuid4()
        self.assertEqual(self.adquirir(clave=clave).status_code, 201)
        response = self.adquirir(reward=otra, clave=clave)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['codigo'], 'conflicto_idempotencia')
        self.assertEqual(models.CuponUsuario.objects.count(), 1)

    def test_sin_puntos_insuficientes(self):
        caro = crear_recompensa(self.business, costo=500, titulo='Caro')
        response = self.adquirir(reward=caro)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['codigo'], 'puntos_insuficientes')
        self.assertEqual(models.CuponUsuario.objects.count(), 0)

    def test_sin_stock(self):
        self.reward.cantidad_disponible = 0
        self.reward.save(update_fields=['cantidad_disponible'])
        response = self.adquirir()
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['codigo'], 'sin_stock')

    def test_recompensa_inactiva(self):
        self.reward.status = False
        self.reward.save(update_fields=['status'])
        response = self.adquirir()
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['codigo'], 'recompensa_inactiva')

    def test_cupon_conserva_condiciones_tras_desactivar_recompensa(self):
        response = self.adquirir()
        self.assertEqual(response.status_code, 201)
        titulo = self.reward.titulo
        self.reward.titulo = 'Título nuevo'
        self.reward.status = False
        self.reward.save(update_fields=['titulo', 'status'])
        cupon = models.CuponUsuario.objects.get()
        self.assertEqual(cupon.titulo_beneficio, titulo)
        self.assertEqual(cupon.status, 'disponible')

    def test_vencimiento_se_recorta_al_fin_de_la_dinamica(self):
        dinamica = crear_dinamica_puntos(self.business, puntos=1)
        dinamica.fecha_fin = timezone.now() + timedelta(days=2)
        dinamica.save(update_fields=['fecha_fin'])
        recompensa = crear_recompensa(
            self.business, costo=1, titulo='Con dinámica',
            dinamica=dinamica, vigencia_dias=30,
        )
        response = self.adquirir(reward=recompensa)
        self.assertEqual(response.status_code, 201)
        cupon = models.CuponUsuario.objects.get(recompensa=recompensa)
        self.assertLessEqual(cupon.fecha_expiracion, dinamica.fecha_fin)

    def test_clave_de_idempotencia_obligatoria(self):
        response = self.client.post('/api/v1/cupones/adquirir/', {
            'recompensa': self.reward.pk,
        }, format='json')
        self.assertEqual(response.status_code, 400)

    def test_clave_usada_en_ajuste_no_se_reutiliza_en_adquisicion(self):
        clave = uuid4()
        puntos.ajustar_puntos(
            usuario=self.consumer,
            negocio=self.business,
            cantidad=5,
            motivo='Ajuste previo',
            creado_por=self.admin,
            clave_idempotencia=str(clave),
        )
        response = self.adquirir(clave=clave)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['codigo'], 'conflicto_idempotencia')
        self.assertEqual(models.CuponUsuario.objects.count(), 0)

    def test_clave_usada_en_adquisicion_no_se_reutiliza_en_ajuste(self):
        clave = uuid4()
        self.assertEqual(self.adquirir(clave=clave).status_code, 201)
        with self.assertRaises(Exception) as contexto:
            puntos.ajustar_puntos(
                usuario=self.consumer,
                negocio=self.business,
                cantidad=5,
                motivo='Ajuste posterior',
                creado_por=self.admin,
                clave_idempotencia=str(clave),
            )
        self.assertEqual(contexto.exception.codigo, 'conflicto_idempotencia')


class CatalogoTests(TestCase):
    def setUp(self):
        self.consumer = crear_usuario()
        self.business = crear_negocio()
        self.client = APIClient()
        self.client.force_authenticate(self.consumer)

    def test_catalogo_excluye_meta_agotadas_e_inactivas(self):
        disponible = crear_recompensa(self.business, costo=10, titulo='Disponible')
        crear_recompensa(
            self.business, costo=10, titulo='Agotada', cantidad_disponible=0,
        )
        crear_recompensa(self.business, costo=10, titulo='Inactiva', status=False)
        _, meta = crear_tarjeta(self.business)
        response = self.client.get(f'/api/v1/negocios/{self.business.pk}/catalogo/')
        self.assertEqual(response.status_code, 200)
        ids = [fila['id'] for fila in response.data['recompensas']]
        self.assertEqual(ids, [disponible.pk])
        self.assertNotIn(meta.pk, ids)
