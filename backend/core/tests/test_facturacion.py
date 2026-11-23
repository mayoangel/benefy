"""Pruebas de Stripe Sandbox: checkout, webhooks y ciclo de Billing."""

from datetime import timedelta
from decimal import Decimal
import threading
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from django.core.cache import cache
from django.db import close_old_connections, connection, transaction
from django.test import TestCase, TransactionTestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from core import models
from core.services import facturacion, planes
from core.tests.helpers import (
    asegurar_planes,
    crear_cupon,
    crear_negocio,
    crear_recompensa,
    crear_usuario,
)


STRIPE_TEST_SETTINGS = {
    'STRIPE_ENABLED': True,
    'STRIPE_MODE': 'test',
    'STRIPE_SECRET_KEY': 'sk_test_clave_de_prueba_no_real',
    'STRIPE_WEBHOOK_SECRET': 'whsec_secreto_de_prueba',
    'STRIPE_PREMIUM_PRICE_ID': 'price_monthly_test',
    'STRIPE_PREMIUM_ANNUAL_PRICE_ID': 'price_annual_test',
    'STRIPE_PORTAL_CONFIGURATION_ID': '',
    'STRIPE_GRACE_DAYS': 3,
    'STRIPE_CHECKOUT_TTL_MINUTES': 60,
    'FRONTEND_URL': 'http://localhost:5173',
}


class BaseFacturacionTests(TestCase):
    def setUp(self):
        cache.clear()
        asegurar_planes()
        self.owner = crear_usuario()
        self.other = crear_usuario()
        self.consumer = crear_usuario()
        self.admin = crear_usuario(rol='admin_sistema')
        self.business = crear_negocio()
        models.UsuarioNegocio.objects.create(
            usuario=self.owner, negocio=self.business,
            sucursal=None, rol_comercio='dueno',
        )
        planes.asignar_free_inicial(self.business, actor=self.owner)
        premium = models.PlanSuscripcion.objects.get(codigo='premium')
        for intervalo, monto, price_id in (
            ('mensual', Decimal('399.00'), 'price_monthly_test'),
            ('anual', Decimal('3990.00'), 'price_annual_test'),
        ):
            precio = models.PlanPrecio.objects.get(
                plan=premium, intervalo=intervalo,
            )
            precio.monto = monto
            precio.divisa = 'MXN'
            precio.stripe_price_id = price_id
            precio.status = True
            precio.save()
        self.client = APIClient()

    def auth(self, user=None):
        self.client.force_authenticate(user=user or self.owner)

    def cliente_stripe_local(self, customer_id='cus_test_1'):
        local, _ = models.ClienteStripe.objects.get_or_create(
            negocio=self.business,
            stripe_mode='test',
            defaults={'stripe_customer_id': customer_id},
        )
        return local

    def precio_stripe(self, intervalo='mensual'):
        if intervalo == 'mensual':
            return {
                'id': 'price_monthly_test',
                'object': 'price',
                'livemode': False,
                'active': True,
                'currency': 'mxn',
                'unit_amount': 39900,
                'recurring': {'interval': 'month'},
            }
        return {
            'id': 'price_annual_test',
            'object': 'price',
            'livemode': False,
            'active': True,
            'currency': 'mxn',
            'unit_amount': 399000,
            'recurring': {'interval': 'year'},
        }

    def sesion_checkout(self, status='open'):
        return {
            'id': 'cs_test_123',
            'object': 'checkout.session',
            'livemode': False,
            'mode': 'subscription',
            'status': status,
            'url': 'https://checkout.stripe.com/c/pay/cs_test_123',
            'expires_at': int(
                (timezone.now() + timedelta(minutes=60)).timestamp()
            ),
            'customer': 'cus_test_1',
            'client_reference_id': str(self.business.pk),
            'subscription': 'sub_test_1',
        }

    def fake_cliente(self):
        cliente = MagicMock()
        cliente.v1.prices.retrieve.return_value = self.precio_stripe('mensual')
        cliente.v1.customers.create.return_value = {
            'id': 'cus_test_1',
            'object': 'customer',
            'livemode': False,
        }
        cliente.v1.subscriptions.list.return_value = {'data': []}
        cliente.v1.checkout.sessions.create.return_value = self.sesion_checkout()
        cliente.v1.checkout.sessions.retrieve.return_value = self.sesion_checkout()
        return cliente

    def suscripcion_stripe(self, **overrides):
        ahora = int(timezone.now().timestamp())
        datos = {
            'id': 'sub_test_1',
            'object': 'subscription',
            'livemode': False,
            'status': 'active',
            'customer': 'cus_test_1',
            'created': ahora - 86400,
            'current_period_start': ahora - 86400,
            'current_period_end': ahora + 30 * 86400,
            'cancel_at_period_end': False,
            'items': {
                'data': [{
                    'price': {'id': 'price_monthly_test'},
                }],
            },
            'metadata': {
                'benefy_negocio_id': str(self.business.pk),
                'benefy_environment': 'sandbox',
            },
        }
        datos.update(overrides)
        return datos

    def activar_premium(self, suscripcion=None):
        self.cliente_stripe_local()
        suscripcion = suscripcion or self.suscripcion_stripe()
        return facturacion._aplicar_suscripcion(
            self.business, suscripcion,
            event_created=suscripcion['created'],
            event_id='evt_activacion',
        )[0]

    def evento(self, tipo, objeto, event_id='evt_test_1', created=None):
        return {
            'id': event_id,
            'object': 'event',
            'type': tipo,
            'livemode': False,
            'created': created or int(timezone.now().timestamp()),
            'data': {'object': objeto},
        }

    def webhook(self, evento, cliente=None):
        cliente = cliente or self.fake_cliente()
        cliente.construct_event.return_value = evento
        with patch.object(facturacion, '_cliente', return_value=cliente):
            return self.client.post(
                '/api/v1/stripe/webhook/',
                data=b'{"prueba": true}',
                content_type='application/json',
                HTTP_STRIPE_SIGNATURE='t=1,v1=firma',
            )


