"""Pruebas de planes, capacidades, límites y conservación al cambiar de plan."""

from datetime import timedelta
import threading

from django.db import IntegrityError, close_old_connections, connection, transaction
from django.db.utils import OperationalError
from django.test import TestCase, TransactionTestCase
from django.utils import timezone
from rest_framework.test import APIClient

from core import models
from core.services import planes
from core.tests.helpers import (
    asegurar_planes,
    asignar_plan,
    crear_cupon,
    crear_negocio,
    crear_recompensa,
    crear_sucursal,
    crear_tarjeta,
    crear_usuario,
)


class PlanBaseTests(TestCase):
    def setUp(self):
        asegurar_planes()
        self.owner = crear_usuario()
        self.other = crear_usuario()
        self.consumer = crear_usuario()
        self.admin = crear_usuario(rol='admin_sistema')
        self.business = crear_negocio()
        models.UsuarioNegocio.objects.create(
            usuario=self.owner, negocio=self.business,
            sucursal=None, rol_comercio='dueno',
        )
        self.client = APIClient()

    def auth(self, user):
        self.client.force_authenticate(user=user)

    def post(self, path, data, user=None):
        self.auth(user or self.owner)
        return self.client.post(path, data, format='json')

    def get(self, path, user=None):
        self.auth(user or self.owner)
        return self.client.get(path)


class CatalogoYContextoTests(PlanBaseTests):
    def test_catalogo_incluye_free_y_premium(self):
        response = self.get('/api/v1/planes/', self.consumer)
        self.assertEqual(response.status_code, 200)
        planes_data = {plan['codigo']: plan for plan in response.data}
        self.assertEqual(set(planes_data), {'free', 'premium'})
        self.assertEqual(planes_data['free']['limites']['sucursales'], 1)
        self.assertEqual(planes_data['premium']['limites']['sucursales'], 5)
        self.assertEqual(planes_data['free']['limites']['alianzas_activas'], 1)
        self.assertEqual(planes_data['premium']['limites']['alianzas_activas'], 4)
        self.assertEqual(planes_data['premium']['limites']['alianzas_con_free'], 1)
        self.assertEqual(planes_data['premium']['limites']['alianzas_con_premium'], 3)
        self.assertFalse(planes_data['free']['caracteristicas']['metricas_avanzadas'])
        self.assertTrue(planes_data['premium']['caracteristicas']['metricas_avanzadas'])
        self.assertTrue(planes_data['free']['caracteristicas']['alianzas'])
        self.assertFalse(planes_data['free']['caracteristicas']['alianzas_proponer'])
        self.assertTrue(planes_data['premium']['caracteristicas']['alianzas_proponer'])
        self.assertIn('alianzas', planes_data['premium']['caracteristicas_implementadas'])
        self.assertIn('alianzas_proponer', planes_data['premium']['caracteristicas_implementadas'])
        self.assertEqual(len(planes_data['premium']['precios']), 2)

    def test_plan_del_negocio_solo_para_miembros(self):
        self.assertEqual(
            self.get(f'/api/v1/negocios/{self.business.pk}/plan/').status_code, 200,
        )
        self.assertEqual(
            self.get(
                f'/api/v1/negocios/{self.business.pk}/plan/', self.other,
            ).status_code,
            403,
        )
        self.assertEqual(
            self.get(
                f'/api/v1/negocios/{self.business.pk}/plan/', self.consumer,
            ).status_code,
            403,
        )
        self.assertEqual(
            self.get(
                f'/api/v1/negocios/{self.business.pk}/plan/', self.admin,
            ).status_code,
            200,
        )

    def test_contexto_incluye_plan_por_negocio(self):
        response = self.get('/api/v1/mi/contexto/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['negocios'][0]['plan']['codigo'], 'free')

    def test_consumidor_no_ve_plan_de_negocio_ajeno_en_contexto(self):
        response = self.get('/api/v1/mi/contexto/', self.consumer)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['negocios'], [])

    def test_negocio_nuevo_recibe_free_y_membresia_dueno(self):
        categoria = models.CategoriaNegocio.objects.create(nombre='Nueva')
        response = self.post('/api/v1/negocio/crear/', {
            'nombre': 'Negocio nuevo',
            'direccion': 'Centro',
            'correo': 'nuevo-plan@example.com',
            'categoria': categoria.pk,
        }, self.consumer)
        self.assertEqual(response.status_code, 201)
        negocio = models.Negocio.objects.get(correo='nuevo-plan@example.com')
        suscripcion = planes.suscripcion_actual(negocio)
        self.assertIsNotNone(suscripcion)
        self.assertEqual(suscripcion.plan.codigo, 'free')
        self.assertEqual(suscripcion.origen, 'automatico')
        self.assertTrue(models.UsuarioNegocio.objects.filter(
            usuario=self.consumer, negocio=negocio,
            rol_comercio='dueno', status=True,
        ).exists())
        self.assertTrue(models.PlanCambioAuditoria.objects.filter(
            negocio=negocio, plan_nuevo__codigo='free', origen='automatico',
        ).exists())

    def test_negocio_sin_suscripcion_usa_free_como_respaldo(self):
        self.assertEqual(planes.plan_actual(self.business).codigo, 'free')
        resumen = planes.resumen_plan(self.business)
        self.assertEqual(resumen['plan']['codigo'], 'free')
        self.assertIsNone(resumen['suscripcion'])

    def test_configuracion_invalida_no_es_ilimitada(self):
        free = models.PlanSuscripcion.objects.get(codigo='free')
        original = free.limites
        free.limites = {'sucursales': 1}
        free.save(update_fields=['limites'])
        try:
            with self.assertRaises(planes.ErrorConfiguracionPlan):
                planes.plan_actual(self.business)
        finally:
            free.limites = original
            free.save(update_fields=['limites'])

    def test_caracteristica_desconocida_es_falsa(self):
        self.assertFalse(
            planes.tiene_caracteristica(self.business, 'no_existe'),
        )


