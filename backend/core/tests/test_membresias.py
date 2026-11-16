"""Pruebas del refactor de membresías, roles y auditoría."""

from datetime import timedelta
from uuid import uuid4

from django.db import IntegrityError, connection, transaction
from django.db.migrations.executor import MigrationExecutor
from django.test import TestCase, TransactionTestCase
from django.utils import timezone
from rest_framework.test import APIClient

from core import models, permissions
from core.services import membresias
from core.tests.helpers import crear_negocio, crear_sucursal, crear_usuario


class MembresiaModeloTests(TestCase):
    def setUp(self):
        self.user = crear_usuario()
        self.other = crear_usuario()
        self.business = crear_negocio()
        self.branch = crear_sucursal(self.business)

    def test_dueno_no_puede_tener_sucursal(self):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                models.UsuarioNegocio.objects.create(
                    usuario=self.user,
                    negocio=self.business,
                    sucursal=self.branch,
                    rol_comercio='dueno',
                )

    def test_supervisor_y_empleado_requieren_sucursal(self):
        for rol in ('supervisor', 'empleado'):
            with self.subTest(rol=rol):
                with self.assertRaises(IntegrityError):
                    with transaction.atomic():
                        models.UsuarioNegocio.objects.create(
                            usuario=self.user,
                            negocio=self.business,
                            sucursal=None,
                            rol_comercio=rol,
                        )

    def test_duplicado_de_membresia_rechazado(self):
        models.UsuarioNegocio.objects.create(
            usuario=self.user, negocio=self.business,
            sucursal=self.branch, rol_comercio='empleado',
        )
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                models.UsuarioNegocio.objects.create(
                    usuario=self.user, negocio=self.business,
                    sucursal=self.branch, rol_comercio='supervisor',
                )

    def test_multiples_duenos_permitidos(self):
        models.UsuarioNegocio.objects.create(
            usuario=self.user, negocio=self.business,
            sucursal=None, rol_comercio='dueno',
        )
        models.UsuarioNegocio.objects.create(
            usuario=self.other, negocio=self.business,
            sucursal=None, rol_comercio='dueno',
        )
        self.assertEqual(
            models.UsuarioNegocio.objects.filter(
                negocio=self.business, rol_comercio='dueno',
            ).count(),
            2,
        )

    def test_misma_cuenta_puede_ser_dueno_y_empleado(self):
        models.UsuarioNegocio.objects.create(
            usuario=self.user, negocio=self.business,
            sucursal=None, rol_comercio='dueno',
        )
        models.UsuarioNegocio.objects.create(
            usuario=self.user, negocio=self.business,
            sucursal=self.branch, rol_comercio='empleado',
        )
        self.assertEqual(
            models.UsuarioNegocio.objects.filter(
                usuario=self.user, negocio=self.business,
            ).count(),
            2,
        )


