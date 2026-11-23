"""Fija el catálogo definitivo de Premium: 399 MXN/mes y 3,990 MXN/año."""

from decimal import Decimal

from django.db import migrations


PRECIOS = {
    'mensual': Decimal('399.00'),
    'anual': Decimal('3990.00'),
}


def fijar_precios(apps, schema_editor):
    Plan = apps.get_model('core', 'PlanSuscripcion')
    Precio = apps.get_model('core', 'PlanPrecio')
    premium = Plan.objects.filter(codigo='premium').first()
    if premium is None:
        return
    for intervalo, monto in PRECIOS.items():
        precio, _ = Precio.objects.get_or_create(
            plan=premium,
            intervalo=intervalo,
            defaults={'divisa': 'MXN', 'status': True},
        )
        precio.monto = monto
        precio.divisa = 'MXN'
        precio.status = True
        precio.save(update_fields=['monto', 'divisa', 'status'])


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0019_stripe_sandbox_esquema'),
    ]

    operations = [
        migrations.RunPython(fijar_precios, migrations.RunPython.noop),
    ]
