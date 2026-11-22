"""Pruebas del contexto del portal y aislamiento por sucursal."""

from datetime import timedelta

from django.test import TestCase
from rest_framework.test import APIClient

from core import models
from core.tests.helpers import (

    crear_cupon,
    crear_negocio,
    crear_recompensa,
    crear_sucursal,
    crear_usuario,
)
from core.utils.tiempo import fecha_negocio


class PortalContextoTests(TestCase):
    def setUp(self):
        self.owner = crear_usuario()
        self.supervisor = crear_usuario()
        self.employee = crear_usuario()
        self.consumer = crear_usuario()
        self.admin = crear_usuario(rol='admin_sistema')
        self.business = crear_negocio()
        self.branch1 = crear_sucursal(self.business, 'Centro')
        self.branch2 = crear_sucursal(self.business, 'Norte')
        self.membership_owner = models.UsuarioNegocio.objects.create(
            usuario=self.owner, negocio=self.business,
            sucursal=None, rol_comercio='dueno',
        )
        self.membership_supervisor = models.UsuarioNegocio.objects.create(
            usuario=self.supervisor, negocio=self.business,
            sucursal=self.branch1, rol_comercio='supervisor',
        )
        self.membership_employee = models.UsuarioNegocio.objects.create(
            usuario=self.employee, negocio=self.business,
            sucursal=self.branch1, rol_comercio='empleado',
        )
        self.client = APIClient()

    def contexto(self, usuario):
        self.client.force_authenticate(usuario)
        return self.client.get('/api/v1/mi/contexto/')

    def test_contexto_dueno(self):
        response = self.contexto(self.owner)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['puede_portal'])
        self.assertFalse(response.data['es_admin_sistema'])
        self.assertEqual(len(response.data['membresias']), 1)
        self.assertEqual(response.data['membresias'][0]['rol_comercio'], 'dueno')
        self.assertEqual(len(response.data['negocios']), 1)
        self.assertEqual(len(response.data['sucursales']), 2)

    def test_contexto_supervisor_y_empleado(self):
        for usuario, rol in (
            (self.supervisor, 'supervisor'),
            (self.employee, 'empleado'),
        ):
            with self.subTest(rol=rol):
                response = self.contexto(usuario)
                self.assertEqual(response.status_code, 200)
                self.assertTrue(response.data['puede_portal'])
                self.assertEqual(response.data['membresias'][0]['rol_comercio'], rol)
                self.assertEqual(len(response.data['sucursales']), 1)
                self.assertEqual(
                    response.data['sucursales'][0]['id'], self.branch1.pk,
                )

    def test_contexto_consumidor_sin_membresia(self):
        response = self.contexto(self.consumer)
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data['puede_portal'])
        self.assertEqual(response.data['membresias'], [])
        self.assertEqual(response.data['negocios'], [])
        self.assertEqual(response.data['sucursales'], [])

    def test_contexto_admin(self):
        response = self.contexto(self.admin)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['es_admin_sistema'])
        self.assertTrue(response.data['puede_portal'])
        self.assertIn(self.business.pk, [n['id'] for n in response.data['negocios']])

    def test_desactivar_membresia_revoca_contexto_y_metricas(self):
        self.membership_supervisor.status = False
        self.membership_supervisor.save(update_fields=['status'])
        response = self.contexto(self.supervisor)
        self.assertFalse(response.data['puede_portal'])
        self.assertEqual(response.data['membresias'], [])

        self.client.force_authenticate(self.supervisor)
        metrics = self.client.get(f'/api/v1/negocios/{self.business.pk}/metricas/')
        self.assertEqual(metrics.status_code, 403)

    def test_negocio_inactivo_no_otorga_acceso(self):
        self.business.status = False
        self.business.save(update_fields=['status'])
        response = self.contexto(self.owner)
        self.assertFalse(response.data['puede_portal'])
        self.assertEqual(response.data['negocios'], [])

    def test_sucursal_inactiva_no_otorga_acceso(self):
        self.branch1.status = False
        self.branch1.save(update_fields=['status'])
        response = self.contexto(self.supervisor)
        self.assertFalse(response.data['puede_portal'])


