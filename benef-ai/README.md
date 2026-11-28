# Benef AI

Microservicio FastAPI de Benefy. Ofrece un chat con Gemini y consultas
autenticadas de solo lectura para usuarios de negocio. El portal web lo consume
a través del proxy autenticado de Django.

## Arquitectura

```text
React (BenefAIChat)
   │  Bearer de Supabase + negocio + sucursal seleccionada
   ▼
Django  POST /api/v1/negocios/{id}/benef-ai/chat/
   │  - valida membresía, sucursal y límites
   │  - firma HMAC del cuerpo
   ▼
Benef AI  POST /chat
   │  - verifica firma, timestamp y token de servicio
   │  - obtiene contexto autorizado desde Django
   │  - construye la instrucción con identidad, plan, tiempo y permisos
   │  - ejecuta tools de solo lectura
   ▼
Django  /benef-ai/contexto/ y /benef-ai/analitica/
   ▼
PostgreSQL
```

La identidad y los permisos nunca se aceptan desde el texto del usuario. El
negocio viaja en la ruta validada por Django y cada consulta vuelve a aplicar el
alcance del rol y la sucursal. Benef AI no ejecuta escrituras ni SQL directo.

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
2. Firma HMAC-SHA256 de servicio: `X-Benef-Timestamp` y `X-Benef-Signature`.

La firma se calcula sobre los bytes exactos del cuerpo con
`HMAC-SHA256(BENEF_AI_SERVICE_TOKEN, timestamp + "." + body)`. Se rechazan
timestamps con más de 5 minutos de diferencia. El token de servicio debe tener al
menos 32 caracteres.

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

Límites del servicio: mensaje de hasta 4000 caracteres, historial de hasta 12
turnos y 12000 caracteres. Django aplica además su propio límite de mensaje de
2000 caracteres, valida el negocio, la sucursal y el rate limit antes de
reenviar.

Benef AI consulta `/negocios/{id}/benef-ai/contexto/` con el bearer del usuario,
rechaza `admin_sistema` y negocios fuera de su contexto. Cada tool vuelve a
llamar a Django, que aplica los permisos de recurso, sucursal y plan.

## Contexto confiable

Django calcula y entrega:

- nombre del usuario, rol comercial y si es propietario;
- negocio, categoría, zona horaria y sucursal seleccionada;
- sucursales autorizadas;
- plan actual, límites, uso, excedentes y estado de suscripción;
- fecha/hora local, fecha de hoy y rangos de:
  `hoy`, `ayer`, `esta semana`, `semana pasada`, `este mes`, `mes pasado`,
  `últimos 7 días`, `últimos 30 días`, `últimos 90 días` y `este año`;
- periodo anterior de igual duración para comparaciones;
- capacidades autorizadas y confirmación de que no puede escribir.

Benef AI no calcula fechas relativas por su cuenta. Cuando una tool recibe
`periodo`, Django resuelve el rango con el reloj y la zona horaria del negocio.
Si recibe fechas explícitas, rechaza fechas futuras, rangos invertidos o rangos
mayores a 366 días.

## Tools

### `consultar_analitica`

Una tool parametrizada con los siguientes temas:

| Tema | Datos principales |
| --- | --- |
| `resumen` | visitas válidas/anuladas, clientes únicos, canjes, puntos, cupones, tarjetas completadas, alianzas y comparación |
| `visitas` | total, evolución diaria/semanal/mensual, sucursales, días de mayor actividad, top de clientes (solo dueño) y comparación |
| `clientes` | ranking por visitas, canjes, puntos, última visita o nombre; activos/inactivos; frecuencia; límite top-N |
| `puntos` | otorgados, consumidos, expirados, ajustes, saldo total, lotes, puntos por vencer y fuentes |
| `tarjetas` | configuración, ciclos en curso, sellos actuales, ciclos completados y dinámicas más utilizadas |
| `recompensas` | configuración actual, vigencia, stock, disponibilidad, emisiones, canjes y tasa |
| `cupones` | emitidos, disponibles, canjeados, vencidos, anulados, tasa con denominador explícito y próximos vencimientos |
| `canjes` | total, anulados, por recompensa, sucursal, método y top de clientes (dueño) |
| `sucursales` | visitas, clientes, canjes y última actividad por sucursal autorizada |
| `equipo` | miembros visibles, rol, sucursal, estado e invitaciones pendientes, sin correos |
| `alianzas` | aliado, dirección, estado, vigencia, fecha de fin, días restantes, condición y recompensas compartidas |
| `plan` | plan vigente, límites, uso, excedentes y suscripción |
| `negocio` | identidad y sucursales autorizadas |

Parámetros compartidos: `periodo`, `desde`, `hasta`, `sucursal_id`, `comparar`,
`orden`, `limite` (1-20), `incluir_inactivos` y `estado` para alianzas.

