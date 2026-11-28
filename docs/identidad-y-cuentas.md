# Identidad, acceso y cuentas

Benefy separa la identidad de la autorización:

- **Supabase Auth** gestiona registro, confirmación de correo, contraseñas,
  login, refresh y logout.
- **Django** conserva perfiles, roles globales, membresías de negocio, permisos
  por sucursal y el ciclo de vida de la cuenta.

La web y la aplicación móvil consumen Supabase Auth. Ningún cliente recibe la
service role key ni contraseñas de PostgreSQL.

## Autenticación

1. El cliente se registra o autentica en Supabase Auth y obtiene un `access_token`.
2. Envía `Authorization: Bearer <access_token>` a Django.
3. Django llama a `GET <SUPABASE_URL>/auth/v1/user` con una clave publicable.
   Supabase valida firma, expiración, emisor y audiencia. Django acepta solo
   usuarios con UUID, rol `authenticated`, correo confirmado y sin sesión
   anónima. Nunca toma permisos de `user_metadata` ni de datos del cliente.
4. El UUID se busca en `Usuario.supabase_uid`. La coincidencia de correo no
   vincula cuentas existentes.
5. Una identidad sin perfil solo puede llamar al alta propia; después usa las
   rutas habilitadas para su rol y sus membresías activas.

La verificación es remota en cada petición, con un timeout de 5 s, y requiere
conexión a Supabase incluso con PostgreSQL local. Token inválido o vencido
responde `401`; proveedor caído responde `503`; nunca se falla abierto.

El refresh token lo administra el cliente y no se envía a Django. Desactivar
`Usuario.is_active` bloquea el siguiente acceso aunque el token siga vigente.

## Configuración de Supabase

En Supabase configura el proveedor Email, la confirmación de correo, las URLs de
redirección del portal y el SMTP. Si se habilita Google, se configura como
proveedor de Supabase Auth; Firebase queda fuera del flujo.

Variables del backend:

```dotenv
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_reemplazar
```

Obtén la URL en **Connect** y la clave en **Settings → API Keys → Publishable
and secret API keys**. La URL de Auth no es el host del pooler PostgreSQL y
`DB_PASSWORD` no es una clave de Auth. Nunca uses `service_role` ni
`sb_secret_...` en el backend ni en los clientes.

Deshabilita la **Data API** de Supabase o excluye las tablas de Django de sus
esquemas expuestos: los permisos Python no protegen accesos directos por
PostgREST, GraphQL o credenciales PostgreSQL. Los clientes solo usan Supabase
para Auth y Storage; las consultas de negocio pasan por Django.

## Cuentas heredadas

Un perfil anterior sin `supabase_uid` no puede iniciar sesión hasta que un
operador lo vincule con una identidad verificada. La coincidencia de correo
devuelve `409` al crear otro perfil; nunca se asigna automáticamente. La
vinculación se hace individualmente desde el shell, con el ID comprobado en
Supabase Auth, preservando perfil y relaciones. `legacy_firebase_uid` se conserva
como referencia histórica y no se usa para autenticar.

## Portal web

La web usa `@supabase/supabase-js` con la clave publicable y **nunca** una clave
`service_role` ni secretos de Django o PostgreSQL. El cliente se crea una sola
vez en `src/lib/supabase.ts` con `persistSession`, `autoRefreshToken` y
`detectSessionInUrl`.

`AuthProvider` restaura la sesión con `getSession`, escucha
`onAuthStateChange` y carga perfil y contexto. `src/lib/api.ts` centraliza las
peticiones: envía el bearer, ante un `401` fuerza un único `refreshSession` y
reintenta una vez, no reintenta ni cierra sesión ante `403`, e interpreta
`codigo`/`detalle`, `detail` y errores de validación de DRF. Los guards
`RequireSession`, `RequirePortalAccess` y `RequireAdmin` solo controlan la
navegación; Django vuelve a validar cada petición.

## Onboarding y accesos

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

`RegistroComercial` e `InvitacionMembresia` no conceden permisos por sí solos:
la membresía de dueño nace del negocio creado, y la invitación solo se convierte
en membresía cuando la identidad autenticada coincide con el correo y la acepta.

El contexto se consulta al cargar, al volver a la pestaña y cuando una petición
devuelve `403`. Si una membresía, negocio o sucursal se desactiva, deja de
aparecer y las rutas responden `403` o listas vacías. El logout llama a
`supabase.auth.signOut()` y limpia perfil, contexto y caché; la recuperación usa
`resetPasswordForEmail` con retorno a `/actualizar-password`.

## Roles y permisos

`Usuario.rol` distingue `consumidor` y `admin_sistema`. El acceso comercial se
determina exclusivamente por `UsuarioNegocio.rol_comercio`: `dueno`,
`supervisor` o `empleado` para un negocio/sucursal concretos. Un usuario sin
membresía no accede a datos comerciales, aunque mantiene todas las funciones de
consumidor. `admin_sistema` es un privilegio global independiente.

