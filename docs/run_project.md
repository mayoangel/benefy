# Comandos del proyecto

Referencia rápida para ejecutar Benefy. Todos los comandos se ejecutan desde
la raíz del repositorio salvo que se indique otra carpeta.

## Desarrollo y pruebas

```bash
# Servicios: PostgreSQL local, Django con runserver y Benef AI.
docker compose -f compose.yaml up -d --build

# Base local y comprobaciones.
docker compose -f compose.yaml exec backend python manage.py migrate
docker compose -f compose.yaml exec backend python manage.py check
docker compose -f compose.yaml exec backend python manage.py test --noinput
docker compose -f compose.yaml exec backend python manage.py makemigrations --check --dry-run

# Logs y parada.
docker compose -f compose.yaml logs -f backend
docker compose -f compose.yaml down        # conserva el volumen
docker compose -f compose.yaml down -v     # borra la base local
```

Clientes, cada uno en su terminal:

```bash
cd frontend-web
npm ci
npm run dev        # http://localhost:5173
```

```bash
cd mobile-app
npm ci
npm run start      # Expo/Metro, normalmente :8081
```

URLs: API <http://localhost:8000/>, Admin
<http://localhost:8000/admin/>, Benef AI <http://localhost:5000/>.

## Verificación en el entorno simulado de producción

Usa Supabase como base de datos. No ejecutes pruebas ni fixtures con estas
credenciales.

```bash
# Construir y arrancar.
docker compose --env-file backend/.env.production -f compose.demo.yaml build
docker compose --env-file backend/.env.production -f compose.demo.yaml up -d

# Estado y salud.
docker compose -f compose.demo.yaml ps
curl -k https://localhost/health/db/

# Comprobaciones de producción.
docker compose --env-file backend/.env.production -f compose.demo.yaml run --rm --no-deps backend python manage.py check --deploy
docker compose --env-file backend/.env.production -f compose.demo.yaml run --rm --no-deps backend python manage.py db_info --connect
docker compose --env-file backend/.env.production -f compose.demo.yaml run --rm --no-deps backend python manage.py migrate --plan

# Logs y parada.
docker compose -f compose.demo.yaml logs -f backend
docker compose -f compose.demo.yaml down
```

URLs: <https://localhost/>, <https://localhost/admin/> y
<https://localhost/health/db/>.

## Presentación

```bash
# Una vez: confiar en la CA interna de Caddy.
docker compose -f compose.demo.yaml cp web:/data/caddy/pki/authorities/local/root.crt caddy-root.crt
# Instalar caddy-root.crt en "Entidades de certificación raíz de confianza".

# Una vez: superusuario de Django Admin (no crea identidad Supabase).
docker compose --env-file backend/.env.production -f compose.demo.yaml exec backend python manage.py createsuperuser

# Arrancar y verificar.
docker compose --env-file backend/.env.production -f compose.demo.yaml up -d
curl -k https://localhost/health/db/

# Demo pública opcional con Cloudflare Tunnel.
docker compose --env-file backend/.env.production -f compose.demo.yaml --profile tunnel up -d

# Al terminar.
docker compose -f compose.demo.yaml down
```

Si presentas desde otra máquina o por el túnel, añade ese hostname a
`ALLOWED_HOSTS` y `CSRF_TRUSTED_ORIGINS`.

## Regla rápida

| Objetivo | Compose |
| --- | --- |
| Programar y probar con base desechable | `compose.yaml` |
| Comprobar Gunicorn, Caddy, HTTPS y cookies seguras | `compose.demo.yaml` |
| Presentar el proyecto | `compose.demo.yaml` |

Los detalles del montaje demo están en
[despliegue-local.md](./despliegue-local.md). Las variables y migraciones del
backend, en la [guía del backend](../backend/README.md).
