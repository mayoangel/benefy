# Benefy

Benefy es una plataforma SaaS B2B para que los negocios diseñen y gestionen
programas de lealtad basados en puntos, sellos y cupones. También contempla
colaboraciones de cross-marketing entre negocios y una experiencia de
autoservicio para el cliente final.

> **Estado actual:** el backend (Django), el servicio de IA (FastAPI) y la
> orquestación local (`compose.yaml`) ya tienen una base ejecutable. El
> dashboard web, la aplicación móvil y el hardware todavía no contienen código.

## Estructura actual

| Carpeta | Propósito |
| --- | --- |
| [`backend`](./backend/README.md) | API, lógica de negocio, persistencia e integraciones del servidor. |
| [`benef-ai`](./benef-ai/README.md) | Componentes y servicios de inteligencia artificial de Benefy. |
| [`docs`](./docs/README.md) | Especificaciones y documentación funcional del producto. |
| [`frontend-web`](./frontend-web/README.md) | Dashboard web para la administración de comercios. |
| [`hardware`](./hardware/README.md) | Firmware e integración de dispositivos IoT y ESP32-S3. |
| [`mobile-app`](./mobile-app/README.md) | Aplicación móvil para clientes finales y gestión de recompensas. |

Los archivos de configuración actuales son:

- [`compose.yaml`](./compose.yaml): orquestación local de los servicios
  `db` (PostgreSQL 15), `backend` (Django) y `benef-ai` (FastAPI).
- [`.gitignore`](./.gitignore): exclusiones para Python, JavaScript,
  React Native, IoT y herramientas de desarrollo.

## Inicio rápido (entorno local)

1. Crea los archivos de entorno a partir de los ejemplos si aún no existen:
   `.env`, `backend/.env` y `benef-ai/.env`.
2. Levanta los servicios desde la raíz del repositorio:

   ```bash
   docker compose up --build
   ```

3. Verifica que los servicios respondan:
   - Backend (Django): <http://localhost:8000>
   - Servicio de IA (FastAPI): <http://localhost:5000>
4. Detén la ejecución con `Ctrl + C`.

## Arquitectura prevista

1. **Backend:** API centralizada para usuarios, comercios, programas de
   lealtad, transacciones, recompensas y webhooks.
2. **Dashboard web:** administración de comercios, métricas y configuración de
   campañas.
3. **Aplicación móvil:** interacción del cliente con códigos QR/NFC y
   recompensas.
4. **IA e IoT:** asistentes y estaciones inteligentes basadas en ESP32-S3.

## Tecnologías previstas

- Python, Django y Django REST Framework.
- PostgreSQL mediante Supabase.
- React y Tailwind CSS para el dashboard web.
- React Native para la aplicación móvil.
- ESP32-S3 para los dispositivos IoT.
- Firebase Auth y Firebase Cloud Messaging.
- Stripe para suscripciones B2B.
- Cloudinary para contenido multimedia.
- Sentry para monitoreo de errores.

Estas tecnologías describen la dirección del producto; deben considerarse
propuestas hasta que aparezcan sus configuraciones y dependencias en cada
subproyecto.

## Documentación

La especificación de requisitos del producto está disponible en
[`docs/Benefy SRS.pdf`](./docs/Benefy%20SRS.pdf). La documentación específica de
cada área se mantiene en el README de su carpeta.

## Próximos pasos

1. Definir los primeros modelos de negocio y endpoints del backend.
2. Inicializar el dashboard web, la aplicación móvil y los componentes de
   hardware/IoT.
3. Integrar la autenticación y los servicios externos (Stripe, Firebase,
   Supabase).

## Requisitos previstos

Para el entorno local actual solo se requieren Docker y Docker Compose. Los
subproyectos pendientes (dashboard web, aplicación móvil y hardware)
documentarán sus propios requisitos cuando se inicialicen.
