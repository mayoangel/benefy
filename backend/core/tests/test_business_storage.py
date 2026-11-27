import json
from unittest.mock import MagicMock, patch
from uuid import uuid4

from django.test import SimpleTestCase, TestCase, override_settings
from rest_framework.test import APIClient

from core import models
from core.services import supabase_storage
from core.tests.helpers import crear_negocio, crear_usuario


STORAGE_SETTINGS = {
    'SUPABASE_URL': 'https://project.supabase.co',
    'SUPABASE_SERVICE_ROLE_KEY': 'service-role-test',
    'SUPABASE_STORAGE_BUCKET_BUSINESS_ASSETS': 'business-assets',
    'SUPABASE_STORAGE_MAX_BYTES': 5000,
    'SUPABASE_STORAGE_ALLOWED_TYPES': (
        'image/jpeg', 'image/png', 'image/webp',
    ),
}


@override_settings(**STORAGE_SETTINGS)
class SubidaFirmadaImagenNegocioTests(SimpleTestCase):
    def test_crea_subida_limitada_a_bucket_y_ruta_del_negocio(self):
        identificador = uuid4().hex
        response = MagicMock()
        response.read.return_value = json.dumps({
            'url': (
                '/object/upload/sign/business-assets/'
                f'businesses/42/logo/{identificador}.webp'
                '?token=upload-token'
            ),
        }).encode()
        opener = MagicMock()
        opener.open.return_value.__enter__.return_value = response

        with (
            patch.object(supabase_storage.uuid, 'uuid4') as crear_uuid,
            patch.object(supabase_storage, 'build_opener', return_value=opener),
        ):
            crear_uuid.return_value.hex = identificador
            resultado = supabase_storage.crear_subida_firmada_negocio(
                42, 'logo', 'image/webp', 1200,
            )

        request = opener.open.call_args.args[0]
        self.assertEqual(request.get_method(), 'POST')
        self.assertTrue(request.full_url.startswith(
            'https://project.supabase.co/storage/v1/object/upload/sign/'
            'business-assets/businesses/42/logo/',
        ))
        self.assertEqual(request.get_header('Authorization'), 'Bearer service-role-test')
        self.assertEqual(resultado['bucket'], 'business-assets')
        self.assertEqual(
            resultado['path'],
            f'businesses/42/logo/{identificador}.webp',
        )
        self.assertEqual(resultado['token'], 'upload-token')
        self.assertTrue(resultado['public_url'].startswith(
            'https://project.supabase.co/storage/v1/object/public/business-assets/'
            'businesses/42/logo/',
        ))
        self.assertEqual(resultado['expires_in'], 7200)

    def test_rechaza_respuesta_sin_token(self):
        response = MagicMock()
        response.read.return_value = json.dumps({
            'url': '/object/upload/sign/business-assets/path',
        }).encode()
        opener = MagicMock()
        opener.open.return_value.__enter__.return_value = response

        with patch.object(supabase_storage, 'build_opener', return_value=opener):
            with self.assertRaises(supabase_storage.ErrorSupabaseStorage):
                supabase_storage.crear_subida_firmada_negocio(
                    42, 'logo', 'image/webp', 1200,
                )

    def test_valida_url_y_metadata_de_imagen_del_negocio(self):
        filename = f'{uuid4().hex}.webp'
        url = (
            'https://project.supabase.co/storage/v1/object/public/business-assets/'
            f'businesses/42/banner/{filename}'
        )
        response = MagicMock()
        response.headers = {
            'Content-Type': 'image/webp',
            'Content-Length': '1200',
        }
        opener = MagicMock()
        opener.open.return_value.__enter__.return_value = response

        with patch.object(supabase_storage, 'build_opener', return_value=opener):
            self.assertEqual(
                supabase_storage.validar_imagen_negocio(url, 42, 'banner'),
                url,
            )
        self.assertEqual(
            opener.open.call_args.args[0].get_method(),
            'HEAD',
        )

    def test_rechaza_ruta_ajena_y_mime_que_no_coincide(self):
        filename = f'{uuid4().hex}.png'
        base = (
            'https://project.supabase.co/storage/v1/object/public/business-assets/'
        )
        invalidas = (
            (f'{base}businesses/43/logo/{filename}', 42, 'logo'),
            (f'{base}businesses/42/banner/{filename}', 42, 'logo'),
            (f'{base}businesses/42/logo/{filename}?token=bad', 42, 'logo'),
        )
        for url, business_id, tipo in invalidas:
            with self.subTest(url=url):
                with self.assertRaises(supabase_storage.ImagenNegocioInvalida):
                    supabase_storage.validar_imagen_negocio(url, business_id, tipo)

        response = MagicMock()
        response.headers = {
            'Content-Type': 'image/jpeg',
            'Content-Length': '1200',
        }
        opener = MagicMock()
        opener.open.return_value.__enter__.return_value = response
        url = f'{base}businesses/42/logo/{filename}'
        with patch.object(supabase_storage, 'build_opener', return_value=opener):
            with self.assertRaises(supabase_storage.ImagenNegocioInvalida):
                supabase_storage.validar_imagen_negocio(url, 42, 'logo')

    @override_settings(SUPABASE_SERVICE_ROLE_KEY='')
    def test_falla_cerrado_sin_service_role(self):
        with self.assertRaises(supabase_storage.SupabaseStorageNoConfigurado):
            supabase_storage.crear_subida_firmada_negocio(
                42, 'logo', 'image/webp', 1200,
            )


