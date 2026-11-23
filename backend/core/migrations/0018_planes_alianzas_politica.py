"""Actualiza el catálogo de planes para la política de alianzas.

Free participa con una alianza activa total. Premium puede tener una alianza
activa con un negocio Free, tres con negocios Premium y cuatro en total.
"""

from django.db import migrations


LIMITES_ALIANZAS = {
    'free': {
        'alianzas_activas': 1,
        'alianzas_con_free': 1,
        'alianzas_con_premium': 1,
    },
    'premium': {
        'alianzas_activas': 4,
        'alianzas_con_free': 1,
        'alianzas_con_premium': 3,
    },
}


def actualizar_planes(apps, schema_editor):
    Plan = apps.get_model('core', 'PlanSuscripcion')
    for plan in Plan.objects.all():
        limites = dict(plan.limites or {})
        valores = LIMITES_ALIANZAS.get(plan.codigo)
        if valores is None:
            # Un plan personalizado no gana capacidades por accidente.
            valores = {
                'alianzas_activas': 0,
                'alianzas_con_free': 0,
                'alianzas_con_premium': 0,
            }
        limites.update(valores)

        caracteristicas = dict(plan.caracteristicas or {})
        if plan.codigo == 'free':
            caracteristicas['alianzas'] = True
            caracteristicas['alianzas_proponer'] = False
        elif plan.codigo == 'premium':
            caracteristicas['alianzas'] = True
            caracteristicas['alianzas_proponer'] = True
        else:
            caracteristicas.setdefault('alianzas', False)
            caracteristicas.setdefault('alianzas_proponer', False)

        plan.limites = limites
        plan.caracteristicas = caracteristicas
        plan.save(update_fields=['limites', 'caracteristicas'])


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0017_recompensas_alianza_relacion'),
    ]

    operations = [
        migrations.RunPython(actualizar_planes, migrations.RunPython.noop),
    ]
