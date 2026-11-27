"""Pruebas de contexto temporal, identidad y analítica de Benef AI."""

from datetime import datetime, timedelta, timezone as dt_timezone
from zoneinfo import ZoneInfo

from django.core.exceptions import PermissionDenied
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from core import models
from core.services.benef_ai_analitica import ErrorConsulta, consultar
from core.services.benef_ai_contexto import construir_contexto_benef_ai
from core.services.benef_ai_tiempo import ErrorPeriodo, ahora_local, resolver_rango
from core.tests.helpers import (
    asegurar_planes,
    asignar_plan,
    crear_cupon,
    crear_dinamica_puntos,
    crear_negocio,
    crear_recompensa,
    crear_sucursal,
    crear_tarjeta,
    crear_usuario,
)


class BenefAITiempoTests(TestCase):
    def setUp(self):
        asegurar_planes()
        self.tijuana = crear_negocio('Tiempo', 'America/Tijuana')
        self.mexico = crear_negocio('Tiempo MX', 'America/Mexico_City')
        self.ahora = datetime(2026, 1, 1, 7, 30, tzinfo=dt_timezone.utc)

    def test_la_fecha_local_depende_de_la_zona_del_negocio(self):
        self.assertEqual(
            ahora_local(self.tijuana, self.ahora).date().isoformat(),
            '2025-12-31',
        )
        self.assertEqual(
            ahora_local(self.mexico, self.ahora).date().isoformat(),
            '2026-01-01',
        )

    def test_mes_ano_y_semana_se_calculan_en_la_zona_local(self):
        rango = resolver_rango(
            self.tijuana, periodo='este_mes', ahora=self.ahora,
        )
        self.assertEqual(rango.desde.isoformat(), '2025-12-01')
        self.assertEqual(rango.hasta.isoformat(), '2025-12-31')

        ano = resolver_rango(
            self.tijuana, periodo='ano_actual', ahora=self.ahora,
        )
        self.assertEqual(ano.desde.isoformat(), '2025-01-01')
        self.assertEqual(ano.hasta.isoformat(), '2025-12-31')

        semana = resolver_rango(
            self.tijuana, periodo='esta_semana', ahora=self.ahora,
        )
        self.assertEqual(semana.desde.isoformat(), '2025-12-29')
        self.assertEqual(semana.hasta.isoformat(), '2025-12-31')

    def test_mes_pasado_y_periodos_de_7_y_30_dias(self):
        pasado = resolver_rango(
            self.tijuana, periodo='mes_pasado', ahora=self.ahora,
        )
        self.assertEqual(pasado.desde.isoformat(), '2025-11-01')
        self.assertEqual(pasado.hasta.isoformat(), '2025-11-30')

        siete = resolver_rango(
            self.tijuana, periodo='ultimos_7_dias', ahora=self.ahora,
        )
        self.assertEqual(siete.dias, 7)
        treinta = resolver_rango(
            self.tijuana, periodo='ultimos_30_dias', ahora=self.ahora,
        )
        self.assertEqual(treinta.dias, 30)

    def test_rango_explicito_rechaza_futuro_y_rangos_excesivos(self):
        with self.assertRaises(ErrorPeriodo):
            resolver_rango(
                self.tijuana,
                desde='2025-12-01',
                hasta='2026-01-01',
                ahora=self.ahora,
            )
        with self.assertRaises(ErrorPeriodo):
            resolver_rango(
                self.tijuana,
                desde='2024-01-01',
                hasta='2025-12-31',
                ahora=self.ahora,
            )
        with self.assertRaises(ErrorPeriodo):
            resolver_rango(
                self.tijuana, periodo='hoy', desde='2025-12-01', ahora=self.ahora,
            )

    def test_periodo_personalizado_y_comparacion(self):
        rango = resolver_rango(
            self.tijuana,
            desde='2025-12-01',
            hasta='2025-12-10',
            ahora=self.ahora,
        )
        self.assertEqual(rango.dias, 10)
        self.assertEqual(rango.anterior.desde.isoformat(), '2025-11-21')
        self.assertEqual(rango.anterior.hasta.isoformat(), '2025-11-30')


