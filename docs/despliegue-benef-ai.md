# Despliegue de Benef AI en Railway

Benef AI es un servicio FastAPI independiente. No comparte base de datos ni
service role con Django: reenvía el bearer de Supabase y Django vuelve a validar
identidad, negocio y sucursal.

## Servicio

1. Crea un segundo servicio en el mismo proyecto de Railway.
2. Configura **Root Directory** = `benef-ai`.
3. Railway detecta `benef-ai/railway.json` y usa `Dockerfile.prod`.
4. El contenedor ejecuta Uvicorn sin `--reload`, con usuarios no root y health
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
| `BACKEND_API_URL` | Sí | URL privada de Django terminando en `/api/v1` |
| `BACKEND_TIMEOUT_SECONDS=10` | Recomendado | Timeout de Django (1–60 s) |
| `BENEF_AI_ALLOWED_ORIGINS` | Sí para navegador | Orígenes CORS del portal |
| `GEMINI_API_KEY` | Opcional | Sin clave, `/chat` responde 503 |
| `GEMINI_MODEL` | Opcional | Por defecto `gemini-3.1-flash-lite` |
| `GEMINI_TIMEOUT_MS=30000` | Recomendado | Timeout de Gemini (1–120 s) |
| `LOG_LEVEL=INFO` | Opcional | Nivel de logs |

No se necesitan `SUPABASE_SERVICE_ROLE_KEY`, `DB_*` ni secretos de Stripe en
Benef AI.

## Conexión privada con Django

En el mismo proyecto de Railway, usa el dominio privado del servicio Django:

```text
BACKEND_API_URL=http://<backend-service>.railway.internal:8000/api/v1
```

El backend debe incluir ese host privado en `ALLOWED_HOSTS`. Por ejemplo:

```text
ALLOWED_HOSTS=api.example.com,<backend-service>.railway.internal
```

`BACKEND_API_URL` debe terminar en `/api/v1`. El código acepta HTTPS o HTTP
únicamente para localhost y dominios `*.railway.internal`. Una URL HTTP pública
se rechaza al arrancar en producción.

La conexión es privada: no necesitas publicar Django a Internet para que Benef AI
lo consuma. El portal web sigue usando el dominio público de Django.

## Autenticación y permisos

1. El cliente envía `Authorization: Bearer <access_token>` a Benef AI.
2. Benef AI consulta `/mi/contexto/` en Django con ese bearer.
3. Rechaza `admin_sistema` y negocios fuera del contexto.
4. Cada tool vuelve a llamar a Django con el mismo bearer; Django aplica los
   permisos específicos.

Benef AI no recibe contraseñas, refresh tokens, service role ni datos de otros
negocios.

## Timeouts y errores

- Django: `BACKEND_TIMEOUT_SECONDS` (10 s por defecto).
- Gemini: `GEMINI_TIMEOUT_MS` (30 s por defecto); el cliente se cierra al
  terminar la petición.
- Timeout de Django → `504`.
- Backend no configurado o inalcanzable → `503`.
- Respuesta inválida del backend o de Gemini → `502`.
- Errores 401/403 del backend se conservan.
- `/health/ready` verifica configuración, no dependencias externas.

## Health checks

| Ruta | Uso |
| --- | --- |
| `/` | Alias de liveness |
| `/health/live` | Liveness para Railway; no consulta Django ni Gemini |
| `/health/ready` | Comprueba configuración de backend; no hace red |

## Pruebas

Dentro de la imagen de producción:

```bash
docker build -f benef-ai/Dockerfile.prod -t benefy-benef-ai-prod benef-ai
docker run --rm --entrypoint python -e ENVIRONMENT=development \
  -e BENEFY_LOAD_DOTENV=0 benefy-benef-ai-prod \
  -m unittest discover -s tests -v
```

La suite usa mocks: no consume Gemini, Django ni Supabase reales.

## Dominio público

Si el portal web llama a Benef AI desde el navegador, asígnale un dominio y
configura `BENEF_AI_ALLOWED_ORIGINS` con el origen exacto del portal. Si solo se
consume desde servidor a servidor, puede quedarse en la red privada de Railway.
