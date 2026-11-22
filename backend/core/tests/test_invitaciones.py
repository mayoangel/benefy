"""Pruebas de invitaciones, aceptación y protección del último propietario."""

from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APIClient

from core import models
from core.services import invitaciones, membresias
from core.tests.helpers import (
    asegurar_planes,
    crear_negocio,
    crear_sucursal,
    crear_usuario,
)
from django.test import TestCase


class InvitacionBaseTests(TestCase):
    def setUp(self):
        asegurar_planes()
        self.owner = crear_usuario()
        self.supervisor = crear_usuario()
        self.employee = crear_usuario()
        self.other = crear_usuario()
        self.admin = crear_usuario(rol='admin_sistema')
        self.business = crear_negocio('Invitaciones')
        self.branch = crear_sucursal(self.business, 'Centro')
        self.other_branch = crear_sucursal(self.business, 'Norte')
        models.UsuarioNegocio.objects.create(
            usuario=self.owner, negocio=self.business,
            sucursal=None, rol_comercio='dueno',
        )
        models.UsuarioNegocio.objects.create(
            usuario=self.supervisor, negocio=self.business,
            sucursal=self.branch, rol_comercio='supervisor',
        )
        self.client = APIClient()

    def auth(self, user):
        self.client.force_authenticate(user=user)

    def invitar(self, correo, rol='empleado', sucursal=None, actor=None):
        self.auth(actor or self.owner)
        return self.client.post(
            f'/api/v1/negocios/{self.business.pk}/invitaciones/',
            {
                'correo': correo,
                'rol_comercio': rol,
                'sucursal': sucursal.pk if sucursal else None,
            },
            format='json',
        )

    def aceptar(self, token, user=None):
        self.auth(user or self.employee)
        return self.client.post(
            f'/api/v1/invitaciones/{token}/aceptar/', {}, format='json',
        )