class BenefAIContextoTests(TestCase):
    def setUp(self):
        asegurar_planes()
        self.owner = crear_usuario()
        self.supervisor = crear_usuario()
        self.employee = crear_usuario()
        self.other = crear_usuario()
        self.admin = crear_usuario(rol='admin_sistema')
        self.business = crear_negocio('Contexto')
        self.branch = crear_sucursal(self.business, 'Centro')
        self.branch2 = crear_sucursal(self.business, 'Norte')
        self.foreign = crear_negocio('Ajeno')
        models.UsuarioNegocio.objects.create(
            usuario=self.owner, negocio=self.business,
            sucursal=None, rol_comercio='dueno',
        )
        models.UsuarioNegocio.objects.create(
            usuario=self.supervisor, negocio=self.business,
            sucursal=self.branch, rol_comercio='supervisor',
        )
        models.UsuarioNegocio.objects.create(
            usuario=self.employee, negocio=self.business,
            sucursal=self.branch, rol_comercio='empleado',
        )
        models.UsuarioNegocio.objects.create(
            usuario=self.other, negocio=self.foreign,
            sucursal=None, rol_comercio='dueno',
        )

    def test_identidad_rol_plan_y_sucursales_del_dueno(self):
        contexto = construir_contexto_benef_ai(self.owner, self.business)
        self.assertEqual(contexto['usuario']['rol_comercio'], 'dueno')
        self.assertTrue(contexto['usuario']['es_dueno'])
        self.assertEqual(contexto['negocio']['nombre'], self.business.nombre)
        self.assertEqual(contexto['plan']['plan']['codigo'], 'free')
        self.assertEqual(contexto['plan']['plan']['nombre_visible'], 'Plan gratis')
        self.assertEqual(len(contexto['sucursales_autorizadas']), 2)
        self.assertTrue(contexto['capacidades']['ver_clientes'])
        self.assertFalse(contexto['capacidades']['puede_escribir'])
        self.assertIn('fecha_actual', contexto['tiempo'])
        self.assertNotIn('correo', contexto['usuario'])

    def test_supervisor_solo_recibe_su_sucursal_y_no_clientes(self):
        contexto = construir_contexto_benef_ai(self.supervisor, self.business)
        self.assertEqual(contexto['usuario']['rol_comercio'], 'supervisor')
        self.assertEqual([item['id'] for item in contexto['sucursales_autorizadas']], [self.branch.pk])
        self.assertFalse(contexto['capacidades']['ver_clientes'])
        self.assertFalse(contexto['capacidades']['ver_cupones'])
        self.assertFalse(contexto['capacidades']['ver_puntos_y_tarjetas'])

    def test_sucursal_ajena_es_rechazada(self):
        with self.assertRaises(PermissionDenied):
            construir_contexto_benef_ai(
                self.supervisor, self.business, sucursal_id=self.branch2.pk,
            )
        with self.assertRaises(PermissionDenied):
            construir_contexto_benef_ai(
                self.owner, self.business, sucursal_id=999999,
            )

    def test_negocio_ajeno_admin_y_usuario_sin_membresia(self):
        with self.assertRaises(PermissionDenied):
            construir_contexto_benef_ai(self.other, self.business)
        with self.assertRaises(PermissionDenied):
            construir_contexto_benef_ai(self.admin, self.business)
        with self.assertRaises(PermissionDenied):
            construir_contexto_benef_ai(crear_usuario(), self.business)


