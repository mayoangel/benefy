# Despliegue del backend en Railway

Esta guía asume que el repositorio se despliega como un servicio de Railway con
root directory `backend`. La base de datos y Auth siguen en Supabase; Railway
solo ejecuta Django con Gunicorn y WhiteNoise.

## 1. Servicio

1. Crea un proyecto en Railway y conecta el repositorio.
2. En el servicio del backend configura **Root Directory** = `backend`.
3. Railway detecta `backend/railway.json` y usa `Dockerfile.prod`.
4. El contenedor ejecuta `collectstatic` y luego Gunicorn en `$PORT`.
5. El health check de la plataforma debe apuntar a `/health/live/`.

El `railway.json` incluido usa:

```json
{
  "build": { "builder": "DOCKERFILE", "dockerfilePath": "Dockerfile.prod" },
  "deploy": {
    "healthcheckPath": "/health/live/",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 5
  }
}
```

## 2. Variables

Usa como base [`backend/.env.production.example`](../backend/.env.production.example).
No subas valores reales al repositorio.

Mínimas:

| Variable | Uso |
| --- | --- |
| `ENVIRONMENT=production` | Activa settings de producción |
| `DEBUG=False` | Obligatorio |
| `SECRET_KEY` | Secreto aleatorio de 50+ caracteres |
| `ALLOWED_HOSTS` | Dominio de Railway y dominio personalizado, separados por coma |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | PostgreSQL de Supabase |
| `DB_SSLMODE=require` | Obligatorio en producción |
| `SUPABASE_URL` | Origen HTTPS del proyecto |
| `SUPABASE_PUBLISHABLE_KEY` | Verificación de sesiones |
| `SUPABASE_SERVICE_ROLE_KEY` | Borrado de identidades en Auth; solo servidor |
| `SUPABASE_STORAGE_BUCKET_AVATARS` | Bucket de avatares |
| `CORS_ALLOWED_ORIGINS` | Dominio del portal web |
| `CSRF_TRUSTED_ORIGINS` | Dominio del portal y del API |
| `FRONTEND_URL` | Redirecciones de Stripe Sandbox |
| `SECURE_SSL_REDIRECT=True` | Redirección HTTPS |
| `SECURE_HSTS_SECONDS=31536000` | HSTS |
| `SECURE_HSTS_INCLUDE_SUBDOMAINS` | `True` solo si controlas todos los subdominios |
| `SECURE_HSTS_PRELOAD` | `True` solo si el dominio está listo para preload |
| `ADMIN_ENABLED=False` | Recomendado; o protege `/admin/` con Cloudflare Access |

Para Stripe Sandbox, mantén `STRIPE_ENABLED=true`, `STRIPE_MODE=test` y claves
`sk_test_`/`pk_test_`. El backend rechaza claves live al arrancar. Configura el
webhook en:

```text
https://<dominio-backend>/api/v1/stripe/webhook/
```

El signing secret del endpoint debe coincidir con `STRIPE_WEBHOOK_SECRET`.

## 3. Dominio y TLS

1. Añade un dominio personalizado en Railway o usa el dominio `*.railway.app`.
2. Agrega el dominio a `ALLOWED_HOSTS`.
3. Si el portal web consume el API directamente, agrégalo a
   `CORS_ALLOWED_ORIGINS` y `CSRF_TRUSTED_ORIGINS`.
4. Railway termina TLS y envía `X-Forwarded-Proto`; Django ya confía en ese
   encabezado.
5. Los health checks `/health/live/`, `/health/db/` y `/health/ready/` están
   exentos de la redirección HTTPS para funcionar dentro de la red del host.

## 4. Migraciones

No ejecutes migraciones automáticamente en cada arranque de réplica. Usa el
procedimiento de [migraciones de producción](./migraciones-produccion.md) y un
pre-deploy command de Railway o una shell del servicio:

```bash
python manage.py migrate --noinput
```

La migración `0021_eliminacion_cuenta` debe aplicarse de forma controlada.

## 5. Verificación posterior

```bash
python manage.py check
python manage.py showmigrations core
```

Comprueba desde el dominio público:

```text
GET /health/live/   -> 200 sin PostgreSQL
GET /health/db/     -> 200 con PostgreSQL
GET /health/ready/  -> 200 con PostgreSQL
```

Después valida login, `/api/v1/autenticacion/perfil/`, QR y un endpoint de
lealtad con una cuenta de prueba.

## 6. Admin

`ADMIN_ENABLED=False` elimina la ruta `/admin/`. Si necesitas Django Admin en
producción:

- actívalo con `ADMIN_ENABLED=True`;
- protégelo con Cloudflare Access, VPN o allowlist;
- usa cuentas staff separadas de las identidades Supabase;
- no compartas la service role key con operadores.

## 7. Stripe Sandbox

- El backend no procesa dinero real.
- Mantén `STRIPE_MODE=test`.
- El webhook se autentica por firma, no por Supabase.
- Verifica el endpoint remoto en Stripe Dashboard.
- No cambies a live sin una fase separada de impuestos, CFDI y conciliación.

## 8. Benef AI

Benef AI es un servicio FastAPI independiente. Si se despliega en Railway:

- configura `BACKEND_API_URL=https://<dominio-backend>/api/v1`;
- configura `BENEF_AI_ALLOWED_ORIGINS` con el portal autorizado;
- el servicio reenvía el bearer de Supabase a Django y Django vuelve a validar
  identidad, negocio y sucursal;
- no necesita la service role key ni acceso directo a PostgreSQL;
- su health check actual no comprueba Django ni Gemini; eso es intencional.

No se requiere modificar la lógica de Benef AI para el despliegue de Django.

## 9. Rollback

1. Conserva el respaldo previo a la migración.
2. Si falla el despliegue, vuelve a la imagen anterior.
3. Si una migración ya se aplicó y es incompatible, restaura el respaldo en una
   ventana controlada; no edites migraciones aplicadas.