@override_settings(**STRIPE_TEST_SETTINGS)
class CheckoutTests(BaseFacturacionTests):
    def test_propietario_free_inicia_checkout_con_precio_del_catalogo(self):
        self.auth()
        cliente = self.fake_cliente()
        with patch.object(facturacion, '_cliente', return_value=cliente):
            response = self.client.post(
                f'/api/v1/negocios/{self.business.pk}/facturacion/checkout/',
                {'intervalo': 'mensual'},
                format='json',
            )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['url'], 'https://checkout.stripe.com/c/pay/cs_test_123')
        self.assertEqual(response.data['modo'], 'test')

        params = cliente.v1.checkout.sessions.create.call_args.args[0]
        self.assertEqual(params['mode'], 'subscription')
        self.assertEqual(params['line_items'], [{
            'price': 'price_monthly_test', 'quantity': 1,
        }])
        self.assertEqual(params['client_reference_id'], str(self.business.pk))
        self.assertNotIn('payment_method_types', params)
        self.assertEqual(
            params['subscription_data']['metadata']['benefy_negocio_id'],
            str(self.business.pk),
        )
        self.assertTrue(params['integration_identifier'].startswith('benefy_saas_'))

        local = models.CheckoutStripe.objects.get()
        self.assertEqual(local.stripe_session_id, 'cs_test_123')
        self.assertEqual(local.status, 'abierta')
        self.assertEqual(local.stripe_mode, 'test')
        self.assertEqual(local.stripe_customer_id, 'cus_test_1')
        self.assertEqual(
            models.ClienteStripe.objects.get().stripe_customer_id, 'cus_test_1',
        )

    def test_usuario_ajeno_no_puede_contratar_para_otro_negocio(self):
        self.auth(self.other)
        cliente = self.fake_cliente()
        with patch.object(facturacion, '_cliente', return_value=cliente):
            response = self.client.post(
                f'/api/v1/negocios/{self.business.pk}/facturacion/checkout/',
                {'intervalo': 'mensual'},
                format='json',
            )
        self.assertEqual(response.status_code, 403)
        self.assertFalse(models.CheckoutStripe.objects.exists())
        cliente.v1.checkout.sessions.create.assert_not_called()

    def test_consumidor_no_puede_ver_facturacion(self):
        self.auth(self.consumer)
        response = self.client.get(
            f'/api/v1/negocios/{self.business.pk}/facturacion/',
        )
        self.assertEqual(response.status_code, 403)

    def test_facturacion_expone_catalogo_y_aviso_sin_identificadores_stripe(self):
        self.auth()
        response = self.client.get(
            f'/api/v1/negocios/{self.business.pk}/facturacion/',
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['plan']['codigo'], 'free')
        self.assertTrue(response.data['facturacion']['habilitada'])
        self.assertEqual(response.data['facturacion']['modo'], 'test')
        precios = {
            item['intervalo']: item
            for item in response.data['facturacion']['precios']
        }
        self.assertEqual(precios['mensual']['monto'], '399.00')
        self.assertEqual(precios['anual']['monto'], '3990.00')
        self.assertTrue(precios['mensual']['disponible'])
        self.assertTrue(precios['anual']['disponible'])
        self.assertIn('demostración', response.data['facturacion']['aviso'])
        serializado = str(response.data)
        self.assertNotIn('price_', serializado)
        self.assertNotIn('sk_test_', serializado)
        self.assertNotIn('cus_', serializado)

    def test_negocio_con_premium_existente_no_crea_otro_checkout(self):
        planes.cambiar_plan(
            negocio=self.business,
            plan=models.PlanSuscripcion.objects.get(codigo='premium'),
            actor=self.admin,
            motivo='Premium existente.',
        )
        self.auth(self.owner)
        cliente = self.fake_cliente()
        with patch.object(facturacion, '_cliente', return_value=cliente):
            response = self.client.post(
                f'/api/v1/negocios/{self.business.pk}/facturacion/checkout/',
                {'intervalo': 'mensual'},
                format='json',
            )
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['codigo'], 'premium_activo')
        cliente.v1.checkout.sessions.create.assert_not_called()

    def test_no_acepta_precio_ni_monto_enviados_por_react(self):
        self.auth()
        cliente = self.fake_cliente()
        cliente.v1.prices.retrieve.return_value = self.precio_stripe('anual')
        with patch.object(facturacion, '_cliente', return_value=cliente):
            response = self.client.post(
                f'/api/v1/negocios/{self.business.pk}/facturacion/checkout/',
                {
                    'intervalo': 'anual',
                    'price': 'price_arbitrario',
                    'monto': '1.00',
                },
                format='json',
            )
        self.assertEqual(response.status_code, 200, response.data)
        params = cliente.v1.checkout.sessions.create.call_args.args[0]
        self.assertEqual(params['line_items'][0]['price'], 'price_annual_test')

    def test_precio_de_stripe_que_no_coincide_bloquea_checkout(self):
        self.auth()
        cliente = self.fake_cliente()
        cliente.v1.prices.retrieve.return_value = {
            **self.precio_stripe('mensual'),
            'unit_amount': 89900,
        }
        with patch.object(facturacion, '_cliente', return_value=cliente):
            response = self.client.post(
                f'/api/v1/negocios/{self.business.pk}/facturacion/checkout/',
                {'intervalo': 'mensual'},
                format='json',
            )
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.data['codigo'], 'plan_no_facturable')
        cliente.v1.checkout.sessions.create.assert_not_called()