| Recurso | Lectura | Escritura |
| --- | --- | --- |
| Usuarios | Propio; admin puede consultar todos | Perfil propio; roles/bloqueo solo admin; baja propia anonimizada con protección de propiedad |
| Categorías y planes | Todos los perfiles autenticados | Solo admin del sistema |
| Negocios | Miembros del negocio | Cualquier perfil crea su propio negocio; dueño modifica; borrado solo admin |
| Sucursales | Dueño: todas las propias; supervisor/empleado: su sucursal | Dueño del negocio |
| Membresías | Propia; dueño: su negocio; supervisor: su sucursal | Dueño asigna supervisor/empleado; supervisor asigna empleados; solo admin asigna dueños |
| Dinámicas | Miembros del negocio | Dueño del negocio |
| Recompensas | Miembros de los negocios asociados | Dueño de la dinámica; en alianzas, dueño del negocio que ofrece el beneficio mediante el endpoint de alianza |
| Alianzas | Dueños de los negocios involucrados; admin puede consultar | Solo un dueño Premium del negocio proponente crea; el dueño receptor acepta o rechaza (Free también puede hacerlo dentro de su cupo); cualquiera de los dos finaliza y administra los beneficios de su negocio. El CRUD genérico de alianzas es de solo lectura |
| Actividades | Consumidor: propias; personal: su sucursal | Solo lectura por CRUD; alta desde `POST /visitas/registrar/`; anulación solo admin |
| Progreso y cupones | Consumidor: propios; dueño: negocio completo; supervisor/empleado: sin listado global | Solo lectura por CRUD; adquisición y emisión desde servicios de lealtad |
| Canjes | Consumidor: propios; dueño: negocio completo; supervisor/empleado: su sucursal | Solo lectura por CRUD; canje exclusivo del dueño del cupón |
| Saldos y lotes de puntos | Consumidor: propios; personal: su negocio | Solo servicios; ajustes exclusivos de `admin_sistema` |
| Pagos y suscripciones | Plan del negocio: miembros y admin; facturación: dueño y admin | Cambio manual de plan solo `admin_sistema` con auditoría; Checkout, Customer Portal y webhooks Stripe Sandbox solo para el dueño (o admin); estados de Stripe no se editan desde el CRUD genérico |
| Notificaciones | Propias y admin | Usuario solo marca `leida`; crear/borrar solo admin |

La sucursal y su negocio deben estar activos para registrar actividades o
canjes. Los usuarios de negocio no pueden cambiar el origen de una recompensa,
trasladar una dinámica o sucursal a otro negocio, ni transferir una membresía.
`stripe_id` (columna legacy) solo lo establece el administrador; la facturación
Sandbox usa `ClienteStripe` y no acepta identificadores Stripe desde el cliente.

Al crear un negocio se conserva el rol global `consumidor` y se crea la membresía
`dueno` en una transacción. El canje lo inicia el cliente desde
`POST /cupones/{uuid}/canjear/`; el cajero solo verifica visualmente la pantalla
de validación y el CRUD genérico de canjes es de solo lectura.

## Rutas de identidad

```http
POST /api/v1/usuario/crear/
Authorization: Bearer <access_token>

{"nombre":"Ana","apellido":"Pérez","telefono":"6640000000"}
```

Devuelve `201` y solo admite `nombre`, `apellido`, `telefono` y `foto_perfil`.
Correo e ID provienen de la identidad verificada; el rol inicial es
`consumidor`. Enviar `rol`, `correo`, `supabase_uid`, `firebase_uid` o
`is_active` produce `400`. Los perfiles no almacenan contraseñas.

`GET /api/v1/autenticacion/perfil/` devuelve el perfil y QR propio.
`PATCH /api/v1/autenticacion/perfil/` actualiza `nombre`, `apellido`, `telefono`
y `foto_perfil`. El correo no se edita desde el perfil: es la identidad
verificada de Supabase. `POST /api/v1/mi/cuenta/eliminar/` inicia una baja
idempotente. `PATCH /api/v1/usuario/rol/{id}/` permite a `admin_sistema` cambiar
`rol` o `is_active`. Los roles globales válidos son `consumidor` y
`admin_sistema`; el alias `negocio` se convierte en `consumidor`.
`usuarios/listar/` devuelve solo el usuario propio salvo para `admin_sistema`.

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

## Avatares en Supabase Storage

El backend no almacena archivos de imagen. El móvil sube el avatar directamente
a Supabase Storage y después envía la URL pública al perfil. Django valida que
la URL pertenezca al bucket y a la carpeta del usuario autenticado.

### Bucket