class LimitesAPITests(PlanBaseTests):
    def crear_sucursal_api(self, nombre, status=True):
        return self.post('/api/v1/sucursal/crear/', {
            'nombre': nombre,
            'direccion': 'Centro',
            'ciudad': 'Tijuana',
            'negocio': self.business.pk,
            'status': status,
        })

    def crear_recompensa_api(self, titulo, status=True):
        return self.post('/api/v1/recompensa/crear/', {
            'titulo': titulo,
            'descripcion': 'Beneficio',
            'tipo': 'gratis',
            'terminos_condiciones': 'Válido.',
            'negocio': self.business.pk,
            'vigencia_dias': 30,
            'status': status,
        })

    def crear_tarjeta_api(self, nombre, status=True):
        return self.post('/api/v1/dinamica/crear/', {
            'nombre': nombre,
            'tipo': 'sellos',
            'meta': 3,
            'fecha_inicio': timezone.now().isoformat(),
            'negocio': self.business.pk,
            'status': status,
        })

    def crear_membresia_api(self, usuario, sucursal, rol):
        return self.post('/api/v1/usuario-negocio/crear/', {
            'usuario': usuario.pk,
            'negocio': self.business.pk,
            'sucursal': sucursal.pk,
            'rol_comercio': rol,
        })

    def test_limite_sucursales_free_y_premium(self):
        self.assertEqual(self.crear_sucursal_api('Primera').status_code, 201)
        response = self.crear_sucursal_api('Segunda')
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data['codigo'], 'limite_plan')

        asignar_plan(self.business, 'premium')
        self.assertEqual(self.crear_sucursal_api('Segunda').status_code, 201)

    def test_sucursales_inactivas_no_consumen_cupo(self):
        self.assertEqual(self.crear_sucursal_api('Inactiva 1', False).status_code, 201)
        self.assertEqual(self.crear_sucursal_api('Inactiva 2', False).status_code, 201)
        self.assertEqual(self.crear_sucursal_api('Activa').status_code, 201)
        self.assertEqual(self.crear_sucursal_api('Otra activa').status_code, 403)

    def test_reactivar_sucursal_valida_limite(self):
        self.assertEqual(self.crear_sucursal_api('Activa').status_code, 201)
        inactiva = self.crear_sucursal_api('Inactiva', False)
        self.assertEqual(inactiva.status_code, 201)
        sucursal = models.Sucursal.objects.get(nombre__startswith='Inactiva')
        self.auth(self.owner)
        response = self.client.patch(
            f'/api/v1/sucursal/actualizar/{sucursal.pk}/',
            {'status': True}, format='json',
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data['codigo'], 'limite_plan')

    def test_limite_recompensas_free(self):
        for indice in range(5):
            self.assertEqual(
                self.crear_recompensa_api(f'Recompensa {indice}').status_code, 201,
            )
        response = self.crear_recompensa_api('Sexta')
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data['codigo'], 'limite_plan')

    def test_recompensa_inactiva_no_consume_y_reactivar_valida(self):
        for indice in range(5):
            self.assertEqual(
                self.crear_recompensa_api(f'Activa {indice}').status_code, 201,
            )
        inactiva = self.crear_recompensa_api('Inactiva', False)
        self.assertEqual(inactiva.status_code, 201)
        recompensa_inactiva = models.Recompensa.objects.get(
            negocio=self.business, titulo='Inactiva',
        )
        self.auth(self.owner)
        response = self.client.patch(
            f'/api/v1/recompensa/actualizar/{recompensa_inactiva.pk}/',
            {'status': True}, format='json',
        )
        self.assertEqual(response.status_code, 403)

        primera = models.Recompensa.objects.filter(
            negocio=self.business, status=True,
        ).first()
        self.client.patch(
            f'/api/v1/recompensa/actualizar/{primera.pk}/',
            {'status': False}, format='json',
        )
        response = self.client.patch(
            f'/api/v1/recompensa/actualizar/{recompensa_inactiva.pk}/',
            {'status': True}, format='json',
        )
        self.assertEqual(response.status_code, 200)

    def test_limite_tarjetas_sellos_free(self):
        self.assertEqual(self.crear_tarjeta_api('Tarjeta 1').status_code, 201)
        self.assertEqual(self.crear_tarjeta_api('Tarjeta 2').status_code, 201)
        response = self.crear_tarjeta_api('Tarjeta 3')
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data['codigo'], 'limite_plan')

        asignar_plan(self.business, 'premium')
        self.assertEqual(self.crear_tarjeta_api('Tarjeta 3').status_code, 201)

    def test_segundo_programa_de_puntos_sigue_rechazado(self):
        response = self.post('/api/v1/dinamica/crear/', {
            'nombre': 'Puntos 1',
            'tipo': 'puntos',
            'regla_conversion': 1,
            'fecha_inicio': timezone.now().isoformat(),
            'negocio': self.business.pk,
        })
        self.assertEqual(response.status_code, 201)
        response = self.post('/api/v1/dinamica/crear/', {
            'nombre': 'Puntos 2',
            'tipo': 'puntos',
            'regla_conversion': 1,
            'fecha_inicio': timezone.now().isoformat(),
            'negocio': self.business.pk,
        })
        self.assertEqual(response.status_code, 400)

    def test_limite_supervisores_y_empleados_free(self):
        self.branch = crear_sucursal(self.business)
        self.assertEqual(
            self.crear_membresia_api(crear_usuario(), self.branch, 'supervisor').status_code,
            201,
        )
        response = self.crear_membresia_api(
            crear_usuario(), self.branch, 'supervisor',
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data['codigo'], 'limite_plan')

        for indice in range(3):
            self.assertEqual(
                self.crear_membresia_api(
                    crear_usuario(), self.branch, 'empleado',
                ).status_code,
                201,
                msg=f'empleado {indice}',
            )
        response = self.crear_membresia_api(
            crear_usuario(), self.branch, 'empleado',
        )
        self.assertEqual(response.status_code, 403)

    def test_reactivar_membresia_valida_limite(self):
        self.branch = crear_sucursal(self.business)
        self.assertEqual(
            self.crear_membresia_api(crear_usuario(), self.branch, 'supervisor').status_code,
            201,
        )
        inactiva_usuario = crear_usuario()
        membresia = models.UsuarioNegocio.objects.create(
            usuario=inactiva_usuario, negocio=self.business,
            sucursal=self.branch, rol_comercio='supervisor', status=False,
        )
        self.auth(self.owner)
        response = self.client.patch(
            f'/api/v1/usuario-negocio/actualizar/{membresia.pk}/',
            {'status': True}, format='json',
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data['codigo'], 'limite_plan')

    def test_editar_recurso_activo_no_consume_cupo_nuevo(self):
        for indice in range(5):
            self.assertEqual(
                self.crear_recompensa_api(f'Activa {indice}').status_code, 201,
            )
        recompensa = models.Recompensa.objects.filter(
            negocio=self.business, status=True,
        ).first()
        self.auth(self.owner)
        response = self.client.patch(
            f'/api/v1/recompensa/actualizar/{recompensa.pk}/',
            {'titulo': 'Título editado'}, format='json',
        )
        self.assertEqual(response.status_code, 200)


