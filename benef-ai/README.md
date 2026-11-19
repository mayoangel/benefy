# Benef AI

> El entorno se inicia con `python dev.py up` desde la raíz.

Microservicio FastAPI de Benefy. Ofrece un chat con Gemini y consultas
autenticadas de solo lectura para usuarios de negocio.

## Endpoints

| Método y ruta | Respuesta |
| --- | --- |
| `GET /` | JSON con `service`, `status`, `environment` y `version` |
| `POST /chat` | Conversa con Gemini y ejecuta tools de consulta permitidas |
| `POST /consultas/metricas` | Consulta métricas del backend con la sesión del usuario |
| `POST /consultas/visitas` | Lista visitas, filtradas por periodo, sucursal y estado |
| `POST /consultas/canjes` | Lista canjes autorizados, con filtro de periodo/sucursal |
| `POST /consultas/cupones` | Lista cupones del negocio; solo dueño según Django |
| `POST /consultas/programas` | Consulta programas activos o el detalle de uno |
| `POST /consultas/recompensas` | Consulta recompensas del negocio |
| `POST /consultas/plan` | Consulta plan, suscripción, límites y uso |
| `POST /consultas/negocio` | Consulta datos básicos del negocio, sin credenciales ni QR |
| `POST /consultas/equipo` | Devuelve conteos de membresías, sin nombres ni correos |
| `POST /consultas/clientes` | Devuelve clientes únicos del periodo, sin identidades |
| `POST /consultas/sucursales` | Lista sucursales accesibles, sin datos QR/NFC |
| `POST /consultas/invitaciones` | Devuelve conteos de invitaciones, sin tokens ni correos |
| `POST /consultas/alianzas` | Devuelve estado y vigencia de alianzas visibles |
| `GET /docs` | Swagger UI generado por FastAPI |
| `GET /redoc` | Documentación ReDoc generada por FastAPI |
| `GET /openapi.json` | Esquema OpenAPI de este microservicio |

Todas las rutas `/consultas/*` requieren `Authorization: Bearer <access_token>`
de Supabase y reciben `negocio_id`; las rutas de actividad aceptan `desde`,
`hasta` y `sucursal_id` cuando aplica. Por ejemplo:

```json
{
	"negocio_id": 12,
	"desde": "2026-11-01",
	"hasta": "2026-11-18",
	"sucursal_id": 3,
	"page": 1,
	"page_size": 20
}
```

`POST /chat` requiere el mismo bearer y un cuerpo como:

```json
{
	"negocio_id": 12,
	"message": "¿Cuántas visitas tuvimos este mes?",
	"history": []
}
```

El historial acepta hasta 12 mensajes previos con rol `user` o `assistant`.
Gemini puede solicitar la tool `consultar_datos_negocio`, que tiene un catálogo
cerrado de consultas y nunca recibe el token ni puede elegir otro negocio. El
servidor ejecuta directamente el endpoint correspondiente de Django con el
bearer del usuario y devuelve a Gemini únicamente los datos autorizados y
sanitizados. Antes de llamar a Gemini y antes de cada ruta `/consultas/*`,
Benef-AI consulta `/mi/contexto/`, rechaza a `admin_sistema` y confirma que el
usuario tenga acceso al negocio seleccionado. Después, Django vuelve a aplicar
los permisos específicos del recurso y la sucursal. Esto agrega una petición de
contexto por cada consulta. Se limita cada respuesta a cuatro rondas de tools y
las interacciones usan `store=false`.

El token se reenvía a Django, que valida identidad, membresía, rol y sucursal en
el endpoint solicitado. En listados multi-negocio, filtra la respuesta
autorizada al `negocio_id` elegido. Las recompensas de alianzas visibles para el
negocio también se incluyen. El conteo de clientes usa la métrica agregada del
periodo y no descarga identidades; el resumen de equipo indica que solo cuenta
las membresías visibles para el usuario. Solo llama rutas de lectura fijas; no
permite elegir una URL arbitraria ni ejecutar acciones. Si se omiten fechas en
métricas, Django aplica los últimos 30 días. Visitas y canjes omiten identidades
y tokens; equipo e invitaciones se resumen sin datos personales.

La consulta de clientes de Benef-AI usa `clientes_unicos` de las métricas por
periodo y no consume el listado identificable de Django. No se ofrece un
ranking de clientes. Las alianzas solo exponen estado y vigencia; no hay
métricas de captación cruzada. Ninguna ruta realiza cambios en el backend.

Los errores de autorización del backend se conservan. Si el backend no está
configurado o disponible, la ruta responde con `503`; ante timeout, con `504`.
El health check no comprueba Django, PostgreSQL, Supabase Auth ni Gemini.

Agrega `GEMINI_API_KEY` al `.env` de la raíz. Opcionalmente define `GEMINI_MODEL`
(por defecto `gemini-3.1-flash-lite`); la clave es opcional al arrancar y `/chat`
devuelve `503` si no está configurada. Compose permite definir
`BENEF_AI_ALLOWED_ORIGINS` para los orígenes web autorizados.

## Desarrollo

Desde la raíz: `python dev.py up`. El servicio se publica en
http://localhost:5001, monta el código en solo lectura y usa Uvicorn con recarga
automática y polling para Docker Desktop.

## Pruebas

Con las dependencias de `benef-ai/requirements.txt` instaladas, ejecuta desde la
raíz:

```powershell
python -m unittest discover -s benef-ai/tests -v
```

```powershell
docker compose logs --tail 50 benef-ai
docker compose stop benef-ai
```

No utiliza un archivo de entorno propio. Compose inyecta `ENVIRONMENT` y
`BACKEND_API_URL`; la configuración compartida está en `.env` en la raíz.