class ConcurrenciaCheckoutTests(TransactionTestCase):
    reset_sequences = True

    @override_settings(**STRIPE_TEST_SETTINGS)
    def test_dos_solicitudes_concurrentes_comparten_un_solo_checkout(self):
        if connection.vendor != 'postgresql':
            self.skipTest('La prueba de bloqueo requiere PostgreSQL.')
        cache.clear()
        asegurar_planes()
        owner = crear_usuario()
        negocio = crear_negocio()
        models.UsuarioNegocio.objects.create(
            usuario=owner, negocio=negocio,
            sucursal=None, rol_comercio='dueno',
        )
        planes.asignar_free_inicial(negocio, actor=owner)
        premium = models.PlanSuscripcion.objects.get(codigo='premium')
        precio = models.PlanPrecio.objects.get(plan=premium, intervalo='mensual')
        precio.monto = Decimal('399.00')
        precio.stripe_price_id = 'price_monthly_test'
        precio.save()

        cliente = MagicMock()
        cliente.v1.prices.retrieve.return_value = {
            'id': 'price_monthly_test',
            'livemode': False,
            'active': True,
            'currency': 'mxn',
            'unit_amount': 39900,
            'recurring': {'interval': 'month'},
        }
        cliente.v1.customers.create.return_value = {
            'id': 'cus_concurrente', 'livemode': False,
        }
        cliente.v1.subscriptions.list.return_value = {'data': []}
        sesion = {
            'id': 'cs_test_concurrente',
            'livemode': False,
            'mode': 'subscription',
            'status': 'open',
            'url': 'https://checkout.stripe.com/c/pay/cs_test_concurrente',
            'expires_at': int((timezone.now() + timedelta(minutes=60)).timestamp()),
            'customer': 'cus_concurrente',
            'client_reference_id': str(negocio.pk),
            'subscription': 'sub_concurrente',
        }
        cliente.v1.checkout.sessions.create.return_value = sesion
        cliente.v1.checkout.sessions.retrieve.return_value = sesion

        barrera = threading.Barrier(2)
        resultados = []
        errores = []

        def intentar():
            close_old_connections()
            try:
                barrera.wait(timeout=10)
                with patch.object(facturacion, '_cliente', return_value=cliente):
                    local, reutilizada = facturacion.crear_sesion_checkout(
                        negocio, owner, 'mensual',
                    )
                    resultados.append((local.stripe_session_id, reutilizada))
            except Exception as exc:  # pragma: no cover - diagnóstico
                errores.append(exc)
            finally:
                close_old_connections()

        hilos = [threading.Thread(target=intentar) for _ in range(2)]
        for hilo in hilos:
            hilo.start()
        for hilo in hilos:
            hilo.join(timeout=20)

        self.assertEqual(errores, [])
        self.assertEqual(len(resultados), 2)
        self.assertEqual({item[0] for item in resultados}, {'cs_test_concurrente'})
        self.assertEqual(models.CheckoutStripe.objects.count(), 1)
        self.assertEqual(
            models.CheckoutStripe.objects.get().status, 'abierta',
        )


