"""Expira los lotes de puntos vencidos."""

from django.core.management.base import BaseCommand

from core import models
from core.services.lealtad import puntos


class Command(BaseCommand):
    help = 'Expira los lotes de puntos cuya fecha de vencimiento ya pasó.'

    def add_arguments(self, parser):
        parser.add_argument('--usuario', type=int, help='Limita a un usuario.')
        parser.add_argument('--negocio', type=int, help='Limita a un negocio.')

    def handle(self, *args, **options):
        usuario = None
        negocio = None
        if options.get('usuario'):
            usuario = models.Usuario.objects.get(pk=options['usuario'])
        if options.get('negocio'):
            negocio = models.Negocio.objects.get(pk=options['negocio'])
        total = puntos.expirar_puntos(usuario=usuario, negocio=negocio)
        self.stdout.write(self.style.SUCCESS(f'Puntos expirados: {total}'))
