"""Identidad Supabase sin eliminar identificadores ni relaciones existentes."""

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [('core', '0003_alter_usuarionegocio_sucursal')]

    operations = [
        migrations.RenameField('usuario', 'firebase_uid', 'legacy_firebase_uid'),
        migrations.AlterField(
            model_name='usuario', name='legacy_firebase_uid',
            field=models.CharField(max_length=128, unique=True, null=True, blank=True, editable=False),
        ),
        migrations.AddField(
            model_name='usuario', name='supabase_uid',
            field=models.UUIDField(unique=True, null=True, blank=True, editable=False),
        ),
        migrations.AddField(
            model_name='usuario', name='is_active', field=models.BooleanField(default=True),
        ),
    ]
