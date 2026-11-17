# Estado de implementación y relación con el SRS

Revisión documental: 16 de noviembre de 2026. Este documento contrasta los
archivos versionados con [Benefy SRS.pdf, revisión 1.0](./Benefy%20SRS.pdf).
Describe capacidades del código, no el estado de migraciones/configuración de
un servidor concreto ni una certificación de aceptación del producto.

## Arquitectura implementada

- Django 5.2 y DRF concentran persistencia, perfiles y autorización. Hay 23
  modelos de dominio y trece migraciones de `core`, además de las de Django.
- El motor de lealtad registra visitas por QR, aplica el límite diario con la
  zona horaria del negocio, otorga puntos por lotes con consumo FIFO, avanza
  tarjetas repetibles o de una sola vez y permite adquirir y canjear cupones
  de forma transaccional e idempotente.
- Free/Premium está implementado: catálogo de planes, límites configurables,
  suscripción vigente única por negocio, asignación automática de Free,
  cambios manuales auditados y bloqueo de altas por encima del cupo. Stripe y
  los cobros siguen pendientes.
- La validación funcional contra Supabase pasó 17/17 comprobaciones; el E2E de
  autenticación real con JWT pasó 12/12 el 14 de noviembre de 2026. El 15 de
  noviembre el E2E del portal pasó 13/13 en API y 9/9 en navegador; el 16 de
  noviembre el E2E de planes pasó 24/24 en API y 12/12 en navegador. La web ya
  consume estos endpoints; el detalle está en
  [validación del MVP](./validacion-mvp-lealtad.md),
  [validación de planes](./validacion-planes-free-premium.md) y
  [autenticación](./autenticacion.md).
- El portal web separa la administración global de los dashboards comerciales.
  Resuelve el acceso con `GET /mi/contexto/`, filtra navegación por rol y ofrece
  selectores de negocio y sucursal. Dueño ve el negocio completo; supervisor y
  empleado, solo su sucursal. Un consumidor sin membresías queda en acceso
  restringido con CTA para registrar un negocio.
- Los roles globales son `consumidor` y `admin_sistema`; el acceso comercial
  se determina con `UsuarioNegocio.rol_comercio` (`dueno`, `supervisor`,
  `empleado`). Todos los usuarios activos pueden consumir. Las altas, cambios y
  bajas de membresías se auditan en `AuditoriaMembresia`. Las migraciones
  `0008`–`0010` quedaron aplicadas en Supabase el 15 de noviembre de 2026 y las
  `0011`–`0013` (planes) el 16 de noviembre de 2026.
- Desarrollo usa PostgreSQL 17 dentro de Docker, la misma versión mayor que
  Supabase. El montaje de demostración apunta a PostgreSQL Supabase con SSL
  mediante un Compose independiente y el mismo ORM.
- Supabase Auth verifica las cuentas; Django consulta `/auth/v1/user` y resuelve
  el perfil por UUID. Los roles/membresías se consultan en Django en cada petición.
- La web usa React 18, React Router y CSS propio: landing pública, Supabase Auth
  y portal conectado a la API. El móvil todavía no tiene Auth ni cliente API.
- La app Expo SDK 58 tiene un dashboard de demostración con Expo Router y cuatro
  pestañas; usa datos locales y no tiene cliente API ni Auth.
- Benef AI solo expone salud y la documentación automática FastAPI. El nombre de
  una rama o un commit de IA no demuestra que exista un agente en `main.py`.
- Hardware no contiene firmware. El CI cubre pruebas de Django, typecheck y
  build del frontend; no hay pruebas de móvil, IA ni E2E.

## Decisiones que difieren de la revisión 1.0

| Tema del SRS | Decisión/código actual | Implicación documental |
| --- | --- | --- |
| Firebase Auth, sección 3.1.3.2 | Supabase Auth con verificación remota en Django | Actualizar proveedor y flujo en la próxima revisión formal |
| Google API, RF-01 y RS-01 | Auth admite cuentas de correo confirmadas; no hay UI ni integración Google en clientes | Google puede habilitarse en Supabase, pero no está implementado en el repositorio |
| React con Tailwind, sección 2.4 | React 18 y CSS propio; no hay Tailwind instalado | No presentar Tailwind como dependencia existente |
| Dashboard y aplicación de consumidores | Portal web conectado por rol; dashboard móvil de demostración | El móvil y los CRUD completos siguen pendientes |
| IA/ESP-CLAW, sección 3.1.3.6 | FastAPI sin agente ni proveedor, hardware vacío | No hay function calling, WebSocket ni herramientas de IA funcionando |
| Stripe/FCM/Cloudinary/Sentry | Modelos o placeholders en algunos casos; SDKs e integraciones ausentes | Distinguir diseño previsto de servicios conectados |

Se conserva el PDF original para no perder formato, firmas o trazabilidad de la
revisión 1.0. Este documento registra las diferencias; no reescribe silenciosamente
los requisitos aprobados ni declara nuevas aprobaciones. La actualización formal
del SRS debe producir una nueva revisión coherente con estas decisiones.

## Requisitos funcionales

Los estados «base backend» significan que existen entidades/rutas útiles,
pero no el flujo completo ni la interfaz exigidos por el SRS.

