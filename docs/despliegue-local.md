# Montaje local tipo producción

Guía del montaje de demostración: los mismos servicios que producción,
ejecutados en local y sin publicar puertos fuera de `127.0.0.1`. No sustituye al
entorno de desarrollo de [compose.yaml](../compose.yaml).

| Servicio | Imagen | Función |
| --- | --- | --- |
| `backend` | `backend/Dockerfile.prod` | Django + Gunicorn + WhiteNoise, usuario no-root |
| `web` | `frontend-web/Dockerfile` | Build de Vite servido por Caddy y proxy de la API |
| `benef-ai` | `benef-ai/Dockerfile` | FastAPI sin recarga y sin puerto público |
| `cloudflared` | `cloudflare/cloudflared` | Túnel opcional (perfil `tunnel`) |

La base de datos es PostgreSQL de Supabase; no hay `db` local.

## Preparación

```bash
cp backend/.env.production.example backend/.env.production
```

Completa `SECRET_KEY` (mínimo 50 caracteres, sin prefijo `django-insecure-`),
`DB_PASSWORD`, `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY`. `ALLOWED_HOSTS`,
`CORS_ALLOWED_ORIGINS` y `CSRF_TRUSTED_ORIGINS` deben coincidir con la URL de la
demo. Para generar una clave:

```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

## Arranque

```bash
docker compose --env-file backend/.env.production -f compose.demo.yaml build
docker compose --env-file backend/.env.production -f compose.demo.yaml up -d
```

Las migraciones no se aplican solas. Revisa el plan y ejecútalas una vez:

```bash
docker compose --env-file backend/.env.production -f compose.demo.yaml run --rm --no-deps backend python manage.py migrate --plan
docker compose --env-file backend/.env.production -f compose.demo.yaml run --rm --no-deps backend python manage.py migrate --noinput
```

Accesos:

- Web y API: <https://localhost/>
- Admin: <https://localhost/admin/>
- Health con base de datos: <https://localhost/health/db/>

`http://localhost` redirige a HTTPS. Caddy usa una CA interna, así que el
navegador avisará hasta que la confíes:

```bash
docker compose -f compose.demo.yaml cp web:/data/caddy/pki/authorities/local/root.crt caddy-root.crt
```

Instala `caddy-root.crt` en las entidades de certificación raíz de confianza del
sistema (Windows: doble clic → Instalar certificado → Equipo local). El archivo
no debe versionarse. Para HTTP sin TLS, publica `:8080` en el `Caddyfile` y fija
`SESSION_COOKIE_SECURE=false` y `CSRF_COOKIE_SECURE=false`; no es lo
recomendado.

## Verificación y operación

```bash
# Estado y salud
docker compose -f compose.demo.yaml ps
curl -k https://localhost/health/db/

# Comprobaciones de despliegue
docker compose --env-file backend/.env.production -f compose.demo.yaml run --rm --no-deps backend python manage.py check --deploy
docker compose --env-file backend/.env.production -f compose.demo.yaml run --rm --no-deps backend python manage.py db_info --connect

# Logs y parada (conserva volúmenes de Caddy)
docker compose -f compose.demo.yaml logs -f backend
docker compose -f compose.demo.yaml down
```

`check --deploy` debe terminar con dos avisos intencionales:

- `security.W004` (`SECURE_HSTS_SECONDS`): Caddy gestiona el TLS y el HSTS en
  `localhost` puede dejar el navegador bloqueado si luego sirves HTTP.
- `security.W008` (`SECURE_SSL_REDIRECT`): la redirección la hace Caddy.
  Activarla en Django provoca bucles detrás del túnel, que habla HTTP interno.

## Presentación

```bash
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

El perfil `tunnel` levanta `cloudflared` y lo conecta por HTTP al puerto 8080
interno de Caddy; no abre puertos en el host. Crea un túnel nombrado en
Cloudflare, copia el token en `backend/.env.production` y añade el hostname
público a `ALLOWED_HOSTS` y `CSRF_TRUSTED_ORIGINS` (con `https://`). Evita el
túnel rápido: cambia el subdominio en cada ejecución y obliga a reiniciar.

## Diferencias con desarrollo

| Aspecto | `compose.yaml` | `compose.demo.yaml` |
| --- | --- | --- |
| Servidor | `runserver` con recarga y código montado | Gunicorn, código dentro de la imagen |
| Base de datos | PostgreSQL local en `db:5432` | Supabase con SSL |
| Estáticos | `runserver` | `collectstatic` + WhiteNoise |
| Origen | Dos puertos (5173 y 8000) | Un solo origen con Caddy |
| Puertos | 5432, 8000, 5000 | 80 y 443 en loopback |

| Objetivo | Compose |
| --- | --- |
| Programar y probar con base desechable | `compose.yaml` |
| Comprobar Gunicorn, Caddy, HTTPS y cookies seguras | `compose.demo.yaml` |
| Presentar el proyecto | `compose.demo.yaml` |

Los detalles de variables, migraciones y comandos de desarrollo están en el
[README raíz](../README.md) y en [backend/README.md](../backend/README.md).
