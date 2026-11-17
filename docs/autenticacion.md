# Autenticación y permisos de Benefy

Supabase Auth gestiona registro, confirmación de correo, contraseñas, inicio
de sesión, renovación y cierre de sesión. Django conserva perfiles, roles,
membresías y reglas de acceso a los datos. El portal web ya consume Supabase
Auth y la API de Django; la aplicación móvil todavía debe integrar sus pantallas
y el cliente de Supabase.

## Flujo implementado

1. El cliente registra o autentica la cuenta en Supabase Auth.
2. Supabase entrega un `access_token`; si exige confirmación de correo, debe
   completarse antes de iniciar la sesión y crear el perfil en Benefy.
3. El cliente envía `Authorization: Bearer <access_token>` a Django.
4. Django llama a `GET <SUPABASE_URL>/auth/v1/user` con ese token y una clave
   publicable. Supabase verifica el token. El backend acepta solo usuarios
   con ID UUID, rol Supabase `authenticated`, correo confirmado y sin sesión
   anónima. Nunca toma permisos de `user_metadata` ni de datos del cliente.
5. El ID verificado se busca en `Usuario.supabase_uid`. La coincidencia de
   correo no vincula automáticamente cuentas existentes.
6. Una identidad sin perfil solo puede llamar al alta propia. Después puede
   usar las rutas habilitadas para su rol y sus membresías activas.

La verificación es remota en cada petición autenticada y tiene un timeout de
5 segundos. Requiere conectividad a Supabase incluso con PostgreSQL local.
No necesita SDK adicional, claves privadas de firma ni `service_role`.

La firma, la expiración, el emisor y la audiencia los valida Supabase al
responder `/auth/v1/user`. Django no verifica esos claims localmente; confía
en la respuesta de Supabase y comprueba el UUID, el rol, el correo confirmado
y el perfil local. Si se requiere validación criptográfica local, debe
implementarse con las claves públicas JWKS de Supabase.
Los tokens inválidos o vencidos producen 401; una caída del proveedor produce
503, nunca acceso sin verificación. No se siguen redirecciones HTTP que puedan
reenviar el token. Producción exige HTTPS para el servidor Auth.

El refresh token lo administra el cliente Supabase. No se envía a Django.
El cierre de sesión y la revocación siguen el ciclo de vida de Supabase; no
se promete que un access token quede invalidado inmediatamente tras cerrar
sesión. Desactivar `Usuario.is_active` bloquea el acceso a Benefy en la
siguiente petición, incluso con un token todavía válido.

## Portal web

La web usa `@supabase/supabase-js` con la clave publicable y **nunca** una
clave `service_role` ni secretos de Django o PostgreSQL. El cliente se crea una
sola vez en `src/lib/supabase.ts` con `persistSession`, `autoRefreshToken` y
`detectSessionInUrl`.

Variables de build de Vite:

```dotenv
VITE_API_BASE_URL=/api/v1
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_reemplazar
```

En desarrollo se usa `frontend-web/.env`; en producción, `VITE_API_BASE_URL=/api/v1`
porque Caddy sirve la SPA y la API en el mismo origen. `frontend-web/Dockerfile`
recibe las tres variables como `ARG` y `compose.demo.yaml` las toma de
`SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY`. Los archivos `.env` reales siguen
excluidos de Git; los ejemplos solo contienen placeholders.

### Sesión y cliente HTTP

`AuthProvider` restaura la sesión con `getSession`, escucha `onAuthStateChange`
y carga perfil y contexto. `src/lib/api.ts` centraliza las peticiones:

- envía `Authorization: Bearer <access_token>`;
- ante un `401`, fuerza un único `refreshSession` y reintenta una vez, sin
  bucles ni solicitudes duplicadas (la renovación concurrente se comparte);
- interpreta `codigo`/`detalle`, `detail` y errores de validación de DRF;
- ante un `403`, no reintenta ni cierra la sesión: el portal muestra el error o
  redirige según el contexto.

`RequireSession` exige sesión para el onboarding y el portal. `RequirePortalAccess`
usa `puede_portal` del contexto y `RequireAdmin` exige `es_admin_sistema`. Los
guards solo controlan la navegación; Django vuelve a validar cada petición.

### Onboarding y accesos

1. Un usuario nuevo inicia sesión y, si Django responde que no existe perfil,
   pasa a `/completar-perfil` y crea el perfil con `POST /usuario/crear/`.
2. Desde `/registrar-negocio` puede crear su negocio con `POST /negocio/crear/`.
   Esa operación crea la membresía `dueno` en la misma transacción.
