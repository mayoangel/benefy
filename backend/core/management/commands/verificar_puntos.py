"""Verifica que el saldo en caché coincida con la suma de lotes disponibles."""

import json

from django.core.management.base import BaseCommand, CommandError

from core.services.lealtad import puntos


class Command(BaseCommand):
    help = 'Compara SaldoPuntos con la suma de lotes disponibles.'

    def handle(self, *args, **options):
        # Normaliza primero los lotes vencidos para comparar el saldo real.
        puntos.expirar_puntos()
        diferencias = puntos.verificar_saldos()
        if diferencias:
            self.stdout.write(json.dumps(diferencias, indent=2, ensure_ascii=False))
            raise CommandError(f'Se encontraron {len(diferencias)} saldos inconsistentes.')
        self.stdout.write(self.style.SUCCESS('Todos los saldos son consistentes.'))
