"""Pruebas unitarias de los clientes Supabase del backend."""

import json
from http.client import HTTPMessage
from unittest.mock import MagicMock, patch
from urllib.error import HTTPError, URLError

from django.test import SimpleTestCase, override_settings

from core.services import supabase_admin, supabase_storage

SUPABASE_TEST = dict(
    SUPABASE_URL='https://project.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY='service-role-test',
    SUPABASE_STORAGE_BUCKET_AVATARS='avatars',
    SUPABASE_STORAGE_MAX_BYTES=5000,
    SUPABASE_STORAGE_ALLOWED_TYPES=('image/jpeg', 'image/png', 'image/webp'),
)


@override_settings(**SUPABASE_TEST)
class SupabaseAdminTests(SimpleTestCase):
    def opener(self, status=204):
        opener = MagicMock()
        response = MagicMock()
        response.status = status
        opener.open.return_value.__enter__.return_value = response
        return opener

    def test_elimina_identidad_con_service_role(self):
        opener = self.opener()
        with patch.object(supabase_admin, 'build_opener', return_value=opener):
            self.assertTrue(supabase_admin.eliminar_usuario('3f1c2a9e-8f4b-4f2a-9c1d-2b7e6a5d4c3b'))
        request = opener.open.call_args.args[0]
        self.assertEqual(request.get_method(), 'DELETE')
        self.assertTrue(request.full_url.endswith(
            '/auth/v1/admin/users/3f1c2a9e-8f4b-4f2a-9c1d-2b7e6a5d4c3b',
        ))
        self.assertEqual(
            request.get_header('Authorization'), 'Bearer service-role-test',
        )
        self.assertEqual(request.get_header('Apikey'), 'service-role-test')

    def test_identidad_inexistente_es_idempotente(self):
        opener = self.opener()
        opener.open.side_effect = HTTPError(
            'https://project.supabase.co', 404, 'not found', {}, None,
        )
        with patch.object(supabase_admin, 'build_opener', return_value=opener):
            self.assertFalse(supabase_admin.eliminar_usuario('uid'))

    def test_error_http_y_red_se_reportan(self):
        for error in (
            HTTPError('https://project.supabase.co', 500, 'error', {}, None),
            URLError('offline'),
        ):
            opener = self.opener()
            opener.open.side_effect = error
            with self.subTest(error=type(error).__name__):
                with patch.object(supabase_admin, 'build_opener', return_value=opener):
                    with self.assertRaises(supabase_admin.ErrorSupabaseAdmin):
                        supabase_admin.eliminar_usuario('uid')

    @override_settings(SUPABASE_SERVICE_ROLE_KEY='')
    def test_sin_service_role_falla_cerrado(self):
        with self.assertRaises(supabase_admin.SupabaseAdminNoConfigurado):
            supabase_admin.eliminar_usuario('uid')


