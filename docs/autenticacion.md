# Autenticación y permisos

Supabase Auth gestiona registro, confirmación de correo, contraseñas, login,
refresh y logout. Django conserva perfiles, roles, membresías y reglas de acceso.
La web ya integra ambos; la aplicación móvil todavía no.

## Flujo implementado

1. El cliente se registra o autentica en Supabase Auth y obtiene un `access_token`.
2. Envía `Authorization: Bearer <access_token>` a Django.
3. Django llama a `GET <SUPABASE_URL>/auth/v1/user` con una clave publicable.
   Supabase verifica el token; el backend acepta solo usuarios con UUID, rol
   `authenticated`, correo confirmado y sin sesión anónima. Nunca toma permisos
   de `user_metadata` ni de datos del cliente.
4. El UUID se busca en `Usuario.supabase_uid`. La coincidencia de correo no
   vincula cuentas existentes.
5. Una identidad sin perfil solo puede llamar al alta propia; después usa las
   rutas habilitadas para su rol y sus membresías activas.

La verificación es remota en cada petición (timeout de 5 s) y requiere conexión
a Supabase incluso con PostgreSQL local. Supabase valida firma, expiración,
emisor y audiencia; Django no verifica esos claims localmente, solo el UUID, el
rol, el correo confirmado y el perfil. Token inválido o vencido → `401`; proveedor
caído → `503`, nunca acceso sin verificación.

El refresh token lo administra el cliente y no se envía a Django. Desactivar
`Usuario.is_active` bloquea el siguiente acceso aunque el token siga vigente.

## Portal web

La web usa `@supabase/supabase-js` con la clave publicable y **nunca** una clave
`service_role` ni secretos de Django o PostgreSQL. El cliente se crea una sola
vez en `src/lib/supabase.ts` con `persistSession`, `autoRefreshToken` y
`detectSessionInUrl`.

`AuthProvider` restaura la sesión con `getSession`, escucha `onAuthStateChange` y
carga perfil y contexto. `src/lib/api.ts` centraliza las peticiones: envía el
bearer, ante un `401` fuerza un único `refreshSession` y reintenta una vez, no
reintenta ni cierra sesión ante `403`, e interpreta `codigo`/`detalle`, `detail`
y errores de validación de DRF. Los guards `RequireSession`,
`RequirePortalAccess` y `RequireAdmin` solo controlan la navegación; Django
vuelve a validar cada petición.

### Onboarding y accesos

1. `/registro` guarda negocio y responsable en metadatos de Supabase. Son datos
   iniciales, nunca permisos.
2. Tras confirmar el correo e iniciar sesión, `AuthProvider` detecta la falta de
   perfil o membresías y llama a `POST /api/v1/onboarding/comercial/`.
3. Django crea o recupera perfil, negocio, membresía `dueno` y plan Free en una
   transacción idempotente asociada al UUID de Auth. Repetir la llamada devuelve
   el mismo negocio.
4. El usuario entra a `/portal/negocio/{id}`. Si falla, `/completar-registro`
   permite reintentar sin otro formulario.
5. Un consumidor sin registro comercial queda en `/acceso-restringido`;
   `/registrar-negocio` crea un negocio adicional con su propio Free.
6. Un invitado se registra con `/registro?invitacion={token}` y acepta en
   `/invitacion/{token}`; no se le crea un negocio.
7. `admin_sistema` entra a `/portal/admin`; dueño, supervisor y empleado, a
   `/portal/negocio/{id}` con navegación filtrada por rol.

`RegistroComercial` e `InvitacionMembresia` no conceden permisos por sí solos: la
membresía de dueño nace del negocio creado, y la invitación solo se convierte en
membresía cuando la identidad autenticada coincide con el correo y la acepta.

El contexto se consulta al cargar, al volver a la pestaña y cuando una petición
devuelve `403`. Si una membresía, negocio o sucursal se desactiva, deja de
aparecer y las rutas responden `403` o listas vacías. El logout llama a
`supabase.auth.signOut()` y limpia perfil, contexto y caché; la recuperación usa
`resetPasswordForEmail` con retorno a `/actualizar-password`.