class InvitacionAPITests(InvitacionBaseTests):
    def test_invitacion_no_crea_membresia_hasta_aceptar(self):
        response = self.invitar(self.employee.correo, sucursal=self.branch)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['estado'], 'pendiente')
        self.assertFalse(models.UsuarioNegocio.objects.filter(
            usuario=self.employee, negocio=self.business,
        ).exists())

        self.auth(self.employee)
        detalle = self.client.get(
            f"/api/v1/invitaciones/{response.data['token']}/",
        )
        self.assertEqual(detalle.status_code, 200)
        self.assertEqual(detalle.data['negocio']['id'], self.business.pk)

        aceptada = self.aceptar(response.data['token'])
        self.assertEqual(aceptada.status_code, 200)
        self.assertTrue(aceptada.data['aceptada'])
        self.assertTrue(models.UsuarioNegocio.objects.filter(
            usuario=self.employee, negocio=self.business,
            sucursal=self.branch, rol_comercio='empleado', status=True,
        ).exists())
        self.assertTrue(models.AuditoriaMembresia.objects.filter(
            usuario=self.employee, negocio=self.business, accion='alta',
        ).exists())

    def test_correo_distinto_no_puede_aceptar(self):
        response = self.invitar(self.employee.correo, sucursal=self.branch)
        resultado = self.aceptar(response.data['token'], self.other)
        self.assertEqual(resultado.status_code, 403)
        self.assertEqual(resultado.data['codigo'], 'correo_no_coincide')
        self.assertFalse(models.UsuarioNegocio.objects.filter(
            usuario=self.other,
        ).exists())

    def test_invitacion_revocada_no_se_acepta(self):
        response = self.invitar(self.employee.correo, sucursal=self.branch)
        self.auth(self.owner)
        revocada = self.client.post(
            f"/api/v1/invitaciones/{response.data['token']}/revocar/",
            {}, format='json',
        )
        self.assertEqual(revocada.status_code, 200)
        self.assertEqual(revocada.data['estado'], 'revocada')
        resultado = self.aceptar(response.data['token'])
        self.assertEqual(resultado.status_code, 409)

    def test_invitacion_expirada(self):
        response = self.invitar(self.employee.correo, sucursal=self.branch)
        invitacion = models.InvitacionMembresia.objects.get(
            token=response.data['token'],
        )
        invitacion.fecha_expiracion = timezone.now() - timedelta(minutes=1)
        invitacion.save(update_fields=['fecha_expiracion'])
        resultado = self.aceptar(response.data['token'])
        self.assertEqual(resultado.status_code, 409)
        self.assertEqual(resultado.data['codigo'], 'invitacion_expirada')

    def test_no_duplica_invitacion_pendiente(self):
        self.invitar(self.employee.correo, sucursal=self.branch)
        response = self.invitar(self.employee.correo, sucursal=self.branch)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['codigo'], 'invitacion_pendiente')

    def test_empleado_no_puede_invitar(self):
        response = self.invitar(
            self.other.correo, sucursal=self.branch, actor=self.employee,
        )
        self.assertEqual(response.status_code, 403)

    def test_supervisor_solo_invita_en_su_sucursal(self):
        response = self.invitar(
            self.other.correo, sucursal=self.other_branch,
            actor=self.supervisor,
        )
        self.assertEqual(response.status_code, 403)
        permitida = self.invitar(
            self.other.correo, sucursal=self.branch, actor=self.supervisor,
        )
        self.assertEqual(permitida.status_code, 201)

    def test_solo_admin_invita_propietario(self):
        response = self.invitar(
            self.other.correo, rol='dueno', actor=self.owner,
        )
        self.assertEqual(response.status_code, 403)
        admin = self.invitar(
            self.other.correo, rol='dueno', actor=self.admin,
        )
        self.assertEqual(admin.status_code, 201)
        aceptada = self.aceptar(admin.data['token'], self.other)
        self.assertEqual(aceptada.status_code, 200)
        self.assertTrue(models.UsuarioNegocio.objects.filter(
            usuario=self.other, negocio=self.business,
            rol_comercio='dueno', sucursal__isnull=True, status=True,
        ).exists())

    def test_limite_de_plan_al_invitar(self):
        self.invitar(self.employee.correo, sucursal=self.branch)
        # Free permite un supervisor activo; el existente ya ocupa el cupo.
        response = self.invitar(
            self.other.correo, rol='supervisor', sucursal=self.branch,
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data['codigo'], 'limite_plan')

    def test_limite_al_aceptar_si_se_ocupo_el_cupo(self):
        response = self.invitar(self.employee.correo, sucursal=self.branch)
        for _indice in range(3):
            models.UsuarioNegocio.objects.create(
                usuario=crear_usuario(), negocio=self.business,
                sucursal=self.other_branch, rol_comercio='empleado', status=True,
            )
        resultado = self.aceptar(response.data['token'])
        self.assertEqual(resultado.status_code, 403)
        self.assertEqual(resultado.data['codigo'], 'limite_plan')

    def test_listado_para_supervisor_solo_su_sucursal(self):
        self.invitar(self.employee.correo, sucursal=self.branch)
        self.invitar(
            self.other.correo, sucursal=self.other_branch,
        )
        self.auth(self.supervisor)
        response = self.client.get(
            f'/api/v1/negocios/{self.business.pk}/invitaciones/',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['sucursal']['id'], self.branch.pk)

    def test_aceptacion_idempotente(self):
        response = self.invitar(self.employee.correo, sucursal=self.branch)
        primera = self.aceptar(response.data['token'])
        segunda = self.aceptar(response.data['token'])
        self.assertEqual(primera.status_code, 200)
        self.assertEqual(segunda.status_code, 200)
        self.assertEqual(
            models.UsuarioNegocio.objects.filter(
                usuario=self.employee, negocio=self.business,
            ).count(),
            1,
        )


class UltimoPropietarioTests(InvitacionBaseTests):
    def test_no_desactiva_al_ultimo_propietario(self):
        membresia = models.UsuarioNegocio.objects.get(
            usuario=self.owner, negocio=self.business, rol_comercio='dueno',
        )
        with self.assertRaises(membresias.ErrorMembresia):
            membresias.desactivar_membresia(
                membresia=membresia, actor=self.owner,
            )

    def test_no_degrada_al_ultimo_propietario(self):
        membresia = models.UsuarioNegocio.objects.get(
            usuario=self.owner, negocio=self.business, rol_comercio='dueno',
        )
        with self.assertRaises(membresias.ErrorMembresia):
            membresias.actualizar_membresia(
                membresia=membresia,
                cambios={'rol_comercio': 'empleado', 'sucursal': self.branch},
                actor=self.owner,
            )

    def test_permite_si_existe_otro_propietario(self):
        models.UsuarioNegocio.objects.create(
            usuario=self.other, negocio=self.business,
            sucursal=None, rol_comercio='dueno',
        )
        membresia = models.UsuarioNegocio.objects.get(
            usuario=self.owner, negocio=self.business, rol_comercio='dueno',
        )
        membresias.desactivar_membresia(membresia=membresia, actor=self.owner)
        membresia.refresh_from_db()
        self.assertFalse(membresia.status)

    def test_api_rechaza_baja_del_ultimo_propietario(self):
        membresia = models.UsuarioNegocio.objects.get(
            usuario=self.owner, negocio=self.business, rol_comercio='dueno',
        )
        self.auth(self.admin)
        response = self.client.delete(
            f'/api/v1/usuario-negocio/eliminar/{membresia.pk}/',
        )
        self.assertEqual(response.status_code, 400)
        membresia.refresh_from_db()
        self.assertTrue(membresia.status)
