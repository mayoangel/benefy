# Benefy

Benefy es una plataforma SaaS B2B para que los negocios diseñen y gestionen
programas de lealtad basados en puntos, sellos y cupones. También contempla
colaboraciones de cross-marketing entre negocios y una experiencia de
autoservicio para el cliente final.

> **Estado actual:** el backend ya contiene el primer modelo de dominio,
> migraciones y endpoints CRUD bajo `/api/v1`. El frontend web implementa la
> landing pública; la aplicación móvil y Benef AI conservan una base ejecutable
> sin flujos de producto completos. El hardware todavía no contiene código.

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
   `.env`, `backend/.env`, `benef-ai/.env`, `frontend-web/.env` y
   `mobile-app/.env`.
2. Levanta los servicios de backend desde la raíz del repositorio:

   ```bash
   docker compose up --build
   ```

3. En otra terminal, aplica las migraciones de Django:

   ```bash
   docker compose exec backend python manage.py migrate
   ```

4. Verifica que los servicios respondan:
   - Backend (Django): <http://localhost:8000>
   - Servicio de IA (FastAPI): <http://localhost:5000>
5. (Opcional) Arranca el frontend web y la app móvil por separado:

   ```bash
   cd frontend-web && npm run dev      # http://localhost:5173
   cd mobile-app && npm run start      # Metro en http://localhost:8081
   ```

6. Detén los servicios con `Ctrl + C`.

## Arquitectura prevista

La conexión local y la conexión SSL a Supabase se configuran por separado.
Consulta [Desarrollo y producción con Supabase](./backend/README.md#desarrollo-y-producción-con-supabase)
para los comandos de inicio, migraciones, verificación y manejo de secretos.

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
- Supabase Auth para autenticación y Django para permisos. Consulta
  [autenticación y permisos](./docs/autenticacion.md).
- Firebase Cloud Messaging queda pospuesto hasta el trabajo de la app móvil.
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

1. Configurar Supabase Auth en cada entorno y conectar las sesiones de los clientes.
2. Proteger las operaciones de progreso y canje mediante servicios
   transaccionales y pruebas de concurrencia.
3. Conectar el dashboard y la aplicación móvil con el contrato de la API.
4. Integrar los servicios externos solo después de estabilizar esos flujos.

## Requisitos

- Docker y Docker Compose para el backend, el servicio de IA y PostgreSQL.
- Node.js 22 o superior para el dashboard web y la aplicación móvil (probado
  con Node v22.17.0). El hardware documentará sus requisitos cuando se
  inicialice.
