# Estado de implementación y relación con el SRS

Revisión documental: 14 de noviembre de 2026. Este documento contrasta los
archivos versionados con [Benefy SRS.pdf, revisión 1.0](./Benefy%20SRS.pdf).
Describe capacidades del código, no el estado de migraciones/configuración de
un servidor concreto ni una certificación de aceptación del producto.

## Arquitectura implementada

- Django 5.2 y DRF concentran persistencia, perfiles y autorización. Hay 20
  modelos de dominio y siete migraciones de `core`, además de las de Django.
- El motor de lealtad registra visitas por QR, aplica el límite diario con la
  zona horaria del negocio, otorga puntos por lotes con consumo FIFO, avanza
  tarjetas repetibles o de una sola vez y permite adquirir y canjear cupones
  de forma transaccional e idempotente.
- Desarrollo usa PostgreSQL 17 dentro de Docker, la misma versión mayor que
  Supabase. El montaje de demostración apunta a PostgreSQL Supabase con SSL
  mediante un Compose independiente y el mismo ORM.
- Supabase Auth verifica las cuentas; Django consulta `/auth/v1/user` y resuelve
  el perfil por UUID. Los roles/membresías se consultan en Django en cada petición.
- La web usa React 18, React Router y CSS propio: landing pública y pantallas
  de acceso simuladas; no consume la API ni Supabase.
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
| Dashboard y aplicación de consumidores | Landing pública, acceso simulado y dashboard móvil de demostración | Pantallas conectadas a datos reales y recorridos del SRS siguen pendientes |
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
| RF-01 | Acceso y cierre de sesión | Base backend Supabase Auth; faltan UI, Google y gestión de sesiones en clientes |
| RF-02 | Registro y edición del comercio | Base backend con permisos y creación de membresía de dueño; falta formulario web |
| RF-03 | Dashboard y filtros de métricas | Endpoint de métricas básicas por negocio y rango; falta dashboard web |
| RF-04 | Configurar dinámicas | Serializers y motor de puntos/tarjetas; faltan UI y pantalla de administración |
| RF-05 | Gestionar alianzas | Entidad/CRUD; escritura restringida al admin, falta aprobación bilateral e interfaz |
| RF-06 | Consultar programas y progreso | Billetera, tarjetas en curso, catálogo y cupones propios; falta pantalla móvil |
| RF-07 | Registro mediante QR | Endpoint de visita con QR de negocio/sucursal y límite diario; falta escáner móvil |
| RF-08 | Registro mediante NFC | Identificador de sucursal; lectura y flujo pendientes |
| RF-09 | Consultar/canjear recompensas | Adquisición atómica con puntos y canje irreversible de cliente; falta UI |
| RF-10 | Historial de movimientos | Ledger de puntos, visitas, cupones y canjes consultables; faltan filtros avanzados y pantalla |
| RF-11 | Permisos y preferencias de notificaciones | Pendiente en móvil; no hay permisos cámara/push ni preferencias |
| RF-12 | Interfaz de suscripciones | Pendiente; solo modelos y lectura según permisos |
| RF-13 | Validaciones visuales | Hay validaciones de servidor; las de formularios de producto siguen pendientes |
| RF-14 | Navegación y recuperación ante errores | Landing con rutas básicas; faltan flujos de producto y estados de sesión/conexión |
| RF-15 | Cobros y webhooks Stripe | Pendiente; IDs Stripe en modelos no constituyen una integración |
| RF-16 | Push automático con FCM | Pospuesto; modelo de notificaciones sin entrega ni cola de reintentos |

## Seguridad y requisitos no funcionales

| Tema | Evidencia y pendiente |
| --- | --- |
| RS-01: identidad y JWT | Token verificado en Supabase; faltan integración cliente y acceso Google descritos en el SRS |
| RS-02: RBAC | Querysets y escrituras restringidos; pruebas de aislamiento. Deben revisarse también Data API, alianzas y despliegue real |
| RS-03: variables de entorno | `.env` reales ignorados y excluidos del build; ejemplos con placeholders. Falta operar secretos/rotación en el servidor |
| RS-04: auditoría | Hay fechas, actividades y canjes; no existe un registro integral de eventos API y autenticación |
| Rendimiento y concurrencia | No hay pruebas de carga que acrediten 100 usuarios, 15 TPS o latencias del SRS |
| Disponibilidad y recuperación | No hay monitoreo/SLA verificado ni procedimientos automatizados de backup, retención o restauración |
| HTTPS | SSL de PostgreSQL y HTTPS local con Caddy en el montaje demo; el TLS público sigue pendiente de despliegue |
| Portabilidad | Imágenes Python 3.11 y Compose; la web se compila en el montaje demo y el móvil se ejecuta fuera de Docker. No hay builds móviles de publicación configurados |
| Privacidad y exposición de datos | Permisos Python no protegen accesos directos por Data API; revisar exposición, privilegios y alcance de alianzas |
| Pruebas | Django cubre salud, configuración, Auth, permisos, migración, motor de lealtad y concurrencia PostgreSQL (93 pruebas); no hay suite web/móvil/IA ni E2E completa |

Los porcentajes, ventanas de mantenimiento, retención de respaldos y objetivos
de fiabilidad del PDF son requisitos pendientes de implementación/medición,
no garantías actuales. Tampoco se declara cumplimiento legal a partir del código.

## Límites que afectan al siguiente desarrollo

1. `ProgresoUsuario` se conserva como historial legacy; la fuente de verdad de
   tarjetas es `CicloTarjeta`.
2. El CRUD genérico de visitas, progreso, cupones y canjes es solo lectura; las
   operaciones reales pasan por los servicios transaccionales.
3. No hay paginación, filtros avanzados, esquema OpenAPI Django ni dashboard web.
4. El catálogo y la billetera tienen contrato backend; faltan pantallas conectadas
   en la aplicación móvil.
5. Las alianzas con puntos compartidos, NFC y QR dinámicos quedan fuera del MVP.
6. Benef AI todavía no tiene un contrato autenticado con el backend. Su token
   interno placeholder no permite omitir Supabase Auth.

La secuencia de trabajo sugerida es conectar los clientes con los contratos de
visita, billetera, catálogo y canje, construir el panel web y programar la
expiración periódica de puntos. Las integraciones externas y el hardware deben
tener entregables propios y pruebas de flujo completo.

## Aspectos editoriales del SRS original

El PDF tiene 22 páginas y se identifica como revisión 1.0. Mantiene campos de
plantilla sin completar (fechas, contactos, firmas, referencias y apéndices),
una cabecera heredada «Modelo de ingeniería / [Nombre documento] / 0.3» y un
índice que requiere actualizar sus páginas. Deben corregirse en el archivo
editable de la siguiente revisión, sin inventar aprobaciones ni datos personales.

Las guías operativas actuales son [backend](../backend/README.md),
[API](./api.md) y [autenticación](./autenticacion.md).
