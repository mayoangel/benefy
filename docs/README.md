# Documentación

Esta carpeta contiene la documentación funcional y técnica de Benefy.

## Contenido actual

- [Autenticación y permisos](./autenticacion.md): Supabase Auth, configuración,
  migración de usuarios y matriz de acceso de Django.
- [API actual](./api.md): rutas, métodos, respuestas y límites de los CRUD.
- [Reglas de lealtad](./reglas-lealtad.md): visitas, puntos, tarjetas, cupones y canje del MVP.
- [Plan de ejecución de lealtad](./plan-ejecucion-lealtad.md): diseño técnico,
  migraciones, contratos y fases implementadas.
- [Comandos del proyecto](./run_project.md): referencia rápida de desarrollo,
  verificación del montaje demo y presentación.
- [Estado de implementación](./estado-implementacion.md): correspondencia con
  los requisitos del SRS y diferencias respecto al código actual.
- [Montaje local tipo producción](./despliegue-local.md): Gunicorn, WhiteNoise,
  Caddy, Cloudflare Tunnel y operación del entorno de demostración.

- [`Benefy SRS.pdf`](./Benefy%20SRS.pdf): especificación de requisitos de
  software, revisión 1.0.

El SRS describe requisitos de producto, no funcionalidades terminadas. Se
conserva su revisión original; las decisiones técnicas vigentes y sus diferencias
están documentadas en los Markdown anteriores. Para instrucciones de ejecución
usa el [README principal](../README.md) y las guías de cada subproyecto.

Las nuevas decisiones de arquitectura, guías operativas y especificaciones
deberán añadirse aquí siguiendo una nomenclatura descriptiva y manteniendo
actualizados los enlaces desde el README raíz.