## Configuración

En Supabase configura el proveedor Email, confirmación de correo, URLs de
redirección y SMTP. Si después habilitas Google, se configura como proveedor de
Supabase Auth; Firebase queda fuera del flujo.

Añade a `backend/.env` y `backend/.env.production`:

```dotenv
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_reemplazar
```

Obtén la URL en **Connect** y la clave en **Settings → API Keys → Publishable
and secret API keys**. La URL Auth no es el host del pooler PostgreSQL y
`DB_PASSWORD` no es una clave Auth. Nunca uses `service_role` ni `sb_secret_...`
en el backend ni en los clientes. Si falta configuración, una petición con
bearer devuelve `503`; el health check sigue público.

Tras cambiar el entorno, reinicia Django (`docker compose restart backend`) o
recrea el contenedor en el montaje demo. Deshabilita la **Data API** de Supabase
o excluye las tablas de Django de sus esquemas expuestos: los permisos Python no
protegen accesos directos por PostgREST, GraphQL o credenciales PostgreSQL. Los
clientes solo usan Supabase para Auth; las consultas pasan por Django.

## Migración de identidad

`0004_usuario_supabase_auth` renombró `firebase_uid` a `legacy_firebase_uid`
(opcional y fuera de la API) y añadió `supabase_uid` e `is_active`. Las
migraciones `0008`–`0010` normalizaron las membresías: `negocio` dejó de ser un
rol global, el `admin` de sucursal pasó a `supervisor` y las altas, cambios y
bajas quedaron en `AuditoriaMembresia`. Los usuarios existentes conservan sus
membresías.

Un perfil anterior sin `supabase_uid` no puede iniciar sesión hasta que un
operador lo vincule con una identidad verificada. La coincidencia de correo
devuelve `409` al crear otro perfil; nunca se asigna automáticamente. La
vinculación se hace individualmente desde el shell, con el ID comprobado en
Supabase Auth, preservando perfil y relaciones. Consulta el estado real con
`manage.py showmigrations core` y sigue [backend/README.md](../backend/README.md)
para aplicar migraciones.

## Rutas de identidad

```http
POST /api/v1/usuario/crear/
Authorization: Bearer <access_token>

{"nombre":"Ana","apellido":"Pérez","telefono":"6640000000"}
```

Devuelve `201` y solo admite `nombre`, `apellido`, `telefono` y `foto_perfil`.
Correo e ID provienen de la identidad verificada; el rol inicial es `consumidor`.
Enviar `rol`, `correo`, `supabase_uid`, `firebase_uid` o `is_active` produce
`400`. Los perfiles no almacenan contraseñas.

`GET /api/v1/autenticacion/perfil/` devuelve el perfil y QR propio.
`PATCH /api/v1/usuario/rol/{id}/` permite a `admin_sistema` cambiar `rol` o
`is_active`. Los roles globales válidos son `consumidor` y `admin_sistema`; el
alias `negocio` se convierte en `consumidor`. `usuarios/listar/` devuelve solo el
usuario propio salvo para `admin_sistema`.

## Matriz de permisos

`Usuario.rol` distingue `consumidor` y `admin_sistema`. El acceso comercial se
determina exclusivamente por `UsuarioNegocio.rol_comercio`: `dueno`,
`supervisor` o `empleado` para un negocio/sucursal concretos. Un usuario sin
membresía no accede a datos comerciales, aunque mantiene todas las funciones de
consumidor. `admin_sistema` es un privilegio global independiente.

