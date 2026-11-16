# Migración de datos del refactor de membresías.

from collections import Counter

from django.db import migrations


def migrar(apps, schema_editor):
    Usuario = apps.get_model('core', 'Usuario')
    UsuarioNegocio = apps.get_model('core', 'UsuarioNegocio')
    AuditoriaMembresia = apps.get_model('core', 'AuditoriaMembresia')
    db = schema_editor.connection.alias

    errores = []
    claves = Counter()
    for membresia in UsuarioNegocio.objects.using(db).select_related(
        'usuario', 'negocio', 'sucursal',
    ):
        if membresia.rol_comercio == 'dueno' and membresia.sucursal_id is not None:
            errores.append(
                f'membresía {membresia.pk}: dueño con sucursal asignada'
            )
        if membresia.rol_comercio in ('admin', 'supervisor', 'empleado') and membresia.sucursal_id is None:
            errores.append(
                f'membresía {membresia.pk}: {membresia.rol_comercio} sin sucursal'
            )
        if membresia.sucursal_id and membresia.sucursal.negocio_id != membresia.negocio_id:
            errores.append(
                f'membresía {membresia.pk}: sucursal de otro negocio'
            )
        claves[(membresia.usuario_id, membresia.negocio_id, membresia.sucursal_id)] += 1

    duplicadas = [clave for clave, total in claves.items() if total > 1]
    if duplicadas:
        errores.append(f'membresías duplicadas: {duplicadas[:10]}')

    if errores:
        raise RuntimeError(
            'No se puede aplicar el refactor de membresías; corrige primero: '
            + '; '.join(errores[:20])
        )

    # El rol global "negocio" queda obsoleto: todos los usuarios activos
    # conservan su capacidad de consumidor y acceden a comercios por membresía.
    Usuario.objects.using(db).filter(rol='negocio').update(rol='consumidor')

    # El rol comercial "admin" pasa a llamarse "supervisor" sin cambiar permisos.
    for membresia in UsuarioNegocio.objects.using(db).filter(
        rol_comercio='admin',
    ).select_related('usuario', 'negocio', 'sucursal'):
        anterior = {'rol_comercio': 'admin'}
        nuevo = {'rol_comercio': 'supervisor'}
        membresia.rol_comercio = 'supervisor'
        membresia.save(using=db, update_fields=['rol_comercio'])
        AuditoriaMembresia.objects.using(db).create(
            membresia_id=membresia.pk,
            usuario_id=membresia.usuario_id,
            usuario_correo=membresia.usuario.correo,
            negocio_id=membresia.negocio_id,
            negocio_nombre=membresia.negocio.nombre,
            sucursal_id=membresia.sucursal_id,
            sucursal_nombre=(
                membresia.sucursal.nombre if membresia.sucursal_id else ''
            ),
            rol_comercio='supervisor',
            accion='migracion',
            datos_anteriores=anterior,
            datos_nuevos=nuevo,
            motivo='Migración de nomenclatura admin→supervisor',
        )


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0008_membresias_esquema'),
    ]

    operations = [
        migrations.RunPython(migrar, migrations.RunPython.noop),
    ]