class BenefAIAnaliticaTests(TestCase):
    def setUp(self):
        asegurar_planes()
        self.business = crear_negocio('Analítica')
        asignar_plan(self.business, 'premium')
        self.owner = crear_usuario()
        self.supervisor = crear_usuario()
        self.employee = crear_usuario()
        self.outsider = crear_usuario()
        self.clients = [crear_usuario() for _ in range(4)]
        self.branch = crear_sucursal(self.business, 'Centro')
        self.branch2 = crear_sucursal(self.business, 'Norte')
        models.UsuarioNegocio.objects.create(
            usuario=self.owner, negocio=self.business,
            sucursal=None, rol_comercio='dueno',
        )
        models.UsuarioNegocio.objects.create(
            usuario=self.supervisor, negocio=self.business,
            sucursal=self.branch, rol_comercio='supervisor',
        )
        models.UsuarioNegocio.objects.create(
            usuario=self.employee, negocio=self.business,
            sucursal=self.branch, rol_comercio='empleado',
        )
        self.reward = crear_recompensa(
            self.business, costo=20, titulo='Café gratis',
            cantidad_disponible=10,
        )
        self.card, self.card_reward = crear_tarjeta(
            self.business, meta=3, repetible=True, titulo='Tarjeta café',
        )
        self.points = crear_dinamica_puntos(self.business, puntos=10)
        self.now = timezone.now()
        self.hoy = ahora_local(self.business, self.now).date()
        self._crear_visitas()
        self._crear_puntos()
        self._crear_cupones_y_canjes()
        self._crear_alianza()

    def _crear_visitas(self):
        self.visitas = []
        filas = [
            (self.clients[0], self.hoy, self.branch, True),
            (self.clients[0], self.hoy - timedelta(days=1), self.branch2, True),
            (self.clients[0], self.hoy - timedelta(days=2), self.branch, True),
            (self.clients[1], self.hoy, self.branch2, True),
            (self.clients[1], self.hoy - timedelta(days=40), self.branch, True),
            (self.clients[2], self.hoy - timedelta(days=45), self.branch, True),
            (self.clients[3], self.hoy, None, True),
            (self.clients[1], self.hoy - timedelta(days=3), self.branch, False),
        ]
        for cliente, fecha, sucursal, valida in filas:
            visita = models.RegistroActividad.objects.create(
                usuario=cliente,
                negocio=self.business,
                sucursal=sucursal,
                tipo='visita',
                fecha_negocio=fecha,
                es_valida=valida,
            )
            self.visitas.append(visita)

    def _crear_puntos(self):
        for cliente, cantidad in ((self.clients[0], 30), (self.clients[1], 10)):
            models.SaldoPuntos.objects.create(
                usuario=cliente, negocio=self.business, saldo_actual=cantidad,
            )
            models.LotePuntos.objects.create(
                usuario=cliente, negocio=self.business,
                dinamica=self.points, origen='visita',
                cantidad_otorgada=cantidad, cantidad_disponible=cantidad,
                fecha_otorgamiento=self.now,
            )
            models.MovimientoPuntos.objects.create(
                usuario=cliente, negocio=self.business,
                tipo='otorgado', cantidad=cantidad,
            )
        models.MovimientoPuntos.objects.create(
            usuario=self.clients[0], negocio=self.business,
            tipo='consumido', cantidad=-5,
        )

    def _crear_cupones_y_canjes(self):
        self.cupon_1 = crear_cupon(
            self.clients[0], self.business, self.reward, status='canjeado',
        )
        self.cupon_2 = crear_cupon(
            self.clients[1], self.business, self.reward, status='disponible',
        )
        self.cupon_3 = crear_cupon(
            self.clients[2], self.business, self.reward, status='vencido', dias=-2,
        )
        models.Canje.objects.create(
            cupon=self.cupon_1, negocio=self.business,
            sucursal=self.branch, anulado=False,
        )

    def _crear_alianza(self):
        self.aliado = crear_negocio('Aliado')
        self.aliado_owner = crear_usuario()
        models.UsuarioNegocio.objects.create(
            usuario=self.aliado_owner, negocio=self.aliado,
            sucursal=None, rol_comercio='dueno',
        )
        self.alianza = models.Alianza.objects.create(
            negocio1=self.business,
            negocio2=self.aliado,
            condicion_participacion='Ambos ofrecen un beneficio.',
            status='activa',
            fecha_inicio=self.now - timedelta(days=1),
            fecha_fin=self.now + timedelta(days=20),
        )
        models.Recompensa.objects.create(
            titulo='Beneficio aliado',
            descripcion='Beneficio de la alianza.',
            tipo='descuento',
            descuento=15,
            costo_desbloqueo=0,
            terminos_condiciones='Válido en el negocio aliado.',
            negocio=self.aliado,
            alianza=self.alianza,
            vigencia_dias=20,
        )

    def test_resumen_y_comparacion_usan_solo_datos_reales(self):
        datos = consultar(
            self.owner, self.business, 'resumen',
            periodo='ultimos_30_dias', comparar=True, ahora=self.now,
        )
        self.assertEqual(datos['visitas_validas'], 5)
        self.assertEqual(datos['visitas_anuladas'], 1)
        self.assertEqual(datos['clientes_unicos'], 3)
        self.assertEqual(datos['canjes'], 1)
        self.assertEqual(datos['puntos']['otorgados'], 40)
        self.assertEqual(datos['puntos']['consumidos'], 5)
        self.assertEqual(datos['cupones']['emitidos'], 3)
        self.assertEqual(datos['alianzas_activas'], 1)
        self.assertIn('comparacion', datos)

    def test_ranking_de_clientes_por_visitas_y_canjes(self):
        datos = consultar(
            self.owner, self.business, 'clientes',
            periodo='ultimos_30_dias', orden='visitas', limite=2, ahora=self.now,
        )
        self.assertEqual(len(datos['resultados']), 2)
        self.assertEqual(datos['resultados'][0]['nombre'], (
            f'{self.clients[0].nombre} {self.clients[0].apellido}'.strip()
        ))
        self.assertEqual(datos['resultados'][0]['visitas'], 3)
        self.assertEqual(datos['resultados'][0]['estado'], 'activo')

        canjes = consultar(
            self.owner, self.business, 'clientes',
            periodo='ultimos_30_dias', orden='canjes', limite=1, ahora=self.now,
        )
        self.assertEqual(canjes['resultados'][0]['canjes'], 1)

    def test_clientes_inactivos_se_distinguen_de_sin_visitas(self):
        datos = consultar(
            self.owner, self.business, 'clientes',
            periodo='ultimos_30_dias', incluir_inactivos=True,
            orden='visitas', limite=10, ahora=self.now,
        )
        estados = {
            fila['nombre']: fila['estado'] for fila in datos['resultados']
        }
        objetivo = f'{self.clients[2].nombre} {self.clients[2].apellido}'.strip()
        self.assertEqual(estados[objetivo], 'inactivo')

    def test_supervisor_no_puede_ver_ranking_nominal_de_clientes(self):
        with self.assertRaises(PermissionDenied):
            consultar(
                self.supervisor, self.business, 'clientes',
                periodo='ultimos_30_dias', ahora=self.now,
            )

    def test_supervisor_solo_ve_visitas_de_su_sucursal(self):
        datos = consultar(
            self.supervisor, self.business, 'visitas',
            periodo='ultimos_30_dias', ahora=self.now,
        )
        self.assertEqual(datos['visitas_validas'], 2)
        self.assertIsNone(datos['top_clientes'])
        self.assertEqual(datos['por_sucursal'], [{'sucursal': self.branch.nombre, 'visitas': 2}])

    def test_alianzas_incluyen_contraparte_fechas_y_recompensas(self):
        datos = consultar(self.owner, self.business, 'alianzas', ahora=self.now)
        self.assertEqual(datos['total'], 1)
        fila = datos['resultados'][0]
        self.assertEqual(fila['aliado'], self.aliado.nombre)
        self.assertEqual(fila['direccion'], 'enviada')
        self.assertEqual(fila['estado'], 'activa')
        self.assertIn('fecha_fin', fila)
        self.assertEqual(fila['recompensas'][0]['titulo'], 'Beneficio aliado')

    def test_cupones_informan_tasa_y_vencidos_con_denominador(self):
        datos = consultar(
            self.owner, self.business, 'cupones',
            periodo='ultimos_30_dias', ahora=self.now,
        )
        self.assertEqual(datos['emitidos'], 3)
        self.assertEqual(datos['canjeados'], 1)
        self.assertEqual(datos['tasa_canje']['numerador'], 1)
        self.assertEqual(datos['tasa_canje']['denominador'], 3)
        self.assertGreaterEqual(datos['vencidos'], 1)

    def test_puntos_y_tarjetas_no_inventan_sellos_historicos(self):
        datos = consultar(
            self.owner, self.business, 'tarjetas',
            periodo='ultimos_30_dias', ahora=self.now,
        )
        self.assertEqual(datos['puntos']['otorgados'], 40)
        self.assertIsNone(datos['tarjetas']['sellos_otorgados'])
        self.assertIn('no guarda', datos['tarjetas']['nota'])

    def test_equipo_respeta_alcance_y_no_expone_correo(self):
        dueno = consultar(self.owner, self.business, 'equipo')
        self.assertEqual(dueno['total_visibles'], 3)
        self.assertEqual(dueno['por_rol']['dueno'], 1)
        self.assertTrue(all('correo' not in item for item in dueno['miembros']))
        empleado = consultar(self.employee, self.business, 'equipo')
        self.assertEqual(empleado['total_visibles'], 1)
        self.assertTrue(empleado['miembros'][0]['es_usuario_actual'])

    def test_sin_datos_devuelve_ceros_y_no_error(self):
        negocio = crear_negocio('Vacío')
        dueno = crear_usuario()
        models.UsuarioNegocio.objects.create(
            usuario=dueno, negocio=negocio,
            sucursal=None, rol_comercio='dueno',
        )
        asegurar_planes()
        datos = consultar(dueno, negocio, 'resumen', periodo='hoy', ahora=self.now)
        self.assertEqual(datos['visitas_validas'], 0)
        self.assertEqual(datos['clientes_unicos'], 0)
        self.assertEqual(datos['canjes'], 0)

    def test_periodo_invalido_y_sucursal_ajena(self):
        with self.assertRaises(ErrorConsulta):
            consultar(
                self.owner, self.business, 'visitas',
                periodo='inventado', ahora=self.now,
            )
        with self.assertRaises(PermissionDenied):
            consultar(
                self.supervisor, self.business, 'visitas',
                periodo='hoy', sucursal_id=self.branch2.pk, ahora=self.now,
            )


