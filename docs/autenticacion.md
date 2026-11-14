# Autenticación y permisos de Benefy

Supabase Auth gestiona registro, confirmación de correo, contraseñas, inicio
de sesión, renovación y cierre de sesión. Django conserva perfiles, roles,
membresías y reglas de acceso a los datos. El dashboard y la app móvil aún
deben integrar sus pantallas y el cliente de Supabase; este cambio implementa
el contrato y la protección del backend.

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
Los tokens inválidos o vencidos producen 401; una caída del proveedor produce
503, nunca acceso sin verificación. No se siguen redirecciones HTTP que puedan
reenviar el token. Producción exige HTTPS para el servidor Auth.

El refresh token lo administra el cliente Supabase. No se envía a Django.
El cierre de sesión y la revocación siguen el ciclo de vida de Supabase; no
se promete que un access token quede invalidado inmediatamente tras cerrar
sesión. Desactivar `Usuario.is_active` bloquea el acceso a Benefy en la
siguiente petición, incluso con un token todavía válido.

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

{"rol":"negocio","is_active":true}
```

`GET /api/v1/usuarios/listar/` devuelve solo el usuario propio, salvo para
`admin_sistema`. Recursos ajenos quedan fuera de los querysets y responden 404
en detalles. Una acción no permitida sobre un recurso visible responde 403.
No se exponen los identificadores Firebase heredados.

## Endpoints de lealtad

| Ruta | Rol requerido | Alcance |
| --- | --- | --- |
| `POST /visitas/registrar/` | `consumidor` | Registra la visita del usuario autenticado |
| `GET /mi/billetera/` | `consumidor` | Solo saldos, tarjetas y cupones propios |
| `GET /mi/historial/` | `consumidor` | Solo visitas, movimientos y canjes propios |
| `GET /negocios/{id}/catalogo/` | Cualquier perfil activo | Recompensas activas del negocio |
| `POST /cupones/adquirir/` | `consumidor` | Descuenta puntos y emite el cupón propio |
| `POST /cupones/{uuid}/canjear/` | Dueño del cupón | Canje irreversible; un cupón ajeno responde 403 |
| `POST /admin/puntos/ajustar/` | `admin_sistema` | Ajuste auditado sin saldo negativo |
| `POST /admin/visitas/{id}/anular/` | `admin_sistema` | Anulación con motivo |
| `POST /admin/cupones/{uuid}/anular/` | `admin_sistema` | Anulación con motivo y sin devolución automática |
| `GET /negocios/{id}/metricas/` | Dueño del negocio o admin | Métricas del negocio solicitado |

Los usuarios con rol `negocio` no pueden registrar visitas ni canjear cupones
como consumidores. El personal del negocio conserva la lectura de su alcance,
pero no interviene en el canje del cliente.

## Matriz de permisos

`Usuario.rol` distingue consumidor, usuario de negocio y administrador del
sistema. `UsuarioNegocio.rol_comercio` determina dueño, admin o empleado para
un negocio/sucursal concretos. Tener rol `negocio` por sí solo no concede acceso.

| Recurso | Lectura | Escritura |
| --- | --- | --- |
| Usuarios | Propio; admin del sistema puede consultar todos | Perfil propio; roles/bloqueo solo admin; borrado solo admin |
| Categorías y planes | Todos los perfiles autenticados | Solo admin del sistema |
| Negocios | Miembros del negocio | Cualquier perfil puede crear su propio negocio; dueño modifica; borrado solo admin |
| Sucursales | Dueño: todas las propias; admin/empleado: su sucursal | Dueño del negocio |
| Membresías | Propia; dueño: su negocio; admin: su sucursal | Dueño asigna admin/empleado; admin de sucursal asigna empleados; solo admin del sistema asigna dueños |
| Dinámicas | Miembros del negocio | Dueño del negocio |
| Recompensas | Miembros de los negocios asociados | Dueño de la dinámica; si es de alianza, dueño de ambos negocios |
| Alianzas | Miembros de los negocios involucrados | Solo admin hasta implementar aprobación bilateral |
| Actividades | Consumidor: propias; personal: su alcance de sucursal | Solo lectura por CRUD; alta exclusiva desde `POST /visitas/registrar/`; anulación solo admin |
| Progreso y cupones | Consumidor: propios; personal: su negocio | Solo lectura por CRUD; adquisición y emisión desde servicios de lealtad |
| Canjes | Consumidor: propios; personal: su negocio | Solo lectura por CRUD; canje exclusivo del dueño del cupón desde `POST /cupones/{uuid}/canjear/` |
| Saldos y lotes de puntos | Consumidor: propios; personal: su negocio | Solo servicios; ajustes exclusivos de `admin_sistema` |
| Pagos y suscripciones | Dueño del negocio y admin del sistema | Solo admin hasta implementar webhooks verificados |
| Notificaciones | Propias y admin del sistema | Usuario solo marca `leida`; crear/borrar solo admin |

El admin del sistema tiene alcance global, sujeto a las validaciones de cada
serializer. La sucursal y su negocio deben estar activos para registrar
actividades o canjes. A los usuarios de negocio no se les permite cambiar
el origen de una recompensa, trasladar una dinámica/sucursal a otro negocio,
ni transferir una membresía a otro usuario/negocio mediante actualización.
`stripe_id` solo puede establecerlo el administrador.

Al crear negocio se actualiza el rol consumidor a negocio y se crea la membresía
de dueño en una transacción. Al asignar la primera membresía a un consumidor,
se actualiza su rol a negocio.

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
  sucursales, autoría de canjes, roles, bloqueo y conservación de usuarios al migrar.
- No se añadieron dependencias: se usa el cliente HTTP de Python y DRF existente.
- El health check no implica que Auth esté configurado. La prueba real requiere
  un usuario confirmado y un access token del proyecto; nunca pegues el token
  en documentación, commits o logs.

Archivos principales: `core/authentication.py` verifica identidad;
`core/access.py` filtra querysets y autoriza escrituras;
`core/permissions.py` conserva las reglas de membresía;
`core/views.py` mantiene las vistas independientes y usa las genéricas DRF para
aplicar el alcance a listados y detalles; `core/serializers.py` restringe campos.

Referencias oficiales:

- [Verificar usuario en Supabase Auth](https://supabase.com/docs/reference/python/auth-getuser).
- [JWT y sesiones](https://supabase.com/docs/guides/auth/jwts).
- [Autenticación personalizada DRF](https://www.django-rest-framework.org/api-guide/authentication/#custom-authentication).
- [Proteger o deshabilitar la Data API](https://supabase.com/docs/guides/api/securing-your-api).