@override_settings(**STRIPE_TEST_SETTINGS)
class WebhookTests(BaseFacturacionTests):
    def test_firma_invalida_no_procesa_ni_crea_evento(self):
        self.cliente_stripe_local()
        cliente = self.fake_cliente()
        cliente.construct_event.side_effect = ValueError('firma inválida')
        with patch.object(facturacion, '_cliente', return_value=cliente):
            response = self.client.post(
                '/api/v1/stripe/webhook/',
                data=b'{"id": "evt_invalido"}',
                content_type='application/json',
                HTTP_STRIPE_SIGNATURE='t=1,v1=invalida',
            )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(models.EventoStripe.objects.exists())

    def test_evento_live_es_rechazado(self):
        self.cliente_stripe_local()
        evento = self.evento(
            'customer.subscription.created',
            self.suscripcion_stripe(),
        )
        evento['livemode'] = True
        cliente = self.fake_cliente()
        cliente.construct_event.return_value = evento
        with patch.object(facturacion, '_cliente', return_value=cliente):
            response = self.client.post(
                '/api/v1/stripe/webhook/',
                data=b'{"id": "evt_live"}',
                content_type='application/json',
                HTTP_STRIPE_SIGNATURE='t=1,v1=firma',
            )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(models.EventoStripe.objects.exists())

    def test_subscription_created_activa_premium_solo_por_webhook_verificado(self):
        self.cliente_stripe_local()
        suscripcion = self.suscripcion_stripe()
        cliente = self.fake_cliente()
        cliente.v1.subscriptions.retrieve.return_value = suscripcion
        evento = self.evento('customer.subscription.created', suscripcion)
        response = self.webhook(evento, cliente)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data['procesado'])
        self.assertEqual(planes.plan_actual(self.business).codigo, 'premium')
        local = models.Suscripcion.objects.get(stripe_subscription_id='sub_test_1')
        self.assertEqual(local.status, 'activa')
        self.assertEqual(local.stripe_mode, 'test')
        self.assertEqual(local.stripe_price_id, 'price_monthly_test')
        self.assertEqual(local.ultimo_evento_stripe_creado, evento['created'])
        self.assertTrue(models.EventoStripe.objects.filter(
            event_id='evt_test_1', status='procesado',
        ).exists())

    def test_evento_duplicado_no_duplica_suscripcion_ni_pago(self):
        self.cliente_stripe_local()
        suscripcion = self.suscripcion_stripe()
        factura = {
            'id': 'in_test_1',
            'object': 'invoice',
            'livemode': False,
            'status': 'paid',
            'customer': 'cus_test_1',
            'amount_paid': 39900,
            'amount_due': 39900,
            'currency': 'mxn',
            'attempt_count': 1,
            'hosted_invoice_url': 'https://invoice.stripe.com/test',
            'period_start': int(timezone.now().timestamp()) - 86400,
            'period_end': int(timezone.now().timestamp()) + 30 * 86400,
            'parent': {
                'subscription_details': {'subscription': 'sub_test_1'},
            },
            'status_transitions': {
                'paid_at': int(timezone.now().timestamp()),
            },
        }
        cliente = self.fake_cliente()
        cliente.v1.subscriptions.retrieve.return_value = suscripcion
        cliente.v1.invoices.retrieve.return_value = factura
        evento = self.evento('invoice.paid', factura, event_id='evt_pago_1')
        primera = self.webhook(evento, cliente)
        segunda = self.webhook(evento, cliente)
        self.assertEqual(primera.status_code, 200)
        self.assertEqual(segunda.status_code, 200)
        self.assertTrue(segunda.data['duplicado'])
        self.assertEqual(models.EventoStripe.objects.count(), 1)
        self.assertEqual(models.Suscripcion.objects.filter(
            stripe_subscription_id='sub_test_1',
        ).count(), 1)
        self.assertEqual(models.Pago.objects.filter(
            stripe_invoice_id='in_test_1',
        ).count(), 1)

    def test_evento_fuera_de_orden_es_ignorado(self):
        self.cliente_stripe_local()
        local = self.activar_premium(self.suscripcion_stripe())
        local.ultimo_evento_stripe_creado = 200
        local.save(update_fields=['ultimo_evento_stripe_creado'])
        evento_viejo = self.evento(
            'customer.subscription.updated',
            self.suscripcion_stripe(status='canceled'),
            event_id='evt_viejo',
            created=100,
        )
        cliente = self.fake_cliente()
        respuesta = self.webhook(evento_viejo, cliente)
        self.assertEqual(respuesta.status_code, 200)
        self.assertFalse(respuesta.data['procesado'])
        cliente.v1.subscriptions.retrieve.assert_not_called()
        local.refresh_from_db()
        self.assertEqual(local.status, 'activa')
        self.assertEqual(planes.plan_actual(self.business).codigo, 'premium')

    def test_pago_fallido_mantiene_gracia_acotada_y_luego_cae_a_free(self):
        self.cliente_stripe_local()
        self.activar_premium(self.suscripcion_stripe())
        ahora = int(timezone.now().timestamp())
        factura = {
            'id': 'in_fallida',
            'object': 'invoice',
            'livemode': False,
            'status': 'open',
            'customer': 'cus_test_1',
            'amount_due': 39900,
            'amount_remaining': 39900,
            'currency': 'mxn',
            'attempt_count': 1,
            'hosted_invoice_url': 'https://invoice.stripe.com/fallida',
            'period_start': ahora,
            'period_end': ahora + 30 * 86400,
            'parent': {
                'subscription_details': {'subscription': 'sub_test_1'},
            },
            'status_transitions': {'paid_at': None},
        }
        suscripcion = self.suscripcion_stripe(
            status='past_due',
            current_period_end=ahora + 86400,
        )
        cliente = self.fake_cliente()
        cliente.v1.subscriptions.retrieve.return_value = suscripcion
        cliente.v1.invoices.retrieve.return_value = factura
        evento = self.evento(
            'invoice.payment_failed', factura, event_id='evt_fallo',
        )
        respuesta = self.webhook(evento, cliente)
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        local = models.Suscripcion.objects.get(stripe_subscription_id='sub_test_1')
        self.assertEqual(local.status, 'pendiente')
        self.assertIsNotNone(local.gracia_fin)
        self.assertGreater(local.gracia_fin, timezone.now())
        self.assertEqual(planes.plan_actual(self.business).codigo, 'premium')
        pago = models.Pago.objects.get(stripe_invoice_id='in_fallida')
        self.assertEqual(pago.status, 'pendiente')

        local.gracia_fin = timezone.now() - timedelta(minutes=1)
        local.save(update_fields=['gracia_fin'])
        self.assertEqual(planes.plan_actual(self.business).codigo, 'free')

    def test_renovacion_actualiza_periodo_y_no_duplica_pago(self):
        self.cliente_stripe_local()
        self.activar_premium(self.suscripcion_stripe())
        ahora = int(timezone.now().timestamp())
        nueva_fin = ahora + 60 * 86400
        suscripcion = self.suscripcion_stripe(
            current_period_start=ahora,
            current_period_end=nueva_fin,
        )
        factura = {
            'id': 'in_renovacion',
            'object': 'invoice',
            'livemode': False,
            'status': 'paid',
            'customer': 'cus_test_1',
            'amount_paid': 39900,
            'amount_due': 0,
            'currency': 'mxn',
            'attempt_count': 1,
            'hosted_invoice_url': 'https://invoice.stripe.com/renovacion',
            'period_start': ahora,
            'period_end': nueva_fin,
            'parent': {
                'subscription_details': {'subscription': 'sub_test_1'},
            },
            'status_transitions': {'paid_at': ahora},
        }
        cliente = self.fake_cliente()
        cliente.v1.subscriptions.retrieve.return_value = suscripcion
        cliente.v1.invoices.retrieve.return_value = factura
        evento = self.evento(
            'invoice.paid', factura, event_id='evt_renovacion',
        )
        self.assertEqual(self.webhook(evento, cliente).status_code, 200)
        local = models.Suscripcion.objects.get(stripe_subscription_id='sub_test_1')
        self.assertEqual(local.status, 'activa')
        self.assertEqual(
            int(local.periodo_actual_fin.timestamp()), nueva_fin,
        )
        self.assertEqual(models.Pago.objects.filter(
            stripe_invoice_id='in_renovacion',
        ).count(), 1)
        self.assertEqual(self.webhook(evento, cliente).status_code, 200)
        self.assertEqual(models.Pago.objects.filter(
            stripe_invoice_id='in_renovacion',
        ).count(), 1)

    def test_cancelacion_al_final_del_periodo_conserva_premium_y_alianza(self):
        self.cliente_stripe_local()
        self.activar_premium(self.suscripcion_stripe())
        otro = crear_negocio()
        alianza = models.Alianza.objects.create(
            negocio1=self.business,
            negocio2=otro,
            condicion_participacion='Beneficio mutuo.',
            status='activa',
            fecha_inicio=timezone.now() - timedelta(days=1),
            fecha_fin=timezone.now() + timedelta(days=30),
        )
        cupon = crear_cupon(
            crear_usuario(), self.business,
            crear_recompensa(self.business),
        )
        ahora = int(timezone.now().timestamp())
        fin = ahora + 10 * 86400
        suscripcion = self.suscripcion_stripe(
            cancel_at_period_end=True,
            current_period_end=fin,
        )
        cliente = self.fake_cliente()
        cliente.v1.subscriptions.retrieve.return_value = suscripcion
        evento_updated = self.evento(
            'customer.subscription.updated', suscripcion,
            event_id='evt_cancelacion_programada',
        )
        self.assertEqual(self.webhook(evento_updated, cliente).status_code, 200)
        local = models.Suscripcion.objects.get(stripe_subscription_id='sub_test_1')
        self.assertTrue(local.en_cancelacion)
        self.assertEqual(local.status, 'activa')
        self.assertEqual(planes.plan_actual(self.business).codigo, 'premium')

        suscripcion_cancelada = self.suscripcion_stripe(
            status='canceled',
            cancel_at_period_end=False,
            canceled_at=fin,
            ended_at=fin,
            current_period_end=fin,
        )
        cliente.v1.subscriptions.retrieve.return_value = suscripcion_cancelada
        evento_deleted = self.evento(
            'customer.subscription.deleted', suscripcion_cancelada,
            event_id='evt_cancelacion_final',
        )
        self.assertEqual(self.webhook(evento_deleted, cliente).status_code, 200)
        local.refresh_from_db()
        self.assertEqual(local.status, 'cancelada')
        self.assertEqual(planes.plan_actual(self.business).codigo, 'free')
        self.assertTrue(models.Alianza.objects.filter(pk=alianza.pk).exists())
        self.assertTrue(models.CuponUsuario.objects.filter(pk=cupon.pk).exists())
        self.assertEqual(cupon.status, 'disponible')
        self.assertEqual(planes.limite(self.business, 'alianzas_activas'), 1)
        self.assertFalse(planes.puede_crear(self.business, 'alianzas_activas'))
        self.assertTrue(models.Suscripcion.objects.filter(
            negocio=self.business, plan__codigo='free', status='activa',
        ).exists())

    def test_cancelacion_inmediata_verificada_quita_premium_al_momento(self):
        self.cliente_stripe_local()
        self.activar_premium(self.suscripcion_stripe())
        ahora = int(timezone.now().timestamp())
        cancelada = self.suscripcion_stripe(
            status='canceled',
            canceled_at=ahora,
            ended_at=ahora,
            current_period_end=ahora,
        )
        cliente = self.fake_cliente()
        cliente.v1.subscriptions.retrieve.return_value = cancelada
        evento = self.evento(
            'customer.subscription.deleted', cancelada,
            event_id='evt_cancelacion_inmediata',
        )
        self.assertEqual(self.webhook(evento, cliente).status_code, 200)
        self.assertEqual(planes.plan_actual(self.business).codigo, 'free')

    def test_evento_de_otro_negocio_no_altera_el_plan_local(self):
        otro = crear_negocio()
        models.ClienteStripe.objects.create(
            negocio=otro, stripe_mode='test',
            stripe_customer_id='cus_otro',
        )
        cliente = self.fake_cliente()
        cliente.v1.subscriptions.retrieve.return_value = self.suscripcion_stripe(
            customer='cus_otro',
            metadata={'benefy_negocio_id': str(otro.pk)},
        )
        evento = self.evento(
            'customer.subscription.created',
            self.suscripcion_stripe(customer='cus_otro'),
        )
        self.assertEqual(self.webhook(evento, cliente).status_code, 200)
        self.assertEqual(planes.plan_actual(self.business).codigo, 'free')
        self.assertEqual(planes.plan_actual(otro).codigo, 'premium')


