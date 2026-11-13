# Estado de implementación y relación con el SRS

Revisión documental: 12 de noviembre de 2026. Este documento contrasta los
archivos versionados con [Benefy SRS.pdf, revisión 1.0](./Benefy%20SRS.pdf).
Describe capacidades del código, no el estado de migraciones/configuración de
un servidor concreto ni una certificación de aceptación del producto.

## Arquitectura implementada

- Django 5.2 y DRF concentran persistencia, perfiles y autorización. Hay 16
  modelos de dominio y cuatro migraciones de `core`, además de las de Django.
- Desarrollo usa PostgreSQL 15 dentro de Docker. Producción apunta a PostgreSQL
  Supabase con SSL mediante un Compose independiente y el mismo ORM.
- Supabase Auth verifica las cuentas; Django consulta `/auth/v1/user` y resuelve
  el perfil por UUID. Los roles/membresías se consultan en Django en cada petición.
- La web usa React 18, React Router y CSS propio. Solo tiene landing pública.
- La app Expo SDK 58 permanece en la plantilla; no hay navegación ni cliente API.
- Benef AI solo expone salud y la documentación automática FastAPI. El nombre de
  una rama o un commit de IA no demuestra que exista un agente en `main.py`.
- Hardware no contiene firmware. No hay CI ni herramientas de prueba comunes.

## Decisiones que difieren de la revisión 1.0

| Tema del SRS | Decisión/código actual | Implicación documental |
| --- | --- | --- |
| Firebase Auth, sección 3.1.3.2 | Supabase Auth con verificación remota en Django | Actualizar proveedor y flujo en la próxima revisión formal |
| Google API, RF-01 y RS-01 | Auth admite cuentas de correo confirmadas; no hay UI ni integración Google en clientes | Google puede habilitarse en Supabase, pero no está implementado en el repositorio |
| React con Tailwind, sección 2.4 | React 18 y CSS propio; no hay Tailwind instalado | No presentar Tailwind como dependencia existente |
| Dashboard y aplicación de consumidores | Landing pública y plantilla móvil | Pantallas y recorridos descritos siguen pendientes |
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
| RF-03 | Dashboard y filtros de métricas | Pendiente: no hay dashboard ni endpoints agregados |
| RF-04 | Configurar dinámicas | Base backend con serializers; faltan UI y motor de acumulación |
| RF-05 | Gestionar alianzas | Entidad/CRUD; escritura restringida al admin, falta aprobación bilateral e interfaz |
| RF-06 | Consultar programas y progreso | Datos y lectura de progreso propio; falta catálogo de consumidor y pantalla móvil |
| RF-07 | Registro mediante QR | Identificadores almacenados; falta escáner, validación de lectura y acreditación |
| RF-08 | Registro mediante NFC | Identificador de sucursal; lectura y flujo pendientes |
| RF-09 | Consultar/canjear recompensas | Lectura y CRUD con operador verificado; falta consumo atómico del cupón y UI |
| RF-10 | Historial de movimientos | Actividades/canjes consultables; no hay ledger completo, filtros ni pantalla |
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
| HTTPS | SSL de PostgreSQL configurado; el proxy/TLS público del backend debe desplegarse aparte |
| Portabilidad | Imágenes Python 3.11 y Compose; clientes fuera de Docker. No hay builds móviles de publicación configurados |
| Privacidad y exposición de datos | Permisos Python no protegen accesos directos por Data API; revisar exposición, privilegios y alcance de alianzas |
| Pruebas | Django cubre salud, configuración, Auth, permisos y migración; no hay suite web/móvil/IA ni E2E completa |

Los porcentajes, ventanas de mantenimiento, retención de respaldos y objetivos
de fiabilidad del PDF son requisitos pendientes de implementación/medición,
no garantías actuales. Tampoco se declara cumplimiento legal a partir del código.

## Límites que afectan al siguiente desarrollo

1. Crear actividad no actualiza saldo ni emite beneficios automáticamente.
2. `ProgresoUsuario` conserva saldo actual; no hay un ledger que explique cada movimiento.
3. El CRUD de canjes no actualiza el cupón ni impide carreras concurrentes.
4. No hay paginación, filtros, esquema OpenAPI Django ni endpoints de analítica.
5. Consumidores consultan sus registros; el catálogo público de comercios/programas
   para móvil requiere un contrato y serializers específicos.
6. Benef AI todavía no tiene un contrato autenticado con el backend. Su token
   interno placeholder no permite omitir Supabase Auth.

La secuencia de trabajo sugerida es completar los servicios transaccionales de
lealtad y sus pruebas, definir los contratos de catálogo/analítica y conectar
clientes con sesiones. Las integraciones externas y el hardware deben tener
entregables propios y pruebas de flujo completo.

## Aspectos editoriales del SRS original

El PDF tiene 22 páginas y se identifica como revisión 1.0. Mantiene campos de
plantilla sin completar (fechas, contactos, firmas, referencias y apéndices),
una cabecera heredada «Modelo de ingeniería / [Nombre documento] / 0.3» y un
índice que requiere actualizar sus páginas. Deben corregirse en el archivo
editable de la siguiente revisión, sin inventar aprobaciones ni datos personales.

Las guías operativas actuales son [backend](../backend/README.md),
[API](./api.md) y [autenticación](./autenticacion.md).
