# Benef AI

> El entorno se inicia con `python dev.py up` desde la raíz.

Microservicio FastAPI de Benefy. Incluye consultas autenticadas de solo lectura
para usuarios de negocio. Todavía no integra un modelo de lenguaje ni un flujo
conversacional.

## Endpoints

| Método y ruta | Respuesta |
| --- | --- |
| `GET /` | JSON con `service`, `status`, `environment` y `version` |
| `POST /consultas/metricas` | Consulta métricas del backend con la sesión del usuario |
| `POST /consultas/visitas` | Lista visitas, filtradas por periodo, sucursal y estado |
| `POST /consultas/canjes` | Lista canjes autorizados, con filtro de periodo/sucursal |
| `POST /consultas/cupones` | Lista cupones del negocio; solo dueño según Django |
| `POST /consultas/programas` | Consulta programas activos o el detalle de uno |
| `POST /consultas/recompensas` | Consulta recompensas del negocio |
| `POST /consultas/plan` | Consulta plan, suscripción, límites y uso |
| `POST /consultas/negocio` | Consulta datos básicos del negocio, sin credenciales ni QR |
| `POST /consultas/equipo` | Devuelve conteos de membresías, sin nombres ni correos |
| `POST /consultas/clientes` | Devuelve el total de clientes únicos, sin identidades |
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

El token se reenvía a Django, que valida identidad, membresía, rol y sucursal.
Antes de cada consulta, Benef-AI verifica `/mi/contexto/`, rechaza a
`admin_sistema` y requiere membresía activa en el negocio. Django aplica además
los permisos de cada recurso y sucursal. El resumen del equipo está limitado a
dueños y supervisores. Benef-AI solo llama rutas de lectura fijas; no permite
elegir una URL arbitraria ni ejecutar acciones. Si se omiten fechas en métricas,
Django aplica los últimos 30 días. Visitas y canjes omiten identidades y tokens;
equipo e invitaciones se resumen sin datos personales.

La consulta de métricas responde clientes únicos dentro del periodo. No se ofrece
un ranking identificable de clientes: el backend actual devuelve nombres y
correos para ese recurso. Las alianzas solo exponen estado y vigencia; no hay
métricas de captación cruzada. Ninguna ruta realiza cambios en el backend.

Los errores de autorización del backend se conservan. Si el backend no está
configurado o disponible, la ruta responde con `503`; ante timeout, con `504`.
El health check sigue sin comprobar Django, PostgreSQL, Supabase Auth ni
proveedores LLM. Todavía no hay conversación con un modelo de lenguaje.

## Desarrollo

Desde la raíz: `python dev.py up`. El servicio se publica en
http://localhost:5001, monta el código en solo lectura y usa Uvicorn con recarga
automática y polling para Docker Desktop.

```powershell
docker compose logs --tail 50 benef-ai
docker compose stop benef-ai
```

No utiliza un archivo de entorno propio. Compose inyecta `ENVIRONMENT` y
`BACKEND_API_URL`; la configuración compartida está en `.env` en la raíz.
No hay proveedores LLM ni tokens internos activos. El siguiente trabajo requiere
integrar un proveedor LLM y registrar estas rutas como herramientas de consulta.
