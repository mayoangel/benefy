# Documentación

Documentación funcional y técnica de Benefy. La ejecución y el estado del
proyecto están en el [README raíz](../README.md); cada subproyecto mantiene su
propia guía.

| Documento | Contenido |
| --- | --- |
| [Autenticación y permisos](./autenticacion.md) | Supabase Auth, sesión web, onboarding, roles y matriz de acceso |
| [API](./api.md) | Rutas, permisos, payloads, errores y límites implementados |
| [Reglas de lealtad](./reglas-lealtad.md) | Visitas, puntos, tarjetas, cupones y canje |
| [Planes Free y Premium](./planes-free-premium.md) | Límites, suscripciones y cambios de plan |
| [Montaje local tipo producción](./despliegue-local.md) | Comandos de demo, Gunicorn, Caddy, HTTPS y túnel |
| [Benefy SRS.pdf](./Benefy%20SRS.pdf) | Especificación de requisitos de software, revisión 1.0 |

El SRS describe requisitos de producto, no funcionalidades terminadas. Las
diferencias vigentes están resumidas en el
[README raíz](../README.md#diferencias-con-el-srs). Los informes de validación
no se versionan: las pruebas vigentes son la suite de Django (`backend/README.md`)
y el typecheck/build del frontend.