3. Un consumidor con perfil pero sin membresías queda en `/acceso-restringido`,
   con el CTA para registrar un negocio. También conserva su uso de la app móvil.
4. `admin_sistema` entra a `/portal/admin`; dueño, supervisor y empleado entran
   a `/portal/negocio/{id}` con navegación filtrada por rol.

Una sesión persistida se restaura al recargar. El logout llama a
`supabase.auth.signOut()` y limpia perfil, contexto y la caché de sesión. La
recuperación usa `resetPasswordForEmail` con retorno a `/actualizar-password`;
la nueva contraseña se guarda con `supabase.auth.updateUser`. No hay botones de
Google, Magic Link ni «Recordarme» simulados.

### Revocación

El contexto se consulta en cada carga, al volver a la pestaña y cuando una
petición devuelve `403`. Incluye el plan de cada negocio accesible, sin revelar
negocios ajenos. El backend vuelve a comprobar las membresías en cada petición.
Si una membresía, negocio o sucursal se desactiva, el contexto deja de incluirla
y las rutas de datos responden `403` o listas vacías. La interfaz muestra el
error o vuelve al acceso restringido; no se confía en ningún estado guardado en
el navegador.

## Configuración

En Supabase configura el proveedor Email, confirmación de correo y las URLs
de redirección permitidas. Configura SMTP para entrega de correos en producción.
Si después habilitas Google, se configura como proveedor en Supabase Auth.
Firebase queda fuera del flujo actual.

En `backend/.env` para desarrollo, y en `backend/.env.production` para
producción, añade:

```dotenv
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_reemplazar
```

Obtén la URL en el diálogo **Connect** del proyecto y la clave publicable en
**Settings → API Keys → Publishable and secret API keys**. Estos nombres son
los que lee Django; no utiliza el prefijo `NEXT_PUBLIC_` de Next.js.
La URL Auth no es el host del pooler PostgreSQL. La contraseña `DB_PASSWORD`
tampoco es una clave Auth. Si todavía usas una clave pública legacy `anon`,
puede enviarse en el mismo parámetro; nunca uses una clave `service_role`
ni `sb_secret_...` en ese lugar o en los clientes.

Configura ambos archivos si vas a autenticarte en los dos entornos. Los valores
pueden pertenecer al mismo proyecto durante una prueba inicial, pero entonces
se comparten las identidades Auth; los perfiles y datos PostgreSQL siguen siendo
independientes. No hay sincronización automática entre bases.

Los ejemplos solo contienen placeholders. Completa las dos variables en los
archivos reales antes de hacer una prueba real de login. Si falta configuración,
una petición con bearer devuelve 503; el health check sigue público.

En desarrollo se recomienda un proyecto Auth de pruebas, distinto al del
montaje con Supabase. El almacenamiento de negocio se selecciona con
`compose.yaml` o `compose.demo.yaml`; los pasos están en el
[README](../README.md) y en [despliegue local](./despliegue-local.md).

Después de cambiar Auth en `backend/.env`, reinicia Django:

```bash
docker compose -f compose.yaml restart backend
```

En el montaje con Supabase, recrea el contenedor:

```bash
docker compose --env-file backend/.env.production -f compose.demo.yaml up -d --force-recreate backend
```

Deshabilita la **Data API** de Supabase si no se utiliza, o excluye las tablas
de Django de sus esquemas expuestos y revisa sus privilegios. Los clientes
solo deben usar Supabase para Auth; todas las consultas de Benefy pasan por
Django. Los permisos Python no protegen accesos directos a tablas mediante
PostgREST, GraphQL o conexiones con credenciales PostgreSQL. No se cambiaron
automáticamente las opciones de la plataforma ni los grants de producción.

## Migración de identidad

`0004_usuario_supabase_auth` conserva el ID numérico y todas las relaciones:

- Renombra `firebase_uid` a `legacy_firebase_uid`, opcional y fuera de la API.
  Los valores anteriores se preservan; no se usa para autenticar.
- Añade `supabase_uid`, UUID único, opcional mientras se vinculan usuarios antiguos.
- Añade `is_active`, verdadero por defecto.

Las migraciones `0008`–`0010` refactorizan los permisos: `negocio` deja de ser
un rol global, `admin` de sucursal pasa a `supervisor`, las membresías se
normalizan con restricciones de sucursal y unicidad, y las altas/cambios/bajas
quedan en `AuditoriaMembresia`. Los usuarios existentes conservan sus
membresías; solo cambia su representación de rol.

