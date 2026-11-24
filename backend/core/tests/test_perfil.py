"""Pruebas del contrato de perfil propio y del alta de consumidores."""

from unittest.mock import patch
from uuid import uuid4

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from core import models
from core.authentication import SupabaseIdentity
from core.tests.helpers import crear_usuario

SUPABASE_TEST = dict(
    SUPABASE_URL='https://project.supabase.co',
    SUPABASE_PUBLISHABLE_KEY='public-test-key',
)


@override_settings(**SUPABASE_TEST)
class PerfilPropioTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = crear_usuario()
        self.other = crear_usuario()
        self.client.force_authenticate(self.user)

    def patch(self, payload):
        return self.client.patch(
            '/api/v1/autenticacion/perfil/', payload, format='json',
        )

    def test_actualiza_campos_permitidos(self):
        response = self.patch({
            'nombre': 'Ana',
            'apellido': 'López',
            'telefono': '6641234567',
        })
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.nombre, 'Ana')
        self.assertEqual(self.user.apellido, 'López')
        self.assertEqual(self.user.telefono, '6641234567')
        self.assertEqual(response.data['correo'], self.user.correo)

    def test_rechaza_campos_de_identidad_o_privilegios(self):
        for field, value in (
            ('correo', 'otro@example.com'),
            ('rol', 'admin_sistema'),
            ('supabase_uid', str(uuid4())),
            ('is_active', False),
            ('qr_token', str(uuid4())),
        ):
            with self.subTest(field=field):
                response = self.patch({field: value})
                self.assertEqual(response.status_code, 400)
        self.user.refresh_from_db()
        self.assertEqual(self.user.rol, 'consumidor')
        self.assertTrue(self.user.is_active)
        self.assertNotEqual(self.user.correo, 'otro@example.com')

    def test_valida_telefono_del_modelo(self):
        response = self.patch({'telefono': 'x' * 21})
        self.assertEqual(response.status_code, 400)

    def test_permite_limpiar_telefono_y_foto(self):
        response = self.patch({'telefono': '', 'foto_perfil': ''})
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.telefono, '')
        self.assertEqual(self.user.foto_perfil, '')

    def test_valida_foto_de_supabase(self):
        url = (
            'https://project.supabase.co/storage/v1/object/public/avatars/'
            f'{self.user.supabase_uid}/perfil.jpg'
        )
        with patch(
            'core.services.supabase_storage.validar_foto_perfil',
            return_value=url,
        ) as validar:
            response = self.patch({'foto_perfil': url})
        self.assertEqual(response.status_code, 200)
        validar.assert_called_once_with(url, self.user.supabase_uid)
        self.user.refresh_from_db()
        self.assertEqual(self.user.foto_perfil, url)

    def test_rechaza_foto_local_o_externa(self):
        for url in (
            'file:///data/user/0/cache/foto.jpg',
            'https://example.com/foto.jpg',
            'http://project.supabase.co/storage/v1/object/public/avatars/x/foto.jpg',
        ):
            with self.subTest(url=url):
                response = self.patch({'foto_perfil': url})
                self.assertEqual(response.status_code, 400)
        self.user.refresh_from_db()
        self.assertIsNone(self.user.foto_perfil)

    def test_patch_generico_sigue_funcionando(self):
        response = self.client.patch(
            f'/api/v1/usuario/actualizar/{self.user.pk}/',
            {'nombre': 'Nombre genérico'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.nombre, 'Nombre genérico')

    def test_no_edita_el_perfil_de_otro_usuario(self):
        response = self.client.patch(
            f'/api/v1/usuario/actualizar/{self.other.pk}/',
            {'nombre': 'Intruso'},
            format='json',
        )
        self.assertEqual(response.status_code, 404)
        self.other.refresh_from_db()
        self.assertNotEqual(self.other.nombre, 'Intruso')


@override_settings(**SUPABASE_TEST)
class AltaConsumidorTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def identity(self, email='nuevo@example.com'):
        return SupabaseIdentity(uid=uuid4(), email=email)

    def test_alta_ignora_roles_y_no_duplica(self):
        identity = self.identity()
        self.client.force_authenticate(user=identity, token=identity)
        response = self.client.post('/api/v1/usuario/crear/', {
            'nombre': 'Nuevo',
            'apellido': 'Cliente',
            'rol': 'admin_sistema',
        }, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertFalse(models.Usuario.objects.filter(supabase_uid=identity.uid).exists())

        response = self.client.post('/api/v1/usuario/crear/', {
            'nombre': 'Nuevo',
            'apellido': 'Cliente',
        }, format='json')
        self.assertEqual(response.status_code, 201)
        user = models.Usuario.objects.get(supabase_uid=identity.uid)
        self.assertEqual(user.rol, 'consumidor')
        self.assertEqual(models.Usuario.objects.filter(supabase_uid=identity.uid).count(), 1)

        response = self.client.post('/api/v1/usuario/crear/', {
            'nombre': 'Otro',
            'apellido': 'Cliente',
        }, format='json')
        self.assertEqual(response.status_code, 409)

    def test_no_vincula_por_correo_existente(self):
        existente = crear_usuario()
        identity = self.identity(email=existente.correo)
        self.client.force_authenticate(user=identity, token=identity)
        response = self.client.post('/api/v1/usuario/crear/', {
            'nombre': 'Nuevo',
            'apellido': 'Cliente',
        }, format='json')
        self.assertEqual(response.status_code, 409)
        self.assertEqual(models.Usuario.objects.filter(correo=existente.correo).count(), 1)