@override_settings(**STORAGE_SETTINGS)
class APIImagenNegocioTests(TestCase):
    def setUp(self):
        self.owner = crear_usuario()
        self.other_owner = crear_usuario()
        self.member = crear_usuario()
        self.consumer = crear_usuario()
        self.business = crear_negocio()
        models.UsuarioNegocio.objects.create(
            usuario=self.owner,
            negocio=self.business,
            rol_comercio='dueno',
        )
        branch = models.Sucursal.objects.create(
            nombre='Sucursal',
            direccion='Centro',
            ciudad='Tijuana',
            negocio=self.business,
        )
        models.UsuarioNegocio.objects.create(
            usuario=self.member,
            negocio=self.business,
            sucursal=branch,
            rol_comercio='empleado',
        )
        self.client = APIClient()
        self.url = f'/api/v1/negocios/{self.business.pk}/imagenes/subida/'

    def test_dueno_solicita_url_firmada(self):
        self.client.force_authenticate(self.owner)
        resultado = {
            'bucket': 'business-assets',
            'path': f'businesses/{self.business.pk}/logo/id.webp',
            'token': 'signed-token',
            'public_url': (
                'https://project.supabase.co/storage/v1/object/public/'
                f'business-assets/businesses/{self.business.pk}/logo/id.webp'
            ),
            'content_type': 'image/webp',
            'max_bytes': 5000,
            'expires_in': 7200,
        }
        with patch(
            'core.services.supabase_storage.crear_subida_firmada_negocio',
            return_value=resultado,
        ) as crear:
            response = self.client.post(
                self.url,
                {
                    'tipo': 'logo',
                    'content_type': 'image/webp',
                    'size_bytes': 1200,
                },
                format='json',
            )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data, resultado)
        crear.assert_called_once_with(
            negocio_id=self.business.pk,
            tipo='logo',
            content_type='image/webp',
            size_bytes=1200,
        )

    def test_miembro_y_consumidor_no_pueden_solicitar_subida(self):
        for user in (self.member, self.consumer, self.other_owner):
            with self.subTest(user=user.pk):
                self.client.force_authenticate(user)
                response = self.client.post(
                    self.url,
                    {
                        'tipo': 'logo',
                        'content_type': 'image/webp',
                        'size_bytes': 1200,
                    },
                    format='json',
                )
                self.assertEqual(response.status_code, 403)

    def test_rechaza_tipo_y_tamano_invalidos(self):
        self.client.force_authenticate(self.owner)
        for payload in (
            {
                'tipo': 'avatar',
                'content_type': 'image/webp',
                'size_bytes': 1200,
            },
            {
                'tipo': 'logo',
                'content_type': 'image/gif',
                'size_bytes': 1200,
            },
            {
                'tipo': 'banner',
                'content_type': 'image/png',
                'size_bytes': 5001,
            },
        ):
            with self.subTest(payload=payload):
                response = self.client.post(self.url, payload, format='json')
                self.assertEqual(response.status_code, 400)

    def test_actualizacion_valida_imagen_de_su_bucket_y_negocio(self):
        self.client.force_authenticate(self.owner)
        url = (
            'https://project.supabase.co/storage/v1/object/public/business-assets/'
            f'businesses/{self.business.pk}/logo/{uuid4().hex}.webp'
        )
        with patch(
            'core.services.supabase_storage.validar_imagen_negocio',
            return_value=url,
        ) as validar:
            response = self.client.patch(
                f'/api/v1/negocio/actualizar/{self.business.pk}/',
                {'logo_url': url},
                format='json',
            )

        self.assertEqual(response.status_code, 200)
        self.business.refresh_from_db()
        self.assertEqual(self.business.logo_url, url)
        validar.assert_called_once_with(url, self.business.pk, 'logo')

    def test_actualizacion_rechaza_url_que_no_es_de_storage_del_negocio(self):
        self.client.force_authenticate(self.owner)
        response = self.client.patch(
            f'/api/v1/negocio/actualizar/{self.business.pk}/',
            {'logo_url': 'https://example.com/logo.jpg'},
            format='json',
        )
        self.assertEqual(response.status_code, 400)