| Recurso | Lectura | Escritura |
| --- | --- | --- |
| Usuarios | Propio; admin puede consultar todos | Perfil propio; roles/bloqueo y borrado solo admin |
| Categorías y planes | Todos los perfiles autenticados | Solo admin del sistema |
| Negocios | Miembros del negocio | Cualquier perfil crea su propio negocio; dueño modifica; borrado solo admin |
| Sucursales | Dueño: todas las propias; supervisor/empleado: su sucursal | Dueño del negocio |
| Membresías | Propia; dueño: su negocio; supervisor: su sucursal | Dueño asigna supervisor/empleado; supervisor asigna empleados; solo admin asigna dueños |
| Dinámicas | Miembros del negocio | Dueño del negocio |
| Recompensas | Miembros de los negocios asociados | Dueño de la dinámica; si es de alianza, dueño de ambos negocios |
| Alianzas | Miembros de los negocios involucrados | Solo admin hasta implementar aprobación bilateral |
| Actividades | Consumidor: propias; personal: su sucursal | Solo lectura por CRUD; alta desde `POST /visitas/registrar/`; anulación solo admin |
| Progreso y cupones | Consumidor: propios; dueño: negocio completo; supervisor/empleado: sin listado global | Solo lectura por CRUD; adquisición y emisión desde servicios de lealtad |
| Canjes | Consumidor: propios; dueño: negocio completo; supervisor/empleado: su sucursal | Solo lectura por CRUD; canje exclusivo del dueño del cupón |
| Saldos y lotes de puntos | Consumidor: propios; personal: su negocio | Solo servicios; ajustes exclusivos de `admin_sistema` |
| Pagos y suscripciones | Plan del negocio: miembros y admin; pagos: dueño y admin | Cambio de plan solo `admin_sistema` con auditoría; pagos solo admin hasta implementar webhooks |
| Notificaciones | Propias y admin | Usuario solo marca `leida`; crear/borrar solo admin |

La sucursal y su negocio deben estar activos para registrar actividades o
canjes. Los usuarios de negocio no pueden cambiar el origen de una recompensa,
trasladar una dinámica o sucursal a otro negocio, ni transferir una membresía.
`stripe_id` solo lo establece el administrador.

Al crear un negocio se conserva el rol global `consumidor` y se crea la membresía
`dueno` en una transacción. El canje del MVP lo inicia el cliente desde
`POST /cupones/{uuid}/canjear/`; el cajero solo verifica visualmente la pantalla
de validación y el CRUD genérico de canjes es de solo lectura.

## Primer administrador

No hay promoción automática por correo o metadata ni una cuenta predeterminada.
Después de crear y verificar el perfil, un operador con acceso al servidor
ejecuta el shell del entorno correcto:

```bash
docker compose -f compose.yaml exec backend python manage.py shell
```

```python
from uuid import UUID
from core.models import Usuario
user = Usuario.objects.get(supabase_uid=UUID("UUID_VERIFICADO_EN_SUPABASE"))
user.rol = "admin_sistema"
user.save(update_fields=["rol"])
```

`createsuperuser` crea una cuenta staff de Django Admin, con autenticación de
sesiones propia. No crea una identidad Supabase ni un perfil Benefy, y no concede
`admin_sistema`. Las tres identidades tienen responsabilidades distintas.

## Operación

- El backend no registra passwords, bearer tokens ni refresh tokens.
- La clave publicable puede estar en los clientes; contraseñas PostgreSQL,
  `SECRET_KEY`, tokens de sesión y claves secretas son privados y quedan fuera de
  Git.
- Las pruebas simulan Supabase Auth sobre PostgreSQL local aislado y cubren
  `401/403/404/503`, escalamiento, aislamiento por negocio y sucursal, contexto,
  onboarding idempotente, revocación, planes, límites, invitaciones y migración
  (195 pruebas de Django; ver `backend/README.md`).
- Archivos clave: `core/authentication.py`, `core/access.py`,
  `core/permissions.py`, `core/views_portal.py`, `core/serializers_portal.py`,
  `core/views.py` y `core/serializers.py`. En la web: `src/auth/`, `src/lib/`,
  `src/portal/` y `src/pages/`.

Referencias: [verificar usuario en Supabase](https://supabase.com/docs/reference/python/auth-getuser),
[JWT y sesiones](https://supabase.com/docs/guides/auth/jwts),
[autenticación DRF](https://www.django-rest-framework.org/api-guide/authentication/#custom-authentication)
y [proteger la Data API](https://supabase.com/docs/guides/api/securing-your-api).
