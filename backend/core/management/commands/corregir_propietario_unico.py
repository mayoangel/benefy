"""Corrección explícita de cuentas con más de un negocio propietario.

Por defecto solo muestra el plan. No borra negocios ni fusiona historiales.
Requiere --apply y confirmar el correo de la cuenta.
"""

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from core import models
from core.services import membresias


class Command(BaseCommand):
    help = (
        'Transfiere o desactiva negocios adicionales de una cuenta para que '
        'conserve un único negocio activo. No elimina datos ni fusiona entidades.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--correo', required=True)
        parser.add_argument('--conservar', type=int, required=True)
        parser.add_argument('--desactivar', type=int, action='append', default=[])
        parser.add_argument(
            '--transferir',
            action='append',
            default=[],
            help='Formato negocio_id:usuario_id. El destinatario no debe tener otro negocio activo.',
        )
        parser.add_argument('--confirmar-correo')
        parser.add_argument('--apply', action='store_true')

    def handle(self, *args, **options):
        correo = options['correo'].strip()
        usuario = models.Usuario.objects.filter(correo__iexact=correo).first()
        if usuario is None:
            raise CommandError('La cuenta indicada no existe.')

        activas = list(
            models.UsuarioNegocio.objects.filter(
                usuario=usuario,
                rol_comercio='dueno',
                sucursal__isnull=True,
                status=True,
            ).select_related('negocio').order_by('negocio_id')
        )
        if len(activas) <= 1:
            self.stdout.write('La cuenta ya cumple la regla de un negocio activo.')
            return

        por_negocio = {m.negocio_id: m for m in activas}
        if options['conservar'] not in por_negocio:
            raise CommandError('--conservar debe ser uno de los negocios activos de la cuenta.')

        desactivar = set(options['desactivar'])
        transferir = {}
        for valor in options['transferir']:
            try:
                negocio_id, usuario_id = (int(parte) for parte in valor.split(':', 1))
            except (TypeError, ValueError):
                raise CommandError('--transferir debe usar negocio_id:usuario_id.') from None
            if negocio_id in transferir:
                raise CommandError('Hay más de una transferencia para el mismo negocio.')
            transferir[negocio_id] = usuario_id

        if options['conservar'] in desactivar or options['conservar'] in transferir:
            raise CommandError('El negocio que se conserva no puede transferirse ni desactivarse.')
        if desactivar & set(transferir):
            raise CommandError('Un negocio no puede transferirse y desactivarse a la vez.')

        adicionales = set(por_negocio) - {options['conservar']}
        sin_resolver = adicionales - desactivar - set(transferir)
        if sin_resolver:
            raise CommandError(
                'Faltan decisiones para los negocios: '
                + ', '.join(str(item) for item in sorted(sin_resolver))
            )
        desconocidos = (desactivar | set(transferir)) - adicionales
        if desconocidos:
            raise CommandError(
                'Los negocios indicados no son propiedades adicionales activas: '
                + ', '.join(str(item) for item in sorted(desconocidos))
            )

        destinos = {}
        for negocio_id, usuario_id in transferir.items():
            destino = models.Usuario.objects.filter(pk=usuario_id, is_active=True).first()
            if destino is None:
                raise CommandError(f'El usuario destino {usuario_id} no existe o está inactivo.')
            if destino.pk == usuario.pk:
                raise CommandError('No se puede transferir un negocio a la misma cuenta.')
            if membresias.propietario_activo(destino) is not None:
                raise CommandError(
                    f'El usuario destino {usuario_id} ya es propietario de un negocio activo.'
                )
            destinos[negocio_id] = destino

        self.stdout.write(f'Cuenta: {usuario.correo} (id={usuario.pk})')
        self.stdout.write(f'Conservar: negocio {options["conservar"]} ({por_negocio[options["conservar"]].negocio.nombre})')
        for negocio_id in sorted(adicionales):
            if negocio_id in desactivar:
                self.stdout.write(f'Desactivar: negocio {negocio_id} ({por_negocio[negocio_id].negocio.nombre})')
            else:
                self.stdout.write(
                    f'Transferir: negocio {negocio_id} '
                    f'({por_negocio[negocio_id].negocio.nombre}) -> '
                    f'{destinos[negocio_id].correo} (id={destinos[negocio_id].pk})'
                )

        if not options['apply']:
            self.stdout.write('Modo seguro: no se escribió nada. Usa --apply para ejecutar.')
            return
        if (options.get('confirmar_correo') or '').strip().lower() != correo.lower():
            raise CommandError('Debes confirmar el correo con --confirmar-correo.')

        with transaction.atomic():
            for negocio_id in sorted(desactivar):
                negocio = por_negocio[negocio_id].negocio
                negocio.status = False
                negocio.save(update_fields=['status', 'fecha_actualizacion'])
                membresias.desactivar_membresia(
                    membresia=por_negocio[negocio_id],
                    actor=None,
                    motivo='Corrección de propiedad única: negocio adicional desactivado.',
                    validar_propietario=False,
                )
            for negocio_id, destino in destinos.items():
                membresias.actualizar_membresia(
                    membresia=por_negocio[negocio_id],
                    cambios={'usuario': destino},
                    actor=None,
                    motivo='Corrección de propiedad única: transferencia autorizada.',
                )
            if len(models.UsuarioNegocio.objects.filter(
                usuario=usuario,
                rol_comercio='dueno',
                sucursal__isnull=True,
                status=True,
            )) != 1:
                raise CommandError('La corrección no dejó exactamente un negocio activo.')

        self.stdout.write('Corrección aplicada; no se eliminaron negocios ni historiales.')
