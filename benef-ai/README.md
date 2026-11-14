# Benef AI

Microservicio FastAPI preparado para incorporar funciones de inteligencia
artificial de Benefy. Actualmente contiene únicamente el endpoint de estado;
no hay agente, LLM, herramientas, memoria ni análisis de negocio implementados.

## Endpoints actuales

| Método y ruta | Respuesta |
| --- | --- |
| `GET /` | JSON con `service`, `status`, `environment` y `version` |
| `GET /docs` | Swagger UI generado por FastAPI |
| `GET /redoc` | Documentación ReDoc generada por FastAPI |
| `GET /openapi.json` | Esquema OpenAPI de este microservicio |

El health check no comprueba Django, PostgreSQL, Supabase Auth ni proveedores
LLM. No hay rutas de análisis/chat, autenticación propia ni llamadas al backend.

## Desarrollo

Desde la raíz del repositorio:

```bash
docker compose -f compose.yaml up -d --build benef-ai
docker compose -f compose.yaml logs --tail 50 benef-ai
```

Se publica <http://localhost:5000/> y el código de `benef-ai/` se monta
en `/app`. Uvicorn utiliza recarga automática.

Para detener solo este servicio:

```bash
docker compose -f compose.yaml stop benef-ai
```

Para ejecución fuera de Docker, desde `benef-ai/` y en un entorno virtual propio:

```bash
python -m pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 5000 --reload
```

Las dependencias están fijadas en [requirements.txt](./requirements.txt).
No hay suite de pruebas ni linter configurados para este servicio.

## Variables

`main.py` carga `benef-ai/.env` sin sobrescribir variables ya inyectadas.
Puedes crearlo desde [.env.example](./.env.example) si no existe.

| Variable del ejemplo | Uso actual |
| --- | --- |
| `ENVIRONMENT` | Se devuelve en el health check; defecto `development` |
| `PORT` | Reservada; Uvicorn usa el puerto del comando, no esta variable |
| `OPENAI_API_KEY`, `GEMINI_API_KEY` | Placeholders; no hay SDK ni llamadas a proveedores |
| `BACKEND_API_URL` | Prevista; todavía no hay cliente HTTP de Django |
| `BACKEND_INTERNAL_TOKEN` | Prevista; no se valida ni concede acceso a la API Django |

El hostname `backend` solo se resuelve en la red Compose. Para una ejecución
futura fuera de Docker se deberá usar una URL accesible como
`http://localhost:8000/api/v1`.

## Montaje de demostración y trabajo pendiente

[compose.demo.yaml](../compose.demo.yaml) conserva el servicio, ejecuta Uvicorn
sin `--reload` y expone `5000` únicamente dentro de su red. No monta el código
ni el `.env` local. Solo inyecta `ENVIRONMENT=production` y `BACKEND_API_URL`;
las claves LLM no se pasan a producción.

El siguiente trabajo requiere definir un caso de uso, un contrato interno
y autenticación entre servicios. La API Django actual exige identidad Supabase
y perfil Benefy; el placeholder `BACKEND_INTERNAL_TOKEN` no sustituye ese flujo.
Las propuestas analíticas y la integración ESP32-S3 del SRS continúan pendientes.