class CambiosPlanTests(PlanBaseTests):
    def cambiar(self, codigo, motivo='Cambio comercial aprobado.'):
        return self.post(
            f'/api/v1/negocios/{self.business.pk}/plan/',
            {'plan_codigo': codigo, 'motivo': motivo},
            self.admin,
        )

    def test_dueno_no_puede_activar_premium(self):
        response = self.post(
            f'/api/v1/negocios/{self.business.pk}/plan/',
            {'plan_codigo': 'premium', 'motivo': 'Quiero Premium.'},
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(planes.plan_actual(self.business).codigo, 'free')

    def test_admin_cambia_plan_y_audita(self):
        response = self.cambiar('premium')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['plan']['codigo'], 'premium')
        self.assertEqual(planes.plan_actual(self.business).codigo, 'premium')
        auditoria = models.PlanCambioAuditoria.objects.get(negocio=self.business)
        self.assertEqual(auditoria.plan_anterior.codigo, 'free')
        self.assertEqual(auditoria.plan_nuevo.codigo, 'premium')
        self.assertEqual(auditoria.actor, self.admin)
        self.assertEqual(auditoria.actor_correo, self.admin.correo)
        self.assertIn('Cambio comercial', auditoria.motivo)

    def test_cambio_requiere_motivo(self):
        response = self.cambiar('premium', motivo='')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(planes.plan_actual(self.business).codigo, 'free')

    def test_no_permite_dos_suscripciones_vigentes(self):
        vigente = planes.suscripcion_actual(self.business)
        if vigente is None:
            planes.asignar_free_inicial(self.business, actor=self.owner)
        premium = models.PlanSuscripcion.objects.get(codigo='premium')
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                models.Suscripcion.objects.create(
                    negocio=self.business, plan=premium, status='activa',
                    origen='manual', fecha_inicio=timezone.now(),
                )

    def test_suscripcion_cancelada_no_concede_plan(self):
        asignar_plan(self.business, 'premium')
        actual = planes.suscripcion_actual(self.business)
        actual.status = 'cancelada'
        actual.fecha_fin = timezone.now()
        actual.save(update_fields=['status', 'fecha_fin', 'fecha_actualizacion'])
        self.assertEqual(planes.plan_actual(self.business).codigo, 'free')

    def test_dos_negocios_pueden_tener_planes_distintos(self):
        otro_negocio = crear_negocio('Otro')
        otro_owner = crear_usuario()
        models.UsuarioNegocio.objects.create(
            usuario=otro_owner, negocio=otro_negocio,
            sucursal=None, rol_comercio='dueno',
        )
        planes.asignar_free_inicial(otro_negocio, actor=otro_owner)
        asignar_plan(self.business, 'premium')

        response = self.get('/api/v1/mi/contexto/', self.admin)
        planes_contexto = {
            negocio['id']: negocio['plan']['codigo']
            for negocio in response.data['negocios']
        }
        self.assertEqual(planes_contexto[self.business.pk], 'premium')
        self.assertEqual(planes_contexto[otro_negocio.pk], 'free')

    def test_historial_de_plan_visible_para_el_negocio(self):
        self.cambiar('premium')
        response = self.get(
            f'/api/v1/negocios/{self.business.pk}/plan/cambios/',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data[0]['plan_anterior'], 'free')
        self.assertEqual(response.data[0]['plan_nuevo'], 'premium')
        self.assertEqual(
            self.get(
                f'/api/v1/negocios/{self.business.pk}/plan/cambios/',
                self.other,
            ).status_code,
            403,
        )