### `consultar_conocimiento_benefy`

Base mantenible en `knowledge.py` con temas:

`general`, `visitas`, `puntos`, `tarjetas`, `recompensas`, `cupones`, `canjes`,
`sucursales`, `qr`, `equipo`, `planes`, `facturacion`, `alianzas`, `clientes`,
`escritura` y `privacidad`.

La base distingue reglas funcionales de los límites numéricos del plan. Los
límites se leen del contexto del negocio, no se duplican en el conocimiento.

## Seguridad y límites

- Máximo 4 rondas de tools y 6 llamadas por respuesta.
- Historial máximo: 12 turnos y 12 000 caracteres.
- Resultados top-N acotados; las consultas de clientes tienen un máximo de
  1 000 candidatos históricos.
- Timeout total del chat: 40 s por defecto; timeout por llamada Gemini: 30 s.
- Se desactivan los reintentos automáticos del cliente experimental de
  Interactions para respetar el presupuesto de tiempo.
- Si todas las tools devuelven 5xx, el chat responde 502 y no permite que el
  modelo invente una conclusión.
- Si Gemini falla o excede el tiempo, se responde 502/504 con mensaje seguro.
- No hay SQL directo desde Gemini. Todas las consultas pasan por Django.
- No se envían correos, tokens, QR, IDs de pago ni datos de otros negocios al
  modelo.
- El ranking nominal de clientes y el detalle de uso de cupones/puntos están
  reservados al propietario, igual que en el portal.
- El agente no puede cambiar de negocio ni aceptar un `negocio_id` alternativo
  dentro de los argumentos de una tool.

## Contexto conversacional

- El historial se envía como turnos reales `user_input` / `model_output`, no
  como un único bloque de texto.
- Las preguntas de seguimiento reutilizan la conversación y pueden volver a
  consultar la tool para obtener el detalle que falte.
- El componente React reinicia la conversación al cambiar de negocio, de
  sucursal o de sesión y descarta respuestas tardías.
- No hay persistencia de conversaciones; no se almacenan datos personales en una
  base de chat.

## Escritura y acciones futuras

No hay acciones de escritura habilitadas. Para una fase futura se reserva este
contrato, sin implementarlo todavía:

```json
{
  "accion": "crear_recompensa",
  "parametros": {},
  "resumen": "Crear una recompensa de 15% para Mi Comercio",
  "requiere_confirmacion": true,
  "token_confirmacion": "<token efímero ligado a usuario, negocio y payload>"
}
```

La ejecución requeriría un endpoint separado, permiso de propietario, validación
del payload y confirmación explícita del usuario. Ningún endpoint de escritura
de Benef AI existe en la versión actual.

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

En desarrollo con Compose, `BACKEND_API_URL=http://backend:8000/api/v1` y
`BENEF_AI_SERVICE_TOKEN` se inyecta desde el `.env` raíz. El portal no recibe
ninguna de estas variables.

## Producción

La imagen de producción es `Dockerfile.prod` (Uvicorn sin `--reload`, usuario no
root, health check `/health/live`). Railway detecta `railway.json` con Root
Directory `benef-ai`.

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

### URL de Django

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

### URL de Benef AI en Django

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
5. Benef AI consulta `/negocios/{id}/benef-ai/contexto/` con el bearer del
   usuario y rechaza `admin_sistema` o negocios ajenos.
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
- Errores 401/403 del backend se conservan cuando son del usuario; los fallos de
  firma interna no se exponen al navegador.
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

## Desarrollo

Desde la raíz: `python dev.py up`. El servicio se publica en
http://localhost:5001. Django usa `BENEF_AI_URL=http://127.0.0.1:5001` cuando se
ejecuta fuera de Compose. Consulta
[desarrollo local](../docs/desarrollo-local.md).

## Pruebas

```powershell
docker run --rm -v "${PWD}:/app" -w /app --entrypoint python `
  -e ENVIRONMENT=development -e BENEFY_LOAD_DOTENV=0 `
  -e BENEF_AI_SERVICE_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx `
  benefy-benef-ai:latest -m unittest discover -s tests -v
```

La suite usa mocks: no consume Gemini, Django ni Supabase reales. Cubre firma
HMAC, contrato `/chat`, tools, errores de Gemini y health checks.

## Limitaciones

- La prueba E2E con Gemini real requiere una sesión de Supabase válida y un
  entorno con servicios; no se ejecuta en CI.
- El historial de conversación vive en memoria del panel y no se persiste.
- No hay streaming token por token ni push del asistente.
- No existe un histórico exacto por sello; se informa el progreso actual y los
  ciclos completados.
- La disponibilidad y latencia dependen de Gemini; el sistema falla de forma
  segura, pero no puede garantizar disponibilidad del proveedor.
