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
| `SUPABASE_STORAGE_MAX_BYTES` | Límite de avatar; por defecto 5 MB |
| `SUPABASE_STORAGE_ALLOWED_TYPES` | `image/jpeg,image/png,image/webp` |
| `CORS_ALLOWED_ORIGINS` | Dominio del portal web |
| `CSRF_TRUSTED_ORIGINS` | Dominio del portal y del API |
| `FRONTEND_URL` | Redirecciones de Stripe Sandbox |
| `SECURE_SSL_REDIRECT=True` | Redirección HTTPS |
| `SECURE_HSTS_SECONDS=31536000` | HSTS |
| `SECURE_HSTS_INCLUDE_SUBDOMAINS` | `False` por defecto; actívalo solo si controlas todos los subdominios |
| `SECURE_HSTS_PRELOAD` | `False` por defecto; no lo actives para el dominio temporal |
| `ADMIN_ENABLED=False` | Recomendado; o protege `/admin/` con Cloudflare Access |

Con `SECURE_HSTS_INCLUDE_SUBDOMAINS=False` y `SECURE_HSTS_PRELOAD=False`,
`check --deploy` reportará las advertencias W005/W021. Es deliberado mientras se
use el dominio temporal de Railway. Actívalos solo cuando el dominio
personalizado esté bajo control y no afecte subdominios ajenos. `SECURE_SSL_REDIRECT`
y `SECURE_HSTS_SECONDS` permanecen activos.

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

Las migraciones `0021_eliminacion_cuenta` y
`0022_eliminacion_cuenta_storage` deben aplicarse de forma controlada.

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

Benef AI es un servicio FastAPI independiente. Sigue la guía
[despliegue de Benef AI](./despliegue-benef-ai.md). Resumen:

- Root Directory: `benef-ai`.
- Dockerfile: `Dockerfile.prod`.
- `BACKEND_API_URL=https://api.example.com/api/v1` o una URL privada de Railway.
- `BENEF_AI_SERVICE_TOKEN` compartido con Django (32+ caracteres).
- Django configura `BENEF_AI_URL` y firma cada solicitud con HMAC-SHA256.
- Django debe permitir el host privado en `ALLOWED_HOSTS` si se usa la red interna.
- No necesita service role, base de datos ni secretos Stripe.
- Health check: `/health/live`; readiness: `/health/ready`.
- Timeouts configurables de Django y Gemini.
- El bearer de Supabase se reenvía; Django vuelve a validar permisos.
- El portal usa el proxy de Django; no requiere CORS directo.

No se requiere modificar React al mover Benef AI entre Railway y un VPS: solo
cambia `BENEF_AI_URL` en Django.

## 9. Rollback

1. Conserva el respaldo previo a la migración.
2. Si falla el despliegue, vuelve a la imagen anterior.
3. Si una migración ya se aplicó y es incompatible, restaura el respaldo en una
   ventana controlada; no edites migraciones aplicadas.