@override_settings(**STRIPE_TEST_SETTINGS)
class PortalTests(BaseFacturacionTests):
    def test_portal_configura_cancelacion_solo_al_final_del_periodo(self):
        self.cliente_stripe_local()
        self.auth()
        cliente = self.fake_cliente()
        cliente.v1.billing_portal.configurations.create.return_value = {
            'id': 'bpc_test_1', 'livemode': False,
        }
        # Reproduce el contrato real de Stripe: es un objeto con atributos,
        # no un dict, por lo que no implementa ``.get()``.
        cliente.v1.billing_portal.sessions.create.return_value = SimpleNamespace(
            id='bps_test_1',
            livemode=False,
            url='https://billing.stripe.com/p/session/test',
        )
        with patch.object(facturacion, '_cliente', return_value=cliente):
            response = self.client.post(
                f'/api/v1/negocios/{self.business.pk}/facturacion/portal/',
            )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(
            response.data['url'],
            'https://billing.stripe.com/p/session/test',
        )
        config = cliente.v1.billing_portal.configurations.create.call_args.args[0]
        self.assertTrue(config['features']['invoice_history']['enabled'])
        self.assertTrue(config['features']['payment_method_update']['enabled'])
        self.assertTrue(config['features']['subscription_cancel']['enabled'])
        self.assertEqual(
            config['features']['subscription_cancel']['mode'],
            'at_period_end',
        )
        self.assertFalse(config['features']['subscription_update']['enabled'])
        self.assertEqual(planes.plan_actual(self.business).codigo, 'free')

    def test_servicio_portal_devuelve_contrato_plano_y_no_stripe_object(self):
        self.cliente_stripe_local()
        cliente = self.fake_cliente()
        cliente.v1.billing_portal.sessions.create.return_value = SimpleNamespace(
            id='bps_test_1',
            livemode=False,
            url='https://billing.stripe.com/p/session/test',
        )
        with patch.object(facturacion, '_cliente', return_value=cliente):
            sesion = facturacion.crear_sesion_portal(self.business)
        self.assertIsInstance(sesion, dict)
        self.assertEqual(sesion['url'], 'https://billing.stripe.com/p/session/test')

    def test_portal_no_expone_detalle_de_error_inesperado(self):
        self.cliente_stripe_local()
        self.auth()
        with patch.object(
            facturacion,
            'crear_sesion_portal',
            side_effect=RuntimeError('sk_test_secreto_no_debe_salir'),
        ):
            response = self.client.post(
                f'/api/v1/negocios/{self.business.pk}/facturacion/portal/',
            )
        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.data['codigo'], 'portal_no_disponible')
        contenido = str(response.data)
        self.assertNotIn('sk_test_', contenido)
        self.assertNotIn('RuntimeError', contenido)
        self.assertNotIn('secreto', contenido)

    def test_regreso_del_portal_no_cambia_plan_sin_stripe(self):
        self.cliente_stripe_local()
        self.auth()
        cliente = self.fake_cliente()
        cliente.v1.subscriptions.list.return_value = {'data': []}
        cliente.v1.invoices.list.return_value = {'data': []}
        with patch.object(facturacion, '_cliente', return_value=cliente):
            response = self.client.post(
                f'/api/v1/negocios/{self.business.pk}/facturacion/sincronizar/',
                {},
                format='json',
            )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(planes.plan_actual(self.business).codigo, 'free')