class MembresiaServicioTests(TestCase):
    def setUp(self):
        self.owner = crear_usuario()
        self.user = crear_usuario()
        self.business = crear_negocio()
        self.branch = crear_sucursal(self.business)
        self.other_business = crear_negocio('Otro')
        self.other_branch = crear_sucursal(self.other_business)

    def test_alta_auditada(self):
        membresia = membresias.crear_membresia(
            usuario=self.user,
            negocio=self.business,
            sucursal=self.branch,
            rol_comercio='empleado',
            actor=self.owner,
            motivo='Alta de prueba',
        )
        auditoria = models.AuditoriaMembresia.objects.get(
            membresia=membresia, accion='alta',
        )
        self.assertEqual(auditoria.usuario_correo, self.user.correo)
        self.assertEqual(auditoria.negocio_nombre, self.business.nombre)
        self.assertEqual(auditoria.rol_comercio, 'empleado')
        self.assertEqual(auditoria.actor_correo, self.owner.correo)

    def test_modificacion_auditada(self):
        membresia = membresias.crear_membresia(
            usuario=self.user, negocio=self.business,
            sucursal=self.branch, rol_comercio='empleado',
        )
        membresias.actualizar_membresia(
            membresia=membresia,
            cambios={'rol_comercio': 'supervisor'},
            actor=self.owner,
        )
        auditoria = models.AuditoriaMembresia.objects.get(
            membresia=membresia, accion='modificacion',
        )
        self.assertEqual(auditoria.datos_anteriores['rol_comercio'], 'empleado')
        self.assertEqual(auditoria.datos_nuevos['rol_comercio'], 'supervisor')

    def test_baja_y_reactivacion_auditadas(self):
        membresia = membresias.crear_membresia(
            usuario=self.user, negocio=self.business,
            sucursal=self.branch, rol_comercio='empleado',
        )
        membresias.desactivar_membresia(
            membresia=membresia, actor=self.owner, motivo='Baja de prueba',
        )
        membresia.refresh_from_db()
        self.assertFalse(membresia.status)
        self.assertIsNotNone(membresia.fecha_baja)
        self.assertTrue(models.AuditoriaMembresia.objects.filter(
            membresia=membresia, accion='baja',
        ).exists())

        reactivada = membresias.crear_membresia(
            usuario=self.user, negocio=self.business,
            sucursal=self.branch, rol_comercio='empleado',
            actor=self.owner,
        )
        self.assertEqual(reactivada.pk, membresia.pk)
        self.assertTrue(reactivada.status)
        self.assertTrue(models.AuditoriaMembresia.objects.filter(
            membresia=membresia, accion='reactivacion',
        ).exists())

    def test_duplicado_activo_rechazado(self):
        membresias.crear_membresia(
            usuario=self.user, negocio=self.business,
            sucursal=self.branch, rol_comercio='empleado',
        )
        with self.assertRaises(membresias.ErrorMembresia):
            membresias.crear_membresia(
                usuario=self.user, negocio=self.business,
                sucursal=self.branch, rol_comercio='empleado',
            )

    def test_sucursal_ajena_rechazada(self):
        with self.assertRaises(membresias.ErrorMembresia):
            membresias.crear_membresia(
                usuario=self.user, negocio=self.business,
                sucursal=self.other_branch, rol_comercio='empleado',
            )

    def test_dueno_con_sucursal_rechazado(self):
        with self.assertRaises(membresias.ErrorMembresia):
            membresias.crear_membresia(
                usuario=self.user, negocio=self.business,
                sucursal=self.branch, rol_comercio='dueno',
            )