Un perfil anterior sin `supabase_uid` no puede iniciar sesión en Benefy hasta
que un administrador lo vincule con una identidad verificada de Supabase.
La coincidencia de correo devuelve 409 al intentar crear otro perfil; nunca
asigna esa identidad al perfil automáticamente. La vinculación de registros
antiguos debe hacerse de forma individual por un operador autorizado, usando
el ID comprobado en Supabase Auth y preservando el perfil y sus relaciones.

Las pruebas verifican esta migración y la conservación de usuarios anteriores
en una base aislada. Para saber si un entorno real tiene la migración aplicada,
consulta su estado; la presencia del archivo en Git no implica su ejecución:

```bash
docker compose -f compose.yaml exec backend python manage.py showmigrations core
```

Para instalar o actualizar desarrollo, revisa y aplica:

```bash
docker compose -f compose.yaml exec backend python manage.py migrate --plan
docker compose -f compose.yaml exec backend python manage.py migrate
docker compose -f compose.yaml exec backend python manage.py test core config.test_database_settings --noinput
```

El montaje con Supabase requiere revisión y respaldo antes de ejecutar manualmente:

```bash
docker compose --env-file backend/.env.production -f compose.demo.yaml run --rm --no-deps backend python manage.py migrate --plan
docker compose --env-file backend/.env.production -f compose.demo.yaml run --rm --no-deps backend python manage.py migrate --noinput
```

No ejecutes las pruebas con las credenciales del proyecto Supabase. Tampoco reviertas
la migración después de crear nuevos perfiles sin evaluar los datos: la columna
Firebase anterior exigía valores no nulos y los perfiles nuevos no los tienen.

## Rutas y payloads

El login ocurre en Supabase. Por ejemplo, el cliente puede usar su SDK oficial
o llamar a la API Auth directamente:

```http
POST https://tu-proyecto.supabase.co/auth/v1/token?grant_type=password
apikey: <SUPABASE_PUBLISHABLE_KEY>
Content-Type: application/json

{"email":"ana@example.com","password":"CONTRASEÑA_DEL_USUARIO"}
```

El registro inicial de la identidad utiliza `POST /auth/v1/signup` en ese
mismo servidor, con el mismo header público y los campos `email` y `password`.
La respuesta del login contiene el access token que se envía a Django.
Las contraseñas se envían únicamente al servidor Auth sobre HTTPS. Django
no implementa una segunda ruta de login ni emite otra sesión paralela.

Se conservan las cinco rutas CRUD en español por recurso y sus métodos HTTP.
Ahora todas requieren identidad y perfil activo, excepto el alta propia, que
requiere identidad verificada pero admite que todavía no exista el perfil.
`GET /` continúa público. Django Admin conserva su autenticación de sesiones
con cuentas staff de Django; esos superusuarios no conceden acceso a la API.

Tras iniciar sesión en Supabase, crear el perfil:

```http
POST /api/v1/usuario/crear/
Authorization: Bearer <access_token>
Content-Type: application/json

{"nombre":"Ana","apellido":"Pérez","telefono":"6640000000"}
```

Devuelve 201. Solo admite `nombre`, `apellido`, `telefono` y `foto_perfil`.
Correo e ID provienen de la identidad verificada; el rol inicial es consumidor.
La actualización del perfil acepta los mismos campos. Enviar `rol`, `correo`,
`supabase_uid`, `firebase_uid` o `is_active` por estas rutas produce 400.
El correo local es el que se verificó al crear el perfil; cambios posteriores
de correo se gestionan en Auth y requieren conciliación autorizada del dato
local. Los perfiles no almacenan contraseñas.

Consultar perfil y QR propio:

```http
GET /api/v1/autenticacion/perfil/
Authorization: Bearer <access_token>
```

Administrar rol o bloqueo local, solo como `admin_sistema`:

```http
PATCH /api/v1/usuario/rol/12/
Authorization: Bearer <access_token>
Content-Type: application/json

{"rol":"admin_sistema","is_active":true}
```

Los roles globales válidos son `consumidor` y `admin_sistema`. El alias
`negocio` se acepta temporalmente y se convierte en `consumidor`; ya no concede
acceso a ningún negocio por sí solo.

`GET /api/v1/usuarios/listar/` devuelve solo el usuario propio, salvo para
`admin_sistema`. Recursos ajenos quedan fuera de los querysets y responden 404
en detalles. Una acción no permitida sobre un recurso visible responde 403.
No se exponen los identificadores Firebase heredados.

