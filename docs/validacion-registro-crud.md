# Validación del registro comercial y CRUD del portal

**Fecha:** 16 de noviembre de 2026.
**Alcance:** corrección del onboarding, CRUD comercial, invitaciones, operaciones
y migraciones `0014`–`0015`. No incluye Stripe ni cobros.

## Causa raíz del registro redundante

El formulario de registro guardaba `nombre` y `negocio` en
`user_metadata` de Supabase, pero ningún componente del backend los consumía.
Al confirmar el correo e iniciar sesión:

1. `GET /autenticacion/perfil/` respondía sin perfil.
2. `AuthProvider` marcaba `needsProfile` y enviaba a `/completar-perfil`.
3. `POST /usuario/crear/` creaba solo el perfil Django.
4. El contexto seguía sin membresías, por lo que el portal enviaba a
   `/acceso-restringido`.
5. El CTA abría `/registrar-negocio` y volvía a pedir los datos del negocio.

Además, la ausencia temporal de contexto durante la restauración de sesión
podía mostrar el acceso restringido antes de terminar la carga. El negocio no
era idempotente: dependía de un segundo formulario y no existía una relación
servidor entre la identidad de Auth y el registro pendiente.

## Flujo corregido

1. `/registro` captura una sola vez negocio, responsable, correo, contraseña y
   términos. Guarda los datos en metadatos de Auth únicamente como **datos**.
2. Supabase exige confirmar el correo; la pantalla lo explica y no muestra el
   dashboard.
3. Tras confirmar e iniciar sesión, `AuthProvider` llama a
   `POST /api/v1/onboarding/comercial/`.
4. Django verifica la identidad, crea o recupera el perfil, el negocio, la
   membresía `dueno`, el plan Free y el registro de onboarding en una
   transacción.
5. El contexto se devuelve ya completo y el usuario entra directamente al
   dashboard. No aparece `/completar-perfil`, `/registrar-negocio` ni el acceso
   restringido.
6. Si la operación falla, `/completar-registro` permite reintentar sin volver a
   crear la cuenta.

La idempotencia se apoya en `RegistroComercial.supabase_uid` único, bloqueo de
fila, la membresía de dueño existente y una restricción de suscripción vigente.
No se usa el correo ni el nombre comercial como clave de idempotencia.

## Estados del onboarding

- Sin sesión: login.
- Registrado pendiente de confirmación: pantalla de revisión de correo.
- Autenticado sin perfil: onboarding automático si hay datos comerciales.
- Perfil sin negocio y registro pendiente: onboarding completa el negocio.
- Negocio o membresía desactivados: no se crea otro negocio; el contexto queda
  restringido.
- Consumidor sin membresía: acceso restringido.
- Error recuperable: `/completar-registro` con reintento.
- Negocio y membresía válidos: dashboard.

## Modelos y migraciones

| Migración | Contenido |
|---|---|
| `0014_registro_comercial` | `RegistroComercial` con UUID único, datos iniciales, estado y vínculos a usuario/negocio |
| `0015_invitaciones_membresia` | `InvitacionMembresia` con token, correo, rol, sucursal, estado y expiración |

Los metadatos de Supabase nunca asignan roles ni permisos. El perfil se crea
siempre como `consumidor`; la única membresía concedida es `dueno` del negocio
creado por esa misma identidad.

## Endpoints nuevos o ampliados

| Método | Ruta | Uso |
|---|---|---|
| POST | `/api/v1/onboarding/comercial/` | Completar registro comercial idempotente |
| GET | `/api/v1/negocios/{id}/visitas/` | Visitas paginadas con filtros |
| GET | `/api/v1/negocios/{id}/cupones/` | Cupones paginados (propietario) |
| GET | `/api/v1/negocios/{id}/canjes/` | Canjes paginados por alcance |
| GET | `/api/v1/negocios/{id}/clientes/` | Clientes agregados (propietario) |
| POST | `/api/v1/negocios/{id}/tarjetas/` | Crear tarjeta y recompensa meta en una transacción |
| GET/POST | `/api/v1/negocios/{id}/invitaciones/` | Listar y crear invitaciones |
| GET | `/api/v1/invitaciones/{token}/` | Consultar invitación propia |
| POST | `/api/v1/invitaciones/{token}/aceptar/` | Aceptar con el correo correcto |
| POST | `/api/v1/invitaciones/{token}/revocar/` | Revocar una invitación pendiente |

