"""Auditoría de solo lectura de propietarios con más de un negocio activo."""

from django.core.management.base import BaseCommand
from django.db.models import Count, Q

from core import models


class Command(BaseCommand):
    help = (
        'Lista cuentas con más de un negocio activo como propietarias, sus '
        'sucursales, historial y referencias de facturación. No modifica datos.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--correo', help='Filtra una cuenta concreta.')

    def handle(self, *args, **options):
        filtro = {}
        if options.get('correo'):
            filtro['usuario__correo__iexact'] = options['correo'].strip()

        duplicados = list(
            models.UsuarioNegocio.objects.filter(
                rol_comercio='dueno',
                sucursal__isnull=True,
                status=True,
                **filtro,
            ).values('usuario_id', 'usuario__correo').annotate(
                total=Count('negocio_id', distinct=True),
            ).filter(total__gt=1).order_by('usuario__correo')
        )
        if not duplicados:
            self.stdout.write('No hay cuentas con más de un negocio activo como propietarias.')
            return

        for fila in duplicados:
            self.stdout.write(
                f"\nCuenta {fila['usuario__correo']} "
                f"(usuario_id={fila['usuario_id']}): {fila['total']} negocios con propiedad activa"
            )
            propietarios = models.UsuarioNegocio.objects.filter(
                usuario_id=fila['usuario_id'],
                rol_comercio='dueno',
                sucursal__isnull=True,
                status=True,
            ).select_related('negocio')
            for membresia in propietarios.order_by('negocio_id'):
                negocio = membresia.negocio
                self._negocio(negocio)
            self.stdout.write(
                'Acción: decidir un negocio a conservar y transferir o desactivar '
                'los demás con corregir_propietario_unico.'
            )

    def _negocio(self, negocio):
        self.stdout.write(
            f"  negocio_id={negocio.pk} nombre={negocio.nombre!r} "
            f"categoria={negocio.categoria.nombre!r} "
            f"slug={negocio.slug!r} estado={'activo' if negocio.status else 'inactivo'}"
        )
        self.stdout.write(
            '    sucursales: ' + ', '.join(
                f'{s.pk}:{s.nombre}' for s in negocio.sucursal_set.order_by('pk')
            )
        )
        self.stdout.write(
            '    propietarios: ' + ', '.join(
                f'{m.usuario_id}:{m.usuario.correo}'
                for m in models.UsuarioNegocio.objects.filter(
                    negocio=negocio,
                    rol_comercio='dueno',
                    sucursal__isnull=True,
                ).select_related('usuario')
            )
        )
        conteos = {
            'visitas': models.RegistroActividad.objects.filter(negocio=negocio).count(),
            'saldos': models.SaldoPuntos.objects.filter(negocio=negocio).count(),
            'lotes': models.LotePuntos.objects.filter(negocio=negocio).count(),
            'movimientos': models.MovimientoPuntos.objects.filter(negocio=negocio).count(),
            'ciclos': models.CicloTarjeta.objects.filter(negocio=negocio).count(),
            'cupones': models.CuponUsuario.objects.filter(negocio=negocio).count(),
            'canjes': models.Canje.objects.filter(negocio=negocio).count(),
            'recompensas': models.Recompensa.objects.filter(negocio=negocio).count(),
            'dinamicas': models.Dinamica.objects.filter(negocio=negocio).count(),
            'alianzas': models.Alianza.objects.filter(
                Q(negocio1=negocio) | Q(negocio2=negocio),
            ).count(),
            'suscripciones': models.Suscripcion.objects.filter(negocio=negocio).count(),
            'pagos': models.Pago.objects.filter(negocio=negocio).count(),
        }
        self.stdout.write(
            '    conteos: ' + ', '.join(f'{clave}={valor}' for clave, valor in conteos.items())
        )
        suscripciones = models.Suscripcion.objects.filter(
            negocio=negocio,
        ).select_related('plan').order_by('pk')
        for suscripcion in suscripciones:
            self.stdout.write(
                f"    suscripción id={suscripcion.pk} plan={suscripcion.plan.codigo} "
                f"status={suscripcion.status} origen={suscripcion.origen} "
                f"stripe_mode={suscripcion.stripe_mode or '—'} "
                f"stripe_subscription={self._referencia(suscripcion.stripe_subscription_id)}"
            )
        for pago in models.Pago.objects.filter(negocio=negocio).order_by('pk'):
            self.stdout.write(
                f"    pago id={pago.pk} status={pago.status} "
                f"monto={pago.monto} {pago.divisa} "
                f"stripe_invoice={self._referencia(pago.stripe_invoice_id)}"
            )
        for alianza in models.Alianza.objects.filter(
            Q(negocio1=negocio) | Q(negocio2=negocio),
        ).order_by('pk'):
            self.stdout.write(
                f"    alianza id={alianza.pk} status={alianza.status} "
                f"negocio1={alianza.negocio1_id} negocio2={alianza.negocio2_id}"
            )

    @staticmethod
    def _referencia(valor):
        if not valor:
            return '—'
        return f'…{valor[-6:]}'
