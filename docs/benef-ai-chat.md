# Benef AI en el dashboard

Benef AI es un asistente conversacional de solo lectura para propietarios,
supervisores y empleados con membresía activa. El portal web no llama a Benef AI
directamente: Django valida la sesión de Supabase, el negocio y los límites antes
de reenviar la solicitud.

## Arquitectura

```text
React (portal)
   │  Authorization: Bearer <Supabase access token>
   ▼
Django  POST /api/v1/negocios/{id}/benef-ai/chat/
   │  - autentica y autoriza el negocio
   │  - valida mensaje, historial y rate limit
   │  - firma el cuerpo con HMAC-SHA256
   ▼
Benef AI  POST /chat
   │  - verifica firma, timestamp y token de servicio
   │  - vuelve a validar /mi/contexto/ con el bearer del usuario
   │  - ejecuta tools de lectura contra Django
   ▼
Django API  →  PostgreSQL / Supabase
```

La única credencial para identificar al usuario sigue siendo su access token de
Supabase. El HMAC es autenticación de servicio, no un segundo sistema de login.

## Endpoint del portal

```http
POST /api/v1/negocios/{negocio_id}/benef-ai/chat/
Authorization: Bearer <supabase_access_token>
Content-Type: application/json

{
  "message": "¿Cuántas visitas tuvimos esta semana?",
  "history": [
    {"role": "user", "content": "Hola"},
    {"role": "assistant", "content": "¿Qué necesitas consultar?"}
  ]
}
```

Respuesta exitosa:

```json
{
  "answer": "Tuvimos 42 visitas válidas...",
  "tools_used": ["metricas", "visitas"]
}
```

Límites de Django:

- `negocio_id` debe existir y estar activo.
- El usuario debe tener membresía efectiva en el negocio.
- `admin_sistema` y consumidores sin membresía reciben `403`.
- Mensaje: 1 a 2000 caracteres.
- Historial: máximo 12 turnos, solo `user`/`assistant`, máximo 12,000
  caracteres acumulados.
- Rate limit por usuario: `20/hour` por defecto
  (`THROTTLE_BENEF_AI_CHAT`).
- Timeout hacia Benef AI: 45 s por defecto (`BENEF_AI_TIMEOUT_SECONDS`).

Errores seguros:

| Situación | HTTP | Código |
| --- | --- | --- |
| Sin sesión | `401` | `sin_sesion` |
| Negocio ajeno o rol no autorizado | `403` | `sin_acceso` |
| Administrador global | `403` | `benef_ai_solo_negocios` |
| Mensaje/historial inválido | `400` | errores de campo DRF |
| Límite de uso | `429` | `detail` con el límite |
| Benef AI no configurado | `503` | `benef_ai_no_configurado` |
| Benef AI no disponible | `503` | `benef_ai_no_disponible` |
| Timeout de Benef AI | `504` | `benef_ai_timeout` |
| Respuesta inválida del proveedor | `502` | `benef_ai_respuesta_invalida` |

## Autenticación entre servicios

Cada solicitud de Django a Benef AI incluye:

```http
Authorization: Bearer <supabase_access_token>
X-Benef-Timestamp: <unix seconds>
X-Benef-Signature: <hex HMAC-SHA256>
Content-Type: application/json
```

La firma se calcula sobre los bytes exactos del cuerpo:

```text
HMAC-SHA256(BENEF_AI_SERVICE_TOKEN, timestamp + "." + body)
```

Benef AI:

1. exige `BENEF_AI_SERVICE_TOKEN` de al menos 32 caracteres;
2. rechaza timestamps con más de 5 minutos de diferencia;
3. compara la firma en tiempo constante;
4. conserva el bearer de Supabase para que Django aplique permisos de negocio.

El token de servicio nunca se envía a React ni se registra en logs. Las URLs de
Benef AI deben ser HTTPS en producción. Se permite HTTP solo para localhost o
redes privadas (`*.railway.internal`, desarrollo local/Docker).

## Contexto y permisos

- El negocio queda fijado por la ruta `/negocios/{id}/benef-ai/chat/`; el cliente
  no puede cambiarlo dentro de la misma solicitud.
- Django verifica la membresía antes de llamar a Benef AI.
- Benef AI consulta `/api/v1/mi/contexto/` con el bearer del usuario y rechaza
  negocios fuera del contexto o cuentas `admin_sistema`.
- Cada tool vuelve a llamar a Django; Django aplica permisos por recurso y
  sucursal.
- Las tools son de solo lectura. No existen operaciones para modificar puntos,
  visitas, cupones, pagos, membresías o alianzas.
- El historial vive en memoria del panel React y se envía en cada turno. No hay
  base de datos de conversaciones.
