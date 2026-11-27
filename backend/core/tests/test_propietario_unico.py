"""Regresión: una cuenta solo puede ser propietaria de un negocio activo."""

from io import StringIO

from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import IntegrityError, transaction
from django.test import TestCase
from rest_framework.test import APIClient

from core import models
from core.services import membresias
from core.tests.helpers import (
    asegurar_planes,
    crear_negocio,
    crear_sucursal,
    crear_usuario,
)


class PropietarioUnicoTests(TestCase):
    def setUp(self):
        asegurar_planes()
        self.client = APIClient()
        self.owner = crear_usuario()
        self.other_owner = crear_usuario()
        self.employee = crear_usuario()
        self.admin = crear_usuario(rol='admin_sistema')
        self.business = crear_negocio('Principal')
        self.other_business = crear_negocio('Secundario')
        self.third_business = crear_negocio('Tercero')
        self.branch = crear_sucursal(self.business, 'Centro')
        self.other_branch = crear_sucursal(self.other_business, 'Norte')
        self.third_branch = crear_sucursal(self.third_business, 'Sur')
        models.UsuarioNegocio.objects.create(
            usuario=self.owner,
            negocio=self.business,
            sucursal=None,
            rol_comercio='dueno',
        )
        models.UsuarioNegocio.objects.create(
            usuario=self.other_owner,
            negocio=self.other_business,
            sucursal=None,
            rol_comercio='dueno',
        )
        models.UsuarioNegocio.objects.create(
            usuario=self.other_owner,
            negocio=self.third_business,
            sucursal=None,
            rol_comercio='dueno',
            status=False,
        )

    def test_dueno_no_puede_crear_segundo_negocio_por_api(self):
        self.client.force_authenticate(self.owner)
        response = self.client.post('/api/v1/negocio/crear/', {
            'nombre': 'Intento duplicado',
            'direccion': 'Centro',
            'correo': 'intento@example.com',
            'categoria': self.business.categoria_id,
        }, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('un solo negocio', str(response.data))
        self.assertEqual(
            models.Negocio.objects.filter(nombre='Intento duplicado').count(), 0,
        )

    def test_admin_no_puede_asignar_segunda_propiedad_al_mismo_usuario(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post('/api/v1/usuario-negocio/crear/', {
            'usuario': self.owner.pk,
            'negocio': self.other_business.pk,
            'sucursal': None,
            'rol_comercio': 'dueno',
        }, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('un solo negocio', str(response.data))
        self.assertFalse(models.UsuarioNegocio.objects.filter(
            usuario=self.owner,
            negocio=self.other_business,
            rol_comercio='dueno',
            sucursal__isnull=True,
        ).exists())

    def test_no_puede_promover_a_dueno_si_ya_tiene_propiedad(self):
        employee_membership = membresias.crear_membresia(
            usuario=self.employee,
            negocio=self.other_business,
            sucursal=self.other_branch,
            rol_comercio='empleado',
        )
        models.UsuarioNegocio.objects.create(
            usuario=self.employee,
            negocio=self.business,
            sucursal=None,
            rol_comercio='dueno',
        )
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            f'/api/v1/usuario-negocio/actualizar/{employee_membership.pk}/',
            {'rol_comercio': 'dueno', 'sucursal': None},
            format='json',
        )
        self.assertEqual(response.status_code, 400)
        employee_membership.refresh_from_db()
        self.assertEqual(employee_membership.rol_comercio, 'empleado')

    def test_empleado_puede_conservar_varias_membresias_laborales(self):
        membresias.crear_membresia(
            usuario=self.employee,
            negocio=self.other_business,
            sucursal=self.other_branch,
            rol_comercio='empleado',
        )
        membresias.crear_membresia(
            usuario=self.employee,
            negocio=self.third_business,
            sucursal=self.third_branch,
            rol_comercio='supervisor',
        )
        self.assertEqual(
            models.UsuarioNegocio.objects.filter(
                usuario=self.employee,
                rol_comercio__in=('empleado', 'supervisor'),
                status=True,
            ).count(),
            2,
        )

    def test_reactivar_propiedad_historica_no_crea_segunda(self):
        historica = models.UsuarioNegocio.objects.get(
            usuario=self.other_owner,
            negocio=self.third_business,
            rol_comercio='dueno',
        )
        with self.assertRaises(membresias.ErrorMembresia) as ctx:
            membresias.crear_membresia(
                usuario=self.other_owner,
                negocio=self.third_business,
                sucursal=None,
                rol_comercio='dueno',
            )
        self.assertEqual(ctx.exception.codigo, 'propietario_unico')
        historica.refresh_from_db()
        self.assertFalse(historica.status)

    def test_restriccion_de_base_de_datos_impide_segundo_dueno(self):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                models.UsuarioNegocio.objects.create(
                    usuario=self.owner,
                    negocio=self.other_business,
                    sucursal=None,
                    rol_comercio='dueno',
                )

    def test_auditoria_y_correccion_son_seguras_si_la_cuenta_cumple(self):
        salida = StringIO()
        call_command('auditar_propietarios', stdout=salida)
        self.assertIn(
            'No hay cuentas con más de un negocio activo como propietarias.',
            salida.getvalue(),
        )

        salida = StringIO()
        call_command(
            'corregir_propietario_unico',
            correo=self.owner.correo,
            conservar=self.business.pk,
            stdout=salida,
        )
        self.assertIn('ya cumple la regla', salida.getvalue())

    def test_crear_cuentas_valida_formato_y_no_escribe_en_modo_seguro(self):
        with self.assertRaises(CommandError):
            call_command('crear_cuentas_propietarios', cuenta=['sin-formato'])

        antes = models.Usuario.objects.count()
        salida = StringIO()
        call_command(
            'crear_cuentas_propietarios',
            cuenta=['nueva@example.com:Ana:Prueba'],
            stdout=salida,
        )
        self.assertIn('Modo seguro', salida.getvalue())
        self.assertEqual(models.Usuario.objects.count(), antes)

    def test_dueno_puede_transferir_su_negocio(self):
        membership = models.UsuarioNegocio.objects.get(
            usuario=self.owner,
            negocio=self.business,
            rol_comercio='dueno',
        )
        transferido = membresias.actualizar_membresia(
            membresia=membership,
            cambios={'usuario': self.employee},
            actor=self.admin,
            motivo='Transferencia de prueba.',
        )
        self.assertEqual(transferido.usuario_id, self.employee.pk)
        self.assertEqual(
            membresias.propietario_activo(self.owner),
            None,
        )
        self.assertEqual(
            membresias.propietario_activo(self.employee).negocio_id,
            self.business.pk,
        )
