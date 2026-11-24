"""Reintenta eliminar identidades Supabase de bajas ya anonimizadas."""

from django.core.management.base import BaseCommand

from core.services import cuentas


class Command(BaseCommand):
    help = 'Reintenta las eliminaciones de cuenta pendientes en Supabase Auth.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--limite', type=int, default=100,
            help='Número máximo de solicitudes a procesar (por defecto 100).',
        )

    def handle(self, *args, **options):
        limite = max(1, min(int(options.get('limite') or 100), 1000))
        resultado = cuentas.reintentar_pendientes(limite=limite)
        self.stdout.write(self.style.SUCCESS(
            'Eliminaciones completadas: {completadas}; pendientes: {pendientes}'.format(
                **resultado,
            ),
        ))
