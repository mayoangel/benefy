# Despliegue de Benef AI

Benef AI es un servicio FastAPI independiente. El portal **no** lo llama
directamente: React usa el proxy autenticado de Django y Django lo invoca con
una firma HMAC-SHA256. Benef AI reenvía el bearer de Supabase a Django para que
las tools mantengan los permisos de negocio.

## Servicio

1. Crea un servicio para Benef AI en Railway o en un VPS.
2. Configura **Root Directory** = `benef-ai` si usas Railway.
3. Railway detecta `benef-ai/railway.json` y usa `Dockerfile.prod`.
4. El contenedor ejecuta Uvicorn sin `--reload`, con usuario no root y health
   check `/health/live`.
5. `PORT` lo inyecta Railway; el entrypoint usa `${PORT:-5000}`.

## Variables

| Variable | Obligatoria | Uso |
| --- | --- | --- |
| `ENVIRONMENT=production` | Sí | Activa validaciones de producción |
| `BENEFY_LOAD_DOTENV=0` | Sí | No carga archivos `.env` locales |
| `PORT` | Railway | Puerto HTTP |
| `WEB_CONCURRENCY=2` | Recomendado | Workers Uvicorn |
| `KEEPALIVE_TIMEOUT=5` | Recomendado | Keep-alive de Uvicorn |
| `BACKEND_API_URL` | Sí | URL de Django terminando en `/api/v1` |
| `BACKEND_TIMEOUT_SECONDS=10` | Recomendado | Timeout de Django (1–60 s) |
| `BENEF_AI_SERVICE_TOKEN` | Sí | Secreto compartido con Django, 32+ caracteres |
| `GEMINI_API_KEY` | Opcional | Sin clave, `/chat` responde 503 |
| `GEMINI_MODEL` | Opcional | Por defecto `gemini-3.1-flash-lite` |
| `GEMINI_TIMEOUT_MS=30000` | Recomendado | Timeout de Gemini (1–120 s) |
| `BENEF_AI_ALLOWED_ORIGINS` | No | Solo si un cliente directo llama al servicio; el portal usa Django |
| `LOG_LEVEL=INFO` | Opcional | Nivel de logs |

No se necesitan `SUPABASE_SERVICE_ROLE_KEY`, `DB_*` ni secretos de Stripe en
Benef AI. El token de servicio y la clave de Gemini nunca llegan al navegador.

## URL de Django

Dentro del mismo proyecto de Railway se puede usar la red privada:

```text
BACKEND_API_URL=http://<backend-service>.railway.internal:8000/api/v1
```

También se admite un dominio público HTTPS de Django:

```text
BACKEND_API_URL=https://api.example.com/api/v1
```

El backend debe incluir el host en `ALLOWED_HOSTS`. La URL debe terminar en
`/api/v1`. El código acepta HTTPS o HTTP únicamente para localhost y dominios
`*.railway.internal`.

## URL de Benef AI en Django

Configura en el servicio Django:

```text
BENEF_AI_URL=https://benef-ai.example.com
BENEF_AI_SERVICE_TOKEN=<el-mismo-secreto>
BENEF_AI_TIMEOUT_SECONDS=45
THROTTLE_BENEF_AI_CHAT=20/hour
```

`BENEF_AI_URL` es el origen del servicio, sin `/chat`, credenciales ni
parámetros. En producción debe ser HTTPS; `http://` solo se admite para
localhost, redes privadas de Railway o desarrollo local. No dependas
exclusivamente de `railway.internal`: puedes mover Benef AI a un VPS con HTTPS
sin cambiar el contrato de React.

## Autenticación y permisos

1. React envía `Authorization: Bearer <access_token>` a Django.
2. Django valida Supabase, la membresía, el negocio y el rate limit.
3. Django firma el cuerpo exacto con `BENEF_AI_SERVICE_TOKEN` y agrega
   `X-Benef-Timestamp` y `X-Benef-Signature`.
4. Benef AI valida firma, ventana de 5 minutos y token de servicio.
5. Benef AI consulta `/mi/contexto/` con el bearer del usuario y rechaza
   `admin_sistema` o negocios ajenos.
6. Cada tool vuelve a llamar a Django con el mismo bearer; Django aplica los
   permisos específicos de recurso y sucursal.

Benef AI no recibe contraseñas, refresh tokens, service role ni datos de otros
negocios. Las tools son de solo lectura.

## Timeouts y errores

- Django → Benef AI: `BENEF_AI_TIMEOUT_SECONDS` (45 s por defecto).
- Benef AI → Django: `BACKEND_TIMEOUT_SECONDS` (10 s por defecto).
- Gemini: `GEMINI_TIMEOUT_MS` (30 s por defecto); el cliente se cierra al
  terminar la petición.
- Timeout de Django → 504.
- Backend no configurado o inalcanzable → 503.
- Respuesta inválida del backend o de Gemini → 502.
- Errores 401/403 del backend se conservan cuando son del usuario; los fallos
  de firma interna no se exponen al navegador.
- `/health/ready` verifica configuración de backend, autenticación interna y
  presencia de Gemini, sin hacer llamadas externas.

## Health checks

| Ruta | Uso |
| --- | --- |
| `/` | Alias de liveness |
| `/health/live` | Liveness para Railway; no consulta Django ni Gemini |
| `/health/ready` | Comprueba configuración; no hace red |

## CORS

El portal usa el proxy de Django, así que no necesita CORS en Benef AI. Deja
`BENEF_AI_ALLOWED_ORIGINS` vacío salvo que exista otro cliente directo. Si se
configura, usa el origen exacto y nunca `*` con credenciales.

## Pruebas

Dentro de la imagen de producción:

```bash
docker build -f benef-ai/Dockerfile.prod -t benefy-benef-ai-prod benef-ai
docker run --rm --entrypoint python -e ENVIRONMENT=development \
  -e BENEFY_LOAD_DOTENV=0 \
  -e BENEF_AI_SERVICE_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
  benefy-benef-ai-prod \
  -m unittest discover -s tests -v
```

La suite usa mocks: no consume Gemini, Django ni Supabase reales. Cubre firma
HMAC, contrato `/chat`, tools, errores de Gemini y health checks.

## Limitaciones

- La prueba E2E con Gemini real requiere una sesión de Supabase válida y un
  entorno con servicios; no se ejecutó en esta entrega.
- El historial de conversación vive en memoria del panel y no se persiste.
- No hay streaming token por token ni push del asistente.
