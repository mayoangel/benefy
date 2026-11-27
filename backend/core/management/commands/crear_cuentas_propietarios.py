"""Crea cuentas verificadas para propietarios adicionales autorizados.

No modifica negocios ni membresías. Imprime las credenciales una sola vez y
exige destino confirmado y respaldo verificado antes de escribir en remoto.
"""

import json
import os
import secrets
from datetime import datetime, timezone
from uuid import UUID

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from core import models
from core.management.commands.seed_demo import (
    is_local_database,
    target_fingerprint,
    verify_remote_authorization,
)
from core.services.showcase_auth import AdminAuth


def _parse_cuenta(valor):
    partes = [parte.strip() for parte in str(valor).split(':', 2)]
    if len(partes) != 3 or not all(partes):
        raise CommandError('--cuenta debe usar correo:nombre:apellido.')
    correo, nombre, apellido = partes
    if '@' not in correo or len(correo) > 254:
        raise CommandError('El correo de la cuenta no es válido.')
    return {'correo': correo.lower(), 'nombre': nombre[:100], 'apellido': apellido[:100]}


class Command(BaseCommand):
    help = (
        'Crea cuentas de Supabase Auth verificadas y sus perfiles Django para '
        'transferirles negocios. No crea ni modifica negocios por sí mismo.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--cuenta',
            action='append',
            required=True,
            help='Formato correo:nombre:apellido. Se puede repetir.',
        )
        parser.add_argument('--apply', action='store_true')
        parser.add_argument('--allow-remote', action='store_true')
        parser.add_argument('--expected-target')
        parser.add_argument('--backup-receipt')

    def handle(self, *args, **options):
        cuentas = [_parse_cuenta(valor) for valor in options['cuenta']]
        correos = [cuenta['correo'] for cuenta in cuentas]
        if len(set(correos)) != len(correos):
            raise CommandError('Hay correos repetidos en --cuenta.')

        target = target_fingerprint()
        self.stdout.write(f'Destino: {target}')
        for cuenta in cuentas:
            self.stdout.write(f"Plan: {cuenta['correo']} ({cuenta['nombre']} {cuenta['apellido']})")

        if not options['apply']:
            self.stdout.write('Modo seguro: no se escribió nada. Usa --apply para ejecutar.')
            return
        if not is_local_database():
            verify_remote_authorization(options, target)

        repetidos = list(models.Usuario.objects.filter(
            correo__in=correos,
        ).values_list('correo', flat=True))
        if repetidos:
            raise CommandError(
                'Ya existen perfiles con estos correos: ' + ', '.join(sorted(repetidos))
            )

        key = os.getenv('SUPABASE_SECRET_KEY', '').strip()
        if not key:
            raise CommandError('Falta SUPABASE_SECRET_KEY para crear cuentas verificadas.')
        client = AdminAuth(key=key)
        auth_existentes = {
            (usuario.get('email') or '').lower()
            for usuario in client.users()
        }
        repetidos = sorted(set(correos) & auth_existentes)
        if repetidos:
            raise CommandError(
                'Ya existen cuentas Auth con estos correos: ' + ', '.join(repetidos)
            )

        creados = []
        credenciales = []
        try:
            with transaction.atomic():
                for cuenta in cuentas:
                    password = secrets.token_urlsafe(18)
                    auth_user = client.request('admin/users', {
                        'email': cuenta['correo'],
                        'email_confirm': True,
                        'password': password,
                        'user_metadata': {
                            'nombre': f"{cuenta['nombre']} {cuenta['apellido']}".strip(),
                        },
                    }, 'POST')
                    if not auth_user.get('email_confirmed_at'):
                        raise CommandError('Auth no confirmó el correo de la cuenta creada.')
                    creados.append(auth_user['id'])
                    usuario = models.Usuario.objects.create(
                        supabase_uid=UUID(auth_user['id']),
                        correo=cuenta['correo'],
                        nombre=cuenta['nombre'],
                        apellido=cuenta['apellido'],
                        rol='consumidor',
                    )
                    credenciales.append({
                        'correo': cuenta['correo'],
                        'password': password,
                        'usuario_id': usuario.pk,
                        'supabase_uid': str(usuario.supabase_uid),
                    })
        except Exception:
            for uid in creados:
                try:
                    client.request('admin/users/' + uid, method='DELETE')
                except Exception:
                    pass
            raise

        self.stdout.write('Cuentas creadas y verificadas. Guarda estas credenciales ahora; no se volverán a mostrar:')
        self.stdout.write(json.dumps({
            'creadas_en': datetime.now(timezone.utc).isoformat(),
            'target': target,
            'cuentas': credenciales,
        }, ensure_ascii=False, indent=2))
