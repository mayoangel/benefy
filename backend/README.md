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