## Endpoints de lealtad

| Ruta | Rol requerido | Alcance |
| --- | --- | --- |
| `POST /visitas/registrar/` | Cualquier usuario activo | Registra la visita del usuario autenticado |
| `GET /mi/billetera/` | Cualquier usuario activo | Solo saldos, tarjetas y cupones propios |
| `GET /mi/historial/` | Cualquier usuario activo | Solo visitas, movimientos y canjes propios |
| `GET /negocios/{id}/catalogo/` | Cualquier perfil activo | Recompensas activas del negocio |
| `POST /cupones/adquirir/` | Cualquier usuario activo | Descuenta puntos y emite el cupón propio |
| `POST /cupones/{uuid}/canjear/` | Dueño del cupón | Canje irreversible; un cupón ajeno responde 403 |
| `POST /admin/puntos/ajustar/` | `admin_sistema` | Ajuste auditado sin saldo negativo |
| `POST /admin/visitas/{id}/anular/` | `admin_sistema` | Anulación con motivo |
| `POST /admin/cupones/{uuid}/anular/` | `admin_sistema` | Anulación con motivo y sin devolución automática |
| `GET /negocios/{id}/metricas/` | Dueño, supervisor o admin | Dueño/admin: negocio completo o `?sucursal=`; supervisor/empleado: solo su sucursal |

Todos los usuarios autenticados y activos pueden registrar visitas, consultar
su billetera, adquirir cupones y canjearlos, aunque también administren uno o
varios negocios. La membresía comercial no bloquea la capacidad de consumidor.
El personal del negocio no interviene obligatoriamente en el canje del cliente.

## Matriz de permisos

`Usuario.rol` distingue `consumidor` y `admin_sistema`. El acceso comercial se
determina exclusivamente por `UsuarioNegocio.rol_comercio`: `dueno`,
`supervisor` o `empleado` para un negocio/sucursal concretos. Un usuario sin
membresía no accede a datos comerciales, aunque mantiene todas las funciones
de consumidor. `admin_sistema` es un privilegio global independiente.

| Recurso | Lectura | Escritura |
| --- | --- | --- |
| Usuarios | Propio; admin del sistema puede consultar todos | Perfil propio; roles/bloqueo solo admin; borrado solo admin |
| Categorías y planes | Todos los perfiles autenticados | Solo admin del sistema |
| Negocios | Miembros del negocio | Cualquier perfil puede crear su propio negocio; dueño modifica; borrado solo admin |
| Sucursales | Dueño: todas las propias; supervisor/empleado: su sucursal | Dueño del negocio |
| Membresías | Propia; dueño: su negocio; supervisor: su sucursal | Dueño asigna supervisor/empleado; supervisor asigna empleados; solo admin del sistema asigna dueños |
| Dinámicas | Miembros del negocio | Dueño del negocio |
| Recompensas | Miembros de los negocios asociados | Dueño de la dinámica; si es de alianza, dueño de ambos negocios |
| Alianzas | Miembros de los negocios involucrados | Solo admin hasta implementar aprobación bilateral |
| Actividades | Consumidor: propias; personal: su alcance de sucursal | Solo lectura por CRUD; alta exclusiva desde `POST /visitas/registrar/`; anulación solo admin |
| Progreso y cupones | Consumidor: propios; dueño: negocio completo; supervisor/empleado: sin listado global de cupones | Solo lectura por CRUD; adquisición y emisión desde servicios de lealtad |
| Canjes | Consumidor: propios; dueño: negocio completo; supervisor/empleado: su sucursal | Solo lectura por CRUD; canje exclusivo del dueño del cupón desde `POST /cupones/{uuid}/canjear/` |
| Saldos y lotes de puntos | Consumidor: propios; personal: su negocio | Solo servicios; ajustes exclusivos de `admin_sistema` |
| Pagos y suscripciones | Plan del negocio: miembros y admin; pagos: dueño y admin | Cambio de plan solo `admin_sistema` con auditoría; pagos solo admin hasta implementar webhooks |
| Notificaciones | Propias y admin del sistema | Usuario solo marca `leida`; crear/borrar solo admin |

El admin del sistema tiene alcance global, sujeto a las validaciones de cada
serializer. La sucursal y su negocio deben estar activos para registrar
actividades o canjes. A los usuarios de negocio no se les permite cambiar
el origen de una recompensa, trasladar una dinámica/sucursal a otro negocio,
ni transferir una membresía a otro usuario/negocio mediante actualización.
`stripe_id` solo puede establecerlo el administrador.

