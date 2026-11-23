"""Pruebas de la política de cupos de alianzas por plan y contraparte."""

import threading
from datetime import timedelta
from unittest import skipUnless
from uuid import uuid4

from django.db import connection, connections
from django.test import TestCase, TransactionTestCase
from django.utils import timezone
from rest_framework.test import APIClient

from core import models
from core.services import planes
from core.services.lealtad import cupones, puntos
from core.tests.helpers import (
    asegurar_planes,
    asignar_plan,
    crear_cupon,
    crear_negocio,
    crear_usuario,
)


class PoliticaAlianzasBaseTests(TestCase):
    def setUp(self):
        asegurar_planes()
        self.owner_a = crear_usuario()
        self.owner_b = crear_usuario()
        self.owner_c = crear_usuario()
        self.owner_d = crear_usuario()
        self.owner_e = crear_usuario()
        self.consumer = crear_usuario()
        self.admin = crear_usuario(rol='admin_sistema')
        self.business_a = crear_negocio('Política A')
        self.business_b = crear_negocio('Política B')
        self.business_c = crear_negocio('Política C')
        self.business_d = crear_negocio('Política D')
        self.business_e = crear_negocio('Política E')
        for owner, business in (
            (self.owner_a, self.business_a),
            (self.owner_b, self.business_b),
            (self.owner_c, self.business_c),
            (self.owner_d, self.business_d),
            (self.owner_e, self.business_e),
        ):
            models.UsuarioNegocio.objects.create(
                usuario=owner,
                negocio=business,
                sucursal=None,
                rol_comercio='dueno',
            )
        asignar_plan(self.business_a)
        self.client = APIClient()

    def fechas(self):
        return timezone.now() - timedelta(days=1), timezone.now() + timedelta(days=60)

    def pendiente(self, origen, destino):
        inicio, fin = self.fechas()
        return models.Alianza.objects.create(
            negocio1=origen,
            negocio2=destino,
            condicion_participacion='Propuesta de prueba.',
            status='pendiente',
            fecha_inicio=inicio,
            fecha_fin=fin,
        )

    def activa(self, origen, destino):
        inicio, fin = self.fechas()
        return models.Alianza.objects.create(
            negocio1=origen,
            negocio2=destino,
            condicion_participacion='Alianza vigente.',
            status='activa',
            fecha_inicio=inicio,
            fecha_fin=fin,
        )

    def aceptar(self, alianza_id, usuario, negocio):
        self.client.force_authenticate(usuario)
        return self.client.post(
            f'/api/v1/alianzas/{alianza_id}/aceptar/?negocio={negocio.pk}',
            {},
            format='json',
        )

    def finalizar(self, alianza_id, usuario, negocio):
        self.client.force_authenticate(usuario)
        return self.client.post(
            f'/api/v1/alianzas/{alianza_id}/finalizar/?negocio={negocio.pk}',
            {},
            format='json',
        )

    def proponer(self, usuario, origen, destino):
        inicio, fin = self.fechas()
        self.client.force_authenticate(usuario)
        return self.client.post('/api/v1/alianzas/solicitudes/', {
            'negocio': origen.pk,
            'negocio_destino': destino.pk,
            'condicion_participacion': 'Propuesta de prueba.',
            'fecha_inicio': inicio.isoformat(),
            'fecha_fin': fin.isoformat(),
        }, format='json')