Nombre por defecto: `avatars`.

Configuración requerida:

- lectura pública para servir el avatar;
- escritura, actualización y borrado restringidos por RLS al propietario;
- límite de 5 MB;
- tipos permitidos: `image/jpeg`, `image/png`, `image/webp`.

El SQL canónico e idempotente es
[`docs/sql/avatars_storage.sql`](./sql/avatars_storage.sql). Crea/actualiza el
bucket, activa RLS y aplica políticas separadas para lectura, alta, actualización
y borrado. Las políticas de escritura exigen que el primer segmento de la ruta
sea `auth.uid()::text`; la actualización también valida el nuevo nombre con
`with check`, por lo que un usuario no puede mover su objeto a la carpeta de
otro.

**Prerrequisito de despliegue:** aplicar este SQL con el SQL Editor o un rol
administrador de Supabase antes de habilitar la subida de avatares. Sin ese paso,
la app muestra un error accionable y el resto de la aplicación sigue funcionando.

### Convención de ruta

```text
avatars/{supabase_uid}/{archivo}.jpg
```

Django exige que la URL empiece por:

```text
https://<proyecto>.supabase.co/storage/v1/object/public/avatars/{supabase_uid}/
```

No acepta otros hosts, otros buckets, `http://`, rutas fuera de la carpeta del
usuario ni URLs con query string.

### Flujo del cliente

1. El usuario elige una imagen con el selector del dispositivo.
2. La app sube el archivo a
   `avatars/{supabase_uid}/perfil-{marca}.{jpg|png|webp}` usando la sesión de
   Supabase. El cliente lee el archivo local con `expo-file-system`, valida tipo
   y tamaño antes de subirlo y conserva la extensión correspondiente al MIME.
3. Obtiene la URL pública.
4. Envía `PATCH /api/v1/autenticacion/perfil/`:

```json
{"foto_perfil":"https://<proyecto>.supabase.co/storage/v1/object/public/avatars/<uid>/perfil-uuid.jpg"}
```

5. Django hace `HEAD` al objeto, valida `Content-Type` y `Content-Length`, y
   guarda la URL en `Usuario.foto_perfil`.

Para quitar la foto se envía `{"foto_perfil": ""}`.

### Limpieza en baja de cuenta

En la eliminación de cuenta, Django usa la service role key para listar y
borrar por páginas todos los objetos bajo `avatars/{supabase_uid}/`. La limpieza
es idempotente: una carpeta vacía o un bucket inexistente se consideran
completados. Si Storage falla, la solicitud queda en estado `anonimizada` y el
comando `reintentar_eliminaciones_cuenta` vuelve a intentar la limpieza y el
borrado de Supabase Auth.

### Variables del backend

```dotenv
SUPABASE_STORAGE_BUCKET_AVATARS=avatars
SUPABASE_STORAGE_MAX_BYTES=5242880
SUPABASE_STORAGE_ALLOWED_TYPES=image/jpeg,image/png,image/webp
```

`SUPABASE_SERVICE_ROLE_KEY` no se usa para subir avatares desde el móvil. Si en
el futuro el backend genera URLs firmadas o administra objetos, esa clave debe
permanecer exclusivamente en el servidor.

### Errores de avatar

La validación de la foto responde `400` como error de campo `foto_perfil` si:

- la URL no es del bucket/host/carpeta permitidos;
- el objeto no existe;
- el `Content-Type` no es una imagen permitida;
- el tamaño es cero, supera el límite o no se puede determinar;
- Supabase Storage no responde.

## Baja de cuenta

La baja es una operación de ciclo de vida, no un `DELETE` físico del historial.
El endpoint es idempotente y separa la anonimización en Django de la limpieza de
avatares en Supabase Storage y del borrado de la identidad en Supabase Auth.

### Endpoint

```http
POST /api/v1/mi/cuenta/eliminar/
Authorization: Bearer <access_token>
Content-Type: application/json

{"confirmacion":"Eliminar mi cuenta"}
```

La confirmación se compara sin distinguir mayúsculas/minúsculas, pero debe ser
la frase exacta.

### Respuestas

| HTTP | Cuerpo | Significado |
| --- | --- | --- |
| `200` | `{"estado":"completada","supabase_eliminado":true,...}` | Baja completa |
| `202` | `{"estado":"anonimizada","supabase_eliminado":false,...}` | Perfil anonimizado; Storage o Supabase Auth pendientes |
| `400` | `confirmacion_invalida` | Frase incorrecta |
| `409` | `propietario_activo` | Conserva negocios activos de su propiedad |
| `409` | `cuenta_admin` | Una cuenta `admin_sistema` no puede autoeliminarse |
| `409` | `cuenta_inactiva` | La cuenta ya no está activa |
| `503` | `supabase_no_configurado` | Falta `SUPABASE_SERVICE_ROLE_KEY` o `SUPABASE_URL` |

