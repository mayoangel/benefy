"""Pruebas de baja de cuenta, anonimización y recuperación de Supabase."""

from io import StringIO
from unittest.mock import patch
from uuid import uuid4

from django.core.management import call_command
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from core import models
from core.services import cuentas
from core.services.lealtad import puntos
from core.tests.helpers import (
    crear_cupon,
    crear_negocio,
    crear_recompensa,
    crear_sucursal,
    crear_tarjeta,
    crear_usuario,
)

SUPABASE_TEST = dict(
    SUPABASE_URL='https://project.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY='service-role-test',
    SUPABASE_PUBLISHABLE_KEY='public-test-key',
)


@override_settings(**SUPABASE_TEST)
class EliminacionCuentaTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = crear_usuario()
        self.business = crear_negocio()
        self.branch = crear_sucursal(self.business, 'Centro')
        self.membership = models.UsuarioNegocio.objects.create(
            usuario=self.user,
            negocio=self.business,
            sucursal=self.branch,
            rol_comercio='empleado',
        )
        puntos.otorgar_puntos(
            usuario=self.user,
            negocio=self.business,
            cantidad=25,
            origen='ajuste',
            descripcion='Saldo de prueba.',
        )
        self.reward = crear_recompensa(self.business, costo=10)
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
        models.RegistroActividad.objects.create(
            usuario=self.user,
            negocio=self.business,
            sucursal=self.branch,
            fecha_negocio=timezone.localdate(),
        )
        models.Notificacion.objects.create(
            usuario=self.user,
            titulo='Aviso personal',
            cuerpo='Contenido personal.',
        )
        models.RegistroComercial.objects.create(
            supabase_uid=self.user.supabase_uid,
            correo=self.user.correo,
            nombre_completo='Nombre personal',
            usuario=self.user,
        )
        self.storage_patcher = patch(
            'core.services.cuentas.supabase_storage.eliminar_avatar',
            return_value=True,
        )
        self.eliminar_avatar = self.storage_patcher.start()
        self.addCleanup(self.storage_patcher.stop)

    def auth(self, user=None):
        self.client.force_authenticate(user=user or self.user)

    def eliminar(self, confirmacion='Eliminar mi cuenta', user=None):
        self.auth(user)
        return self.client.post(
            '/api/v1/mi/cuenta/eliminar/',
            {'confirmacion': confirmacion},
            format='json',
        )

    @patch('core.services.cuentas.supabase_admin.eliminar_usuario', return_value=True)
    def test_elimina_anonimiza_y_conserva_historial(self, eliminar_supabase):
        qr_anterior = self.user.qr_token
        response = self.eliminar()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['estado'], 'completada')
        self.assertTrue(response.data['supabase_eliminado'])
        eliminar_supabase.assert_called_once()

        self.user.refresh_from_db()
        self.assertEqual(self.user.nombre, 'Usuario')
        self.assertEqual(self.user.apellido, 'Eliminado')
        self.assertIsNone(self.user.telefono)
        self.assertIsNone(self.user.foto_perfil)
        self.assertIsNone(self.user.supabase_uid)
        self.assertFalse(self.user.is_active)
        self.assertNotEqual(self.user.qr_token, qr_anterior)
        self.assertIn('@benefy.invalid', self.user.correo)

        self.membership.refresh_from_db()
        self.assertFalse(self.membership.status)
        self.assertEqual(
            models.SaldoPuntos.objects.get(usuario=self.user).saldo_actual, 0,
        )
        self.assertEqual(
            models.LotePuntos.objects.get(usuario=self.user).cantidad_disponible, 0,
        )
        self.assertTrue(models.MovimientoPuntos.objects.filter(
            usuario=self.user, tipo='expirado', cantidad=-25,
        ).exists())
        self.coupon.refresh_from_db()
        self.assertEqual(self.coupon.status, 'anulado')
        self.cycle.refresh_from_db()
        self.assertEqual(self.cycle.estado, 'anulado')

        self.assertEqual(
            models.RegistroActividad.objects.filter(usuario=self.user).count(), 1,
        )
        self.assertFalse(models.Notificacion.objects.filter(usuario=self.user).exists())
        registro = models.RegistroComercial.objects.get(usuario__isnull=True)
        self.assertEqual(registro.nombre_completo, '')
        self.assertIn('@benefy.invalid', registro.correo)
        self.assertTrue(models.AuditoriaMembresia.objects.filter(
            usuario=self.user, usuario_correo='',
        ).exists())

        solicitud = models.EliminacionCuenta.objects.get(usuario=self.user)
        self.assertEqual(solicitud.estado, 'completada')
        self.assertIsNone(solicitud.supabase_uid)
        self.assertIsNotNone(solicitud.anonimizada_en)
        self.assertIsNotNone(solicitud.storage_limpiado_en)
        self.assertIsNotNone(solicitud.supabase_eliminado_en)
        self.eliminar_avatar.assert_called_once()

    def test_confirmacion_incorrecta_no_modifica_nada(self):
        response = self.eliminar('borrar todo')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['codigo'], 'confirmacion_invalida')
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_active)
        self.assertFalse(models.EliminacionCuenta.objects.exists())

    def test_limite_de_intentos_de_baja(self):
        cache.clear()
        for _ in range(5):
            self.assertEqual(self.eliminar('borrar todo').status_code, 400)
        self.assertEqual(self.eliminar('borrar todo').status_code, 429)

    def test_propietario_de_negocio_activo_queda_bloqueado(self):
        owner = crear_usuario()
        models.UsuarioNegocio.objects.create(
            usuario=owner, negocio=self.business, sucursal=None,
            rol_comercio='dueno',
        )
        response = self.eliminar(user=owner)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['codigo'], 'propietario_activo')
        self.assertEqual(response.data['negocios'][0]['id'], self.business.pk)
        owner.refresh_from_db()
        self.assertTrue(owner.is_active)

    @patch('core.services.cuentas.supabase_admin.eliminar_usuario', return_value=True)
    def test_transferencia_a_otro_propietario_permite_eliminarse(self, _):
        owner = crear_usuario()
        otro_owner = crear_usuario()
        business = crear_negocio()
        models.UsuarioNegocio.objects.create(
            usuario=owner, negocio=business, sucursal=None,
            rol_comercio='dueno',
        )
        models.UsuarioNegocio.objects.create(
            usuario=otro_owner, negocio=business, sucursal=None,
            rol_comercio='dueno',
        )
        response = self.eliminar(user=owner)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(models.UsuarioNegocio.objects.filter(
            usuario=otro_owner, negocio=business, rol_comercio='dueno', status=True,
        ).exists())
        self.assertFalse(models.UsuarioNegocio.objects.filter(
            usuario=owner, negocio=business, status=True,
        ).exists())

    @patch('core.services.cuentas.supabase_admin.eliminar_usuario', return_value=True)
    def test_propietario_de_negocio_inactivo_puede_eliminarse(self, _):
        owner = crear_usuario()
        business = crear_negocio(status=False)
        membership = models.UsuarioNegocio.objects.create(
            usuario=owner, negocio=business, sucursal=None,
            rol_comercio='dueno',
        )
        response = self.eliminar(user=owner)
        self.assertEqual(response.status_code, 200)
        membership.refresh_from_db()
        self.assertFalse(membership.status)

    def test_admin_sistema_no_se_autoelimina(self):
        admin = crear_usuario(rol='admin_sistema')
        response = self.eliminar(user=admin)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['codigo'], 'cuenta_admin')
        admin.refresh_from_db()
        self.assertTrue(admin.is_active)

    @override_settings(SUPABASE_SERVICE_ROLE_KEY='')
    def test_sin_service_role_no_hay_cambios_parciales(self):
        response = self.eliminar()
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.data['codigo'], 'supabase_no_configurado')
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_active)
        self.assertFalse(models.EliminacionCuenta.objects.exists())

    @patch(
        'core.services.cuentas.supabase_admin.eliminar_usuario',
        side_effect=cuentas.supabase_admin.ErrorSupabaseAdmin('fallo temporal'),
    )
    def test_fallo_supabase_deja_estado_pendiente_y_reintenta(self, _):
        response = self.eliminar()
        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.data['estado'], 'anonimizada')
        self.assertFalse(response.data['supabase_eliminado'])

        solicitud = models.EliminacionCuenta.objects.get(usuario=self.user)
        self.assertEqual(solicitud.estado, 'anonimizada')
        self.assertEqual(solicitud.intentos, 1)
        self.assertIsNotNone(solicitud.supabase_uid)
        self.assertIsNotNone(solicitud.storage_limpiado_en)
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_active)

        with patch(
            'core.services.cuentas.supabase_admin.eliminar_usuario',
            return_value=True,
        ) as eliminar:
            call_command(
                'reintentar_eliminaciones_cuenta',
                stdout=StringIO(),
            )
        eliminar.assert_called_once()
        solicitud.refresh_from_db()
        self.assertEqual(solicitud.estado, 'completada')
        self.assertIsNone(solicitud.supabase_uid)

    @patch('core.services.cuentas.supabase_admin.eliminar_usuario', return_value=True)
    @patch(
        'core.services.cuentas.supabase_storage.eliminar_avatar',
        side_effect=cuentas.supabase_storage.ErrorSupabaseStorage('fallo de storage'),
    )
    def test_fallo_storage_deja_estado_pendiente_y_reintenta(self, _, __):
        response = self.eliminar()
        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.data['estado'], 'anonimizada')
        self.assertTrue(response.data['supabase_eliminado'])

        solicitud = models.EliminacionCuenta.objects.get(usuario=self.user)
        self.assertEqual(solicitud.estado, 'anonimizada')
        self.assertEqual(solicitud.storage_intentos, 1)
        self.assertIsNone(solicitud.storage_limpiado_en)
        self.assertIsNotNone(solicitud.supabase_eliminado_en)
        self.assertIsNotNone(solicitud.supabase_uid)

        with patch(
            'core.services.cuentas.supabase_storage.eliminar_avatar',
            return_value=True,
        ) as limpiar:
            call_command(
                'reintentar_eliminaciones_cuenta',
                stdout=StringIO(),
            )
        limpiar.assert_called_once()
        solicitud.refresh_from_db()
        self.assertEqual(solicitud.estado, 'completada')
        self.assertIsNotNone(solicitud.storage_limpiado_en)
        self.assertIsNone(solicitud.supabase_uid)

    @patch('core.services.cuentas.supabase_admin.eliminar_usuario', return_value=True)
    def test_reintento_es_idempotente(self, _):
        primera = self.eliminar()
        self.assertEqual(primera.status_code, 200)
        segunda = cuentas.solicitar_eliminacion(self.user, 'Eliminar mi cuenta')
        self.assertEqual(segunda.estado, 'completada')
        self.assertTrue(segunda.supabase_eliminado)
        self.assertEqual(models.RegistroActividad.objects.filter(usuario=self.user).count(), 1)

    def test_usuario_sin_supabase_uid_puede_anonimizarse(self):
        self.user.supabase_uid = None
        self.user.save(update_fields=['supabase_uid'])
        resultado = cuentas.solicitar_eliminacion(
            self.user, 'Eliminar mi cuenta',
        )
        self.assertEqual(resultado.estado, 'completada')
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_active)
        self.assertIsNone(self.user.supabase_uid)