class FreeAlianzasTests(PoliticaAlianzasBaseTests):
    def test_crud_generico_de_alianzas_es_solo_lectura(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post('/api/v1/alianza/crear/', {}, format='json')
        self.assertEqual(response.status_code, 405)

    def test_free_no_puede_proponer_pero_si_aceptar_y_finalizar(self):
        respuesta = self.proponer(self.owner_b, self.business_b, self.business_a)
        self.assertEqual(respuesta.status_code, 403)
        self.assertEqual(respuesta.data['codigo'], 'limite_plan')

        alianza = self.pendiente(self.business_a, self.business_b)
        aceptada = self.aceptar(alianza.pk, self.owner_b, self.business_b)
        self.assertEqual(aceptada.status_code, 200)
        self.assertEqual(aceptada.data['status'], 'activa')
        finalizada = self.finalizar(alianza.pk, self.owner_b, self.business_b)
        self.assertEqual(finalizada.status_code, 200)
        self.assertEqual(finalizada.data['status'], 'finalizada')

    def test_free_solo_puede_tener_una_alianza_activa(self):
        asignar_plan(self.business_c)
        primera = self.pendiente(self.business_a, self.business_b)
        segunda = self.pendiente(self.business_c, self.business_b)

        self.assertEqual(
            self.aceptar(primera.pk, self.owner_b, self.business_b).status_code,
            200,
        )
        rechazada = self.aceptar(segunda.pk, self.owner_b, self.business_b)
        self.assertEqual(rechazada.status_code, 403)
        self.assertEqual(rechazada.data['codigo'], 'limite_plan')
        self.assertEqual(
            models.Alianza.objects.filter(
                status='activa', negocio2=self.business_b,
            ).count(),
            1,
        )

    def test_membresia_inactiva_no_puede_aceptar(self):
        pendiente = self.pendiente(self.business_a, self.business_b)
        membresia = models.UsuarioNegocio.objects.get(
            usuario=self.owner_b, negocio=self.business_b,
        )
        membresia.status = False
        membresia.save(update_fields=['status'])
        respuesta = self.aceptar(pendiente.pk, self.owner_b, self.business_b)
        self.assertEqual(respuesta.status_code, 403)
        self.assertEqual(respuesta.data['codigo'], 'sin_permiso_alianza')

    def test_transiciones_invalidas(self):
        primera = self.pendiente(self.business_a, self.business_b)
        self.assertEqual(
            self.aceptar(primera.pk, self.owner_b, self.business_b).status_code,
            200,
        )
        repetida = self.aceptar(primera.pk, self.owner_b, self.business_b)
        self.assertEqual(repetida.status_code, 409)
        self.assertEqual(repetida.data['codigo'], 'alianza_ya_respondida')

        pendiente = self.pendiente(self.business_c, self.business_b)
        finalizada = self.finalizar(pendiente.pk, self.owner_b, self.business_b)
        self.assertEqual(finalizada.status_code, 409)
        self.assertEqual(finalizada.data['codigo'], 'alianza_no_activa')

    def test_pendiente_no_consume_y_finalizada_libera_cupo(self):
        pendiente = self.pendiente(self.business_a, self.business_b)
        self.assertEqual(
            planes.resumen_plan(self.business_a)['limites']['alianzas_activas']['uso'],
            0,
        )
        self.assertEqual(
            self.aceptar(pendiente.pk, self.owner_b, self.business_b).status_code,
            200,
        )
        self.assertEqual(
            planes.resumen_plan(self.business_a)['limites']['alianzas_activas']['uso'],
            1,
        )
        self.assertEqual(
            self.finalizar(pendiente.pk, self.owner_b, self.business_b).status_code,
            200,
        )
        self.assertEqual(
            planes.resumen_plan(self.business_a)['limites']['alianzas_activas']['uso'],
            0,
        )

    def test_free_puede_administrar_beneficios_de_alianza_activa(self):
        alianza = self.activa(self.business_a, self.business_b)
        self.client.force_authenticate(self.owner_b)
        response = self.client.post(
            f'/api/v1/alianzas/{alianza.pk}/recompensas/',
            {
                'negocio': self.business_b.pk,
                'titulo': 'Beneficio Free',
                'descripcion': 'Disponible para clientes de la alianza.',
                'tipo': 'gratis',
                'costo_desbloqueo': 0,
                'terminos_condiciones': 'Vigente con la alianza.',
                'vigencia_dias': 10,
                'status': True,
            },
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['negocio'], self.business_b.pk)
        self.assertTrue(models.Recompensa.objects.filter(
            alianza=alianza, negocio=self.business_b,
        ).exists())

        self.client.force_authenticate(self.owner_b)
        actualizada = self.client.patch(
            f'/api/v1/recompensa/actualizar/{response.data["id"]}/',
            {'status': False},
            format='json',
        )
        self.assertEqual(actualizada.status_code, 200)
        self.assertFalse(actualizada.data['status'])

        self.client.force_authenticate(self.owner_a)
        ajena = self.client.patch(
            f'/api/v1/recompensa/actualizar/{response.data["id"]}/',
            {'status': True},
            format='json',
        )
        self.assertEqual(ajena.status_code, 403)


class PremiumAlianzasTests(PoliticaAlianzasBaseTests):
    def test_premium_solo_una_alianza_activa_con_free(self):
        primera = self.pendiente(self.business_b, self.business_a)
        segunda = self.pendiente(self.business_c, self.business_a)

        self.assertEqual(
            self.aceptar(primera.pk, self.owner_a, self.business_a).status_code,
            200,
        )
        rechazada = self.aceptar(segunda.pk, self.owner_a, self.business_a)
        self.assertEqual(rechazada.status_code, 403)
        self.assertIn('con negocios Free', rechazada.data['detalle'])
        self.assertEqual(
            models.Alianza.objects.filter(
                status='activa', negocio2=self.business_a,
            ).count(),
            1,
        )

    def test_premium_limita_tres_alianzas_con_premium(self):
        for business in (
            self.business_b, self.business_c, self.business_d, self.business_e,
        ):
            asignar_plan(business)
        propuestas = [
            self.pendiente(business, self.business_a)
            for business in (
                self.business_b, self.business_c, self.business_d, self.business_e,
            )
        ]
        for propuesta in propuestas[:3]:
            self.assertEqual(
                self.aceptar(propuesta.pk, self.owner_a, self.business_a).status_code,
                200,
            )
        rechazada = self.aceptar(
            propuestas[3].pk, self.owner_a, self.business_a,
        )
        self.assertEqual(rechazada.status_code, 403)
        self.assertIn('con negocios Premium', rechazada.data['detalle'])
        self.assertEqual(
            models.Alianza.objects.filter(
                status='activa', negocio2=self.business_a,
            ).count(),
            3,
        )

    def test_premium_puede_combinar_una_free_y_tres_premium(self):
        for business in (
            self.business_c, self.business_d, self.business_e,
        ):
            asignar_plan(business)
        propuestas = [
            self.pendiente(self.business_b, self.business_a),
            self.pendiente(self.business_c, self.business_a),
            self.pendiente(self.business_d, self.business_a),
            self.pendiente(self.business_e, self.business_a),
        ]
        for propuesta in propuestas:
            self.assertEqual(
                self.aceptar(propuesta.pk, self.owner_a, self.business_a).status_code,
                200,
            )
        self.assertEqual(
            models.Alianza.objects.filter(
                status='activa', negocio2=self.business_a,
            ).count(),
            4,
        )


class DowngradeAlianzasTests(PoliticaAlianzasBaseTests):
    def test_downgrade_conserva_alianzas_y_bloquea_excesos(self):
        asignar_plan(self.business_c)
        activa_free = self.activa(self.business_a, self.business_b)
        activa_premium = self.activa(self.business_a, self.business_c)
        pendiente = self.pendiente(self.business_d, self.business_a)

        asignar_plan(self.business_a, 'free')
        activa_free.refresh_from_db()
        activa_premium.refresh_from_db()
        self.assertEqual(activa_free.status, 'activa')
        self.assertEqual(activa_premium.status, 'activa')

        resumen = planes.resumen_plan(self.business_a)
        self.assertEqual(resumen['plan']['codigo'], 'free')
        self.assertEqual(resumen['limites']['alianzas_activas']['uso'], 2)
        self.assertTrue(resumen['limites']['alianzas_activas']['excedido'])
        self.assertIn('alianzas_activas', resumen['excedentes'])

        propuesta = self.proponer(self.owner_a, self.business_a, self.business_b)
        self.assertEqual(propuesta.status_code, 403)
        self.assertEqual(propuesta.data['codigo'], 'limite_plan')

        rechazo = self.aceptar(pendiente.pk, self.owner_a, self.business_a)
        self.assertEqual(rechazo.status_code, 403)
        self.assertEqual(rechazo.data['codigo'], 'limite_plan')

    def test_downgrade_de_contrapartes_recalcula_el_limite_del_premium(self):
        asignar_plan(self.business_b)
        asignar_plan(self.business_c)
        activa_b = self.activa(self.business_a, self.business_b)
        activa_c = self.activa(self.business_a, self.business_c)

        asignar_plan(self.business_b, 'free')
        asignar_plan(self.business_c, 'free')
        activa_b.refresh_from_db()
        activa_c.refresh_from_db()
        self.assertEqual(activa_b.status, 'activa')
        self.assertEqual(activa_c.status, 'activa')

        resumen = planes.resumen_plan(self.business_a)
        self.assertEqual(resumen['limites']['alianzas_con_free']['uso'], 2)
        self.assertTrue(resumen['limites']['alianzas_con_free']['excedido'])
        self.assertIn('alianzas_con_free', resumen['excedentes'])

        pendiente = self.pendiente(self.business_d, self.business_a)
        respuesta = self.aceptar(pendiente.pk, self.owner_a, self.business_a)
        self.assertEqual(respuesta.status_code, 403)
        self.assertEqual(respuesta.data['codigo'], 'limite_plan')

    def test_cupon_emitido_sigue_canjeable_tras_finalizar_alianza(self):
        alianza = self.activa(self.business_a, self.business_b)
        recompensa = models.Recompensa.objects.create(
            titulo='Café de alianza',
            descripcion='Beneficio de prueba.',
            tipo='gratis',
            costo_desbloqueo=0,
            terminos_condiciones='Vigente.',
            status=True,
            negocio=self.business_a,
            alianza=alianza,
            vigencia_dias=30,
        )
        cupon = crear_cupon(self.consumer, self.business_a, recompensa)
        respuesta = self.finalizar(alianza.pk, self.owner_b, self.business_b)
        self.assertEqual(respuesta.status_code, 200)

        canje, cupon_actualizado = cupones.canjear_cupon(
            usuario=self.consumer, cupon_uuid=cupon.uuid,
        )
        self.assertEqual(cupon_actualizado.status, 'canjeado')
        self.assertIsNotNone(canje.pk)

    def test_recompensa_compartida_consume_solo_el_saldo_ofertante(self):
        alianza = self.activa(self.business_a, self.business_b)
        recompensa = models.Recompensa.objects.create(
            titulo='Café compartido',
            descripcion='Beneficio de alianza.',
            tipo='gratis',
            costo_desbloqueo=10,
            terminos_condiciones='Vigente con la alianza.',
            status=True,
            negocio=self.business_a,
            alianza=alianza,
            vigencia_dias=10,
            cantidad_disponible=1,
        )
        puntos.otorgar_puntos(
            usuario=self.consumer, negocio=self.business_a, cantidad=100,
            origen='ajuste', referencia='saldo-a',
        )
        puntos.otorgar_puntos(
            usuario=self.consumer, negocio=self.business_b, cantidad=50,
            origen='ajuste', referencia='saldo-b',
        )
        clave = uuid4()
        self.client.force_authenticate(self.consumer)
        response = self.client.post('/api/v1/cupones/adquirir/', {
            'recompensa': recompensa.pk,
            'clave_idempotencia': str(clave),
        }, format='json')
        self.assertEqual(response.status_code, 201)
        cupon_uuid = response.data['cupon']['uuid']
        self.assertEqual(response.data['cupon']['negocio'], self.business_a.pk)
        self.assertEqual(
            models.SaldoPuntos.objects.get(
                usuario=self.consumer, negocio=self.business_a,
            ).saldo_actual,
            90,
        )
        self.assertEqual(
            models.SaldoPuntos.objects.get(
                usuario=self.consumer, negocio=self.business_b,
            ).saldo_actual,
            50,
        )
        recompensa.refresh_from_db()
        self.assertEqual(recompensa.cantidad_disponible, 0)

        repetida = self.client.post('/api/v1/cupones/adquirir/', {
            'recompensa': recompensa.pk,
            'clave_idempotencia': str(clave),
        }, format='json')
        self.assertEqual(repetida.status_code, 200)
        self.assertEqual(repetida.data['cupon']['uuid'], cupon_uuid)
        self.assertEqual(
            models.SaldoPuntos.objects.get(
                usuario=self.consumer, negocio=self.business_a,
            ).saldo_actual,
            90,
        )
        self.assertEqual(
            models.CuponUsuario.objects.filter(
                usuario=self.consumer,
            ).count(),
            1,
        )

        finalizada = self.finalizar(alianza.pk, self.owner_b, self.business_b)
        self.assertEqual(finalizada.status_code, 200)
        canje, cupon_actualizado = cupones.canjear_cupon(
            usuario=self.consumer, cupon_uuid=cupon_uuid,
        )
        self.assertEqual(cupon_actualizado.status, 'canjeado')
        self.assertIsNotNone(canje.pk)

    def test_beneficio_sigue_visible_tras_downgrade(self):
        alianza = self.activa(self.business_a, self.business_b)
        recompensa = models.Recompensa.objects.create(
            titulo='Beneficio tras downgrade',
            descripcion='Beneficio de alianza.',
            tipo='gratis',
            costo_desbloqueo=0,
            terminos_condiciones='Vigente.',
            status=True,
            negocio=self.business_a,
            alianza=alianza,
            vigencia_dias=10,
        )
        asignar_plan(self.business_a, 'free')
        self.client.force_authenticate(self.consumer)
        catalogo = self.client.get(
            f'/api/v1/negocios/{self.business_a.pk}/catalogo/',
        )
        self.assertEqual(catalogo.status_code, 200)
        self.assertIn(
            recompensa.pk,
            [item['id'] for item in catalogo.data['recompensas']],
        )


def ejecutar_en_hilos(func, cantidad=2):
    barrera = threading.Barrier(cantidad)
    resultados = []
    errores = []

    def worker(indice):
        connections.close_all()
        try:
            barrera.wait(timeout=15)
            resultados.append(func(indice))
        except Exception as exc:  # noqa: BLE001 - se reporta en la aserción
            errores.append(exc)
        finally:
            connections.close_all()

    hilos = [threading.Thread(target=worker, args=(i,)) for i in range(cantidad)]
    for hilo in hilos:
        hilo.start()
    for hilo in hilos:
        hilo.join(timeout=30)
    return resultados, errores


@skipUnless(connection.vendor == 'postgresql', 'Requiere PostgreSQL.')
class ConcurrenciaAlianzasTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        asegurar_planes()
        self.owner_a = crear_usuario()
        self.owner_b = crear_usuario()
        self.owner_c = crear_usuario()
        self.business_a = crear_negocio('Concurrencia A')
        self.business_b = crear_negocio('Concurrencia B')
        self.business_c = crear_negocio('Concurrencia C')
        for owner, business in (
            (self.owner_a, self.business_a),
            (self.owner_b, self.business_b),
            (self.owner_c, self.business_c),
        ):
            models.UsuarioNegocio.objects.create(
                usuario=owner,
                negocio=business,
                sucursal=None,
                rol_comercio='dueno',
            )
        asignar_plan(self.business_a)
        self.pendientes = [self.crear_pendiente(b, self.business_a)
                           for b in (self.business_b, self.business_c)]

    def crear_pendiente(self, origen, destino):
        ahora = timezone.now()
        return models.Alianza.objects.create(
            negocio1=origen,
            negocio2=destino,
            condicion_participacion='Concurrencia.',
            status='pendiente',
            fecha_inicio=ahora,
            fecha_fin=ahora + timedelta(days=60),
        )

    def test_aceptacion_y_downgrade_concurrentes_no_dejan_estado_invalido(self):
        from core.services import alianzas as servicio

        # Deja una alianza activa con un negocio Free y otra pendiente.
        servicio.responder_solicitud(
            usuario=self.owner_a,
            alianza_id=self.pendientes[0].pk,
            aceptar=True,
        )

        def operacion(indice):
            if indice == 0:
                return servicio.responder_solicitud(
                    usuario=self.owner_a,
                    alianza_id=self.pendientes[1].pk,
                    aceptar=True,
                )
            return asignar_plan(self.business_a, 'free')

        resultados, errores = ejecutar_en_hilos(operacion)
        self.assertLessEqual(len(errores), 1)
        if errores:
            self.assertIsInstance(errores[0], planes.LimitePlan)
        self.assertGreaterEqual(len(resultados), 1)

        activas = models.Alianza.objects.filter(
            status='activa', negocio2=self.business_a,
        ).count()
        resumen = planes.resumen_plan(self.business_a)
        self.assertEqual(resumen['limites']['alianzas_activas']['uso'], activas)
        self.assertIn(activas, (1, 2))
        self.assertEqual(
            resumen['limites']['alianzas_activas']['excedido'],
            activas > 1,
        )

    def test_dos_aceptaciones_simultaneas_no_exceden_el_cupo_free(self):
        def aceptar(indice):
            from core.services import alianzas as servicio

            return servicio.responder_solicitud(
                usuario=self.owner_a,
                alianza_id=self.pendientes[indice].pk,
                aceptar=True,
            )

        resultados, errores = ejecutar_en_hilos(aceptar)
        self.assertEqual(len(resultados), 1)
        self.assertEqual(len(errores), 1)
        self.assertEqual(
            models.Alianza.objects.filter(
                status='activa', negocio2=self.business_a,
            ).count(),
            1,
        )