class AislamientoSucursalTests(TestCase):
    def setUp(self):
        self.owner = crear_usuario()
        self.supervisor = crear_usuario()
        self.employee = crear_usuario()
        self.consumer1 = crear_usuario()
        self.consumer2 = crear_usuario()
        self.admin = crear_usuario(rol='admin_sistema')
        self.business = crear_negocio()
        self.branch1 = crear_sucursal(self.business, 'Centro')
        self.branch2 = crear_sucursal(self.business, 'Norte')
        models.UsuarioNegocio.objects.create(
            usuario=self.owner, negocio=self.business,
            sucursal=None, rol_comercio='dueno',
        )
        models.UsuarioNegocio.objects.create(
            usuario=self.supervisor, negocio=self.business,
            sucursal=self.branch1, rol_comercio='supervisor',
        )
        models.UsuarioNegocio.objects.create(
            usuario=self.employee, negocio=self.business,
            sucursal=self.branch1, rol_comercio='empleado',
        )
        self.reward = crear_recompensa(self.business, costo=10)
        self.coupon1 = crear_cupon(self.consumer1, self.business, self.reward)
        self.coupon2 = crear_cupon(self.consumer2, self.business, self.reward)
        today = fecha_negocio(self.business)
        self.visit1 = models.RegistroActividad.objects.create(
            usuario=self.consumer1, negocio=self.business,
            sucursal=self.branch1, tipo='visita',
            fecha_negocio=today, es_valida=True,
        )
        self.visit2 = models.RegistroActividad.objects.create(
            usuario=self.consumer2, negocio=self.business,
            sucursal=self.branch2, tipo='visita',
            fecha_negocio=today, es_valida=True,
        )
        self.canje1 = models.Canje.objects.create(
            cupon=self.coupon1, sucursal=self.branch1,
            negocio=self.business, origen='cliente', metodo='visual',
        )
        self.canje2 = models.Canje.objects.create(
            cupon=self.coupon2, sucursal=self.branch2,
            negocio=self.business, origen='cliente', metodo='visual',
        )
        self.client = APIClient()

    def get(self, usuario, path):
        self.client.force_authenticate(usuario)
        return self.client.get(path)

    def test_visitas_por_sucursal(self):
        for usuario, ids in (
            (self.owner, [self.visit1.pk, self.visit2.pk]),
            (self.supervisor, [self.visit1.pk]),
            (self.employee, [self.visit1.pk]),
        ):
            with self.subTest(usuario=usuario.correo):
                response = self.get(usuario, '/api/v1/registros-actividad/listar/')
                self.assertEqual(response.status_code, 200)
                self.assertEqual(
                    sorted(fila['id'] for fila in response.data),
                    sorted(ids),
                )

    def test_canjes_por_sucursal(self):
        for usuario, ids in (
            (self.owner, [self.canje1.pk, self.canje2.pk]),
            (self.supervisor, [self.canje1.pk]),
            (self.employee, [self.canje1.pk]),
        ):
            with self.subTest(usuario=usuario.correo):
                response = self.get(usuario, '/api/v1/canjes/listar/')
                self.assertEqual(response.status_code, 200)
                self.assertEqual(
                    sorted(fila['id'] for fila in response.data),
                    sorted(ids),
                )

    def test_cupones_solo_dueno_ve_negocio_completo(self):
        owner = self.get(self.owner, '/api/v1/cupones-usuario/listar/')
        supervisor = self.get(self.supervisor, '/api/v1/cupones-usuario/listar/')
        employee = self.get(self.employee, '/api/v1/cupones-usuario/listar/')
        self.assertEqual(len(owner.data), 2)
        self.assertEqual(supervisor.data, [])
        self.assertEqual(employee.data, [])

    def test_metricas_por_sucursal(self):
        owner = self.get(
            self.owner, f'/api/v1/negocios/{self.business.pk}/metricas/',
        )
        supervisor = self.get(
            self.supervisor, f'/api/v1/negocios/{self.business.pk}/metricas/',
        )
        employee = self.get(
            self.employee, f'/api/v1/negocios/{self.business.pk}/metricas/',
        )
        admin = self.get(
            self.admin, f'/api/v1/negocios/{self.business.pk}/metricas/',
        )

        self.assertEqual(owner.data['alcance'], 'negocio')
        self.assertEqual(owner.data['visitas_validas'], 2)
        self.assertEqual(owner.data['cupones_canjeados'], 2)
        self.assertIsNotNone(owner.data['puntos_otorgados'])

        for response in (supervisor, employee):
            self.assertEqual(response.data['alcance'], 'sucursal')
            self.assertEqual(response.data['visitas_validas'], 1)
            self.assertEqual(response.data['cupones_canjeados'], 1)
            self.assertIsNone(response.data['puntos_otorgados'])
            self.assertEqual(response.data['sucursales'], [self.branch1.pk])

        self.assertEqual(admin.data['alcance'], 'negocio')
        self.assertEqual(admin.data['visitas_validas'], 2)

    def test_supervisor_no_filtra_otra_sucursal(self):
        response = self.get(
            self.supervisor,
            f'/api/v1/negocios/{self.business.pk}/metricas/?sucursal={self.branch2.pk}',
        )
        self.assertEqual(response.status_code, 403)

    def test_dueno_filtra_sucursal(self):
        response = self.get(
            self.owner,
            f'/api/v1/negocios/{self.business.pk}/metricas/?sucursal={self.branch2.pk}',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['alcance'], 'sucursal')
        self.assertEqual(response.data['visitas_validas'], 1)
        self.assertIsNone(response.data['puntos_otorgados'])
