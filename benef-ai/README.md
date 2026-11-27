# Benef AI

Microservicio FastAPI de Benefy. Ofrece un chat con Gemini y consultas
autenticadas de solo lectura para usuarios de negocio. El portal web lo consume
a través del proxy autenticado de Django.

## Endpoints

| Método y ruta | Respuesta |
| --- | --- |
| `GET /` | JSON con `service`, `status`, `environment` y `version` |
| `GET /health/live` | Liveness; no consulta Django ni Gemini |
| `GET /health/ready` | Configuración de backend, autenticación interna y Gemini |
| `POST /chat` | Conversa con Gemini y ejecuta tools de consulta permitidas |
| `POST /consultas/*` | Consultas internas de solo lectura con bearer de usuario |
| `GET /docs` | Swagger UI generado por FastAPI |
| `GET /redoc` | Documentación ReDoc generada por FastAPI |
| `GET /openapi.json` | Esquema OpenAPI de este microservicio |

## Contrato de `/chat`

Requiere **dos** cosas:

1. `Authorization: Bearer <access_token>` de Supabase.
2. Firma HMAC-SHA256 de servicio:
   `X-Benef-Timestamp` y `X-Benef-Signature`.

La firma se calcula sobre los bytes exactos del cuerpo con
`HMAC-SHA256(BENEF_AI_SERVICE_TOKEN, timestamp + "." + body)`. Se rechazan
timestamps con más de 5 minutos de diferencia. El token de servicio debe tener
al menos 32 caracteres.

```json
{
  "negocio_id": 12,
  "sucursal_id": 11,
  "message": "¿Cuántas visitas tuvimos este mes?",
  "history": [
    {"role": "user", "content": "Hola"},
    {"role": "assistant", "content": "¿Qué necesitas?"}
  ]
}
```

Respuesta:

```json
{
  "answer": "Tuvimos 42 visitas válidas...",
  "tools_used": ["metricas", "visitas"]
}
```

Límites: mensaje de hasta 4000 caracteres, historial de hasta 12 turnos y 12000
caracteres. Benef AI consulta `/negocios/{id}/benef-ai/contexto/` con el bearer
del usuario, rechaza `admin_sistema` y negocios fuera de su contexto. Cada tool
vuelve a llamar a Django, que aplica los permisos de recurso, sucursal y plan.

## Tools

`consultar_analitica` permite únicamente:
`resumen`, `visitas`, `clientes`, `puntos`, `tarjetas`, `recompensas`,
`cupones`, `canjes`, `sucursales`, `equipo`, `alianzas`, `plan` y `negocio`.

`consultar_conocimiento_benefy` devuelve la explicación funcional de Benefy desde
`knowledge.py` para temas de producto, planes, facturación, roles y escritura.

Todas son de lectura. No hay tools para modificar puntos, visitas, cupones,
pagos, membresías ni alianzas. Cada respuesta se limita a 4 rondas y 6
llamadas; Gemini usa `store=false`. Los datos devueltos se sanitizan: sin
correos, tokens, QR ni información de otros negocios. Los periodos relativos y
la zona horaria se calculan en Django, no en el modelo. Si todas las tools
devuelven 5xx, el chat responde 502 y no permite conclusiones inventadas.

## Variables

```dotenv
ENVIRONMENT=development
BACKEND_API_URL=http://127.0.0.1:8000/api/v1
BACKEND_TIMEOUT_SECONDS=10
BENEF_AI_SERVICE_TOKEN=<token-aleatorio-de-32-o-mas-caracteres>
GEMINI_API_KEY=<clave>
GEMINI_MODEL=gemini-3.1-flash-lite
GEMINI_TIMEOUT_MS=30000
BENEF_AI_TOTAL_TIMEOUT_MS=40000
BENEF_AI_ALLOWED_ORIGINS=
LOG_LEVEL=INFO
```

En Docker Compose, `BACKEND_API_URL=http://backend:8000/api/v1` y
`BENEF_AI_SERVICE_TOKEN` se inyecta desde el `.env` raíz. El portal no recibe
ninguna de estas variables.

## Desarrollo

Desde la raíz: `python dev.py up`. El servicio se publica en
http://localhost:5001. Django usa `BENEF_AI_URL=http://127.0.0.1:5001` cuando se
ejecuta fuera de Compose.

## Producción

La imagen de producción es `Dockerfile.prod` (Uvicorn sin `--reload`, usuario no
root, health check `/health/live`). Railway detecta `railway.json` con Root
Directory `benef-ai`.

- `BACKEND_API_URL` puede ser `https://api.example.com/api/v1` o una URL privada
  `http://<backend-service>.railway.internal:8000/api/v1`.
- `BENEF_AI_SERVICE_TOKEN` debe coincidir con el de Django.
- `BENEF_AI_URL` se configura en Django, no aquí.
- No se necesita CORS para el portal porque React usa Django.

Detalles en [despliegue de Benef AI](../docs/despliegue-benef-ai.md) y
[arquitectura del chat](../docs/benef-ai-chat.md).

## Pruebas

```powershell
docker run --rm -v "${PWD}:/app" -w /app --entrypoint python `
  -e ENVIRONMENT=development -e BENEFY_LOAD_DOTENV=0 `
  -e BENEF_AI_SERVICE_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx `
  benefy-benef-ai:latest -m unittest discover -s tests -v
```

Las pruebas usan mocks y no consumen Gemini, Django ni Supabase reales.
