# Montaje local tipo producción

Guía del montaje de demostración: mismos servicios que producción, ejecutados
en la máquina local y sin publicar puertos fuera de `127.0.0.1`. No sustituye
al entorno de desarrollo de [compose.yaml](../compose.yaml).

## Qué incluye

| Servicio | Imagen | Función |
| --- | --- | --- |
| `backend` | `backend/Dockerfile.prod` | Django + Gunicorn + WhiteNoise, usuario no-root |
| `web` | `frontend-web/Dockerfile` | Build de Vite servido por Caddy y proxy de la API |
| `benef-ai` | `benef-ai/Dockerfile` | FastAPI sin recarga y sin puerto público |
| `cloudflared` | `cloudflare/cloudflared` | Túnel opcional (perfil `tunnel`) |

La base de datos sigue siendo PostgreSQL de Supabase. No hay `db` local.

## Preparación

```bash
cp backend/.env.production.example backend/.env.production
```

Completa `SECRET_KEY` (mínimo 50 caracteres, sin prefijo `django-insecure-`),
`DB_PASSWORD`, `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY`. Los valores de
`ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS` y `CSRF_TRUSTED_ORIGINS` deben coincidir
con la URL desde la que abrirás la demo.

Generar una clave local:

```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

## Arranque

```bash
docker compose --env-file backend/.env.production -f compose.demo.yaml build
docker compose --env-file backend/.env.production -f compose.demo.yaml up -d
```

Las migraciones no se aplican solas. Ejecútalas una vez, revisando antes el plan:

```bash
docker compose --env-file backend/.env.production -f compose.demo.yaml run --rm --no-deps backend python manage.py migrate --plan
docker compose --env-file backend/.env.production -f compose.demo.yaml run --rm --no-deps backend python manage.py migrate --noinput
```

Accesos:

- Web y API: <https://localhost/>
- Admin: <https://localhost/admin/>
- Health con base de datos: <https://localhost/health/db/>

`http://localhost` redirige a HTTPS. Caddy usa una CA interna, así que el
navegador avisará hasta que la confíes. Para exportarla:

```bash
docker compose -f compose.demo.yaml cp web:/data/caddy/pki/authorities/local/root.crt caddy-root.crt
```

Instala `caddy-root.crt` en el almacén de entidades de certificación de
confianza del sistema (Windows: doble clic → Instalar certificado → Equipo
local → Entidades de certificación raíz de confianza). Ese archivo no debe
versionarse.

Si prefieres HTTP sin TLS, cambia el `Caddyfile` para publicar solo `:8080` y
pon `SESSION_COOKIE_SECURE=false` y `CSRF_COOKIE_SECURE=false`. No es la
configuración recomendada.

## Túnel para la presentación

El perfil `tunnel` levanta `cloudflared` y lo conecta por HTTP al puerto 8080
interno de Caddy; no abre puertos en el host. Crea un túnel nombrado en
Cloudflare, copia el token en `backend/.env.production` y arranca:

```bash
docker compose --env-file backend/.env.production -f compose.demo.yaml --profile tunnel up -d
```

Añade el hostname público a `ALLOWED_HOSTS` y a `CSRF_TRUSTED_ORIGINS`
(con esquema `https://`). Evita el túnel rápido de Cloudflare: cambia el
subdominio en cada ejecución y obliga a reiniciar el backend.

## Operación

```bash
# Estado y logs
docker compose -f compose.demo.yaml ps
docker compose -f compose.demo.yaml logs -f backend

# Verificación de despliegue de Django
docker compose --env-file backend/.env.production -f compose.demo.yaml run --rm --no-deps backend python manage.py check --deploy

# Destino real de la base de datos
docker compose --env-file backend/.env.production -f compose.demo.yaml run --rm --no-deps backend python manage.py db_info --connect

# Parada conservando volúmenes de Caddy
docker compose -f compose.demo.yaml down
```

`check --deploy` debe terminar con dos avisos intencionales:

- `security.W004` (`SECURE_HSTS_SECONDS`): Caddy gestiona el TLS y el HSTS en
  `localhost` puede dejar el navegador bloqueado si luego sirves HTTP.
- `security.W008` (`SECURE_SSL_REDIRECT`): la redirección a HTTPS la hace
  Caddy. Activarla en Django provocaría bucles detrás del túnel, que le habla
  por HTTP interno.

## Diferencias con desarrollo

| Aspecto | `compose.yaml` | `compose.demo.yaml` |
| --- | --- | --- |
| Servidor | `runserver` con recarga y código montado | Gunicorn, código dentro de la imagen |
| Base de datos | PostgreSQL local en `db:5432` | Supabase con SSL |
| Estáticos | `runserver` | `collectstatic` + WhiteNoise |
| Origen | Dos puertos (5173 y 8000) | Un solo origen con Caddy |
| Puertos | 5432, 8000, 5000 | 80 y 443 en loopback |
