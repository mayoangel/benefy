"""Cierre del esquema de planes: código obligatorio y retiro de campos legacy."""

from django.db import migrations, models


def rellenar_legacy(apps, schema_editor):
    """Permite revertir 0013 sin dejar nulos en el campo legacy restaurado."""
    Plan = apps.get_model('core', 'PlanSuscripcion')
    for plan in Plan.objects.filter(stripe_price_id__isnull=True):
        plan.stripe_price_id = f'reverso-{plan.pk}'
        plan.save(update_fields=['stripe_price_id'])


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0012_planes_datos'),
    ]

    operations = [
        # Su reverso se ejecuta al final de la reversión, antes de restaurar
        # el campo no nulo de 0010.
        migrations.RunPython(migrations.RunPython.noop, rellenar_legacy),
        migrations.AlterField(
            model_name='plansuscripcion',
            name='codigo',
            field=models.CharField(max_length=30, unique=True),
        ),
        migrations.RemoveField(
            model_name='plansuscripcion',
            name='intervalo',
        ),
        migrations.RemoveField(
            model_name='plansuscripcion',
            name='limite_dinamicas',
        ),
        migrations.RemoveField(
            model_name='plansuscripcion',
            name='limite_sucursales',
        ),
        migrations.RemoveField(
            model_name='plansuscripcion',
            name='stripe_price_id',
        ),
    ]