- Al cambiar de negocio, cerrar sesión o reiniciar la conversación, React aborta
  la solicitud pendiente y descarta respuestas tardías.

## Tools disponibles

El agente solo puede invocar `consultar_datos_negocio` con uno de estos tipos:

`metricas`, `visitas`, `canjes`, `cupones`, `programas`, `recompensas`, `plan`,
`negocio`, `equipo`, `clientes`, `sucursales`, `invitaciones`, `alianzas`.

Benef AI limita cada respuesta a 4 rondas de tools y 4 llamadas, usa
`store=false` en Gemini y sanitiza los campos devueltos (sin identidades,
tokens, QR, correos ni datos de otros negocios). Si una consulta no tiene datos o
Django responde `403`, el agente debe explicarlo, no inventar cifras.

## UI del portal

`src/portal/components/BenefAIChat.tsx` implementa:

- botón **Benef AI** en la barra superior del negocio;
- panel lateral responsive con el negocio actual;
- conversación con historial en memoria;
- envío con Enter y salto de línea con Shift+Enter;
- sugerencias iniciales, estado de carga, errores recuperables y reinicio;
- cancelación de solicitudes al cambiar de negocio/cerrar el panel;
- foco al abrir, cierre con Escape, `role="dialog"`, `role="log"`,
  `aria-live`, etiquetas accesibles y scroll automático.

No se añadió una ruta de dashboard alternativa ni se reutilizó
`dashboard/dani`.

## Configuración local

Variables compartidas (no subir secretos):

```dotenv
BENEF_AI_URL=http://127.0.0.1:5001
BENEF_AI_SERVICE_TOKEN=<token-aleatorio-de-32-o-mas-caracteres>
BENEF_AI_TIMEOUT_SECONDS=45
THROTTLE_BENEF_AI_CHAT=20/hour
GEMINI_API_KEY=<clave-solo-en-el-entorno-del-servicio-IA>
```

En Docker Compose, Django usa `BENEF_AI_URL=http://benef-ai:5000` y ambos
servicios reciben el mismo `BENEF_AI_SERVICE_TOKEN` desde el `.env` raíz. Benef
AI usa `BACKEND_API_URL=http://backend:8000/api/v1`.

En ejecución local fuera de Compose:

- Django: `BENEF_AI_URL=http://127.0.0.1:5001`.
- Benef AI: `BACKEND_API_URL=http://127.0.0.1:8000/api/v1` (o el puerto de
  Django que corresponda).

El portal solo requiere `VITE_API_BASE_URL`; no recibe claves de Gemini ni el
token de servicio.

## Railway / VPS

Django:

```text
BENEF_AI_URL=https://benef-ai.example.com
BENEF_AI_SERVICE_TOKEN=<secreto-compartido>
```

Benef AI:

```text
BACKEND_API_URL=https://api.example.com/api/v1
BENEF_AI_SERVICE_TOKEN=<el-mismo-secreto>
GEMINI_API_KEY=<secreto>
```

También se admite `http://benef-ai.railway.internal:5000` si ambos servicios
están en la misma red privada de Railway. No se debe depender exclusivamente de
`railway.internal`: la URL es configurable y puede apuntar a un VPS con HTTPS.

## Costos y límites

- Rate limit de 20 consultas por usuario/hora por defecto.
- Mensajes de 2000 caracteres y contexto de 12,000 caracteres.
- Máximo 4 rondas de tools por respuesta.
- Timeout de Django 45 s y de Gemini 30 s.
- No se persisten conversaciones ni se entrenan modelos con los datos.
- El health check de Benef AI no consume Gemini.

## Pruebas

- Django: autenticación, permisos, aislamiento entre negocios, validación,
  rate limit, timeout, errores del proveedor, respuesta exitosa y compatibilidad
  de firma HMAC.
- Benef AI: contrato `/chat`, autenticación HMAC, herramientas permitidas,
  contexto, errores de Gemini, respuesta vacía y límites de historial.
- React: apertura/cierre, envío, Shift+Enter, carga, error, reinicio, cambio de
  negocio, respuestas tardías, accesibilidad y ausencia de chat para admin.

Resultados de esta entrega: **335 pruebas Django OK**, **39 pruebas Benef AI
OK**, **52 pruebas Vitest OK** y **40 pruebas Playwright E2E OK**. El build de
Vite y el typecheck también pasan.

## Limitaciones del MVP

- El historial se pierde al recargar la página; no hay base de conversaciones.
- No hay streaming token por token; la respuesta llega completa.
- No hay push ni notificaciones del asistente.
- La calidad de las respuestas depende de las tools y de Gemini; si no hay
  datos, el agente debe decirlo.
- La prueba E2E con Gemini real requiere una sesión de Supabase válida y un
  entorno con servicios; no se ejecutó en esta entrega.
