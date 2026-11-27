# Migraciones de producción

Las migraciones de Benefy se aplican de forma controlada. No se ejecutan seeds,
resets ni migraciones sobre Supabase remoto desde el arranque del contenedor.

## Antes de migrar

1. Confirma el proyecto y la rama destino.
2. Crea un respaldo recuperable de Supabase PostgreSQL.
3. Ejecuta las pruebas contra PostgreSQL aislado:

```bash
python dev.py test-backend --local
```

4. Revisa el plan:

```bash
python manage.py migrate --plan
python manage.py showmigrations core
```

5. Verifica que el respaldo se pueda restaurar en un entorno aislado.

## Aplicación

En Railway, ejecuta como paso previo al despliegue o desde una shell del
servicio:

```bash
python manage.py migrate --noinput
```

No ejecutes este comando en cada réplica del contenedor. Usa un release/deploy
command único.

## Verificación

```bash
python manage.py showmigrations core
python manage.py check
```

Comprueba:

- `/health/live/` responde 200;
- `/health/db/` y `/health/ready/` responden 200;
- login y `/api/v1/autenticacion/perfil/`;
- resolución y registro de una visita;
- un endpoint de billetera con una cuenta de prueba;
- si Stripe está habilitado, el webhook Sandbox y la firma.

## Recuperación

- Si falla la aplicación, vuelve a la imagen anterior.
- Si falla una migración dentro de una transacción, corrige el problema antes de
  reintentar.
- Si los datos quedaron en un estado incompatible, restaura el respaldo en una
  ventana controlada.
- No edites migraciones ya aplicadas ni borres la tabla `django_migrations` para
  “reintentar”.

## Migraciones pendientes de este repositorio

`0021_eliminacion_cuenta` agrega el estado idempotente de baja de cuenta y
`0022_eliminacion_cuenta_storage` agrega las marcas de limpieza de avatares.
Ambas aparecen aplicadas en el destino al 2026-11-27.

`0023_propietario_unico_negocio` agrega la restricción de un solo negocio activo
por propietario. Se aplicó en remoto el 2026-11-27 después de crear y verificar
el respaldo `backups/benefy-20261127-042154-180465.dump`, corregir la cuenta
`business@benefy.com` y transferir sus negocios adicionales. La comprobación
previa de la migración sigue protegiendo cualquier destino que aún tenga cuentas
con más de una propiedad activa; el procedimiento está en
[propietario-unico.md](propietario-unico.md).

## Respaldo local de referencia

`python dev.py backup` crea un respaldo del proyecto de demostración verificado,
pero no sustituye el respaldo administrado de Supabase en producción. Los
archivos y recibos de respaldo no se versionan en Git.
