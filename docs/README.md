# Documentación

Documentación de producción de Benefy. Cada subproyecto mantiene su propia guía
de instalación, configuración y despliegue.

## Documentación transversal

| Documento | Contenido |
| --- | --- |
| [API](./api.md) | Rutas, permisos, payloads, errores y límites implementados |
| [Identidad, acceso y cuentas](./identidad-y-cuentas.md) | Supabase Auth, sesión web, onboarding, roles, matriz de acceso, avatares y baja de cuenta |
| [Reglas de lealtad](./lealtad.md) | Visitas, puntos, tarjetas, cupones y canje |
| [Planes y facturación](./planes-y-facturacion.md) | Límites Free/Premium, suscripciones, Stripe Sandbox y Customer Portal |
| [Operaciones](./operaciones.md) | Despliegue, variables, migraciones, respaldos, health checks y runbooks |
| [SQL de avatares](./sql/avatars_storage.sql) | Bucket, RLS y políticas de Storage |

## Guías por componente

| Guía | Contenido |
| --- | --- |
| [Backend](../backend/README.md) | API Django, configuración, comandos y pruebas |
| [Frontend web](../frontend-web/README.md) | Portal React, build y despliegue estático |
| [Aplicación móvil](../mobile-app/README.md) | Pantallas, endpoints, configuración y publicación Expo |
| [Benef AI](../benef-ai/README.md) | Contrato `/chat`, HMAC, tools, despliegue y pruebas |

## Desarrollo

| Documento | Contenido |
| --- | --- |
| [Desarrollo local y demostración](./desarrollo-local.md) | Compose, launcher, dataset de demo y pruebas locales |
| [Archivo histórico](./archive/README.md) | SRS y material fuera de la operación vigente |
