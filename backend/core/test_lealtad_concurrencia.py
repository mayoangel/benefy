"""Pruebas de concurrencia sobre PostgreSQL."""

import threading
from datetime import timedelta
from unittest import skipUnless
from uuid import uuid4

from django.db import connection, connections
from django.test import TransactionTestCase
from django.utils import timezone

from core import models
from core.services.lealtad import cupones, puntos, tarjetas, visitas
from core.test_helpers import (
    crear_dinamica_puntos,
    crear_negocio,
    crear_recompensa,
    crear_tarjeta,
    crear_usuario,
)


def ejecutar_en_hilos(func, cantidad=2):
    barrera = threading.Barrier(cantidad)
    resultados = []
    errores = []

    def worker(indice):
        connections.close_all()
        try:
            barrera.wait(timeout=15)
            resultados.append(func(indice))
        except Exception as exc:  # noqa: BLE001 - se reporta en la aserción
            errores.append(exc)
        finally:
            connections.close_all()

    hilos = [threading.Thread(target=worker, args=(i,)) for i in range(cantidad)]
    for hilo in hilos:
        hilo.start()
    for hilo in hilos:
        hilo.join(timeout=30)
    return resultados, errores


@skipUnless(connection.vendor == 'postgresql', 'Requiere PostgreSQL.')
class ConcurrenciaTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        self.consumer = crear_usuario()
        self.business = crear_negocio()

    def test_dos_visitas_simultaneas_solo_registran_una(self):
        crear_dinamica_puntos(self.business, puntos=10)
        ahora = timezone.now()

        def visitar(_):
            return visitas.registrar_visita(
                usuario=self.consumer,
                qr_uuid=self.business.qr_uuid,
                ahora=ahora,
            )

        resultados, errores = ejecutar_en_hilos(visitar)
        self.assertEqual(errores, [])
        self.assertEqual(len(resultados), 2)
        self.assertEqual(
            sum(1 for r in resultados if not r['already_registered']), 1,
        )
        self.assertEqual(
            models.RegistroActividad.objects.filter(es_valida=True).count(), 1,
        )
        self.assertEqual(models.LotePuntos.objects.count(), 1)

    def test_dos_adquisiciones_simultaneas_con_la_misma_clave(self):
        crear_recompensa(self.business, costo=10, cantidad_disponible=5)
        recompensa = models.Recompensa.objects.get()
        puntos.otorgar_puntos(
            usuario=self.consumer, negocio=self.business, cantidad=100,
            origen='ajuste', referencia='saldo',
        )
        clave = uuid4()

        def adquirir(_):
            return cupones.adquirir_cupon(
                usuario=self.consumer,
                recompensa_id=recompensa.pk,
                clave_idempotencia=clave,
            )

        resultados, errores = ejecutar_en_hilos(adquirir)
        self.assertEqual(errores, [])
        self.assertEqual(len(resultados), 2)
        self.assertEqual(models.CuponUsuario.objects.count(), 1)
        self.assertEqual(models.SaldoPuntos.objects.get().saldo_actual, 90)
        recompensa.refresh_from_db()
        self.assertEqual(recompensa.cantidad_disponible, 4)

    def test_dos_canjes_simultaneos_solo_consumen_una_vez(self):
        recompensa = crear_recompensa(self.business, costo=10)
        cupon = models.CuponUsuario.objects.create(
            usuario=self.consumer,
            negocio=self.business,
            recompensa=recompensa,
            fecha_expiracion=timezone.now() + timedelta(days=10),
            titulo_beneficio=recompensa.titulo,
        )

        def canjear(_):
            return cupones.canjear_cupon(
                usuario=self.consumer, cupon_uuid=cupon.uuid,
            )

        resultados, errores = ejecutar_en_hilos(canjear)
        self.assertEqual(len(resultados), 1)
        self.assertEqual(len(errores), 1)
        self.assertEqual(models.Canje.objects.count(), 1)
        cupon.refresh_from_db()
        self.assertEqual(cupon.status, 'canjeado')

    def test_dos_adquisiciones_compiten_por_el_ultimo_stock(self):
        crear_recompensa(self.business, costo=10, cantidad_disponible=1)
        recompensa = models.Recompensa.objects.get()
        puntos.otorgar_puntos(
            usuario=self.consumer, negocio=self.business, cantidad=100,
            origen='ajuste', referencia='saldo',
        )

        def adquirir(_):
            return cupones.adquirir_cupon(
                usuario=self.consumer,
                recompensa_id=recompensa.pk,
                clave_idempotencia=uuid4(),
            )

        resultados, errores = ejecutar_en_hilos(adquirir)
        self.assertEqual(len(resultados), 1)
        self.assertEqual(len(errores), 1)
        self.assertEqual(models.CuponUsuario.objects.count(), 1)
        recompensa.refresh_from_db()
        self.assertEqual(recompensa.cantidad_disponible, 0)

    def test_creacion_simultanea_de_saldo(self):
        def otorgar(indice):
            return puntos.otorgar_puntos(
                usuario=self.consumer,
                negocio=self.business,
                cantidad=10,
                origen='ajuste',
                referencia=f'ajuste-{indice}',
            )

        resultados, errores = ejecutar_en_hilos(otorgar)
        self.assertEqual(errores, [])
        self.assertEqual(models.SaldoPuntos.objects.count(), 1)
        self.assertEqual(models.SaldoPuntos.objects.get().saldo_actual, 20)

    def test_creacion_simultanea_de_ciclo(self):
        crear_tarjeta(self.business, meta=5)

        def avanzar(_):
            return tarjetas.avanzar_tarjetas(
                usuario=self.consumer, negocio=self.business,
            )

        resultados, errores = ejecutar_en_hilos(avanzar)
        self.assertEqual(errores, [])
        self.assertEqual(models.CicloTarjeta.objects.count(), 1)
        self.assertEqual(models.CicloTarjeta.objects.get().sellos_actuales, 2)
