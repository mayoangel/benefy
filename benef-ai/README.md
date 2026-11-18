# Benef AI

> El entorno se inicia con `python dev.py up` desde la raíz.

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
un caso de uso y autenticación entre servicios; el backend exige identidad
Supabase y perfil Benefy.