@override_settings(**SUPABASE_TEST)
class SupabaseStorageTests(SimpleTestCase):
    uid = '3f1c2a9e-8f4b-4f2a-9c1d-2b7e6a5d4c3b'
    url = (
        'https://project.supabase.co/storage/v1/object/public/avatars/'
        f'{uid}/perfil.jpg'
    )

    def opener(self, content_type='image/jpeg', content_length='1200'):
        opener = MagicMock()
        response = MagicMock()
        response.headers = {
            'Content-Type': content_type,
            'Content-Length': content_length,
        }
        opener.open.return_value.__enter__.return_value = response
        return opener

    def test_valida_url_metadata_y_metodo_head(self):
        opener = self.opener()
        with patch.object(supabase_storage, 'build_opener', return_value=opener):
            self.assertEqual(
                supabase_storage.validar_foto_perfil(self.url, self.uid), self.url,
            )
        request = opener.open.call_args.args[0]
        self.assertEqual(request.get_method(), 'HEAD')
        self.assertEqual(request.full_url, self.url)

    def test_rechaza_otro_bucket_host_o_carpeta(self):
        invalidas = (
            self.url.replace('/avatars/', '/otros/'),
            self.url.replace('project.supabase.co', 'evil.example.com'),
            self.url.replace(f'/{self.uid}/', '/otro-uid/'),
            self.url.replace('https://', 'http://'),
        )
        for url in invalidas:
            with self.subTest(url=url):
                with self.assertRaises(supabase_storage.FotoPerfilInvalida):
                    supabase_storage.validar_foto_perfil(url, self.uid)

    def test_rechaza_tipo_tamano_o_metadata_invalida(self):
        casos = (
            ('text/html', '1200'),
            ('image/jpeg', '6000'),
            ('image/jpeg', ''),
            ('image/jpeg', '0'),
        )
        for content_type, length in casos:
            with self.subTest(content_type=content_type, length=length):
                opener = self.opener(content_type, length)
                with patch.object(supabase_storage, 'build_opener', return_value=opener):
                    with self.assertRaises(supabase_storage.FotoPerfilInvalida):
                        supabase_storage.validar_foto_perfil(self.url, self.uid)

    def test_rechaza_objeto_inexistente(self):
        opener = self.opener()
        opener.open.side_effect = HTTPError(self.url, 404, 'not found', HTTPMessage(), None)
        with patch.object(supabase_storage, 'build_opener', return_value=opener):
            with self.assertRaises(supabase_storage.FotoPerfilInvalida):
                supabase_storage.validar_foto_perfil(self.url, self.uid)


@override_settings(**SUPABASE_TEST)
class SupabaseStorageLimpiezaTests(SimpleTestCase):
    uid = '3f1c2a9e-8f4b-4f2a-9c1d-2b7e6a5d4c3b'

    def response(self, payload, status=200):
        response = MagicMock()
        response.status = status
        response.read.return_value = (
            json.dumps(payload).encode('utf-8') if payload is not None else b''
        )
        context = MagicMock()
        context.__enter__.return_value = response
        return context

    def test_limpia_solo_la_carpeta_del_usuario(self):
        opener = MagicMock()
        opener.open.side_effect = [
            self.response([{'name': 'foto.jpg'}, {'name': 'otra.png'}]),
            self.response([]),
            self.response([]),
        ]
        with patch.object(supabase_storage, 'build_opener', return_value=opener):
            self.assertTrue(supabase_storage.eliminar_avatar(self.uid))

        listado = opener.open.call_args_list[0].args[0]
        self.assertTrue(listado.full_url.endswith('/storage/v1/object/list/avatars'))
        self.assertEqual(
            json.loads(listado.data.decode('utf-8'))['prefix'], self.uid,
        )

        borrado = opener.open.call_args_list[1].args[0]
        self.assertTrue(borrado.full_url.endswith('/storage/v1/object/avatars'))
        self.assertEqual(
            json.loads(borrado.data.decode('utf-8'))['prefixes'],
            [f'{self.uid}/foto.jpg', f'{self.uid}/otra.png'],
        )

    def test_listado_ajeno_se_prefija_con_el_uid_autenticado(self):
        opener = MagicMock()
        opener.open.side_effect = [
            self.response([{'name': 'otro-uid/foto.jpg'}]),
            self.response([]),
            self.response([]),
        ]
        with patch.object(supabase_storage, 'build_opener', return_value=opener):
            supabase_storage.eliminar_avatar(self.uid)
        borrado = opener.open.call_args_list[1].args[0]
        self.assertEqual(
            json.loads(borrado.data.decode('utf-8'))['prefixes'],
            [f'{self.uid}/otro-uid/foto.jpg'],
        )

    @override_settings(SUPABASE_SERVICE_ROLE_KEY='')
    def test_sin_service_role_falla_cerrado(self):
        with self.assertRaises(supabase_storage.SupabaseStorageNoConfigurado):
            supabase_storage.eliminar_avatar(self.uid)