Al crear un negocio se conserva el rol global `consumidor` y se crea la
membresía `dueno` en una transacción. Asignar una membresía tampoco cambia el
rol global: el usuario sigue siendo consumidor y obtiene acceso comercial por
esa membresía. La creación, modificación y baja lógica de membresías queda
auditada en `AuditoriaMembresia`.

El canje del MVP lo inicia el cliente autenticado desde
`POST /cupones/{uuid}/canjear/`. El backend valida la propiedad del cupón, su
estado y vigencia, y lo consume en la misma transacción. No se acepta
`validado_por` ni se suplanta al personal; el cajero solo verifica visualmente
la pantalla de validación. El CRUD genérico de canjes es de solo lectura.

## Primer administrador y usuarios anteriores

No hay promoción automática por correo o metadata. Después de crear y verificar
el perfil, un operador con acceso al servidor puede promover el UID elegido.
Ejecuta el shell contra el entorno correcto; por ejemplo, en desarrollo:

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

Para abrir el shell del montaje con Supabase:

```bash
docker compose --env-file backend/.env.production -f compose.demo.yaml run --rm --no-deps backend python manage.py shell
```

La promoción es una escritura manual privilegiada y debe aprobarse para el
entorno elegido. No hay una cuenta `admin_sistema` predeterminada.

Para crear un superusuario de Django Admin en desarrollo:

```bash
docker compose -f compose.yaml exec backend python manage.py createsuperuser
```

Ese usuario se guarda en las tablas de autenticación de Django y accede a
`/admin/`. No crea una cuenta Supabase ni un perfil Benefy; las tres identidades
(staff Django, identidad Supabase y perfil Benefy) tienen responsabilidades distintas.

Para vincular un perfil heredado, consulta por su PK desde ese mismo shell,
comprueba que `supabase_uid` sea nulo, verifica la identidad en Supabase Auth,
asigna ese UUID y guarda únicamente `supabase_uid`. No cambies PK, correo ni
relaciones, ni copies valores antiguos de Firebase como si fueran UUID Supabase.

## Operación y pruebas

- El backend no registra passwords, bearer tokens ni refresh tokens.
- La clave publicable puede estar en los clientes; las contraseñas PostgreSQL,
  claves secretas y sesiones son privadas. Conserva las variables reales fuera de Git.
- Las pruebas simulan Supabase Auth y se ejecutan sobre PostgreSQL local aislado.
  Cubren 401/403/404/503, perfiles, escalamiento, aislamiento de negocios y
  sucursales, contexto del portal, revocación de membresías, planes y límites,
  autoría de canjes, roles, bloqueo y conservación de usuarios al migrar
  (153 pruebas de Django).
- La web se valida con `npm run typecheck` y `npm run build`. El E2E de navegador
  con Playwright/Edge cubrió 12/12, incluido el panel de plan, uso y límites.
- El E2E de API con JWT reales de Supabase cubrió 24/24 contexto, planes,
  límites, métricas y permisos para `admin@benefy.com`, `business@benefy.com` y
  `user@benefy.com`.
- No se añadieron dependencias al backend: se usa el cliente HTTP de Python y
  DRF existente. La web añade `@supabase/supabase-js`.
- El health check no implica que Auth esté configurado. La prueba real requiere
  un usuario confirmado y un access token del proyecto; nunca pegues el token
  en documentación, commits o logs.

Archivos principales: `core/authentication.py` verifica identidad;
`core/access.py` filtra querysets y autoriza escrituras;
`core/permissions.py` conserva las reglas de membresía;
`core/views_portal.py` y `core/serializers_portal.py` exponen el contexto;
`core/views.py` mantiene las vistas independientes y usa las genéricas DRF para
aplicar el alcance a listados y detalles; `core/serializers.py` restringe campos.
En la web: `src/auth/` (sesión, guards y contexto), `src/lib/` (Supabase, API y
tipos), `src/portal/` (layout, selectores y dashboards) y `src/pages/` (login,
registro, recuperación, onboarding y acceso restringido).

Referencias oficiales:

- [Verificar usuario en Supabase Auth](https://supabase.com/docs/reference/python/auth-getuser).
- [JWT y sesiones](https://supabase.com/docs/guides/auth/jwts).
- [Autenticación personalizada DRF](https://www.django-rest-framework.org/api-guide/authentication/#custom-authentication).
- [Proteger o deshabilitar la Data API](https://supabase.com/docs/guides/api/securing-your-api).
