# Backend

Esta carpeta contiene el backend de Benefy: la API, la lógica de negocio, la
persistencia de datos y las integraciones con servicios externos.

## Responsabilidades previstas

- Gestionar usuarios, comercios, programas de lealtad y recompensas.
- Exponer la API para el dashboard web y la aplicación móvil.
- Procesar transacciones, canjes y colaboraciones entre negocios.
- Integrar autenticación, pagos, almacenamiento multimedia y monitoreo.

## Estado actual

El proyecto Django contiene el primer modelo relacional de Benefy, sus
migraciones y endpoints CRUD bajo `/api/v1`. `GET /` expone un endpoint de
verificación de estado en JSON. La autenticación de aplicación y la aplicación
efectiva de permisos siguen pendientes.

Las dependencias base (Django, Django REST Framework, django-cors-headers,
psycopg2-binary y python-dotenv) están declaradas en `requirements.txt`.

## Cómo ejecutar

Con Docker (recomendado, desde la raíz del repositorio):

```bash
docker compose up --build backend
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py test
```

En local (requiere un PostgreSQL accesible desde `backend/.env`):

```bash
docker compose up -d db
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

Cuando Django se ejecuta directamente desde Windows, configura
`DB_HOST=localhost`. El nombre `db` solo se resuelve dentro de la red de
Docker Compose.

## Verificación

```bash
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test
```

## Configuración

`config/settings.py` lee `backend/.env` (generado a partir de `.env.example`)
con python-dotenv: `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS` y las credenciales de
PostgreSQL (`DB_*`). Dentro de Docker, `compose.yaml` también inyecta los
valores de conexión hacia el servicio `db`.

## Desarrollo y producción con Supabase

Todos los comandos Docker Compose de esta sección se ejecutan desde la raíz
del repositorio. Se usa el mismo ORM, modelos y archivos de migraciones en
ambos entornos. Esta configuración no copia datos existentes ni ejecuta
migraciones automáticamente.

### Variables de entorno

Desarrollo conserva `.env` de la raíz para `POSTGRES_USER`, `POSTGRES_PASSWORD`
y `POSTGRES_DB`, y `backend/.env` para Django. Usa los `.env.example` respectivos
solo si todavía no existen los archivos reales. No sobrescribas credenciales
existentes: cambiar las variables de PostgreSQL no cambia la contraseña de un
volumen ya inicializado.

Compose local fija `ENVIRONMENT=development`, `DB_HOST=db`, `DB_PORT=5432`
y `DB_SSLMODE=disable`; inyecta el nombre, usuario y contraseña del PostgreSQL
local. Estas variables tienen prioridad sobre `backend/.env`. Para Django
ejecutado fuera de Docker, usa `DB_HOST=localhost` en `backend/.env`.

Producción usa un archivo nuevo `.env.production` en la raíz, creado a partir
de `.env.production.example` si no existe. Completa `DB_HOST`, `DB_PORT`,
`DB_NAME`, `DB_USER`, `DB_PASSWORD`, `SECRET_KEY` y `ALLOWED_HOSTS`.
Genera una clave exclusiva con `python -c "import secrets; print(secrets.token_urlsafe(64))"`.
No uses la clave de desarrollo. `ALLOWED_HOSTS` lleva dominios sin esquema;
`CORS_ALLOWED_ORIGINS` y `CSRF_TRUSTED_ORIGINS` llevan orígenes completos HTTPS
separados por comas.

`compose.production.yaml` es independiente: **no lo combines con compose.yaml**.
Fija `ENVIRONMENT=production`, `DEBUG=False` y `sslmode=require`; no carga
`backend/.env`, no monta el código local y no inicia PostgreSQL local.
Conserva Benef AI en la red interna, sin puerto público ni recarga automática.
La conexión Supabase usa el session pooler en el puerto `5432`.
`require` cifra la conexión pero no verifica identidad del servidor. Para
verificación completa, configura `DB_SSLMODE=verify-full` y `DB_SSLROOTCERT`
en el entorno del backend y monta el certificado CA correspondiente; habría
que adaptar explícitamente el Compose de producción para ello.

### Iniciar y detener desarrollo

```bash
docker compose -f compose.yaml config --quiet
docker compose -f compose.yaml up -d --build
docker compose -f compose.yaml exec backend python manage.py check
docker compose -f compose.yaml exec backend python manage.py test --noinput
docker compose -f compose.yaml down
```

`down` conserva el volumen local. No uses `down -v` si quieres conservar datos.

### Iniciar y detener producción

```bash
docker compose --env-file .env.production -f compose.production.yaml config --quiet
docker compose --env-file .env.production -f compose.production.yaml up -d --build
docker compose --env-file .env.production -f compose.production.yaml exec backend python manage.py check
docker compose --env-file .env.production -f compose.production.yaml down
```

El proyecto Compose se llama `benefy-production`, por lo que no reemplaza los
contenedores locales. Gunicorn escucha dentro del contenedor en `8000`;
el host solo publica `127.0.0.1:8001` por defecto (`BACKEND_PORT`).
Esto permite coexistir con desarrollo y conectar un proxy del host.
Benef AI mantiene únicamente su health check; sus integraciones siguen pendientes.

### Migraciones (ejecución manual)

En desarrollo:

```bash
docker compose -f compose.yaml exec backend python manage.py makemigrations --check --dry-run
docker compose -f compose.yaml exec backend python manage.py migrate
```

En producción, revisar primero el plan (lectura):

```bash
docker compose --env-file .env.production -f compose.production.yaml run --rm --no-deps backend python manage.py migrate --plan
```

Solo después de aprobación explícita y respaldo de Supabase, aplicar:

```bash
docker compose --env-file .env.production -f compose.production.yaml run --rm --no-deps backend python manage.py migrate --noinput
```

No ejecutes `manage.py test`, `flush`, cargas de fixtures ni migraciones inversas
con las credenciales de producción. Las pruebas deben utilizar PostgreSQL local
o una base aislada. La copia de datos desde desarrollo requiere un plan de
exportación/restauración y autorización aparte.

### Verificar la base de datos seleccionada

Estos comandos cargan settings y muestran solo entorno, motor, host, puerto,
base y modo SSL. No abren conexión:

```bash
docker compose -f compose.yaml run --rm --no-deps backend python manage.py db_info
docker compose --env-file .env.production -f compose.production.yaml run --rm --no-deps backend python manage.py db_info
```

Para comprobar la conexión real, añade `--connect`:

```bash
docker compose -f compose.yaml run --rm --no-deps backend python manage.py db_info --connect
docker compose --env-file .env.production -f compose.production.yaml run --rm --no-deps backend python manage.py db_info --connect
```

Se ejecuta únicamente `SELECT current_database(), current_user` y se consulta
si el cliente PostgreSQL negoció SSL. Desarrollo debe mostrar `host=db`;
producción, el pooler de Supabase y `ssl_in_use=true`. El health check HTTP
`GET /` no comprueba la base de datos.

### Secretos y despliegue público

- `.env.production`, `.env` y sus variantes reales están ignorados por Git.
  Los ejemplos deben contener campos vacíos o placeholders para secretos.
  Los Dockerfiles excluyen `.env.*`; no copies credenciales a las imágenes.
- Guarda las credenciales con acceso restringido o inyéctalas desde el gestor
  de secretos del servidor. Quien controla Docker puede inspeccionar el entorno
  del contenedor. No publiques `docker compose config` sin `--quiet`, ni dumps
  de settings, porque pueden mostrar contraseñas.
- Rota la contraseña Supabase compartida en el chat antes del despliegue real
  y actualiza solo `.env.production`; las credenciales locales son independientes.
- Usa un dominio y un proxy HTTPS delante de Gunicorn. Configura hosts y
  orígenes, firewall, certificados, redirección HTTPS y HSTS tras verificar TLS.
  Configura la confianza en cabeceras del proxy únicamente si el proxy las
  sobrescribe y es el único que puede llegar al backend.
- Ejecuta `docker compose --env-file .env.production -f compose.production.yaml run --rm --no-deps backend python manage.py check --deploy`
  y resuelve los avisos del despliegue. Se activan cookies seguras en producción.
- Los estáticos de Admin requieren `collectstatic` y un servidor de estáticos:
  `docker compose --env-file .env.production -f compose.production.yaml exec backend python manage.py collectstatic --noinput`.
  Configura un volumen o un paso de publicación para servir `/app/staticfiles`
  con el proxy; Gunicorn no los sirve. Ese almacenamiento aún no está incluido.
- Completa autenticación, permisos y aislamiento de negocios antes de publicar
  la API actual. Configura respaldos, monitoreo y permisos mínimos de la cuenta
  PostgreSQL. Revisa la exposición de tablas Django mediante la Data API de
  Supabase: este proyecto solo usa su PostgreSQL, no Supabase Auth ni su API REST.

Referencias: [conexiones Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres)
y [SSL](https://supabase.com/docs/guides/platform/ssl-enforcement).
