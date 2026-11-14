# Restricciones de integridad del motor de lealtad, posteriores a la corrección de datos.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0006_lealtad_datos_base'),
    ]

    operations = [
        migrations.AlterField(
            model_name='registroactividad',
            name='negocio',
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to='core.negocio'),
        ),
        migrations.AlterField(
            model_name='registroactividad',
            name='fecha_negocio',
            field=models.DateField(db_index=True),
        ),
        migrations.AddConstraint(
            model_name='canje',
            constraint=models.UniqueConstraint(fields=('cupon',), name='un_canje_por_cupon'),
        ),
        migrations.AddConstraint(
            model_name='cuponusuario',
            constraint=models.UniqueConstraint(
                condition=models.Q(('clave_idempotencia__isnull', False)),
                fields=('usuario', 'clave_idempotencia'),
                name='idempotencia_adquisicion_por_usuario',
            ),
        ),
        migrations.AddConstraint(
            model_name='dinamica',
            constraint=models.UniqueConstraint(
                condition=models.Q(('status', True), ('tipo', 'puntos')),
                fields=('negocio',),
                name='una_dinamica_puntos_activa_por_negocio',
            ),
        ),
        migrations.AddConstraint(
            model_name='negocio',
            constraint=models.UniqueConstraint(fields=('qr_uuid',), name='negocio_qr_unico'),
        ),
        migrations.AddConstraint(
            model_name='progresousuario',
            constraint=models.UniqueConstraint(
                fields=('usuario', 'dinamica'),
                name='progreso_unico_por_usuario_y_dinamica',
            ),
        ),
        migrations.AddConstraint(
            model_name='recompensa',
            constraint=models.UniqueConstraint(
                condition=models.Q(('es_meta', True)),
                fields=('dinamica',),
                name='una_recompensa_meta_por_dinamica',
            ),
        ),
        migrations.AddConstraint(
            model_name='recompensa',
            constraint=models.CheckConstraint(
                condition=models.Q(('negocio__isnull', False), ('alianza__isnull', False), _connector='OR'),
                name='recompensa_con_origen',
            ),
        ),
        migrations.AddConstraint(
            model_name='recompensa',
            constraint=models.CheckConstraint(
                condition=models.Q(('fecha_expiracion__isnull', False), ('vigencia_dias__isnull', False), _connector='OR'),
                name='recompensa_con_vigencia',
            ),
        ),
        migrations.AddConstraint(
            model_name='recompensa',
            constraint=models.CheckConstraint(
                condition=models.Q(('fecha_expiracion__isnull', True), ('vigencia_dias__isnull', True), _connector='OR'),
                name='recompensa_vigencia_unica',
            ),
        ),
        migrations.AddConstraint(
            model_name='recompensa',
            constraint=models.CheckConstraint(
                condition=models.Q(('es_meta', False), ('dinamica__isnull', False), _connector='OR'),
                name='meta_requiere_dinamica',
            ),
        ),
        migrations.AddConstraint(
            model_name='registroactividad',
            constraint=models.UniqueConstraint(
                condition=models.Q(('es_valida', True), ('tipo', 'visita')),
                fields=('usuario', 'negocio', 'fecha_negocio'),
                name='visita_unica_diaria_por_negocio',
            ),
        ),
    ]
