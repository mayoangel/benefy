# Operaciones de producción

Esta guía cubre el despliegue y la operación de Benefy en producción. El
desarrollo local se documenta aparte en [desarrollo local](./desarrollo-local.md)
y no forma parte de este procedimiento.

## Arquitectura desplegada

| Componente | Plataforma | Entrada |
| --- | --- | --- |
| Backend Django | Railway o contenedor compatible con Docker | `Dockerfile.prod`, `railway.json`, `/health/live/` |
| Base de datos | PostgreSQL de Supabase | Conexión SSL desde el backend |
| Identidad | Supabase Auth | Verificación remota en cada petición |
| Portal web | Hosting estático | Build de Vite en `frontend-web/dist/` |
| App móvil | Expo/EAS | Builds Android/iOS |
| Benef AI | Railway o VPS | FastAPI, `/health/live`, `/health/ready` |
| Facturación | Stripe Sandbox/Test Mode | Webhook `/api/v1/stripe/webhook/` |

## Backend en Railway

1. Crea un proyecto en Railway y conecta el repositorio.
2. En el servicio del backend configura **Root Directory** = `backend`.
3. Railway detecta `backend/railway.json` y usa `Dockerfile.prod`.
4. El contenedor ejecuta `collectstatic` y luego Gunicorn en `$PORT`.
5. El health check de la plataforma debe apuntar a `/health/live/`.

`backend/railway.json` usa:

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

### Variables del backend

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
| `SUPABASE_SERVICE_ROLE_KEY` | Borrado de identidades en Auth y limpieza de Storage; solo servidor |
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
| `BENEF_AI_URL` | URL pública HTTPS o privada de Railway del servicio Benef AI |
| `BENEF_AI_SERVICE_TOKEN` | Secreto compartido con Benef AI, 32+ caracteres |
| `BENEF_AI_TIMEOUT_SECONDS` | Timeout de Django hacia Benef AI; por defecto 45 s |
| `THROTTLE_BENEF_AI_CHAT` | Límite del chat; por defecto `20/hour` |

Con `SECURE_HSTS_INCLUDE_SUBDOMAINS=False` y `SECURE_HSTS_PRELOAD=False`,
`check --deploy` reportará las advertencias W005/W021. Es deliberado mientras se
use el dominio temporal de Railway. Actívalos solo cuando el dominio
personalizado esté bajo control y no afecte subdominios ajenos.
`SECURE_SSL_REDIRECT` y `SECURE_HSTS_SECONDS` permanecen activos.

Para Stripe Sandbox, mantén `STRIPE_ENABLED=true`, `STRIPE_MODE=test` y claves
`sk_test_`/`pk_test_`. El backend rechaza claves live al arrancar. Configura el
webhook en:

```text
https://<dominio-backend>/api/v1/stripe/webhook/
```

El signing secret del endpoint debe coincidir con `STRIPE_WEBHOOK_SECRET`. La
operación de facturación está en [planes y facturación](./planes-y-facturacion.md).

## Dominio y TLS

1. Añade un dominio personalizado en Railway o usa el dominio `*.railway.app`.
2. Agrega el dominio a `ALLOWED_HOSTS`.
3. Si el portal web consume el API directamente, agrégalo a
   `CORS_ALLOWED_ORIGINS` y `CSRF_TRUSTED_ORIGINS`.
4. Railway termina TLS y envía `X-Forwarded-Proto`; Django ya confía en ese
   encabezado.
5. Los health checks `/health/live/`, `/health/db/` y `/health/ready/` están
   exentos de la redirección HTTPS para funcionar dentro de la red del host.

## Portal web

El portal se compila como sitio estático:

```bash
cd frontend-web
npm ci
npm run typecheck
npm test
npm run build
```

El resultado está en `frontend-web/dist/`. El hosting debe:

- servir `index.html` para rutas del cliente (SPA fallback);
- publicar los assets con cache largo;
- configurar las variables públicas de build:
  - `VITE_API_BASE_URL=https://<api-host>/api/v1`
  - `VITE_SUPABASE_URL=https://<proyecto>.supabase.co`
  - `VITE_SUPABASE_PUBLISHABLE_KEY=<clave publicable>`

