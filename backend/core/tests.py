from datetime import timedelta
from decimal import Decimal

from django.contrib import admin
from django.test import SimpleTestCase, TestCase
from django.utils import timezone

from core import models


class HealthCheckTests(SimpleTestCase):
    def test_health_check_responde_ok(self):
        response = self.client.get("/")

        self.assertEqual(response.status_code, 200)
        self.assertJSONEqual(
            response.content,
            {"service": "backend", "status": "ok"},
        )


class DetailNotFoundTests(TestCase):
    detail_paths = (
        "/api/v1/usuario/detail/999999/",
        "/api/v1/categoria-negocio/detail/999999/",
        "/api/v1/negocio/detail/999999/",
        "/api/v1/sucursal/detail/999999/",
        "/api/v1/usuario-negocio/detail/999999/",
        "/api/v1/dinamica/detail/999999/",
        "/api/v1/alianza/detail/999999/",
        "/api/v1/recompensa/detail/999999/",
        "/api/v1/registro-actividad/detail/999999/",
        "/api/v1/progreso-usuario/detail/999999/",
        "/api/v1/cupon-usuario/detail/999999/",
        "/api/v1/canje/detail/999999/",
        "/api/v1/plan-suscripcion/detail/999999/",
        "/api/v1/suscripcion/detail/999999/",
        "/api/v1/pago/detail/999999/",
        "/api/v1/notificacion/detail/999999/",
    )

    def test_detalles_inexistentes_responden_404(self):
        for path in self.detail_paths:
            with self.subTest(path=path):
                self.assertEqual(self.client.get(path).status_code, 404)


class ModelStringTests(SimpleTestCase):
    def setUp(self):
        self.usuario = models.Usuario(
            pk=1,
            firebase_uid="firebase-test",
            nombre="Ana",
            apellido="Pérez",
            correo="ana@example.com",
        )
        self.categoria = models.CategoriaNegocio(pk=1, nombre="Cafetería")
        self.negocio = models.Negocio(
            pk=1,
            nombre="Café Benefy",
            direccion="Centro",
            correo="cafe@example.com",
            categoria=self.categoria,
        )
        self.sucursal = models.Sucursal(
            pk=1,
            nombre="Centro",
            direccion="Avenida Principal",
            ciudad="Tijuana",
            negocio=self.negocio,
        )
        self.dinamica = models.Dinamica(
            pk=1,
            nombre="Café frecuente",
            tipo="sellos",
            meta=10,
            fecha_inicio=timezone.now(),
            fecha_fin=timezone.now() + timedelta(days=30),
            negocio=self.negocio,
        )

    def test_representaciones_no_referencian_campos_inexistentes(self):
        membresia = models.UsuarioNegocio(
            usuario=self.usuario,
            negocio=self.negocio,
            sucursal=self.sucursal,
            rol_comercio="empleado",
        )
        alianza = models.Alianza(
            negocio1=self.negocio,
            negocio2=models.Negocio(pk=2, nombre="Pan Benefy"),
            status="activa",
        )
        recompensa = models.Recompensa(pk=1, titulo="Café gratis", dinamica=self.dinamica)
        actividad = models.RegistroActividad(
            usuario=self.usuario,
            sucursal=self.sucursal,
            fecha=timezone.now(),
        )
        progreso = models.ProgresoUsuario(
            usuario=self.usuario,
            dinamica=self.dinamica,
            saldo_acumulado=Decimal("4.00"),
        )
        cupon = models.CuponUsuario(
            usuario=self.usuario,
            recompensa=recompensa,
            status="disponible",
        )
        pago = models.Pago(
            stripe_invoice_id="in_test",
            monto=Decimal("299.00"),
            divisa="MXN",
            negocio=self.negocio,
        )

        self.assertIn("ana@example.com", str(membresia))
        self.assertIn("Tarjeta de sellos", str(self.dinamica))
        self.assertIn("Activa", str(alianza))
        self.assertIn("ana@example.com", str(actividad))
        self.assertIn("ana@example.com", str(progreso))
        self.assertIn("Disponible", str(cupon))
        self.assertIn("MXN", str(pago))

    def test_notificacion_sin_usuario_tiene_representacion_segura(self):
        notificacion = models.Notificacion(
            titulo="Mantenimiento",
            cuerpo="Aviso de prueba",
        )

        self.assertEqual(
            str(notificacion),
            "Push para sin destinatario: Mantenimiento",
        )


class AdminRegistrationTests(SimpleTestCase):
    def test_modelos_del_dominio_estan_registrados(self):
        for model in (
            models.Usuario,
            models.Negocio,
            models.Sucursal,
            models.Dinamica,
            models.CuponUsuario,
            models.Canje,
        ):
            with self.subTest(model=model.__name__):
                self.assertTrue(admin.site.is_registered(model))
