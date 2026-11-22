"""Inspección de la conexión sin mostrar credenciales ni modificar datos."""

import json

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = 'Muestra el destino configurado; --connect verifica la conexión mediante SELECT.'

    def add_arguments(self, parser):
        parser.add_argument('--connect', action='store_true')

    def handle(self, *args, **options):
        database = settings.DATABASES['default']
        result = {
            'environment': settings.ENVIRONMENT,
            'engine': database['ENGINE'],
            'host': database['HOST'],
            'port': database['PORT'],
            'database': database['NAME'],
            'sslmode': database['OPTIONS'].get('sslmode'),
        }
        if options['connect']:
            with connection.cursor() as cursor:
                cursor.execute('SELECT current_database(), current_user')
                result['connected_database'], result['connected_user'] = cursor.fetchone()
            result['ssl_in_use'] = connection.connection.info.ssl_in_use
        self.stdout.write(json.dumps(result, ensure_ascii=False))
