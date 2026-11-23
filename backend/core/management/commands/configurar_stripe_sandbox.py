"""Enlaza el catálogo Premium de Django con Stripe Sandbox.

Es idempotente: reutiliza el producto y los Price IDs existentes cuando monto,
divisa y periodicidad coinciden. Nunca imprime claves ni crea objetos live.
"""

from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from core import models
from core.services import facturacion


class Command(BaseCommand):
    help = (
        'Crea o reutiliza el producto y precios de Premium en Stripe Sandbox '
        'y actualiza PlanPrecio. Requiere claves test válidas.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--product-id', default='')
        parser.add_argument('--monthly-price-id', default='')
        parser.add_argument('--annual-price-id', default='')
        parser.add_argument(
            '--no-portal', action='store_true',
            help='No crea/verifica la configuración del Customer Portal.',
        )

    def handle(self, *args, **options):
        try:
            facturacion._entorno_stripe()  # noqa: SLF001 - validación central
        except facturacion.ErrorFacturacion as exc:
            raise CommandError(str(exc.detail.get('detalle'))) from None
        cliente = facturacion._cliente()  # noqa: SLF001

        producto = self._producto(
            cliente,
            options['product_id']
            or settings.STRIPE_PREMIUM_PRODUCT_ID,
        )
        precios = self._precios(cliente, producto, options)
        portal_id = None
        if not options['no_portal']:
            try:
                portal_id = facturacion._configuracion_portal(cliente)  # noqa: SLF001
            except facturacion.ErrorFacturacion as exc:
                self.stderr.write(
                    'Customer Portal no configurado: '
                    + str(exc.detail.get('detalle'))
                )

        self.stdout.write(self.style.SUCCESS('Catálogo Stripe Sandbox listo.'))
        self.stdout.write(f'Producto: {producto.id}')
        for intervalo, price in precios.items():
            self.stdout.write(
                f'{intervalo}: {price.id} · '
                f'{price.unit_amount / 100:.2f} {price.currency.upper()}'
            )
        if portal_id:
            self.stdout.write(f'Customer Portal configuration: {portal_id}')
            self.stdout.write(
                'Opcional: define STRIPE_PORTAL_CONFIGURATION_ID para reutilizarla.'
            )

    def _producto(self, cliente, product_id):
        if product_id:
            try:
                producto = facturacion._ejecutar(  # noqa: SLF001
                    cliente.v1.products.retrieve, product_id,
                )
            except facturacion.ErrorFacturacion as exc:
                raise CommandError(
                    'No se pudo recuperar el producto indicado: '
                    + str(exc.detail.get('detalle'))
                ) from None
            facturacion.verificar_modo_test(producto)
            if producto.id.startswith('prod_'):
                return producto
            raise CommandError('El identificador de producto no es de Stripe.')

        productos = facturacion._ejecutar(  # noqa: SLF001
            cliente.v1.products.list,
            {'active': True, 'limit': 100},
        )
        for producto in facturacion._lista(productos, 'data'):  # noqa: SLF001
            metadata = facturacion._v(producto, 'metadata', {}) or {}  # noqa: SLF001
            if facturacion._v(metadata, 'benefy_plan') == 'premium':  # noqa: SLF001
                facturacion.verificar_modo_test(producto)
                return producto
        producto = facturacion._ejecutar(  # noqa: SLF001
            cliente.v1.products.create,
            {
                'name': 'Benefy Premium',
                'description': 'Suscripción Premium de Benefy (Sandbox).',
                'metadata': {
                    'benefy_plan': 'premium',
                    'benefy_environment': 'sandbox',
                },
            },
            options={'idempotency_key': 'benefy-product-premium-test-v1'},
        )
        facturacion.verificar_modo_test(producto)
        return producto

    def _precios(self, cliente, producto, options):
        premium = models.PlanSuscripcion.objects.filter(
            codigo='premium', status=True,
        ).first()
        if premium is None:
            raise CommandError('No existe el plan Premium activo en Django.')
        solicitados = {
            'mensual': (
                options['monthly_price_id']
                or settings.STRIPE_PREMIUM_PRICE_ID
            ),
            'anual': (
                options['annual_price_id']
                or settings.STRIPE_PREMIUM_ANNUAL_PRICE_ID
            ),
        }
        resultado = {}
        with transaction.atomic():
            for intervalo in ('mensual', 'anual'):
                precio = models.PlanPrecio.objects.select_for_update().filter(
                    plan=premium, intervalo=intervalo,
                ).first()
                if precio is None or precio.monto is None or precio.monto <= 0:
                    raise CommandError(
                        f'Falta el monto {intervalo} en PlanPrecio.'
                    )
                price = self._resolver_precio(
                    cliente=cliente,
                    producto=producto,
                    precio_local=precio,
                    price_id=solicitados[intervalo],
                )
                precio.stripe_price_id = price.id
                precio.divisa = precio.divisa or 'MXN'
                precio.status = True
                precio.save(update_fields=[
                    'stripe_price_id', 'divisa', 'status',
                ])
                resultado[intervalo] = price
        return resultado

    def _resolver_precio(self, cliente, producto, precio_local, price_id):
        if price_id:
            price = facturacion._ejecutar(  # noqa: SLF001
                cliente.v1.prices.retrieve, price_id,
            )
            facturacion.verificar_modo_test(price)
            self._validar_price(price, producto, precio_local)
            return price
        precios = facturacion._ejecutar(  # noqa: SLF001
            cliente.v1.prices.list,
            {'product': producto.id, 'active': True, 'limit': 100},
        )
        for price in facturacion._lista(precios, 'data'):  # noqa: SLF001
            try:
                self._validar_price(price, producto, precio_local)
            except CommandError:
                continue
            facturacion.verificar_modo_test(price)
            return price
        esperado = int(
            (precio_local.monto * Decimal('100')).to_integral_value(
                rounding=ROUND_HALF_UP,
            )
        )
        intervalo_stripe = 'month' if precio_local.intervalo == 'mensual' else 'year'
        price = facturacion._ejecutar(  # noqa: SLF001
            cliente.v1.prices.create,
            {
                'product': producto.id,
                'currency': precio_local.divisa.lower(),
                'unit_amount': esperado,
                'recurring': {'interval': intervalo_stripe},
                'nickname': f'Benefy Premium {precio_local.intervalo}',
                'metadata': {
                    'benefy_plan': 'premium',
                    'benefy_intervalo': precio_local.intervalo,
                    'benefy_environment': 'sandbox',
                },
            },
            options={
                'idempotency_key': (
                    f'benefy-price-premium-test-{precio_local.intervalo}-v1'
                ),
            },
        )
        facturacion.verificar_modo_test(price)
        self._validar_price(price, producto, precio_local)
        return price

    def _validar_price(self, price, producto, precio_local):
        if not facturacion._v(price, 'active', False):  # noqa: SLF001
            raise CommandError('El Price no está activo.')
        if facturacion._id(facturacion._v(producto, 'id')) != facturacion._id(  # noqa: SLF001
            facturacion._v(price, 'product'),  # noqa: SLF001
        ):
            raise CommandError('El Price pertenece a otro producto.')
        if str(price.currency).lower() != precio_local.divisa.lower():
            raise CommandError('La divisa del Price no coincide con Django.')
        esperado = int(
            (precio_local.monto * Decimal('100')).to_integral_value(
                rounding=ROUND_HALF_UP,
            )
        )
        if int(price.unit_amount or 0) != esperado:
            raise CommandError('El monto del Price no coincide con Django.')
        recurrente = facturacion._v(price, 'recurring', {}) or {}  # noqa: SLF001
        esperado_intervalo = 'month' if precio_local.intervalo == 'mensual' else 'year'
        if facturacion._v(recurrente, 'interval') != esperado_intervalo:  # noqa: SLF001
            raise CommandError('El intervalo del Price no coincide con Django.')
