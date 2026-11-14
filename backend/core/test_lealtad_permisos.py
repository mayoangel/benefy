"""Pruebas de permisos y aislamiento de los endpoints de lealtad."""

from django.test import TestCase
from rest_framework.test import APIClient

from core import models
from core.services.lealtad import puntos, visitas
from core.test_helpers import (
    crear_cupon,
    crear_negocio,
    crear_recompensa,
    crear_usuario,
)


class LealtadPermisosTests(TestCase):
    def setUp(self):
        self.consumer = crear_usuario()
        self.other = crear_usuario()
        self.owner = crear_usuario(rol='negocio')
        self.foreign_owner = crear_usuario(rol='negocio')
        self.admin = crear_usuario(rol='admin_sistema')
        self.business = crear_negocio()
        self.foreign = crear_negocio('Ajeno')
        models.UsuarioNegocio.objects.create(
            usuario=self.owner, negocio=self.business,
            rol_comercio='dueno', sucursal=None,
        )
        models.UsuarioNegocio.objects.create(
            usuario=self.foreign_owner, negocio=self.foreign,
            rol_comercio='dueno', sucursal=None,
        )
        self.reward = crear_recompensa(self.business, costo=10)
        self.coupon = crear_cupon(self.consumer, self.business, self.reward)
        self.other_coupon = crear_cupon(self.other, self.business, self.reward)
        puntos.otorgar_puntos(
            usuario=self.consumer, negocio=self.business, cantidad=20,
            origen='ajuste', referencia='consumer',
        )
        puntos.otorgar_puntos(
            usuario=self.other, negocio=self.business, cantidad=30,
            origen='ajuste', referencia='other',
        )
        visitas.registrar_visita(
            usuario=self.consumer, qr_uuid=self.business.qr_uuid,
        )
        visitas.registrar_visita(
            usuario=self.other, qr_uuid=self.business.qr_uuid,
        )
        self.client = APIClient()

    def test_billetera_solo_muestra_datos_propios(self):
        self.client.force_authenticate(self.consumer)
        response = self.client.get('/api/v1/mi/billetera/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['saldos']), 1)
        self.assertEqual(response.data['saldos'][0]['saldo_actual'], 20)
        self.assertEqual(len(response.data['cupones']), 1)
        self.assertEqual(
            response.data['cupones'][0]['uuid'], str(self.coupon.uuid),
        )

    def test_historial_solo_muestra_datos_propios(self):
        self.client.force_authenticate(self.consumer)
        response = self.client.get('/api/v1/mi/historial/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['visitas']), 1)
        self.assertEqual(response.data['visitas'][0]['usuario'], self.consumer.pk)
        self.assertEqual(len(response.data['movimientos']), 1)

    def test_metricas_solo_para_negocio_propio_o_admin(self):
        self.client.force_authenticate(self.owner)
        path = f'/api/v1/negocios/{self.business.pk}/metricas/'
        self.assertEqual(self.client.get(path).status_code, 200)

        self.client.force_authenticate(self.foreign_owner)
        self.assertEqual(self.client.get(path).status_code, 403)

        self.client.force_authenticate(self.consumer)
        self.assertEqual(self.client.get(path).status_code, 403)

        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.get(path).status_code, 200)

    def test_consumidor_no_puede_usar_endpoints_administrativos(self):
        self.client.force_authenticate(self.consumer)
        self.assertEqual(
            self.client.post('/api/v1/admin/puntos/ajustar/', {}).status_code,
            403,
        )
        self.assertEqual(
            self.client.post(
                f'/api/v1/admin/visitas/{models.RegistroActividad.objects.first().pk}/anular/',
                {'motivo': 'x'},
            ).status_code,
            403,
        )

    def test_catalogo_visible_para_consumidor(self):
        self.client.force_authenticate(self.consumer)
        response = self.client.get(
            f'/api/v1/negocios/{self.business.pk}/catalogo/',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['negocio']['id'], self.business.pk)
