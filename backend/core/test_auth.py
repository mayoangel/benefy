"""Autenticación remota simulada y autorización contra una base aislada."""

from datetime import timedelta
from io import BytesIO
import json
from unittest.mock import patch
from urllib.error import HTTPError, URLError
from uuid import uuid4

from django.test import SimpleTestCase, TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from core import models, urls
from core.authentication import AuthUnavailable, SupabaseIdentity, verify_token
from rest_framework.exceptions import AuthenticationFailed


@override_settings(SUPABASE_URL='https://project.supabase.co',
                   SUPABASE_PUBLISHABLE_KEY='public-test-key')
class SupabaseVerificationTests(SimpleTestCase):
    def response(self, **overrides):
        user = {'id': str(uuid4()), 'email': 'user@example.com',
                'email_confirmed_at': timezone.now().isoformat(),
                'role': 'authenticated', 'is_anonymous': False,
                'user_metadata': {'rol': 'admin_sistema'}}
        user.update(overrides)
        response = BytesIO(json.dumps(user).encode())
        return response, user

    @patch('core.authentication.build_opener')
    def test_supabase_valida_token_y_metadata_no_otorga_roles(self, opener):
        response, user = self.response()
        opener.return_value.open.return_value = response
        identity = verify_token('test-access-token')
        self.assertEqual(str(identity.uid), user['id'])
        self.assertEqual(identity.email, user['email'])
        self.assertFalse(hasattr(identity, 'rol'))
        request = opener.return_value.open.call_args.args[0]
        self.assertEqual(request.full_url, 'https://project.supabase.co/auth/v1/user')
        self.assertEqual(request.get_header('Authorization'), 'Bearer test-access-token')
        self.assertEqual(opener.return_value.open.call_args.kwargs['timeout'], 5)

    @patch('core.authentication.build_opener')
    def test_rechaza_token_invalido_o_expirado(self, opener):
        for code in (401, 403):
            opener.return_value.open.side_effect = HTTPError('https://example.com', code, '', {}, None)
            with self.assertRaises(AuthenticationFailed):
                verify_token('expired-token')

    @patch('core.authentication.build_opener')
    def test_no_falla_abierto_ante_indisponibilidad(self, opener):
        for error in (URLError('offline'), TimeoutError(), HTTPError('https://example.com', 500, '', {}, None)):
            opener.return_value.open.side_effect = error
            with self.assertRaises(AuthUnavailable):
                verify_token('test-token')

    @patch('core.authentication.build_opener')
    def test_rechaza_identidades_no_permitidas(self, opener):
        for overrides in ({'is_anonymous': True}, {'email_confirmed_at': None},
                          {'role': 'service_role'}, {'id': 'invalid'}, {'email': ''}):
            response, _ = self.response(**overrides)
            opener.return_value.open.return_value = response
            with self.assertRaises(AuthenticationFailed):
                verify_token('test-token')

    @override_settings(SUPABASE_URL='https://project.supabase.co', SUPABASE_PUBLISHABLE_KEY='')
    def test_configuracion_incompleta_es_503(self):
        with self.assertRaises(AuthUnavailable):
            verify_token('test-token')


