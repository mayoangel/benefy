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
`0022_eliminacion_cuenta_storage` agrega las marcas de limpieza de avatares. No
se aplicaron en Supabase remoto durante esta implementación. Las migraciones
`0019` y `0020` se verificaron como aplicadas en el destino el 2026-11-24; las
migraciones `0021` y `0022` siguen pendientes de autorización y respaldo.

`0023_propietario_unico_negocio` agrega la restricción de un solo negocio activo
por propietario. Antes de aplicarla, corrige las cuentas indicadas por su
comprobación previa siguiendo [propietario-unico.md](propietario-unico.md). La
migración no debe aplicarse en remoto hasta crear y verificar un respaldo y
resolver esas cuentas.

## Respaldo local de referencia

`python dev.py backup` crea un respaldo del proyecto de demostración verificado,
pero no sustituye el respaldo administrado de Supabase en producción. Los
archivos y recibos de respaldo no se versionan en Git.