| ID | Requisito de la revisión 1.0 | Estado en el código |
| --- | --- | --- |
| RF-01 | Acceso y cierre de sesión | Login, sesión persistente, refresh, logout y recuperación en la web con Supabase Auth; Google y Auth móvil pendientes |
| RF-02 | Registro y edición del comercio | Alta web de perfil y negocio con membresía de dueño; edición completa pendiente |
| RF-03 | Dashboard y filtros de métricas | Portal con métricas reales por negocio o sucursal y rango de fechas; filtros avanzados y exportación pendientes |
| RF-04 | Configurar dinámicas | Serializers y motor de puntos/tarjetas; faltan UI y pantalla de administración |
| RF-05 | Gestionar alianzas | Entidad/CRUD; escritura restringida al admin, falta aprobación bilateral e interfaz |
| RF-06 | Consultar programas y progreso | Billetera, tarjetas en curso, catálogo y cupones propios; falta pantalla móvil |
| RF-07 | Registro mediante QR | Endpoint de visita con QR de negocio/sucursal y límite diario; falta escáner móvil |
| RF-08 | Registro mediante NFC | Identificador de sucursal; lectura y flujo pendientes |
| RF-09 | Consultar/canjear recompensas | Adquisición atómica con puntos y canje irreversible de cliente; falta UI |
| RF-10 | Historial de movimientos | Ledger de puntos, visitas, cupones y canjes consultables; faltan filtros avanzados y pantalla |
| RF-11 | Permisos y preferencias de notificaciones | Pendiente en móvil; no hay permisos cámara/push ni preferencias |
| RF-12 | Interfaz de suscripciones | Plan actual, límites, uso, excedentes y funciones Premium en el portal; cambio manual auditado por admin. Checkout y cobros pendientes |
| RF-13 | Validaciones visuales | Validaciones de formularios de acceso y onboarding en la web; faltan las de los CRUD comerciales |
| RF-14 | Navegación y recuperación ante errores | Portal con guards, estados de carga/error, logout y acceso restringido; faltan flujos móviles y de conexión |
| RF-15 | Cobros y webhooks Stripe | Pendiente; IDs Stripe en modelos no constituyen una integración |
| RF-16 | Push automático con FCM | Pospuesto; modelo de notificaciones sin entrega ni cola de reintentos |

## Seguridad y requisitos no funcionales

| Tema | Evidencia y pendiente |
| --- | --- |
| RS-01: identidad y JWT | Token verificado en Supabase y consumido por la web con refresh y guards; falta Auth móvil y Google del SRS |
| RS-02: RBAC | Querysets y escrituras restringidos; aislamiento por sucursal probado y contexto del portal. Deben revisarse también Data API, alianzas y despliegue real |
| RS-03: variables de entorno | `.env` reales ignorados y excluidos del build; ejemplos con placeholders. Falta operar secretos/rotación en el servidor |
| RS-04: auditoría | Hay fechas, actividades y canjes; no existe un registro integral de eventos API y autenticación |
| Rendimiento y concurrencia | No hay pruebas de carga que acrediten 100 usuarios, 15 TPS o latencias del SRS |
| Disponibilidad y recuperación | No hay monitoreo/SLA verificado ni procedimientos automatizados de backup, retención o restauración |
| HTTPS | SSL de PostgreSQL y HTTPS local con Caddy en el montaje demo; el TLS público sigue pendiente de despliegue |
| Portabilidad | Imágenes Python 3.11 y Compose; la web se compila en el montaje demo y el móvil se ejecuta fuera de Docker. No hay builds móviles de publicación configurados |
| Privacidad y exposición de datos | Permisos Python no protegen accesos directos por Data API; revisar exposición, privilegios y alcance de alianzas |
| Pruebas | Django cubre salud, configuración, Auth, permisos, membresías, portal, aislamiento por sucursal, planes, límites, concurrencia, migración, motor de lealtad y PostgreSQL (153 pruebas). El E2E con Supabase pasó 24/24 en API y 12/12 en navegador. No hay suite móvil/IA ni E2E automatizada en CI |

Los porcentajes, ventanas de mantenimiento, retención de respaldos y objetivos
de fiabilidad del PDF son requisitos pendientes de implementación/medición,
no garantías actuales. Tampoco se declara cumplimiento legal a partir del código.

## Límites que afectan al siguiente desarrollo

1. `ProgresoUsuario` se conserva como historial legacy; la fuente de verdad de
   tarjetas es `CicloTarjeta`.
2. El CRUD genérico de visitas, progreso, cupones y canjes es solo lectura; las
   operaciones reales pasan por los servicios transaccionales.
3. El portal tiene layout, navegación, selectores y resúmenes; el CRUD de
   dinámicas, recompensas y equipo sigue pendiente. Tampoco hay paginación,
   filtros avanzados ni esquema OpenAPI.
4. El catálogo y la billetera tienen contrato backend; faltan pantallas conectadas
   en la aplicación móvil.
5. Las alianzas con puntos compartidos, NFC y QR dinámicos quedan fuera del MVP.
6. Benef AI todavía no tiene un contrato autenticado con el backend. Su token
   interno placeholder no permite omitir Supabase Auth.
7. Free/Premium está implementado en capacidades y límites. Faltan precios,
   Stripe, renovaciones, checkout, downgrade programado y la pantalla para
   regularizar tarjetas, sucursales o equipo excedentes.

La secuencia de trabajo sugerida es completar los CRUD del portal, integrar
Stripe y la facturación, resolver la regularización de excedentes, conectar la
aplicación móvil con Auth y los contratos de visita, billetera, catálogo y canje,
y programar la expiración periódica de puntos. Las integraciones externas y el
hardware deben tener entregables propios y pruebas de flujo completo.

## Aspectos editoriales del SRS original

El PDF tiene 22 páginas y se identifica como revisión 1.0. Mantiene campos de
plantilla sin completar (fechas, contactos, firmas, referencias y apéndices),
una cabecera heredada «Modelo de ingeniería / [Nombre documento] / 0.3» y un
índice que requiere actualizar sus páginas. Deben corregirse en el archivo
editable de la siguiente revisión, sin inventar aprobaciones ni datos personales.

Las guías operativas actuales son [backend](../backend/README.md),
[API](./api.md) y [autenticación](./autenticacion.md).
