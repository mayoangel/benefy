"""Pruebas de los contratos móviles: directorio y respuestas enriquecidas."""

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from core import models
from core.services.lealtad import puntos
from core.tests.helpers import (
    crear_cupon,
    crear_negocio,
    crear_recompensa,
    crear_sucursal,
    crear_tarjeta,
    crear_usuario,
)


class DirectorioNegociosTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.consumer = crear_usuario()
        self.business = crear_negocio('Café Activo')
        self.other = crear_negocio('Panadería Activa')
        self.other.direccion = 'Zona Sur'
        self.other.save(update_fields=['direccion'])
        self.inactive = crear_negocio('Negocio Inactivo', status=False)
        self.branch = crear_sucursal(self.business, 'Centro')
        self.branch.ciudad = 'Ensenada'
        self.branch.save(update_fields=['ciudad'])
        self.inactive_branch = crear_sucursal(
            self.business, 'Sucursal Cerrada', status=False,
        )
        self.client.force_authenticate(self.consumer)

    def get(self, params=None):
        return self.client.get('/api/v1/negocios/descubrir/', params or {})

    def test_lista_solo_negocios_activos_con_campos_publicos(self):
        response = self.get()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 2)
        ids = {row['id'] for row in response.data['results']}
        self.assertIn(self.business.pk, ids)
        self.assertIn(self.other.pk, ids)
        self.assertNotIn(self.inactive.pk, ids)

        row = next(item for item in response.data['results'] if item['id'] == self.business.pk)
        for field in ('id', 'nombre', 'slug', 'descripcion', 'direccion', 'logo_url', 'categoria', 'sucursales'):
            self.assertIn(field, row)
        self.assertNotIn('qr_uuid', row)
        self.assertNotIn('correo', row)
        self.assertNotIn('stripe_id', row)
        self.assertEqual([s['id'] for s in row['sucursales']], [self.branch.pk])

    def test_busca_por_nombre_descripcion_y_sucursal(self):
        for value in ('Café', 'Centro', 'Ensenada'):
            with self.subTest(value=value):
                response = self.get({'q': value})
                self.assertEqual(response.status_code, 200)
                self.assertEqual(
                    [row['id'] for row in response.data['results']],
                    [self.business.pk],
                )
        self.assertEqual(
            self.get({'q': 'Sucursal Cerrada'}).data['count'], 0,
        )

    def test_filtra_por_categoria_y_pagina(self):
        response = self.get({
            'categoria': self.business.categoria_id,
            'page_size': 1,
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(len(response.data['results']), 1)
        self.assertIsNone(response.data['next'])

        response = self.get({'page_size': 1})
        self.assertEqual(response.data['count'], 2)
        self.assertEqual(len(response.data['results']), 1)
        self.assertIsNotNone(response.data['next'])

    def test_categoria_invalida_es_400(self):
        response = self.get({'categoria': 'no-es-un-id'})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['codigo'], 'categoria_invalida')

    def test_requiere_identidad(self):
        self.client.force_authenticate(user=None)
        self.assertEqual(self.get().status_code, 401)


class RespuestasMovilesTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = crear_usuario()
        self.business = crear_negocio('Café Móvil')
        self.branch = crear_sucursal(self.business, 'Centro')
        puntos.otorgar_puntos(
            usuario=self.user,
            negocio=self.business,
            cantidad=40,
            origen='ajuste',
            descripcion='Saldo móvil.',
        )
        self.reward = crear_recompensa(self.business, costo=10, titulo='Latte')
        self.coupon = crear_cupon(self.user, self.business, self.reward)
        card, _ = crear_tarjeta(self.business, meta=3)
        self.cycle = models.CicloTarjeta.objects.create(
            usuario=self.user,
            dinamica=card,
            negocio=self.business,
            meta=3,
            sellos_actuales=1,
            fecha_inicio=timezone.now(),
        )
        self.visit = models.RegistroActividad.objects.create(
            usuario=self.user,
            negocio=self.business,
            sucursal=self.branch,
            fecha_negocio=timezone.localdate(),
        )
        models.Canje.objects.create(
            cupon=self.coupon,
            negocio=self.business,
            sucursal=self.branch,
            origen='cliente',
            metodo='visual',
        )
        self.client.force_authenticate(self.user)

    def test_billetera_incluye_negocio_sin_consultas_redundantes(self):
        response = self.client.get('/api/v1/mi/billetera/')
        self.assertEqual(response.status_code, 200)
        for key in ('saldos', 'tarjetas', 'cupones'):
            self.assertEqual(response.data[key][0]['negocio_nombre'], self.business.nombre)
            self.assertEqual(response.data[key][0]['negocio_slug'], self.business.slug)
            self.assertEqual(response.data[key][0]['negocio_logo_url'], self.business.logo_url)

    def test_historial_incluye_negocio_y_sucursal(self):
        response = self.client.get('/api/v1/mi/historial/')
        self.assertEqual(response.status_code, 200)
        visita = response.data['visitas'][0]
        self.assertEqual(visita['negocio_nombre'], self.business.nombre)
        self.assertEqual(visita['sucursal_nombre'], self.branch.nombre)
        movimiento = response.data['movimientos'][0]
        self.assertEqual(movimiento['negocio_nombre'], self.business.nombre)
        canje = response.data['canjes'][0]
        self.assertEqual(canje['negocio_nombre'], self.business.nombre)
        self.assertEqual(canje['sucursal_nombre'], self.branch.nombre)

    def test_catalogo_incluye_datos_publicos_del_negocio(self):
        response = self.client.get(f'/api/v1/negocios/{self.business.pk}/catalogo/')
        self.assertEqual(response.status_code, 200)
        negocio = response.data['negocio']
        self.assertEqual(negocio['slug'], self.business.slug)
        self.assertEqual(negocio['descripcion'], self.business.descripcion)
        self.assertEqual(negocio['categoria']['id'], self.business.categoria_id)
        self.assertTrue(response.data['recompensas'])
        self.assertEqual(response.data['sucursales'][0]['id'], self.branch.pk)
        reward = response.data['recompensas'][0]
        self.assertEqual(reward['negocio_nombre'], self.business.nombre)
        self.assertFalse(reward['es_alianza'])

    def test_cupones_y_notificaciones_tienen_campos_moviles(self):
        models.Notificacion.objects.create(
            usuario=self.user,
            titulo='Aviso',
            cuerpo='Cuerpo real',
        )
        cupones = self.client.get('/api/v1/cupones-usuario/listar/')
        self.assertEqual(cupones.status_code, 200)
        cupon = cupones.data[0]
        self.assertEqual(cupon['uuid'], str(self.coupon.uuid))
        self.assertEqual(cupon['negocio_nombre'], self.business.nombre)
        self.assertEqual(cupon['titulo_beneficio'], self.reward.titulo)
        self.assertIn('descripcion_beneficio', cupon)

        notificaciones = self.client.get('/api/v1/notificaciones/listar/')
        self.assertEqual(notificaciones.status_code, 200)
        self.assertEqual(notificaciones.data[0]['cuerpo'], 'Cuerpo real')