class MembresiaAPITests(TestCase):
    def setUp(self):
        self.owner = crear_usuario()
        self.supervisor = crear_usuario()
        self.employee = crear_usuario()
        self.consumer = crear_usuario()
        self.admin = crear_usuario(rol='admin_sistema')
        self.business = crear_negocio()
        self.branch = crear_sucursal(self.business)
        self.other_branch = crear_sucursal(self.business, 'Otra')
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
        self.client = APIClient()

    def crear(self, usuario, sucursal, rol, actor=None):
        self.client.force_authenticate(actor or self.owner)
        return self.client.post('/api/v1/usuario-negocio/crear/', {
            'usuario': usuario.pk,
            'negocio': self.business.pk,
            'sucursal': sucursal.pk if sucursal else None,
            'rol_comercio': rol,
        }, format='json')

    def test_owner_crea_supervisor_y_empleado(self):
        self.assertEqual(
            self.crear(self.consumer, self.branch, 'supervisor').status_code, 201,
        )
        otro = crear_usuario()
        self.assertEqual(
            self.crear(otro, self.branch, 'empleado').status_code, 201,
        )

    def test_supervisor_solo_crea_empleado_en_su_sucursal(self):
        self.assertEqual(
            self.crear(self.consumer, self.branch, 'empleado', self.supervisor).status_code,
            201,
        )
        otro = crear_usuario()
        self.assertEqual(
            self.crear(otro, self.branch, 'supervisor', self.supervisor).status_code,
            403,
        )
        tercero = crear_usuario()
        self.assertEqual(
            self.crear(tercero, self.other_branch, 'empleado', self.supervisor).status_code,
            403,
        )

    def test_admin_crea_dueno(self):
        nuevo = crear_usuario()
        self.assertEqual(
            self.crear(nuevo, None, 'dueno', self.admin).status_code, 201,
        )

    def test_alias_admin_se_convierte_en_supervisor(self):
        nuevo = crear_usuario()
        response = self.crear(nuevo, self.branch, 'admin')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            models.UsuarioNegocio.objects.get(
                usuario=nuevo, negocio=self.business, sucursal=self.branch,
            ).rol_comercio,
            'supervisor',
        )

    def test_delete_es_baja_logica(self):
        self.client.force_authenticate(self.owner)
        membresia = models.UsuarioNegocio.objects.get(usuario=self.employee)
        response = self.client.delete(
            f'/api/v1/usuario-negocio/eliminar/{membresia.pk}/',
        )
        self.assertEqual(response.status_code, 204)
        membresia.refresh_from_db()
        self.assertFalse(membresia.status)
        self.assertIsNotNone(membresia.fecha_baja)
        self.assertTrue(models.AuditoriaMembresia.objects.filter(
            membresia=membresia, accion='baja',
        ).exists())

    def test_alias_rol_global_negocio_se_convierte_en_consumidor(self):
        self.client.force_authenticate(self.admin)
        response = self.client.patch(
            f'/api/v1/usuario/rol/{self.consumer.pk}/',
            {'rol': 'negocio'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.consumer.refresh_from_db()
        self.assertEqual(self.consumer.rol, 'consumidor')


class MembresiaMigracionTests(TransactionTestCase):
    def test_migra_negocio_y_admin_sin_perder_membresias(self):
        executor = MigrationExecutor(connection)
        previous = [('core', '0007_lealtad_restricciones_base')]
        latest = executor.loader.graph.leaf_nodes()
        executor.migrate(previous)
        try:
            old_apps = executor.loader.project_state(previous).apps
            Usuario = old_apps.get_model('core', 'Usuario')
            Categoria = old_apps.get_model('core', 'CategoriaNegocio')
            Negocio = old_apps.get_model('core', 'Negocio')
            Sucursal = old_apps.get_model('core', 'Sucursal')
            UsuarioNegocio = old_apps.get_model('core', 'UsuarioNegocio')

            usuario = Usuario.objects.create(
                supabase_uid=uuid4(),
                nombre='Migración',
                apellido='Prueba',
                correo=f'migracion.{uuid4().hex}@example.com',
                rol='negocio',
            )
            categoria = Categoria.objects.create(nombre=f'Cat {uuid4().hex[:6]}')
            negocio = Negocio.objects.create(
                nombre='Negocio migración',
                direccion='Centro',
                correo=f'negocio.{uuid4().hex}@example.com',
                categoria=categoria,
            )
            sucursal = Sucursal.objects.create(
                nombre='Sucursal migración',
                direccion='Centro',
                ciudad='Tijuana',
                negocio=negocio,
            )
            membresia = UsuarioNegocio.objects.create(
                usuario=usuario,
                negocio=negocio,
                sucursal=sucursal,
                rol_comercio='admin',
            )
            dueno = Usuario.objects.create(
                supabase_uid=uuid4(),
                nombre='Dueño migración',
                apellido='Prueba',
                correo=f'dueno.{uuid4().hex}@example.com',
                rol='negocio',
            )
            UsuarioNegocio.objects.create(
                usuario=dueno,
                negocio=negocio,
                sucursal=None,
                rol_comercio='dueno',
            )

            Dinamica = old_apps.get_model('core', 'Dinamica')
            Recompensa = old_apps.get_model('core', 'Recompensa')
            RegistroActividad = old_apps.get_model('core', 'RegistroActividad')
            SaldoPuntos = old_apps.get_model('core', 'SaldoPuntos')
            LotePuntos = old_apps.get_model('core', 'LotePuntos')
            CicloTarjeta = old_apps.get_model('core', 'CicloTarjeta')
            CuponUsuario = old_apps.get_model('core', 'CuponUsuario')

            programa = Dinamica.objects.create(
                nombre=f'Programa {uuid4().hex[:6]}',
                tipo='sellos',
                meta=3,
                fecha_inicio=timezone.now(),
                fecha_fin=None,
                negocio=negocio,
            )
            recompensa = Recompensa.objects.create(
                titulo='Premio migración',
                descripcion='Premio de prueba',
                terminos_condiciones='Válido',
                negocio=negocio,
                dinamica=programa,
                es_meta=True,
                vigencia_dias=30,
            )
            visita = RegistroActividad.objects.create(
                usuario=usuario,
                negocio=negocio,
                sucursal=sucursal,
                tipo='visita',
                fecha_negocio=timezone.localdate(),
                es_valida=True,
            )
            saldo = SaldoPuntos.objects.create(
                usuario=usuario, negocio=negocio, saldo_actual=25,
            )
            lote = LotePuntos.objects.create(
                usuario=usuario,
                negocio=negocio,
                origen='visita',
                cantidad_otorgada=25,
                cantidad_disponible=25,
                fecha_otorgamiento=timezone.now(),
                referencia='visita:migracion',
            )
            ciclo = CicloTarjeta.objects.create(
                usuario=usuario,
                dinamica=programa,
                negocio=negocio,
                numero_ciclo=1,
                sellos_actuales=1,
                meta=3,
                recompensa=recompensa,
                estado='en_curso',
                fecha_inicio=timezone.now(),
            )
            cupon = CuponUsuario.objects.create(
                usuario=usuario,
                recompensa=recompensa,
                negocio=negocio,
                fecha_expiracion=timezone.now() + timedelta(days=30),
                status='disponible',
            )

            executor = MigrationExecutor(connection)
            executor.migrate(latest)
            current_user = models.Usuario.objects.get(pk=usuario.pk)
            current_business = models.Negocio.objects.get(pk=negocio.pk)
            current_branch = models.Sucursal.objects.get(pk=sucursal.pk)
            self.assertEqual(current_user.rol, 'consumidor')
            self.assertEqual(
                models.UsuarioNegocio.objects.get(pk=membresia.pk).rol_comercio,
                'supervisor',
            )
            self.assertTrue(models.AuditoriaMembresia.objects.filter(
                membresia_id=membresia.pk, accion='migracion',
            ).exists())

            # El antiguo administrador de sucursal conserva sus permisos.
            self.assertTrue(permissions.puede_acceder_negocio(
                current_user, current_business,
            ))
            self.assertTrue(permissions.puede_administrar_operaciones_sucursal(
                current_user, current_branch,
            ))
            self.assertFalse(permissions.puede_administrar_negocio(
                current_user, current_business,
            ))

            # El dueño conserva el control total del negocio.
            current_owner = models.Usuario.objects.get(pk=dueno.pk)
            self.assertEqual(current_owner.rol, 'consumidor')
            self.assertTrue(permissions.puede_administrar_negocio(
                current_owner, current_business,
            ))

            # Las tablas de lealtad no se alteran con el refactor.
            self.assertEqual(
                models.SaldoPuntos.objects.get(pk=saldo.pk).saldo_actual, 25,
            )
            self.assertEqual(
                models.LotePuntos.objects.get(pk=lote.pk).cantidad_disponible, 25,
            )
            self.assertEqual(
                models.RegistroActividad.objects.get(pk=visita.pk).es_valida, True,
            )
            self.assertEqual(
                models.CicloTarjeta.objects.get(pk=ciclo.pk).sellos_actuales, 1,
            )
            self.assertEqual(
                models.CuponUsuario.objects.get(pk=cupon.pk).status, 'disponible',
            )
        finally:
            MigrationExecutor(connection).migrate(latest)