### Qué se anonimiza

- `nombre`, `apellido`, `telefono`, `foto_perfil` y `correo` del `Usuario`.
- `supabase_uid` y `legacy_firebase_uid`.
- `qr_token`: se rota para invalidar el QR de miembro anterior.
- Notificaciones personales: se eliminan.
- `RegistroComercial`: se elimina el nombre y se sustituye el correo.
- Auditorías de membresía: se conserva la operación, sin el correo personal.
- Membresías activas: se desactivan con auditoría.

### Qué se conserva

Se conservan los asientos transaccionales justificados: visitas, movimientos y
lotes de puntos, cupones, canjes, ciclos de tarjeta y auditorías. El usuario
queda referenciado por su `id` anonimizado para no romper las claves foráneas.

Los puntos y cupones disponibles se expiran/anulan al momento de la baja. Los
registros históricos permanecen, pero ya no son utilizables.

### Propiedad de negocios

Si el usuario es el único propietario activo de un negocio activo, la baja
responde `409` con:

```json
{
  "codigo": "propietario_activo",
  "detalle": "Transfiere la propiedad o cierra los negocios activos antes de eliminar la cuenta.",
  "negocios": [{"id": 12, "nombre": "Negocio de ejemplo"}]
}
```

Procedimientos admitidos:

1. **Transferencia:** un `admin_sistema` crea otra membresía `dueno` sin sucursal
   para el negocio mediante `POST /api/v1/usuario-negocio/crear/`. Cuando el
   nuevo propietario queda activo, el usuario original puede eliminarse.
2. **Cierre:** el propietario desactiva el negocio con
   `PATCH /api/v1/negocio/actualizar/{id}/` y `{"status": false}`. La baja
   posterior desactiva la membresía sin dejar un negocio activo huérfano.
3. **Bloqueo:** si no se transfiere ni se cierra, la baja se mantiene bloqueada.

### Fallos parciales y reintentos

La anonimización ocurre en una transacción de PostgreSQL. Después se ejecutan
dos tareas externas idempotentes:

```text
DELETE /storage/v1/object/{bucket}   (objetos bajo {supabase_uid}/)
DELETE {SUPABASE_URL}/auth/v1/admin/users/{supabase_uid}
```

Si Storage o Supabase Auth fallan, la cuenta ya está desactivada y anonimizada,
pero la solicitud queda en estado `anonimizada`. El comando de reintento es:

```bash
python manage.py reintentar_eliminaciones_cuenta --limite 100
```

El `404` de Supabase se trata como éxito idempotente. La service role key nunca
se envía al cliente ni se registra en logs. La limpieza de Storage y el borrado
de Auth se registran por separado, de modo que un fallo no bloquea el otro ni
obliga a repetir la anonimización.

### Estados de la solicitud

| Estado | Significado |
| --- | --- |
| `pendiente` | Solicitud creada; aún no se anonimiza |
| `anonimizada` | Datos personales anonimizados; Storage y/o Supabase Auth pendientes |
| `completada` | Anonimización, avatares y borrado de Supabase terminados |
| `fallida` | Falló la transacción de anonimización; puede reintentarse desde la app mientras la cuenta siga activa |

### Configuración

```dotenv
SUPABASE_URL=https://<proyecto>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role>
SUPABASE_STORAGE_BUCKET_AVATARS=avatars
```

La service role key es un secreto exclusivo del servidor. No debe tener prefijo
`EXPO_PUBLIC_` ni exponerse en el portal.

## Operación y secretos

- El backend no registra passwords, bearer tokens ni refresh tokens.
- La clave publicable puede estar en los clientes; contraseñas PostgreSQL,
  `SECRET_KEY`, tokens de sesión y claves secretas son privados y quedan fuera de
  Git.
- Las pruebas simulan Supabase Auth sobre PostgreSQL local aislado y cubren
  `401/403/404/503`, escalamiento, aislamiento por negocio y sucursal, contexto,
  onboarding idempotente, revocación, planes, límites, invitaciones y baja de
  cuenta.
- Archivos clave: `core/authentication.py`, `core/access.py`,
  `core/permissions.py`, `core/views_portal.py`, `core/serializers_portal.py`,
  `core/views.py` y `core/serializers.py`. En la web: `src/auth/`, `src/lib/`,
  `src/portal/` y `src/pages/`.

Referencias: [verificar usuario en Supabase](https://supabase.com/docs/reference/python/auth-getuser),
[JWT y sesiones](https://supabase.com/docs/guides/auth/jwts),
[autenticación DRF](https://www.django-rest-framework.org/api-guide/authentication/#custom-authentication)
y [proteger la Data API](https://supabase.com/docs/guides/api/securing-your-api).