El navegador nunca debe recibir `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`SUPABASE_SERVICE_ROLE_KEY`, contraseñas PostgreSQL ni `BENEF_AI_SERVICE_TOKEN`.
Si el hosting no proxya `/api`, `VITE_API_BASE_URL` debe ser el origen público
del backend.

## App móvil

La app se configura con variables `EXPO_PUBLIC_*` y se publica con EAS. Consulta
[mobile-app/README.md](../mobile-app/README.md#produccion) para el build y las
variables.

## Benef AI

Benef AI es un servicio FastAPI independiente. El portal no lo llama
directamente: React usa el proxy autenticado de Django y Django lo invoca con
una firma HMAC-SHA256. La configuración, variables, timeouts y health checks
están en [benef-ai/README.md](../benef-ai/README.md#produccion).

Resumen:

- Root Directory: `benef-ai`.
- Dockerfile: `Dockerfile.prod`.
- `BACKEND_API_URL=https://api.example.com/api/v1` o una URL privada de Railway.
- `BENEF_AI_SERVICE_TOKEN` compartido con Django (32+ caracteres).
- Django configura `BENEF_AI_URL` y firma cada solicitud con HMAC-SHA256.
- Django debe permitir el host privado en `ALLOWED_HOSTS` si se usa la red interna.
- No necesita service role, base de datos ni secretos Stripe.
- Health check: `/health/live`; readiness: `/health/ready`.

No se requiere modificar React al mover Benef AI entre Railway y un VPS: solo
cambia `BENEF_AI_URL` en Django.

## Migraciones

Las migraciones se aplican de forma controlada. No se ejecutan seeds, resets ni
migraciones sobre Supabase remoto desde el arranque del contenedor.

### Antes de migrar

1. Confirma el proyecto y la rama destino.
2. Crea un respaldo recuperable de Supabase PostgreSQL.
3. Ejecuta las pruebas contra PostgreSQL aislado.
4. Revisa el plan:

```bash
python manage.py migrate --plan
python manage.py showmigrations core
```

5. Verifica que el respaldo se pueda restaurar en un entorno aislado.

### Aplicación

En Railway, ejecuta como paso previo al despliegue o desde una shell del
servicio:

```bash
python manage.py migrate --noinput
```

No ejecutes este comando en cada réplica del contenedor. Usa un release/deploy
command único.

### Verificación

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

### Recuperación

- Si falla la aplicación, vuelve a la imagen anterior.
- Si falla una migración dentro de una transacción, corrige el problema antes de
  reintentar.
- Si los datos quedaron en un estado incompatible, restaura el respaldo en una
  ventana controlada.
- No edites migraciones ya aplicadas ni borres la tabla `django_migrations` para
  “reintentar”.

## Respaldos

Supabase administra los respaldos de producción. Un respaldo manual local con
`python dev.py backup` sirve como referencia de desarrollo, pero no sustituye el
respaldo administrado del proyecto. Los archivos `.dump` y sus recibos `.json`
quedan en `backups/`, fuera de Git.

Antes de cualquier operación destructiva o migración remota:

1. crea o confirma el respaldo administrado;
2. verifica el destino y la fecha;
3. conserva el comprobante de restauración;
4. no apliques cambios sin una ventana controlada.

## Health checks

| Ruta | Uso |
| --- | --- |
| `GET /` | Alias de liveness |
| `GET /health/live/` | Liveness; no consulta PostgreSQL |
| `GET /health/db/` | Readiness; consulta PostgreSQL y responde `503` si falla |
| `GET /health/ready/` | Alias de readiness |

En Benef AI: `/health/live` y `/health/ready`. La readiness verifica configuración
de backend, autenticación interna y presencia de Gemini, sin hacer llamadas
externas.

## CI y verificación continua

El CI de `push` y `pull_request` ejecuta:

- backend: configuración, migraciones pendientes y `core.tests`;
- frontend: Vitest, typecheck y build;
- Benef AI: pruebas unitarias;
- móvil: Jest, typecheck y lint;
- herramientas: pruebas del launcher y del smoke de despliegue.

Las suites que dependen de navegador o de un Sandbox real no bloquean los PR:

- `.github/workflows/e2e.yml`: Playwright con Chromium, manual o semanal.
- `.github/workflows/stripe-sandbox.yml`: verificación de solo lectura del
  catálogo Premium en Stripe Sandbox, manual.
- `.github/workflows/deploy-smoke.yml`: smoke de un despliegue, manual.

### Smoke de despliegue

El smoke comprueba health checks, login con Supabase Auth, perfil, contexto y la
resolución de un QR de sucursal o negocio. Por defecto **no registra visitas**:

```bash
SMOKE_BASE_URL=https://api.example.com \
SMOKE_SUPABASE_URL=https://<proyecto>.supabase.co \
SMOKE_SUPABASE_KEY=<clave-publicable> \
SMOKE_EMAIL=<cuenta-de-prueba> \
SMOKE_PASSWORD=<contraseña> \
python tools/smoke_deploy.py
```

Si no se indica `SMOKE_QR_UUID`, el script intenta obtener un QR de las
sucursales autorizadas de la cuenta. Para una cuenta consumidora sin membresía,
el flujo de lealtad se marca como omitido. Para registrar una visita real en un
entorno controlado:

```bash
python tools/smoke_deploy.py --registrar-visita
```

Ese flag consume el límite diario de la cuenta y no debe usarse en producción
sin autorización. Para comprobar únicamente health checks:

```bash
python tools/smoke_deploy.py --base-url https://api.example.com --health-only
```