class BenefAIAnaliticaAPITests(TestCase):
    def setUp(self):
        asegurar_planes()
        self.owner = crear_usuario()
        self.outsider = crear_usuario()
        self.admin = crear_usuario(rol='admin_sistema')
        self.business = crear_negocio('API IA')
        self.branch = crear_sucursal(self.business, 'Centro')
        models.UsuarioNegocio.objects.create(
            usuario=self.owner, negocio=self.business,
            sucursal=None, rol_comercio='dueno',
        )
        self.client = APIClient()

    def test_contexto_y_analitica_requieren_membresia(self):
        self.client.force_authenticate(self.owner)
        contexto = self.client.get(f'/api/v1/negocios/{self.business.pk}/benef-ai/contexto/')
        self.assertEqual(contexto.status_code, 200)
        self.assertEqual(contexto.data['usuario']['rol_comercio'], 'dueno')
        analitica = self.client.get(
            f'/api/v1/negocios/{self.business.pk}/benef-ai/analitica/?tema=resumen&periodo=hoy',
        )
        self.assertEqual(analitica.status_code, 200)
        self.assertEqual(analitica.data['visitas_validas'], 0)

        self.client.force_authenticate(self.outsider)
        self.assertEqual(
            self.client.get(f'/api/v1/negocios/{self.business.pk}/benef-ai/contexto/').status_code,
            403,
        )
        self.client.force_authenticate(self.admin)
        self.assertEqual(
            self.client.get(f'/api/v1/negocios/{self.business.pk}/benef-ai/contexto/').status_code,
            403,
        )

    def test_parametros_invalidos_son_400_y_sucursal_ajena_403(self):
        self.client.force_authenticate(self.owner)
        base = f'/api/v1/negocios/{self.business.pk}/benef-ai/analitica/'
        self.assertEqual(
            self.client.get(base, {'tema': 'no_existe'}).status_code, 400,
        )
        self.assertEqual(
            self.client.get(base, {'tema': 'resumen', 'periodo': 'mes_inventado'}).status_code,
            400,
        )
        otra = crear_sucursal(crear_negocio('Otra'))
        self.assertEqual(
            self.client.get(base, {'tema': 'visitas', 'sucursal': otra.pk}).status_code,
            403,
        )
