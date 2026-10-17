# Benefy

Benefy es una plataforma SaaS B2B para que los negocios diseñen y gestionen
programas de lealtad basados en puntos, sellos y cupones. También contempla
colaboraciones de cross-marketing entre negocios y una experiencia de
autoservicio para el cliente final.

> **Estado actual:** el repositorio se encuentra en la fase de estructura
> inicial. Las carpetas de aplicación todavía no contienen código ejecutable.

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

- [`compose.yaml`](./compose.yaml): reservado para la orquestación local de
  servicios; todavía no define servicios.
- [`.gitignore`](./.gitignore): exclusiones para Python, JavaScript,
  React Native, IoT y herramientas de desarrollo.

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

1. Definir la configuración y los servicios de desarrollo local en
   `compose.yaml`.
2. Inicializar el backend, el dashboard web, la aplicación móvil y los
   componentes de IA e IoT.
3. Añadir las variables de entorno y documentar su configuración sin incluir
   secretos en el repositorio.

## Requisitos previstos

Cuando los subproyectos estén inicializados, se requerirán Docker y Docker
Compose, Node.js 18 o superior, un entorno de desarrollo para React Native y
las credenciales de los servicios externos definidos por cada componente.