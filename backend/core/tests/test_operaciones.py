"""Pruebas de operaciones del portal: visitas, cupones, canjes, clientes y tarjetas."""

from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from core import models
from core.tests.helpers import (
    asegurar_planes,
    crear_cupon,
    crear_negocio,
    crear_recompensa,
    crear_sucursal,
    crear_tarjeta,
    crear_usuario,
)


class OperacionesBaseTests(TestCase):
    def setUp(self):
        asegurar_planes()
        self.owner = crear_usuario()
        self.supervisor = crear_usuario()
        self.employee = crear_usuario()
        self.other = crear_usuario()
        self.client_user = crear_usuario()
        self.client_user2 = crear_usuario()
        self.business = crear_negocio('Operaciones')
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
        self.coupon1 = crear_cupon(self.client_user, self.business, self.reward)
        self.coupon2 = crear_cupon(self.client_user2, self.business, self.reward)
        hoy = timezone.localdate()
        self.visit1 = models.RegistroActividad.objects.create(
            usuario=self.client_user, negocio=self.business,
            sucursal=self.branch1, tipo='visita',
            fecha_negocio=hoy, es_valida=True,
        )
        self.visit2 = models.RegistroActividad.objects.create(
            usuario=self.client_user2, negocio=self.business,
            sucursal=self.branch2, tipo='visita',
            fecha_negocio=hoy, es_valida=True,
        )
        self.canje1 = models.Canje.objects.create(
            cupon=self.coupon1, sucursal=self.branch1,
            negocio=self.business, origen='cliente', metodo='visual',
        )
        self.canje2 = models.Canje.objects.create(
            cupon=self.coupon2, sucursal=self.branch2,
            negocio=self.business, origen='cliente', metodo='visual',
        )
        models.SaldoPuntos.objects.create(
            usuario=self.client_user, negocio=self.business, saldo_actual=12,
        )
        self.client = APIClient()

    def auth(self, user):
        self.client.force_authenticate(user=user)

    def get(self, path, user=None):
        self.auth(user or self.owner)
        return self.client.get(path)

    def post(self, path, data, user=None):
        self.auth(user or self.owner)
        return self.client.post(path, data, format='json')


class VisitasPortalTests(OperacionesBaseTests):
    def test_dueno_ve_todas_y_supervisor_su_sucursal(self):
        owner = self.get(f'/api/v1/negocios/{self.business.pk}/visitas/')
        self.assertEqual(owner.status_code, 200)
        self.assertEqual(owner.data['count'], 2)
        supervisor = self.get(
            f'/api/v1/negocios/{self.business.pk}/visitas/', self.supervisor,
        )
        self.assertEqual(supervisor.data['count'], 1)
        self.assertEqual(
            supervisor.data['results'][0]['sucursal'], self.branch1.pk,
        )
        ajeno = self.get(
            f'/api/v1/negocios/{self.business.pk}/visitas/', self.other,
        )
        self.assertEqual(ajeno.status_code, 403)

    def test_filtros_y_paginacion(self):
        response = self.get(
            f'/api/v1/negocios/{self.business.pk}/visitas/?'
            f'sucursal={self.branch2.pk}&estado=validas&page_size=1',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['id'], self.visit2.pk)
        invalidas = self.get(
            f'/api/v1/negocios/{self.business.pk}/visitas/?estado=anuladas',
        )
        self.assertEqual(invalidas.data['count'], 0)

    def test_fechas_invalidas(self):
        response = self.get(
            f'/api/v1/negocios/{self.business.pk}/visitas/?desde=2026-13-01',
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['codigo'], 'fechas_invalidas')

    def test_supervisor_no_filtra_otra_sucursal(self):
        response = self.get(
            f'/api/v1/negocios/{self.business.pk}/visitas/?'
            f'sucursal={self.branch2.pk}',
            self.supervisor,
        )
        self.assertEqual(response.status_code, 403)


