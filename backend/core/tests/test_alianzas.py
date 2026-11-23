"""Pruebas del flujo de alianzas entre negocios y sus beneficios."""

from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from core import models
from core.tests.helpers import (
    asegurar_planes,
    asignar_plan,
    crear_negocio,
    crear_usuario,
)


class AlianzasBaseTests(TestCase):
    def setUp(self):
        asegurar_planes()
        self.owner_a = crear_usuario()
        self.owner_b = crear_usuario()
        self.owner_c = crear_usuario()
        self.supervisor_a = crear_usuario()
        self.consumer = crear_usuario()
        self.admin = crear_usuario(rol='admin_sistema')
        self.business_a = crear_negocio('Alianza A')
        self.business_b = crear_negocio('Alianza B')
        self.business_c = crear_negocio('Alianza C')
        models.UsuarioNegocio.objects.create(
            usuario=self.owner_a,
            negocio=self.business_a,
            sucursal=None,
            rol_comercio='dueno',
        )
        models.UsuarioNegocio.objects.create(
            usuario=self.owner_b,
            negocio=self.business_b,
            sucursal=None,
            rol_comercio='dueno',
        )
        models.UsuarioNegocio.objects.create(
            usuario=self.owner_c,
            negocio=self.business_c,
            sucursal=None,
            rol_comercio='dueno',
        )
        branch = models.Sucursal.objects.create(
            nombre='Sucursal A',
            direccion='Centro',
            ciudad='Tijuana',
            negocio=self.business_a,
        )
        models.UsuarioNegocio.objects.create(
            usuario=self.supervisor_a,
            negocio=self.business_a,
            sucursal=branch,
            rol_comercio='supervisor',
        )
        self.client = APIClient()

    def auth(self, user):
        self.client.force_authenticate(user=user)

    def fechas(self, dias=1, duracion=60):
        inicio = timezone.now() + timedelta(days=dias)
        return inicio, inicio + timedelta(days=duracion)

    def proponer(self, user=None, origen=None, destino=None, **extra):
        inicio, fin = self.fechas()
        datos = {
            'negocio': (origen or self.business_a).pk,
            'negocio_destino': (destino or self.business_b).pk,
            'condicion_participacion': 'Beneficio cruzado para clientes de ambos negocios.',
            'fecha_inicio': inicio.isoformat(),
            'fecha_fin': fin.isoformat(),
        }
        datos.update(extra)
        self.auth(user or self.owner_a)
        return self.client.post('/api/v1/alianzas/solicitudes/', datos, format='json')

    def aceptar(self, alianza_id, user=None, negocio=None):
        self.auth(user or self.owner_b)
        path = f'/api/v1/alianzas/{alianza_id}/aceptar/'
        if negocio:
            path += f'?negocio={negocio.pk}'
        return self.client.post(path, {}, format='json')

    def rechazar(self, alianza_id, user=None):
        self.auth(user or self.owner_b)
        return self.client.post(
            f'/api/v1/alianzas/{alianza_id}/rechazar/', {}, format='json',
        )

    def crear_activa(self):
        inicio, fin = self.fechas(dias=-1)
        response = self.proponer(
            fecha_inicio=inicio.isoformat(), fecha_fin=fin.isoformat(),
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(self.aceptar(response.data['id']).status_code, 200)
        return response.data['id']


class SolicitudAlianzaTests(AlianzasBaseTests):
    def test_dueno_propone_y_receptor_acepta(self):
        asignar_plan(self.business_a)
        asignar_plan(self.business_b)
        response = self.proponer()
        self.assertEqual(response.status_code, 201)
        alianza = models.Alianza.objects.get(pk=response.data['id'])
        self.assertEqual(alianza.status, 'pendiente')
        self.assertEqual(alianza.negocio1, self.business_a)
        self.assertEqual(alianza.negocio2, self.business_b)
        self.assertEqual(alianza.creado_por, self.owner_a)
        self.assertEqual(alianza.eventos.count(), 1)

        self.auth(self.owner_a)
        enviadas = self.client.get(
            f'/api/v1/alianzas/?negocio={self.business_a.pk}&vista=enviadas',
        )
        self.assertEqual(enviadas.status_code, 200)
        self.assertEqual(enviadas.data[0]['direccion'], 'enviada')
        self.assertEqual(enviadas.data[0]['negocio2']['nombre'], self.business_b.nombre)

        self.auth(self.owner_b)
        recibidas = self.client.get(
            f'/api/v1/alianzas/?negocio={self.business_b.pk}&vista=recibidas',
        )
        self.assertEqual(recibidas.status_code, 200)
        self.assertEqual(recibidas.data[0]['direccion'], 'recibida')
        self.assertEqual(recibidas.data[0]['numero_beneficios'], 0)

        respuesta = self.aceptar(alianza.pk, negocio=self.business_b)
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['status'], 'activa')
        self.assertEqual(respuesta.data['respondido_por_correo'], self.owner_b.correo)
        alianza.refresh_from_db()
        self.assertEqual(alianza.status, 'activa')
        self.assertEqual(alianza.respondido_por, self.owner_b)
        self.assertEqual(alianza.eventos.count(), 2)

    def test_solo_dueno_puede_proponer(self):
        asignar_plan(self.business_a)
        response = self.proponer(user=self.supervisor_a)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data['codigo'], 'sin_permiso_alianza')

        response = self.proponer(user=self.owner_c)
        self.assertEqual(response.status_code, 403)

        response = self.proponer(user=self.admin)
        self.assertEqual(response.status_code, 403)

    def test_solo_receptor_puede_responder(self):
        asignar_plan(self.business_a)
        asignar_plan(self.business_b)
        response = self.proponer()
        alianza_id = response.data['id']

        for usuario in (self.owner_a, self.owner_c, self.supervisor_a):
            respuesta = self.aceptar(alianza_id, user=usuario)
            self.assertEqual(respuesta.status_code, 403)
            self.assertEqual(respuesta.data['codigo'], 'sin_permiso_alianza')

        self.assertEqual(self.aceptar(alianza_id, user=self.owner_b).status_code, 200)

    def test_no_duplica_y_permite_reintentar_tras_rechazo(self):
        asignar_plan(self.business_a)
        asignar_plan(self.business_b)
        response = self.proponer()
        self.assertEqual(response.status_code, 201)
        duplicada = self.proponer()
        self.assertEqual(duplicada.status_code, 409)
        self.assertEqual(duplicada.data['codigo'], 'alianza_duplicada')

        rechazo = self.rechazar(response.data['id'])
        self.assertEqual(rechazo.status_code, 200)
        self.assertEqual(rechazo.data['status'], 'rechazada')
        reintento = self.proponer()
        self.assertEqual(reintento.status_code, 201)

    def test_free_puede_aceptar_solicitud_de_premium(self):
        asignar_plan(self.business_a)
        response = self.proponer()
        self.assertEqual(response.status_code, 201)
        pendiente = self.aceptar(response.data['id'])
        self.assertEqual(pendiente.status_code, 200)
        self.assertEqual(pendiente.data['status'], 'activa')
        self.assertEqual(
            models.Alianza.objects.get(pk=response.data['id']).status,
            'activa',
        )

    def test_negocio_free_no_puede_proponer(self):
        response = self.proponer()
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data['codigo'], 'limite_plan')

    def test_condicion_y_fechas_invalidas(self):
        asignar_plan(self.business_a)
        response = self.proponer(condicion_participacion='   ')
        self.assertEqual(response.status_code, 400)

        response = self.proponer(
            fecha_fin=(timezone.now() - timedelta(days=1)).isoformat(),
        )
        self.assertEqual(response.status_code, 400)

    def test_listado_solo_muestra_negocios_propios(self):
        asignar_plan(self.business_a)
        asignar_plan(self.business_b)
        self.proponer()
        self.auth(self.owner_c)
        response = self.client.get('/api/v1/alianzas/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [])
        response = self.client.get(
            f'/api/v1/alianzas/?negocio={self.business_b.pk}',
        )
        self.assertEqual(response.status_code, 403)

    def test_vigente_solo_cuando_la_ventana_esta_abierta(self):
        asignar_plan(self.business_a)
        asignar_plan(self.business_b)
        inicio, fin = self.fechas(dias=-1)
        response = self.proponer(
            fecha_inicio=inicio.isoformat(), fecha_fin=fin.isoformat(),
        )
        self.aceptar(response.data['id'])
        self.auth(self.owner_a)
        detalle = self.client.get(
            f'/api/v1/alianzas/{response.data["id"]}/?negocio={self.business_a.pk}',
        )
        self.assertEqual(detalle.status_code, 200)
        self.assertTrue(detalle.data['vigente'])

    def test_admin_puede_consultar_pero_no_responder(self):
        asignar_plan(self.business_a)
        asignar_plan(self.business_b)
        response = self.proponer()
        self.auth(self.admin)
        detalle = self.client.get(f'/api/v1/alianzas/{response.data["id"]}/')
        self.assertEqual(detalle.status_code, 200)
        respuesta = self.client.post(
            f'/api/v1/alianzas/{response.data["id"]}/aceptar/', {}, format='json',
        )
        self.assertEqual(respuesta.status_code, 403)

    def test_detalle_ajeno_responde_403(self):
        asignar_plan(self.business_a)
        asignar_plan(self.business_b)
        response = self.proponer()
        self.auth(self.owner_c)
        detalle = self.client.get(f'/api/v1/alianzas/{response.data["id"]}/')
        self.assertEqual(detalle.status_code, 403)


class DescubrimientoAlianzasTests(AlianzasBaseTests):
    def setUp(self):
        super().setUp()
        asignar_plan(self.business_a)

    def test_directorio_excluye_negocio_propio_y_datos_privados(self):
        self.auth(self.owner_a)
        response = self.client.get(
            f'/api/v1/alianzas/descubrir/?negocio={self.business_a.pk}',
        )
        self.assertEqual(response.status_code, 200)
        ids = {item['id'] for item in response.data}
        self.assertNotIn(self.business_a.pk, ids)
        self.assertIn(self.business_b.pk, ids)
        self.assertIn(self.business_c.pk, ids)
        for item in response.data:
            self.assertNotIn('correo', item)
            self.assertNotIn('telefono', item)

    def test_busqueda_y_categoria(self):
        self.auth(self.owner_a)
        response = self.client.get(
            f'/api/v1/alianzas/descubrir/?negocio={self.business_a.pk}'
            f'&q={self.business_b.nombre}',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual([item['id'] for item in response.data], [self.business_b.pk])

        response = self.client.get(
            f'/api/v1/alianzas/descubrir/?negocio={self.business_a.pk}'
            f'&categoria={self.business_c.categoria_id}',
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn(self.business_c.pk, {item['id'] for item in response.data})

    def test_solicitud_pendiente_oculta_negocio(self):
        self.proponer()
        self.auth(self.owner_a)
        response = self.client.get(
            f'/api/v1/alianzas/descubrir/?negocio={self.business_a.pk}',
        )
        ids = {item['id'] for item in response.data}
        self.assertNotIn(self.business_b.pk, ids)

    def test_alianza_vencida_no_bloquea_una_nueva_propuesta(self):
        ahora = timezone.now()
        models.Alianza.objects.create(
            negocio1=self.business_a,
            negocio2=self.business_b,
            condicion_participacion='Alianza anterior.',
            status='activa',
            fecha_inicio=ahora - timedelta(days=60),
            fecha_fin=ahora - timedelta(days=1),
        )
        self.auth(self.owner_a)
        response = self.client.get(
            f'/api/v1/alianzas/descubrir/?negocio={self.business_a.pk}',
        )
        self.assertIn(self.business_b.pk, {item['id'] for item in response.data})
        nueva = self.proponer()
        self.assertEqual(nueva.status_code, 201)

    def test_supervisor_no_puede_descubrir(self):
        self.auth(self.supervisor_a)
        response = self.client.get(
            f'/api/v1/alianzas/descubrir/?negocio={self.business_a.pk}',
        )
        self.assertEqual(response.status_code, 403)


class BeneficiosAlianzaTests(AlianzasBaseTests):
    def setUp(self):
        super().setUp()
        asignar_plan(self.business_a)
        asignar_plan(self.business_b)
        self.alianza_id = self.crear_activa()

    def datos_beneficio(self, negocio=None, **extra):
        datos = {
            'negocio': (negocio or self.business_a).pk,
            'titulo': 'Café de alianza',
            'descripcion': 'Beneficio exclusivo para clientes de la alianza.',
            'tipo': 'gratis',
            'costo_desbloqueo': 0,
            'terminos_condiciones': 'Válido durante la vigencia de la alianza.',
            'vigencia_dias': 20,
            'status': True,
        }
        datos.update(extra)
        return datos

    def test_dueno_crea_beneficio_y_aparece_en_catalogo(self):
        self.auth(self.owner_a)
        response = self.client.post(
            f'/api/v1/alianzas/{self.alianza_id}/recompensas/',
            self.datos_beneficio(),
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        recompensa = models.Recompensa.objects.get(pk=response.data['id'])
        self.assertEqual(recompensa.alianza_id, self.alianza_id)
        self.assertEqual(recompensa.negocio_id, self.business_a.pk)

        self.auth(self.consumer)
        catalogo = self.client.get(
            f'/api/v1/negocios/{self.business_a.pk}/catalogo/',
        )
        self.assertEqual(catalogo.status_code, 200)
        self.assertIn(
            'Café de alianza',
            [item['titulo'] for item in catalogo.data['recompensas']],
        )

    def test_beneficio_solo_para_negocios_participantes(self):
        self.auth(self.owner_c)
        response = self.client.post(
            f'/api/v1/alianzas/{self.alianza_id}/recompensas/',
            self.datos_beneficio(negocio=self.business_c),
            format='json',
        )
        self.assertEqual(response.status_code, 403)

    def test_beneficio_de_otro_negocio_participante_requiere_su_dueno(self):
        self.auth(self.owner_a)
        response = self.client.post(
            f'/api/v1/alianzas/{self.alianza_id}/recompensas/',
            self.datos_beneficio(negocio=self.business_b),
            format='json',
        )
        self.assertEqual(response.status_code, 403)

    def test_finalizar_oculta_beneficio_del_catalogo(self):
        self.auth(self.owner_a)
        self.client.post(
            f'/api/v1/alianzas/{self.alianza_id}/recompensas/',
            self.datos_beneficio(),
            format='json',
        )
        self.auth(self.owner_b)
        response = self.client.post(
            f'/api/v1/alianzas/{self.alianza_id}/finalizar/', {}, format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'finalizada')
        self.auth(self.consumer)
        catalogo = self.client.get(
            f'/api/v1/negocios/{self.business_a.pk}/catalogo/',
        )
        self.assertNotIn(
            'Café de alianza',
            [item['titulo'] for item in catalogo.data['recompensas']],
        )
