"""Pruebas del registro comercial idempotente y su onboarding."""

import threading
from uuid import uuid4

from django.db import close_old_connections, connection, transaction
from django.test import TestCase, TransactionTestCase
from rest_framework.test import APIClient

from core import models
from core.authentication import SupabaseIdentity
from core.services import onboarding, planes
from core.tests.helpers import asegurar_planes, crear_negocio, crear_usuario


def identidad(metadata=None, email='nuevo-negocio@example.com', uid=None):
    return SupabaseIdentity(
        uid=uid or uuid4(),
        email=email,
        user_metadata=metadata or {},
    )


def metadata(nombre_negocio='Café Nuevo', nombre_completo='Ana María Pérez'):
    return {
        'benefy_tipo_registro': 'comercial',
        'benefy_nombre_negocio': nombre_negocio,
        'benefy_nombre_completo': nombre_completo,
    }


class OnboardingAPITests(TestCase):
    def setUp(self):
        asegurar_planes()
        self.client = APIClient()

    def completar(self, identity, usuario=None):
        self.client.force_authenticate(
            user=usuario or identity, token=identity,
        )
        return self.client.post('/api/v1/onboarding/comercial/', {}, format='json')

    def test_crea_perfil_negocio_dueno_y_free(self):
        identity = identidad(metadata())
        response = self.completar(identity)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['completado'])
        self.assertFalse(response.data['ya_existia'])

        usuario = models.Usuario.objects.get(supabase_uid=identity.uid)
        self.assertEqual(usuario.rol, 'consumidor')
        self.assertEqual(usuario.correo, identity.email)
        self.assertEqual(usuario.nombre, 'Ana María')
        self.assertEqual(usuario.apellido, 'Pérez')

        negocio = models.Negocio.objects.get(pk=response.data['negocio_id'])
        self.assertEqual(negocio.nombre, 'Café Nuevo')
        self.assertEqual(negocio.correo, identity.email)
        self.assertTrue(models.UsuarioNegocio.objects.filter(
            usuario=usuario, negocio=negocio, rol_comercio='dueno',
            sucursal__isnull=True, status=True,
        ).exists())
        suscripcion = planes.suscripcion_actual(negocio)
        self.assertEqual(suscripcion.plan.codigo, 'free')
        self.assertEqual(suscripcion.origen, 'automatico')

        registro = models.RegistroComercial.objects.get(supabase_uid=identity.uid)
        self.assertEqual(registro.estado, 'completado')
        self.assertEqual(registro.negocio_id, negocio.pk)
        self.assertEqual(registro.usuario_id, usuario.pk)
        self.assertEqual(
            response.data['contexto']['negocios'][0]['plan']['codigo'], 'free',
        )
        self.assertTrue(response.data['contexto']['puede_portal'])

    def test_es_idempotente_ante_reintentos(self):
        identity = identidad(metadata())
        primera = self.completar(identity)
        segunda = self.completar(identity)
        self.assertEqual(primera.status_code, 200)
        self.assertEqual(segunda.status_code, 200)
        self.assertTrue(segunda.data['ya_existia'])
        self.assertEqual(primera.data['negocio_id'], segunda.data['negocio_id'])
        self.assertEqual(models.Negocio.objects.count(), 1)
        self.assertEqual(models.Usuario.objects.count(), 1)
        self.assertEqual(models.UsuarioNegocio.objects.count(), 1)
        self.assertEqual(models.Suscripcion.objects.count(), 1)
        self.assertEqual(models.RegistroComercial.objects.count(), 1)

    def test_metadata_no_concede_permisos(self):
        identity = identidad({
            **metadata(),
            'rol': 'admin_sistema',
            'benefy_rol': 'admin_sistema',
            'membresias': [{'rol_comercio': 'dueno', 'negocio': 999}],
        })
        response = self.completar(identity)
        self.assertEqual(response.status_code, 200)
        usuario = models.Usuario.objects.get(supabase_uid=identity.uid)
        self.assertEqual(usuario.rol, 'consumidor')
        self.assertEqual(
            models.UsuarioNegocio.objects.filter(usuario=usuario).count(), 1,
        )

    def test_sin_registro_comercial_no_crea_nada(self):
        identity = identidad({})
        response = self.completar(identity)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['codigo'], 'sin_registro_comercial')
        self.assertFalse(models.Usuario.objects.filter(
            supabase_uid=identity.uid,
        ).exists())
        self.assertEqual(models.Negocio.objects.count(), 0)

    def test_metadata_incompleta_es_reintentable(self):
        identity = identidad({'benefy_tipo_registro': 'comercial'})
        response = self.completar(identity)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['codigo'], 'registro_incompleto')
        self.assertEqual(models.Negocio.objects.count(), 0)
        self.assertFalse(models.RegistroComercial.objects.exists())

    def test_completa_perfil_existente_sin_negocio(self):
        usuario = crear_usuario()
        nombre_original = usuario.nombre
        identity = SupabaseIdentity(
            uid=usuario.supabase_uid,
            email=usuario.correo,
            user_metadata=metadata(),
        )
        response = self.completar(identity, usuario)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(models.Usuario.objects.count(), 1)
        usuario.refresh_from_db()
        self.assertEqual(usuario.nombre, nombre_original)
        self.assertTrue(models.UsuarioNegocio.objects.filter(
            usuario=usuario, rol_comercio='dueno', status=True,
        ).exists())

    def test_dueno_existente_no_crea_segundo_negocio(self):
        usuario = crear_usuario()
        negocio = crear_negocio('Existente')
        models.UsuarioNegocio.objects.create(
            usuario=usuario, negocio=negocio, sucursal=None,
            rol_comercio='dueno',
        )
        identity = SupabaseIdentity(
            uid=usuario.supabase_uid,
            email=usuario.correo,
            user_metadata=metadata('Otro negocio'),
        )
        response = self.completar(identity, usuario)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['ya_existia'])
        self.assertEqual(response.data['negocio_id'], negocio.pk)
        self.assertEqual(models.Negocio.objects.count(), 1)

    def test_membresia_inactiva_no_crea_otro_negocio(self):
        usuario = crear_usuario()
        negocio = crear_negocio('Desactivado')
        models.UsuarioNegocio.objects.create(
            usuario=usuario, negocio=negocio, sucursal=None,
            rol_comercio='dueno', status=False,
        )
        identity = SupabaseIdentity(
            uid=usuario.supabase_uid,
            email=usuario.correo,
            user_metadata=metadata('No duplicar'),
        )
        response = self.completar(identity, usuario)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['ya_existia'])
        self.assertEqual(models.Negocio.objects.count(), 1)
        self.assertFalse(response.data['contexto']['puede_portal'])

    def test_perfil_previo_sin_uuid_no_se_vincula_por_correo(self):
        anterior = crear_usuario()
        anterior.supabase_uid = None
        anterior.save(update_fields=['supabase_uid'])
        identity = identidad(metadata(), email=anterior.correo)
        response = self.completar(identity)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['codigo'], 'perfil_requiere_vinculacion')
        anterior.refresh_from_db()
        self.assertIsNone(anterior.supabase_uid)
        self.assertNotEqual(anterior.supabase_uid, identity.uid)

    def test_correo_de_negocio_ajeno_es_conflicto(self):
        otro = crear_usuario()
        negocio = crear_negocio('Ajeno')
        negocio.correo = 'conflicto@example.com'
        negocio.save(update_fields=['correo'])
        models.UsuarioNegocio.objects.create(
            usuario=otro, negocio=negocio, sucursal=None, rol_comercio='dueno',
        )
        identity = identidad(metadata(), email='conflicto@example.com')
        response = self.completar(identity)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['codigo'], 'correo_negocio_en_uso')
        self.assertFalse(models.Usuario.objects.filter(
            supabase_uid=identity.uid,
        ).exists())

    def test_registro_legacy_con_nombre_y_negocio(self):
        identity = identidad({
            'nombre': 'Luis Gómez',
            'negocio': 'Fonda Luis',
        })
        response = self.completar(identity)
        self.assertEqual(response.status_code, 200)
        negocio = models.Negocio.objects.get(pk=response.data['negocio_id'])
        self.assertEqual(negocio.nombre, 'Fonda Luis')

    def test_segundo_negocio_por_api_se_rechaza(self):
        identity = identidad(metadata())
        self.completar(identity)
        usuario = models.Usuario.objects.get(supabase_uid=identity.uid)
        negocio_uno = models.Negocio.objects.get()

        categoria = models.CategoriaNegocio.objects.create(nombre='Segunda')
        self.client.force_authenticate(user=usuario)
        response = self.client.post('/api/v1/negocio/crear/', {
            'nombre': 'Café Dos',
            'direccion': 'Centro',
            'correo': 'cafe-dos@example.com',
            'categoria': categoria.pk,
        }, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('un solo negocio', str(response.data))
        self.assertEqual(models.Negocio.objects.count(), 1)
        self.assertEqual(models.Negocio.objects.get().pk, negocio_uno.pk)

        # Un nuevo intento del onboarding tampoco crea un segundo negocio.
        self.completar(identity, usuario)
        self.assertEqual(models.Negocio.objects.count(), 1)


class OnboardingConcurrenteTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        asegurar_planes()
        self.identity = identidad(metadata('Concurrente'))
        self.resultados = []
        self.errores = []

    def test_dos_solicitudes_crean_un_solo_negocio(self):
        if connection.vendor != 'postgresql':
            self.skipTest('La prueba de concurrencia requiere PostgreSQL.')

        barrier = threading.Barrier(2)

        def intentar(_indice):
            close_old_connections()
            try:
                barrier.wait(timeout=10)
                resultado = onboarding.completar_registro_comercial(
                    self.identity,
                )
                self.resultados.append(resultado.negocio.pk)
            except Exception as exc:  # pragma: no cover - diagnóstico
                self.errores.append(repr(exc))
            finally:
                close_old_connections()

        hilos = [threading.Thread(target=intentar, args=(i,)) for i in range(2)]
        for hilo in hilos:
            hilo.start()
        for hilo in hilos:
            hilo.join(timeout=20)

        self.assertEqual(self.errores, [])
        self.assertEqual(len(self.resultados), 2)
        self.assertEqual(len(set(self.resultados)), 1)
        self.assertEqual(models.Negocio.objects.count(), 1)
        self.assertEqual(models.Usuario.objects.count(), 1)
        self.assertEqual(models.UsuarioNegocio.objects.count(), 1)
        self.assertEqual(models.Suscripcion.objects.count(), 1)
        self.assertEqual(models.RegistroComercial.objects.count(), 1)
