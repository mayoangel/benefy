"""Pruebas de tarjetas, ciclos, snapshots y desactivación."""

from datetime import timedelta

from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone

from core import models
from core.services.lealtad import visitas
from core.test_helpers import (
    crear_negocio,
    crear_recompensa,
    crear_tarjeta,
    crear_usuario,
)


class TarjetasTests(TestCase):
    def setUp(self):
        self.consumer = crear_usuario()
        self.business = crear_negocio()

    def visitar(self, dias=0):
        return visitas.registrar_visita(
            usuario=self.consumer,
            qr_uuid=self.business.qr_uuid,
            ahora=timezone.now() + timedelta(days=dias),
        )

    def test_tarjeta_repetible_crea_nuevo_ciclo(self):
        crear_tarjeta(self.business, meta=2, repetible=True, titulo='Corte')
        self.visitar(0)
        self.assertEqual(models.CicloTarjeta.objects.get().sellos_actuales, 1)
        resultado = self.visitar(1)
        self.assertTrue(resultado['tarjetas'][0]['completado'])
        self.assertEqual(models.CuponUsuario.objects.count(), 1)
        ciclos = list(models.CicloTarjeta.objects.order_by('numero_ciclo'))
        self.assertEqual(len(ciclos), 2)
        self.assertEqual(ciclos[0].estado, 'completado')
        self.assertEqual(ciclos[1].estado, 'en_curso')
        self.assertEqual(ciclos[1].sellos_actuales, 0)

    def test_tarjeta_de_una_sola_vez_no_crea_otro_ciclo(self):
        crear_tarjeta(self.business, meta=2, repetible=False, titulo='Bienvenida')
        self.visitar(0)
        self.visitar(1)
        self.assertEqual(models.CicloTarjeta.objects.count(), 1)
        self.assertEqual(models.CicloTarjeta.objects.get().estado, 'completado')

    def test_desactivar_tarjeta_permite_completar_ciclo_existente(self):
        tarjeta, _ = crear_tarjeta(self.business, meta=2, repetible=True)
        self.visitar(0)
        tarjeta.status = False
        tarjeta.save(update_fields=['status'])
        resultado = self.visitar(1)
        self.assertTrue(resultado['tarjetas'][0]['completado'])
        self.assertEqual(models.CuponUsuario.objects.count(), 1)
        # No se crea el ciclo siguiente mientras la tarjeta esté inactiva.
        self.assertEqual(models.CicloTarjeta.objects.count(), 1)

    def test_tarjeta_desactivada_no_inicia_ciclos_nuevos(self):
        tarjeta, _ = crear_tarjeta(self.business, meta=2, status=False)
        self.visitar(0)
        self.assertEqual(models.CicloTarjeta.objects.count(), 0)
        self.assertEqual(models.CuponUsuario.objects.count(), 0)

    def test_snapshot_de_recompensa_no_cambia_al_editar_la_recompensa(self):
        _, recompensa = crear_tarjeta(self.business, meta=2, titulo='Café')
        titulo_original = recompensa.titulo
        self.visitar(0)
        recompensa.titulo = 'Título cambiado'
        recompensa.vigencia_dias = 1
        recompensa.save(update_fields=['titulo', 'vigencia_dias'])
        self.visitar(1)
        cupon = models.CuponUsuario.objects.get()
        self.assertEqual(cupon.titulo_beneficio, titulo_original)
        # La vigencia del ciclo se congeló en 30 días, no en el nuevo valor de 1.
        self.assertGreater(
            cupon.fecha_expiracion,
            timezone.now() + timedelta(days=20),
        )

    def test_una_visita_avanza_todas_las_tarjetas_elegibles(self):
        crear_tarjeta(self.business, meta=3, titulo='Tarjeta A')
        crear_tarjeta(self.business, meta=4, titulo='Tarjeta B')
        self.visitar(0)
        self.assertEqual(models.CicloTarjeta.objects.count(), 2)
        self.assertEqual(
            list(models.CicloTarjeta.objects.values_list('sellos_actuales', flat=True)),
            [1, 1],
        )

    def test_una_sola_recompensa_meta_por_dinamica(self):
        tarjeta, _ = crear_tarjeta(self.business, meta=2)
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                crear_recompensa(
                    self.business, titulo='Otra meta', dinamica=tarjeta, es_meta=True,
                )

    def test_primera_visita_inicia_ciclo(self):
        crear_tarjeta(self.business, meta=5)
        resultado = self.visitar(0)
        self.assertEqual(resultado['tarjetas'][0]['sellos_actuales'], 1)
        ciclo = models.CicloTarjeta.objects.get()
        self.assertEqual(ciclo.numero_ciclo, 1)
        self.assertEqual(ciclo.meta, 5)
        self.assertEqual(ciclo.recompensa_titulo, ciclo.recompensa.titulo)