Las operaciones de visitas, cupones, canjes y clientes aceptan `desde`, `hasta`,
`sucursal`, `estado`, `buscar`, `page` y `page_size` según corresponda.

## Portal React

Se añadieron o reescribieron:

- Configuración del negocio.
- Sucursales con alta, edición y activación/desactivación.
- Programa de puntos con un solo activo.
- Tarjetas de sellos con recompensa meta y creación atómica.
- Recompensas con costo, stock, vigencia y estado.
- Equipo con invitaciones, roles, sucursal, estado y enlaces de aceptación.
- Visitas, canjes, cupones y clientes con filtros y paginación.
- Página de aceptación de invitación.
- Registro de invitado sin crear negocio automáticamente.

Los límites se consultan en `/negocios/{id}/plan/`; React no duplica números.
Los rechazos `limite_plan` muestran un mensaje comprensible y enlace informativo
a `/precios`.

## Permisos y protección

- `dueno`: configuración, sucursales, puntos, tarjetas, recompensas, equipo y
  consultas.
- `supervisor`: operaciones y equipo de su sucursal; no configura el negocio.
- `empleado`: visitas/canjes de su sucursal.
- `admin_sistema`: acceso global.
- Solo `admin_sistema` puede invitar un nuevo propietario; el dueño invita
  supervisores y empleados.
- La membresía se crea únicamente al aceptar con el correo autenticado.
- No se puede desactivar ni degradar al último propietario activo.
- Las bajas de sucursales/recompensas son lógicas desde la interfaz; el backend
  protege registros con historial mediante `PROTECT`.

## Pruebas

- Django: **195 pruebas OK**.
- `manage.py check` y `makemigrations --check`: limpios.
- `npm run typecheck` y `npm run build`: OK.
- E2E navegador de onboarding y CRUD: **16/16**.
- E2E API de onboarding, límites, invitaciones y operaciones: **27/27**.
- E2E API de cupón y canje: **5/5**.
- E2E previo de planes: 24/24 API y 12/12 navegador.

Casos cubiertos incluyen perfil y negocio automáticos, Free, reintentos y
concurrencia, metadata sin permisos, segundo negocio, negocio/membresía
desactivados, invitaciones, límites, reactivaciones, historial y aislamiento.

## Respaldo y Supabase

| Dato | Valor |
|---|---|
| Archivo | `benefy_supabase_pre_onboarding_20261116.dump` |
| Ruta | `C:\Users\angel\AppData\Local\Temp\opencode\benefy-backups\` |
| Formato | `pg_dump -Fc`, esquema + datos |
| Tamaño | 472,497 bytes |
| SHA-256 | `925D13412119878A2188BDBE1BDEAD0F8D868B86281FC3F8EFFCCC1D99A47A34` |
| Entradas de datos | 73 |

La restauración en una base local temporal terminó con código 0 y conteos
idénticos: 8 usuarios, 2 negocios, 3 membresías, 4 suscripciones, 5 visitas y 6
cupones.

Migraciones `0014` y `0015` aplicadas en local y Supabase. Estado posterior:

| Tabla | Filas |
|---|---:|
| Usuarios | 10 |
| Negocios | 4 |
| Membresías | 6 |
| Registros comerciales completados | 2 |
| Invitaciones aceptadas/revocadas | 1 / 1 |
| Suscripciones vigentes duplicadas | 0 |
| Visitas | 6 |
| Cupones | 7 |
| Canjes | 2 |

Los datos originales del negocio 1 y 2 se conservaron. Los dos negocios
`E2E Onboarding` y sus cuentas son datos de prueba creados para validar el flujo
completo; no se eliminaron registros históricos.

## Pendiente

- Envío automático de correos de invitación (hoy se comparte el enlace).
- Edición avanzada de la tarjeta con selección de ciclos tras downgrade.
- Filtros/exportaciones avanzadas y analítica Premium.
- Stripe, checkout, facturación y webhooks.