El script no imprime tokens, contraseñas ni datos personales. El workflow
`deploy-smoke.yml` recibe `SMOKE_SUPABASE_URL`,
`SMOKE_SUPABASE_PUBLISHABLE_KEY`, `SMOKE_EMAIL` y `SMOKE_PASSWORD` como secretos
del repositorio; el origen se pasa como input.

## Django Admin

`ADMIN_ENABLED=False` elimina la ruta `/admin/`. Si necesitas Django Admin en
producción:

- actívalo con `ADMIN_ENABLED=True`;
- protégelo con Cloudflare Access, VPN o allowlist;
- usa cuentas staff separadas de las identidades Supabase;
- no compartas la service role key con operadores.

## Runbooks

### Propietario único

Una cuenta puede ser propietaria de un solo negocio activo. Puede conservar
membresías de empleado o supervisor en otros negocios y un negocio puede tener
más de un propietario.

La base de datos tiene una restricción parcial como última barrera:

```text
UniqueConstraint(usuario, condition=rol_comercio='dueno' AND sucursal IS NULL AND status)
```

Auditoría de solo lectura:

```bash
python manage.py auditar_propietarios --correo business@example.com
```

Sin `--correo` lista todas las cuentas que hoy incumplen la regla. Para cada
negocio muestra identificador, nombre, categoría, sucursales, propietarios,
conteos de historial, suscripciones, pagos y alianzas. No escribe datos.

Antes de corregir, crea y verifica un respaldo. La corrección es reproducible y
exige decidir qué negocio se conserva:

```bash
python manage.py corregir_propietario_unico \
  --correo business@example.com \
  --conservar 7 \
  --transferir 5:123 \
  --desactivar 8
```

Solo después de revisar el plan:

```bash
python manage.py corregir_propietario_unico \
  --correo business@example.com \
  --conservar 7 \
  --transferir 5:123 \
  --desactivar 8 \
  --confirmar-correo business@example.com \
  --apply
```

- `--conservar`: negocio que permanece con la cuenta.
- `--transferir negocio_id:usuario_id`: cambia el propietario. El destino debe
  existir, estar activo y no tener otro negocio activo.
- `--desactivar negocio_id`: desactiva el negocio y la membresía del propietario,
  conservando todo su historial.
- Cada negocio adicional debe aparecer exactamente en una de las dos opciones.
- La operación es atómica y vuelve a comprobar que quede un solo negocio activo.

Después de corregir, verifica que el negocio conservado mantiene sus sucursales,
clientes, visitas, cupones, canjes, suscripciones y pagos; que los negocios
desactivados conservan su historial; y que `auditar_propietarios` ya no reporta
cuentas incumplidoras.

Para crear una cuenta verificada destinada a una transferencia:

```bash
python manage.py crear_cuentas_propietarios \
  --cuenta aurora@example.com:Renata:Flores \
  --apply --allow-remote \
  --expected-target <huella> \
  --backup-receipt /backups/<respaldo>.json
```

Requiere `SUPABASE_SECRET_KEY`, crea el usuario confirmado en Supabase Auth y su
perfil Django, y muestra las credenciales una sola vez. No crea ni modifica
negocios; después usa `corregir_propietario_unico`.

### Eliminación de cuenta

La baja, la anonimización, la propiedad de negocios y los reintentos están en
[identidad y cuentas](./identidad-y-cuentas.md#baja-de-cuenta). El comando de
reintento es:

```bash
python manage.py reintentar_eliminaciones_cuenta --limite 100
```

### Stripe

La reconciliación y el estado de suscripciones están en
[planes y facturación](./planes-y-facturacion.md#reconciliación).

```bash
python manage.py reconciliar_stripe --negocio-id <id>
```

### Avatares

El bucket, las políticas RLS y la validación están en
[identidad y cuentas](./identidad-y-cuentas.md#avatares-en-supabase-storage).
Aplica [`docs/sql/avatars_storage.sql`](./sql/avatars_storage.sql) con un rol
administrador de Supabase antes de habilitar la subida de fotos.

## Rollback

1. Conserva el respaldo previo a la migración.
2. Si falla el despliegue, vuelve a la imagen anterior.
3. Si una migración ya se aplicó y es incompatible, restaura el respaldo en una
   ventana controlada; no edites migraciones aplicadas.

## Seguridad de secretos

- Los archivos `.env` reales están ignorados por Git.
- Los ejemplos solo contienen valores públicos, placeholders o credenciales
  exclusivas de desarrollo.
- Los prefijos `VITE_` y `EXPO_PUBLIC_` exponen valores al cliente; no incluyas
  contraseñas PostgreSQL, claves secretas ni tokens de sesión.
- `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `BENEF_AI_SERVICE_TOKEN` y `GEMINI_API_KEY` son exclusivos del servidor.
- No imprimas `docker compose config` sin `--quiet`: muestra valores privados.
