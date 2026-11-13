# Backend

API Django 5.2 + Django REST Framework. La configuración está en `config/`;
`core/` contiene 16 modelos, serializers, vistas, permisos y cuatro migraciones
de dominio. La entrada de URLs es `config/urls.py`.

## Funcionalidad disponible

- 80 rutas CRUD, con acciones en español, y dos rutas adicionales de perfil/roles.
- Verificación de sesiones Supabase Auth y permisos según usuario, negocio y sucursal.
- Django Admin con los modelos registrados y cuentas staff separadas de los perfiles Benefy.
- PostgreSQL local para desarrollo o PostgreSQL Supabase con SSL para producción.
- Comando `db_info` para inspeccionar el destino sin imprimir passwords.
- Pruebas de salud, autenticación, permisos, aislamiento y migración de perfiles.

Consulta [API](../docs/api.md) para las rutas y
[autenticación](../docs/autenticacion.md) para los payloads y la matriz de acceso.
Los modelos de Stripe y notificaciones no implican que esas integraciones estén
implementadas. Los servicios transaccionales completos de lealtad siguen pendientes.

## Entornos y variables

Todos los comandos Docker de esta guía se ejecutan desde la raíz del repositorio.

| Archivo real | Uso |
| --- | --- |
| `.env` | Sustituciones de Compose de desarrollo: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` |
| `backend/.env` | Django local: se carga con python-dotenv, sin sobrescribir el entorno del proceso |
| `backend/.env.production` | Variables que Compose de producción inyecta explícitamente en el contenedor |

Usa [.env.example](./.env.example) y
[.env.production.example](./.env.production.example) solo para crear archivos
que no existan. Las variables de PostgreSQL local deben coincidir con las
credenciales del volumen ya inicializado. Cambiar `POSTGRES_PASSWORD` en un
archivo no modifica la contraseña almacenada en un volumen existente.

| Variable | Comportamiento |
| --- | --- |
| `ENVIRONMENT` | Desarrollo fija `development`; producción fija `production` |
| `DEBUG` | Se lee de Django local; producción fija `False` |
| `SECRET_KEY` | En producción debe estar definida, tener al menos 50 caracteres y no empezar por `django-insecure-` |
| `ALLOWED_HOSTS` | Hosts sin esquema separados por comas; producción exige un valor |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Destino PostgreSQL; todos son obligatorios en producción |
| `DB_SSLMODE` | Desarrollo Compose fija `disable`; producción Compose fija `require` |
| `DB_SSLROOTCERT` | Settings admite un certificado CA; no se monta ni se pasa en el Compose actual |
| `SUPABASE_URL` | URL HTTPS del proyecto Auth, distinta del host pooler PostgreSQL |
| `SUPABASE_PUBLISHABLE_KEY` | Clave pública usada para verificar tokens en Supabase Auth |
| `CORS_ALLOWED_ORIGINS` | Orígenes completos separados por comas |
| `CSRF_TRUSTED_ORIGINS` | Orígenes confiables completos separados por comas |
| `BACKEND_PORT` | Sustitución exclusiva de Compose de producción; puerto host por defecto 8001 |

Con `DEBUG=True`, CORS permite cualquier origen. En producción se utiliza la
lista explícita y se activan cookies seguras de sesión/CSRF.
`LANGUAGE_CODE` es `en-us` y `TIME_ZONE` es `UTC`; no hay variables para
cambiarlos actualmente.

Las variables Stripe de la plantilla local son placeholders; no existe SDK,
webhook ni código que las utilice. La configuración de Supabase Auth usa la
clave publicable, nunca la contraseña PostgreSQL ni una clave `service_role`.

## Desarrollo con Docker

`compose.yaml` conserva los servicios `db`, `backend` y `benef-ai`.
Django utiliza `runserver`, monta `backend/` y espera a que PostgreSQL esté
saludable. Fuerza `DB_HOST=db`, `DB_PORT=5432` y SSL deshabilitado, aunque
`backend/.env` tenga otros valores; nombre/usuario/password vienen del `.env`
de la raíz. La aplicación Django no carga ese archivo raíz.

```bash
docker compose -f compose.yaml config --quiet
docker compose -f compose.yaml up -d --build
docker compose -f compose.yaml exec backend python manage.py migrate
docker compose -f compose.yaml exec backend python manage.py check
docker compose -f compose.yaml logs --tail 50 backend
```

- API y health check: <http://localhost:8000/>.
- Admin: <http://localhost:8000/admin/>.
- No se ejecutan migraciones ni se crean usuarios automáticamente al iniciar.

Para detener y conservar datos:

```bash
docker compose -f compose.yaml down
```

No uses `down -v` para una parada normal. El puerto PostgreSQL local está
fijado a `5432:5432`; `POSTGRES_PORT` no se referencia en el Compose actual.

Si cambias `backend/.env`, reinicia Django:

```bash
docker compose -f compose.yaml restart backend
```

Si cambias variables que Compose inyecta desde la raíz, recrea el servicio
con `up -d --force-recreate backend`; un simple `restart` no actualiza ese entorno.

## Ejecución local sin contenedor Django

Primero levanta PostgreSQL desde la raíz:

```bash
docker compose -f compose.yaml up -d db
```

En `backend/.env`, configura `DB_HOST=localhost` y las mismas credenciales
del PostgreSQL local. Después, desde `backend/` y con un entorno virtual activo:

```bash
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py check
python manage.py runserver 0.0.0.0:8000
```

La imagen Docker usa Python 3.11. El entorno virtual local existente puede tener
otra versión; no lo copies al contenedor. Gunicorn se utiliza en producción
Linux, no como servidor local de Windows.

## Pruebas y cambios de modelos

Ejecuta pruebas únicamente contra PostgreSQL local o una base de pruebas aislada:

```bash
docker compose -f compose.yaml run --rm --no-deps backend python manage.py test --noinput
docker compose -f compose.yaml run --rm --no-deps backend python manage.py test core.test_auth --noinput
docker compose -f compose.yaml exec backend python manage.py makemigrations --check --dry-run
```

`run --no-deps` presupone que `db` ya está levantado. Django crea y destruye
una base de prueba; el usuario PostgreSQL local necesita permiso para crearla.
`core/test_auth_migration.py` prueba la transición de identidad solo dentro
de esa base aislada.

Para un cambio deliberado en modelos:

```bash
docker compose -f compose.yaml exec backend python manage.py makemigrations core
docker compose -f compose.yaml exec backend python manage.py migrate --plan
docker compose -f compose.yaml exec backend python manage.py migrate
```

Revisa y versiona el archivo de migración. No edites migraciones ya aplicadas
para introducir cambios nuevos. Agregar campos obligatorios, eliminar columnas
o cambiar tipos requiere revisar los datos y la estrategia de despliegue.

## Producción con Supabase

`compose.production.yaml` es independiente: no lo combines con `compose.yaml`.
Usa el proyecto `benefy-production`, Gunicorn con dos workers y PostgreSQL
externo. Conserva Benef AI sin recarga y sin puerto público.

Configura `backend/.env.production` antes de iniciar. La imagen excluye los
archivos reales de entorno y no monta el código local. En producción Django
no carga `backend/.env`; Compose pasa únicamente las variables declaradas
en su bloque `environment`.

```bash
docker compose --env-file backend/.env.production -f compose.production.yaml config --quiet
docker compose --env-file backend/.env.production -f compose.production.yaml up -d --build
docker compose --env-file backend/.env.production -f compose.production.yaml exec backend python manage.py check
```

El backend se publica solo en `127.0.0.1:8001` por defecto; dentro de Docker
escucha en `8000`. Benef AI escucha en `5000` dentro de la red Compose.
La configuración permite coexistir con desarrollo, pero no sincroniza datos.

Para actualizar variables de producción, recrea el servicio:

```bash
docker compose --env-file backend/.env.production -f compose.production.yaml up -d --force-recreate backend
```

Para detenerlo:

```bash
docker compose --env-file backend/.env.production -f compose.production.yaml down
```

El pooler Supabase configurado usa modo sesión en el puerto 5432.
`sslmode=require` cifra la conexión; no verifica hostname/certificado.
Usar `verify-full` requiere adaptar explícitamente Compose para pasar el modo,
montar el certificado CA y configurar `DB_SSLROOTCERT`.

## Migraciones en producción

Los modelos y archivos de migración son los mismos que en desarrollo. Cambiar
de destino no copia registros desde PostgreSQL local ni aplica el esquema
automáticamente. Para consultar qué falta:

```bash
docker compose --env-file backend/.env.production -f compose.production.yaml run --rm --no-deps backend python manage.py showmigrations core
docker compose --env-file backend/.env.production -f compose.production.yaml run --rm --no-deps backend python manage.py migrate --plan
```

Solo después de revisión, respaldo y autorización para ese entorno:

```bash
docker compose --env-file backend/.env.production -f compose.production.yaml run --rm --no-deps backend python manage.py migrate --noinput
```

Las migraciones disponibles en Git no prueban que estén aplicadas en un servidor.
No ejecutes `test`, `flush`, fixtures ni migraciones inversas con credenciales
de producción. La copia de datos entre entornos exige un procedimiento aparte.

## Verificar el destino de Django

Sin conexión a la base:

```bash
docker compose -f compose.yaml run --rm --no-deps backend python manage.py db_info
docker compose --env-file backend/.env.production -f compose.production.yaml run --rm --no-deps backend python manage.py db_info
```

Para conexión real, añade `--connect`:

```bash
docker compose -f compose.yaml run --rm --no-deps backend python manage.py db_info --connect
docker compose --env-file backend/.env.production -f compose.production.yaml run --rm --no-deps backend python manage.py db_info --connect
```

Se muestra entorno, host, puerto, motor, base y modo SSL; nunca la contraseña.
`--connect` ejecuta `SELECT current_database(), current_user` y consulta si se
negoció SSL. Desarrollo debe mostrar `host=db`; producción, el host Supabase
configurado y `ssl_in_use=true`. `GET /` solo comprueba que Django responde.

## Administradores

```bash
docker compose -f compose.yaml exec backend python manage.py createsuperuser
```

Crea una cuenta staff para Django Admin, usando su autenticación de sesiones.
No crea un usuario en Supabase Auth ni un perfil `core.Usuario`, y no concede
el rol Benefy `admin_sistema`. La [guía de autenticación](../docs/autenticacion.md)
explica cómo crear/vincular el perfil y asignar ese rol mediante un operador autorizado.
No existen credenciales de administrador predeterminadas en el código.

## Despliegue público y secretos

- Configura dominio, proxy HTTPS, certificados y firewall delante de Gunicorn.
  El proxy puede alcanzar el puerto loopback 8001 en el mismo host; un proxy
  en otro contenedor necesita red/puertos adecuados.
- Define hosts y orígenes HTTPS permitidos. Configura redirección HTTPS, HSTS
  y confianza en cabeceras del proxy cuando el proxy sobrescriba esas cabeceras
  y sea el único que pueda llegar al backend.
- Ejecuta el chequeo de despliegue y resuelve los avisos:
  `docker compose --env-file backend/.env.production -f compose.production.yaml run --rm --no-deps backend python manage.py check --deploy`.
- Publica estáticos de Admin con un volumen o proceso de extracción:
  `docker compose --env-file backend/.env.production -f compose.production.yaml exec backend python manage.py collectstatic --noinput`.
  Se recopilan en `/app/staticfiles`. Gunicorn no los sirve y el Compose actual
  no configura almacenamiento persistente ni servidor de estáticos.
- Revisa la matriz de permisos, la verificación de email y los flujos incompletos
  de lealtad antes de exponer el servicio. Los límites y pendientes están en
  [estado de implementación](../docs/estado-implementacion.md).
- Deshabilita la Data API de Supabase o excluye las tablas Django de sus esquemas
  expuestos; los permisos Python no controlan consultas directas por PostgREST.
- Configura respaldos, restauración probada, monitoreo y permisos mínimos
  PostgreSQL. Supabase Auth y PostgreSQL son integraciones distintas; no se usa
  la API REST de datos Supabase.
- Los archivos reales `.env*` están ignorados por Git; los Dockerfiles los
  excluyen. No uses `git add -f` para subirlos. Verifica también que no estuvieran
  versionados previamente, porque ignorarlos no elimina su historial.
- Una clave publicable es pública; passwords PostgreSQL, `SECRET_KEY`, tokens
  de sesión y claves secretas son privados. No publiques `docker compose config`
  sin `--quiet` ni dumps completos de settings. Rota cualquier secreto filtrado.

Referencias: [conexión PostgreSQL Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres)
y [SSL](https://supabase.com/docs/guides/platform/ssl-enforcement).
