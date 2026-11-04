# Backend

Esta carpeta contiene el backend de Benefy: la API, la lógica de negocio, la
persistencia de datos y las integraciones con servicios externos.

## Responsabilidades previstas

- Gestionar usuarios, comercios, programas de lealtad y recompensas.
- Exponer la API para el dashboard web y la aplicación móvil.
- Procesar transacciones, canjes y colaboraciones entre negocios.
- Integrar autenticación, pagos, almacenamiento multimedia y monitoreo.

## Estado actual

El proyecto Django está inicializado con la estructura `config` (paquete de
configuración del proyecto) y `manage.py`. `GET /` expone un endpoint de
verificación de estado en JSON.

Las dependencias base (Django, Django REST Framework, django-cors-headers,
psycopg2-binary y python-dotenv) están declaradas en `requirements.txt`.

## Cómo ejecutar

Con Docker (recomendado, desde la raíz del repositorio):

```bash
docker compose up --build backend
```

En local (requiere un PostgreSQL accesible desde `backend/.env`):

```bash
pip install -r requirements.txt
python manage.py runserver 0.0.0.0:8000
```

## Configuración

`config/settings.py` lee `backend/.env` (generado a partir de `.env.example`)
con python-dotenv: `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS` y las credenciales de
PostgreSQL (`DB_*`). Dentro de Docker, `compose.yaml` también inyecta los
valores de conexión hacia el servicio `db`.