class AuthAndPermissionsTests(TestCase):
    def user(self, name, role='consumidor'):
        return models.Usuario.objects.create(supabase_uid=uuid4(), nombre=name,
            apellido='Prueba', correo=name + '@example.com', rol=role)

    def setUp(self):
        self.client = APIClient()
        self.consumer = self.user('consumer')
        self.other = self.user('other')
        self.owner = self.user('owner', 'negocio')
        self.manager = self.user('manager', 'negocio')
        self.employee = self.user('employee', 'negocio')
        self.admin = self.user('admin', 'admin_sistema')
        self.category = models.CategoriaNegocio.objects.create(nombre='Café')
        self.business = models.Negocio.objects.create(nombre='Uno', direccion='Centro',
            correo='uno@example.com', categoria=self.category)
        self.foreign = models.Negocio.objects.create(nombre='Dos', direccion='Otra',
            correo='dos@example.com', categoria=self.category)
        self.branch = models.Sucursal.objects.create(nombre='Centro', direccion='Centro',
            ciudad='Tijuana', negocio=self.business)
        self.other_branch = models.Sucursal.objects.create(nombre='Norte', direccion='Norte',
            ciudad='Tijuana', negocio=self.business)
        self.foreign_branch = models.Sucursal.objects.create(nombre='Ajena', direccion='Ajena',
            ciudad='Tijuana', negocio=self.foreign)
        models.UsuarioNegocio.objects.create(usuario=self.owner, negocio=self.business,
            rol_comercio='dueno')
        models.UsuarioNegocio.objects.create(usuario=self.manager, negocio=self.business,
            sucursal=self.branch, rol_comercio='admin')
        models.UsuarioNegocio.objects.create(usuario=self.employee, negocio=self.business,
            sucursal=self.branch, rol_comercio='empleado')
        self.program = models.Dinamica.objects.create(nombre='Sellos', tipo='sellos',
            meta=5, fecha_inicio=timezone.now(), fecha_fin=timezone.now() + timedelta(days=30),
            negocio=self.business)
        self.reward = models.Recompensa.objects.create(titulo='Café gratis',
            descripcion='Café', terminos_condiciones='Uno', negocio=self.business,
            dinamica=self.program, vigencia_dias=30)
        self.coupon = models.CuponUsuario.objects.create(usuario=self.consumer,
            recompensa=self.reward, negocio=self.business,
            fecha_expiracion=timezone.now() + timedelta(days=7))

    def auth(self, user):
        self.client.force_authenticate(user=user)

    def test_todas_las_rutas_api_requieren_identidad(self):
        for pattern in urls.urlpatterns:
            path = '/api/' + str(pattern.pattern)
            path = path.replace('<int:pk>', '1').replace('<uuid:uuid>', str(uuid4()))
            with self.subTest(path=path):
                self.assertEqual(self.client.get(path).status_code, 401)

    def test_header_malformado_es_401(self):
        for header in ('Basic secret', 'Bearer', 'Bearer uno dos'):
            self.client.credentials(HTTP_AUTHORIZATION=header)
            self.assertEqual(self.client.get('/api/v1/autenticacion/perfil/').status_code, 401)

    @patch('core.authentication.verify_token', side_effect=AuthUnavailable())
    def test_fallo_del_proveedor_es_503(self, verify):
        self.client.credentials(HTTP_AUTHORIZATION='Bearer test-token')
        self.assertEqual(self.client.get('/api/v1/autenticacion/perfil/').status_code, 503)

    @patch('core.authentication.verify_token', side_effect=AuthenticationFailed())
    def test_fallo_de_token_es_401(self, verify):
        self.client.credentials(HTTP_AUTHORIZATION='Bearer test-token')
        self.assertEqual(self.client.get('/api/v1/autenticacion/perfil/').status_code, 401)

    @patch('core.authentication.verify_token')
    def test_token_real_se_resuelve_a_usuario_local(self, verify):
        verify.return_value = SupabaseIdentity(self.consumer.supabase_uid, self.consumer.correo)
        self.client.credentials(HTTP_AUTHORIZATION='Bearer test-token')
        response = self.client.get('/api/v1/autenticacion/perfil/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['id'], self.consumer.pk)

    @patch('core.authentication.verify_token')
    def test_cuenta_local_desactivada_rechaza_token_valido(self, verify):
        self.consumer.is_active = False
        self.consumer.save()
        verify.return_value = SupabaseIdentity(self.consumer.supabase_uid, self.consumer.correo)
        self.client.credentials(HTTP_AUTHORIZATION='Bearer test-token')
        self.assertEqual(self.client.get('/api/v1/usuarios/listar/').status_code, 401)

    @patch('core.authentication.verify_token')
    def test_alta_solo_con_identidad_verificada(self, verify):
        identity = SupabaseIdentity(uuid4(), 'nuevo@example.com')
        verify.return_value = identity
        self.client.credentials(HTTP_AUTHORIZATION='Bearer test-token')
        self.assertEqual(self.client.get('/api/v1/negocios/listar/').status_code, 403)
        payload = {'nombre': 'Nuevo', 'apellido': 'Cliente'}
        self.assertEqual(self.client.post('/api/v1/usuario/crear/', payload).status_code, 201)
        user = models.Usuario.objects.get(supabase_uid=identity.uid)
        self.assertEqual(user.correo, identity.email)
        self.assertEqual(user.rol, 'consumidor')
        self.assertEqual(self.client.post('/api/v1/usuario/crear/', payload).status_code, 409)

    @patch('core.authentication.verify_token')
    def test_no_vincula_correo_existente_automaticamente(self, verify):
        verify.return_value = SupabaseIdentity(uuid4(), self.consumer.correo)
        self.client.credentials(HTTP_AUTHORIZATION='Bearer test-token')
        response = self.client.post('/api/v1/usuario/crear/', {'nombre': 'X', 'apellido': 'Y'})
        self.assertEqual(response.status_code, 409)

    def test_perfil_no_permite_escalar_rol_o_cambiar_identidad(self):
        self.auth(self.consumer)
        for field, value in (('rol', 'admin_sistema'), ('is_active', False),
                             ('supabase_uid', str(uuid4())), ('correo', 'otro@example.com')):
            with self.subTest(field=field):
                response = self.client.patch(f'/api/v1/usuario/actualizar/{self.consumer.pk}/',
                                             {field: value}, format='json')
                self.assertEqual(response.status_code, 400)

    def test_consumidor_solo_ve_sus_usuarios_y_cupones(self):
        self.auth(self.other)
        self.assertEqual([row['id'] for row in self.client.get('/api/v1/usuarios/listar/').data], [self.other.pk])
        self.assertEqual(self.client.get('/api/v1/cupones-usuario/listar/').data, [])
        self.assertEqual(self.client.get(f'/api/v1/cupon-usuario/detalle/{self.coupon.pk}/').status_code, 404)
        self.assertEqual(self.client.get(f'/api/v1/usuario/detalle/{self.consumer.pk}/').status_code, 404)

    def test_negocio_y_sucursal_ajenos_no_se_exponen(self):
        self.auth(self.owner)
        self.assertEqual([row['id'] for row in self.client.get('/api/v1/negocios/listar/').data], [self.business.pk])
        self.assertEqual(self.client.get(f'/api/v1/negocio/detalle/{self.foreign.pk}/').status_code, 404)
        self.auth(self.employee)
        rows = self.client.get('/api/v1/sucursales/listar/').data
        self.assertEqual([row['id'] for row in rows], [self.branch.pk])
        self.assertEqual(self.client.get(f'/api/v1/sucursal/detalle/{self.other_branch.pk}/').status_code, 404)

    def test_saldos_actividades_y_recompensas_se_aislan_por_negocio(self):
        foreign_program = models.Dinamica.objects.create(nombre='Ajena', tipo='sellos', meta=5,
            fecha_inicio=timezone.now(), fecha_fin=timezone.now() + timedelta(days=30), negocio=self.foreign)
        foreign_reward = models.Recompensa.objects.create(titulo='Ajena', descripcion='Ajena',
            terminos_condiciones='Otro', negocio=self.foreign,
            dinamica=foreign_program, vigencia_dias=30)
        models.CuponUsuario.objects.create(usuario=self.other, recompensa=foreign_reward,
            negocio=self.foreign, fecha_expiracion=timezone.now() + timedelta(days=7))
        progress = models.ProgresoUsuario.objects.create(usuario=self.consumer, dinamica=self.program)
        models.ProgresoUsuario.objects.create(usuario=self.other, dinamica=foreign_program)
        activity = models.RegistroActividad.objects.create(
            usuario=self.consumer, negocio=self.business, sucursal=self.branch,
            fecha_negocio=timezone.localdate(),
        )
        models.RegistroActividad.objects.create(
            usuario=self.other, negocio=self.foreign, sucursal=self.foreign_branch,
            fecha_negocio=timezone.localdate(),
        )
        self.auth(self.employee)
        for resource, expected in (('dinamicas', self.program.pk), ('recompensas', self.reward.pk),
                                   ('progresos-usuario', progress.pk), ('registros-actividad', activity.pk),
                                   ('cupones-usuario', self.coupon.pk)):
            with self.subTest(resource=resource):
                rows = self.client.get(f'/api/v1/{resource}/listar/').data
                self.assertEqual([row['id'] for row in rows], [expected])

    def test_facturacion_solo_es_visible_para_dueno_del_negocio(self):
        plan = models.PlanSuscripcion.objects.create(nombre='Plan', descripcion='Plan', stripe_price_id='price_test')
        subscription = models.Suscripcion.objects.create(stripe_subscription_id='sub_test',
            periodo_actual_inicio=timezone.now(), periodo_actual_fin=timezone.now() + timedelta(days=30),
            negocio=self.business, plan=plan)
        payment = models.Pago.objects.create(stripe_invoice_id='in_test', monto='99.00',
            negocio=self.business, suscripcion=subscription)
        for user, visible in ((self.owner, True), (self.manager, False), (self.employee, False),
                              (self.consumer, False)):
            self.auth(user)
            for resource, expected in (('suscripciones', subscription.pk), ('pagos', payment.pk)):
                with self.subTest(user=user.nombre, resource=resource):
                    ids = [row['id'] for row in self.client.get(f'/api/v1/{resource}/listar/').data]
                    self.assertEqual(ids, [expected] if visible else [])

    def test_admin_y_empleado_no_pueden_elevar_membresia(self):
        membership = models.UsuarioNegocio.objects.get(usuario=self.employee)
        path = f'/api/v1/usuario-negocio/actualizar/{membership.pk}/'
        for user in (self.manager, self.employee, self.owner):
            self.auth(user)
            self.assertEqual(self.client.patch(path, {'rol_comercio': 'dueno'}).status_code, 403)

    def test_canje_cliente_es_irreversible_y_solo_del_propietario(self):
        self.auth(self.other)
        ajeno = self.client.post(f'/api/v1/cupones/{self.coupon.uuid}/canjear/')
        self.assertEqual(ajeno.status_code, 403)
        self.assertEqual(ajeno.data['codigo'], 'cupon_ajeno')

        self.auth(self.consumer)
        propio = self.client.post(f'/api/v1/cupones/{self.coupon.uuid}/canjear/')
        self.assertEqual(propio.status_code, 200)
        self.assertEqual(propio.data['cupon']['status'], 'canjeado')
        repetido = self.client.post(f'/api/v1/cupones/{self.coupon.uuid}/canjear/')
        self.assertEqual(repetido.status_code, 409)
        self.assertEqual(repetido.data['codigo'], 'cupon_no_disponible')

    def test_no_puede_trasladar_dinamica_a_otro_negocio(self):
        self.auth(self.owner)
        response = self.client.patch(f'/api/v1/dinamica/actualizar/{self.program.pk}/',
                                     {'negocio': self.foreign.pk}, format='json')
        self.assertEqual(response.status_code, 403)

    def test_empleado_no_configura_programas_y_dueno_si(self):
        self.auth(self.employee)
        path = f'/api/v1/dinamica/actualizar/{self.program.pk}/'
        self.assertEqual(self.client.patch(path, {'nombre': 'Otro'}).status_code, 403)
        self.auth(self.owner)
        self.assertEqual(self.client.patch(path, {'nombre': 'Otro'}).status_code, 200)

    def test_no_puede_asignar_dueno_o_membresia_en_sucursal_ajena(self):
        self.auth(self.owner)
        path = '/api/v1/usuario-negocio/crear/'
        response = self.client.post(path, {'usuario': self.other.pk, 'negocio': self.business.pk,
                                           'rol_comercio': 'dueno'}, format='json')
        self.assertEqual(response.status_code, 403)
        response = self.client.post(path, {'usuario': self.other.pk, 'negocio': self.business.pk,
            'rol_comercio': 'empleado', 'sucursal': self.foreign_branch.pk}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_admin_sucursal_solo_asigna_empleados_de_su_sucursal(self):
        self.auth(self.manager)
        payload = {'usuario': self.other.pk, 'negocio': self.business.pk,
                   'sucursal': self.other_branch.pk, 'rol_comercio': 'empleado'}
        self.assertEqual(self.client.post('/api/v1/usuario-negocio/crear/', payload).status_code, 403)
        payload['sucursal'] = self.branch.pk
        self.assertEqual(self.client.post('/api/v1/usuario-negocio/crear/', payload).status_code, 201)
        self.other.refresh_from_db()
        self.assertEqual(self.other.rol, 'negocio')

    def test_crud_generico_de_canje_y_cupones_es_solo_lectura(self):
        self.auth(self.admin)
        self.assertEqual(self.client.post('/api/v1/canje/crear/', {}).status_code, 405)
        self.assertEqual(self.client.post('/api/v1/cupon-usuario/crear/', {}).status_code, 405)
        self.assertEqual(self.client.post('/api/v1/registro-actividad/crear/', {}).status_code, 405)
        self.assertEqual(self.client.post('/api/v1/progreso-usuario/crear/', {}).status_code, 405)

    def test_admin_sistema_gestiona_roles(self):
        path = f'/api/v1/usuario/rol/{self.consumer.pk}/'
        self.auth(self.owner)
        self.assertEqual(self.client.patch(path, {'rol': 'admin_sistema'}).status_code, 403)
        self.auth(self.admin)
        self.assertEqual(self.client.patch(path, {'rol': 'negocio'}).status_code, 200)

    def test_crear_negocio_crea_membresia_de_dueno(self):
        self.auth(self.consumer)
        response = self.client.post('/api/v1/negocio/crear/', {'nombre': 'Nuevo', 'direccion': 'Centro',
            'correo': 'nuevo-negocio@example.com', 'categoria': self.category.pk})
        self.assertEqual(response.status_code, 201)
        self.consumer.refresh_from_db()
        self.assertEqual(self.consumer.rol, 'negocio')
        self.assertTrue(models.UsuarioNegocio.objects.filter(usuario=self.consumer,
            negocio__nombre='Nuevo', rol_comercio='dueno', sucursal__isnull=True).exists())

    def test_notificaciones_solo_permiten_marcar_lectura(self):
        notification = models.Notificacion.objects.create(usuario=self.consumer, titulo='Aviso', cuerpo='Prueba')
        self.auth(self.consumer)
        path = f'/api/v1/notificacion/actualizar/{notification.pk}/'
        self.assertEqual(self.client.patch(path, {'cuerpo': 'Alterado'}).status_code, 403)
        self.assertEqual(self.client.patch(path, {'leida': True}, format='json').status_code, 200)