class CuponesCanjesPortalTests(OperacionesBaseTests):
    def test_cupones_solo_dueno(self):
        owner = self.get(f'/api/v1/negocios/{self.business.pk}/cupones/')
        self.assertEqual(owner.status_code, 200)
        self.assertEqual(owner.data['count'], 2)
        supervisor = self.get(
            f'/api/v1/negocios/{self.business.pk}/cupones/', self.supervisor,
        )
        self.assertEqual(supervisor.status_code, 403)
        filtrado = self.get(
            f'/api/v1/negocios/{self.business.pk}/cupones/?'
            f'estado=disponible&buscar={self.client_user.correo}',
        )
        self.assertEqual(filtrado.data['count'], 1)

    def test_canjes_por_sucursal(self):
        owner = self.get(f'/api/v1/negocios/{self.business.pk}/canjes/')
        self.assertEqual(owner.data['count'], 2)
        supervisor = self.get(
            f'/api/v1/negocios/{self.business.pk}/canjes/', self.supervisor,
        )
        self.assertEqual(supervisor.data['count'], 1)
        self.assertEqual(
            supervisor.data['results'][0]['usuario_correo'],
            self.client_user.correo,
        )
        filtrado = self.get(
            f'/api/v1/negocios/{self.business.pk}/canjes/?'
            f'sucursal={self.branch2.pk}',
        )
        self.assertEqual(filtrado.data['count'], 1)

    def test_clientes_agregados_y_protegidos(self):
        response = self.get(f'/api/v1/negocios/{self.business.pk}/clientes/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 2)
        fila = next(
            item for item in response.data['results']
            if item['id'] == self.client_user.pk
        )
        self.assertEqual(fila['visitas'], 1)
        self.assertEqual(fila['puntos'], 12)
        self.assertEqual(fila['cupones'], 1)
        supervisor = self.get(
            f'/api/v1/negocios/{self.business.pk}/clientes/', self.supervisor,
        )
        self.assertEqual(supervisor.status_code, 403)
        busqueda = self.get(
            f'/api/v1/negocios/{self.business.pk}/clientes/'
            f'?buscar={self.client_user2.correo}',
        )
        self.assertEqual(busqueda.data['count'], 1)


class TarjetasPortalTests(OperacionesBaseTests):
    def datos_tarjeta(self, nombre='Tarjeta Nueva', **extra):
        datos = {
            'nombre': nombre,
            'meta': 3,
            'es_repetible': False,
            'fecha_inicio': timezone.now().isoformat(),
            'recompensa': {
                'titulo': f'Premio {nombre}',
                'descripcion': 'Premio de prueba',
                'tipo': 'gratis',
                'terminos_condiciones': 'Válido.',
                'vigencia_dias': 30,
            },
        }
        datos.update(extra)
        return datos

    def test_crea_tarjeta_y_recompensa_meta(self):
        response = self.post(
            f'/api/v1/negocios/{self.business.pk}/tarjetas/',
            self.datos_tarjeta(),
        )
        self.assertEqual(response.status_code, 201)
        tarjeta = models.Dinamica.objects.get(pk=response.data['tarjeta']['id'])
        recompensa = models.Recompensa.objects.get(
            pk=response.data['recompensa']['id'],
        )
        self.assertEqual(tarjeta.tipo, 'sellos')
        self.assertEqual(tarjeta.meta, 3)
        self.assertEqual(recompensa.dinamica_id, tarjeta.pk)
        self.assertTrue(recompensa.es_meta)
        self.assertEqual(recompensa.negocio_id, self.business.pk)

    def test_limite_free_de_tarjetas(self):
        self.assertEqual(self.post(
            f'/api/v1/negocios/{self.business.pk}/tarjetas/',
            self.datos_tarjeta('Uno'),
        ).status_code, 201)
        self.assertEqual(self.post(
            f'/api/v1/negocios/{self.business.pk}/tarjetas/',
            self.datos_tarjeta('Dos'),
        ).status_code, 201)
        response = self.post(
            f'/api/v1/negocios/{self.business.pk}/tarjetas/',
            self.datos_tarjeta('Tres'),
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data['codigo'], 'limite_plan')
        self.assertEqual(models.Dinamica.objects.filter(
            negocio=self.business, tipo='sellos',
        ).count(), 2)

    def test_error_de_recompensa_revierte_la_tarjeta(self):
        datos = self.datos_tarjeta('Inválida')
        datos['recompensa']['tipo'] = 'descuento'
        response = self.post(
            f'/api/v1/negocios/{self.business.pk}/tarjetas/', datos,
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(models.Dinamica.objects.filter(
            negocio=self.business, nombre='Inválida',
        ).exists())

    def test_supervisor_no_crea_tarjetas(self):
        response = self.post(
            f'/api/v1/negocios/{self.business.pk}/tarjetas/',
            self.datos_tarjeta(),
            self.supervisor,
        )
        self.assertEqual(response.status_code, 403)

    def test_desactivar_tarjeta_conserva_ciclo(self):
        response = self.post(
            f'/api/v1/negocios/{self.business.pk}/tarjetas/',
            self.datos_tarjeta('Con ciclo'),
        )
        tarjeta = models.Dinamica.objects.get(pk=response.data['tarjeta']['id'])
        ciclo = models.CicloTarjeta.objects.create(
            usuario=self.client_user, dinamica=tarjeta,
            negocio=self.business, meta=tarjeta.meta,
            sellos_actuales=1, fecha_inicio=timezone.now(),
            estado='en_curso',
        )
        self.auth(self.owner)
        actualizada = self.client.patch(
            f'/api/v1/dinamica/actualizar/{tarjeta.pk}/',
            {'status': False}, format='json',
        )
        self.assertEqual(actualizada.status_code, 200)
        ciclo.refresh_from_db()
        self.assertEqual(ciclo.estado, 'en_curso')
        self.assertTrue(ciclo.sellos_actuales == 1)

    def test_desactivar_recompensa_conserva_cupon(self):
        cupon = crear_cupon(self.client_user, self.business, self.reward)
        self.auth(self.owner)
        response = self.client.patch(
            f'/api/v1/recompensa/actualizar/{self.reward.pk}/',
            {'status': False}, format='json',
        )
        self.assertEqual(response.status_code, 200)
        cupon.refresh_from_db()
        self.assertEqual(cupon.status, 'disponible')