class DowngradeTests(PlanBaseTests):
    def setUp(self):
        super().setUp()
        self.branch = crear_sucursal(self.business)
        asignar_plan(self.business, 'premium')

    def test_downgrade_conserva_datos_y_marca_excedentes(self):
        for indice in range(4):
            crear_sucursal(self.business, f'Sucursal {indice}')
        for indice in range(6):
            crear_recompensa(self.business, titulo=f'Recompensa {indice}')
        for indice in range(3):
            crear_tarjeta(self.business, titulo=f'Tarjeta {indice}')
        for indice in range(2):
            models.UsuarioNegocio.objects.create(
                usuario=crear_usuario(), negocio=self.business,
                sucursal=self.branch, rol_comercio='supervisor',
            )
        for indice in range(4):
            models.UsuarioNegocio.objects.create(
                usuario=crear_usuario(), negocio=self.business,
                sucursal=self.branch, rol_comercio='empleado',
            )
        cupon = crear_cupon(self.consumer, self.business, crear_recompensa(self.business))
        tarjeta, _ = crear_tarjeta(self.business)
        ciclo = models.CicloTarjeta.objects.create(
            usuario=self.consumer, dinamica=tarjeta, negocio=self.business,
            meta=tarjeta.meta, fecha_inicio=timezone.now() - timedelta(days=1),
            sellos_actuales=1, estado='en_curso',
        )
        conteos = {
            'sucursales': models.Sucursal.objects.filter(negocio=self.business).count(),
            'recompensas': models.Recompensa.objects.filter(negocio=self.business).count(),
            'tarjetas': models.Dinamica.objects.filter(
                negocio=self.business, tipo='sellos',
            ).count(),
            'supervisores': models.UsuarioNegocio.objects.filter(
                negocio=self.business, rol_comercio='supervisor',
            ).count(),
            'empleados': models.UsuarioNegocio.objects.filter(
                negocio=self.business, rol_comercio='empleado',
            ).count(),
        }

        response = self.post(
            f'/api/v1/negocios/{self.business.pk}/plan/',
            {'plan_codigo': 'free', 'motivo': 'Downgrade solicitado.'},
            self.admin,
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['plan']['codigo'], 'free')

        self.assertEqual(
            models.Sucursal.objects.filter(negocio=self.business).count(),
            conteos['sucursales'],
        )
        self.assertEqual(
            models.Recompensa.objects.filter(negocio=self.business).count(),
            conteos['recompensas'],
        )
        for recurso in (
            'sucursales', 'recompensas', 'tarjetas_sellos',
            'supervisores', 'empleados',
        ):
            self.assertIn(recurso, response.data['excedentes'])
            self.assertTrue(response.data['limites'][recurso]['excedido'])

        self.assertTrue(models.CuponUsuario.objects.filter(pk=cupon.pk).exists())
        self.assertEqual(cupon.status, 'disponible')
        ciclo.refresh_from_db()
        self.assertEqual(ciclo.estado, 'en_curso')

        # No se borran recursos, pero no se permiten nuevas altas por encima.
        response = self.post('/api/v1/sucursal/crear/', {
            'nombre': 'Bloqueada',
            'direccion': 'Centro',
            'ciudad': 'Tijuana',
            'negocio': self.business.pk,
        })
        self.assertEqual(response.status_code, 403)

        # El consumo sigue funcionando.
        self.auth(self.consumer)
        self.assertEqual(
            self.client.get('/api/v1/mi/billetera/').status_code, 200,
        )


class LimiteConcurrenteTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        asegurar_planes()
        self.owner = crear_usuario()
        self.business = crear_negocio()
        models.UsuarioNegocio.objects.create(
            usuario=self.owner, negocio=self.business,
            sucursal=None, rol_comercio='dueno',
        )
        free = models.PlanSuscripcion.objects.get(codigo='free')
        if planes.suscripcion_actual(self.business) is None:
            models.Suscripcion.objects.create(
                negocio=self.business, plan=free, status='activa',
                origen='manual', fecha_inicio=timezone.now(),
            )
    def test_solo_una_creacion_consume_el_ultimo_cupo(self):
        if connection.vendor != 'postgresql':
            self.skipTest('La prueba de bloqueo requiere PostgreSQL.')
        barrier = threading.Barrier(2)
        resultados = []
        errores = []

        def intentar(indice):
            close_old_connections()
            try:
                barrier.wait(timeout=10)
                with transaction.atomic():
                    planes.verificar_capacidad(self.business, 'sucursales')
                    models.Sucursal.objects.create(
                        nombre=f'Concurrente {indice}',
                        direccion='Centro',
                        ciudad='Tijuana',
                        negocio=self.business,
                    )
                resultados.append('creada')
            except planes.LimitePlan:
                resultados.append('limite')
            except (OperationalError, Exception) as exc:  # pragma: no cover
                errores.append(repr(exc))
            finally:
                close_old_connections()

        hilos = [threading.Thread(target=intentar, args=(i,)) for i in range(2)]
        for hilo in hilos:
            hilo.start()
        for hilo in hilos:
            hilo.join(timeout=20)

        self.assertEqual(errores, [])
        self.assertEqual(sorted(resultados), ['creada', 'limite'])
        self.assertEqual(
            models.Sucursal.objects.filter(negocio=self.business).count(), 1,
        )
