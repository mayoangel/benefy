"""Reconcilia suscripciones y facturas Sandbox consultando Stripe."""

from django.core.management.base import BaseCommand, CommandError

from core import models
from core.services import facturacion


class Command(BaseCommand):
    help = (
        'Consulta Stripe Sandbox y sincroniza suscripciones/pagos de uno o '
        'todos los negocios con Customer de prueba. No imprime secretos.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--negocio-id', type=int, default=None,
            help='Limita la reconciliación a un negocio.',
        )
        parser.add_argument(
            '--limite', type=int, default=50,
            help='Máximo de negocios a procesar (por defecto 50).',
        )

    def handle(self, *args, **options):
        try:
            facturacion._entorno_stripe()  # noqa: SLF001
        except facturacion.ErrorFacturacion as exc:
            raise CommandError(str(exc.detail.get('detalle'))) from None

        consulta = models.ClienteStripe.objects.filter(
            stripe_mode='test',
        ).select_related('negocio').order_by('negocio_id')
        if options['negocio_id']:
            consulta = consulta.filter(negocio_id=options['negocio_id'])
        consulta = consulta[:max(options['limite'], 1)]

        procesados = 0
        errores = 0
        for enlace in consulta:
            try:
                facturacion.reconciliar_negocio(enlace.negocio)
                procesados += 1
            except facturacion.ErrorFacturacion as exc:
                errores += 1
                self.stderr.write(
                    f'Negocio {enlace.negocio_id}: '
                    + str(exc.detail.get('detalle'))
                )
            except Exception as exc:
                errores += 1
                self.stderr.write(
                    f'Negocio {enlace.negocio_id}: error de reconciliación '
                    f'({type(exc).__name__}).'
                )
        self.stdout.write(
            self.style.SUCCESS(
                f'Reconciliados: {procesados}; errores: {errores}.'
            )
        )
