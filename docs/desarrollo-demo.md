# Desarrollo y demostración unificados

El entorno recomendado es `compose.unified.yaml`, controlado por `dev.py`.
Sirve tanto para desarrollar como para demostrar el producto localmente. No
ejecuta migraciones ni carga datos automáticamente al arrancar.

## Comandos habituales

Requisitos: Docker Desktop con Compose v2 y Python 3.11 o posterior en el host.
Node y los paquetes Python de los servicios se instalan dentro de Docker.

```powershell
python dev.py up
python dev.py seed-plan
python dev.py down
```

Abre **http://localhost:5173**. La API responde en http://localhost:8001 y
Benef AI en http://localhost:5001. Todos los puertos se publican únicamente en
loopback. `down` conserva los volúmenes; no incluye `-v` ni borra datos.

`seed-plan` solo describe lo que se añadiría. La escritura remota permanece
bloqueada hasta confirmar el destino, disponer de respaldo y proporcionar las
credenciales administrativas específicas del seed.

## Una fuente de configuración

`.env.devdemo` es el archivo local autoritativo del entorno nuevo. En el primer
`up`, si no existe, el launcher copia únicamente las variables necesarias de
`backend/.env.production`. Usa creación exclusiva: nunca sustituye un archivo
existente ni modifica el original. No importa el token de Cloudflare.

Si no existe una configuración anterior:

1. Crea `.env.devdemo` usando `.env.devdemo.example`, sin sobrescribir otro archivo.
2. Configura PostgreSQL y las dos variables de Supabase.
3. Ejecuta `python dev.py up`.

También puede importarse explícitamente una configuración existente:
`python dev.py init --from RUTA`. Si `.env.devdemo` ya existe, se conserva.
Después de editar variables, vuelve a ejecutar `up`: Compose recrea los
servicios que cambiaron. No hace falta reconstruir para cambios de CSS, React
o Python.

El launcher no imprime valores y da prioridad al archivo sobre variables
`DB_*` antiguas de la terminal. Desactiva la carga implícita de otros `.env` en
Django, Vite y Benef AI. El frontend recibe únicamente la URL de la API,
URL de Supabase y clave publicable. Las claves administrativas del seed no se
inyectan en el servidor web ni en el backend habitual.

Variables necesarias:

| Variables | Uso |
| --- | --- |
| `SECRET_KEY` | Django; solo backend |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_SSLMODE` | PostgreSQL de la aplicación |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Auth; la clave publicable se comparte con Vite |
| `CANJE_VALIDACION_SEGUNDOS` | Regla existente de validación de canje; por defecto 300 |
| `BENEFY_DB_MODE` | `remote` por defecto; `local` para la base aislada |
| `LOCAL_DB_PASSWORD` | Opcional; el launcher deriva una contraseña local de `SECRET_KEY` si falta |
| `SUPABASE_SEED_ADMIN_KEY`, `BENEFY_DEMO_PASSWORD` | Solo provisionamiento explícito de cuentas de prueba |

Las contraseñas con `$`, `#` y `=` se conservan literalmente. Los valores
complejos pueden escribirse como cadenas JSON entre comillas dobles. No se
realiza expansión de variables dentro del archivo del launcher.

## Identidad y datos

Supabase Auth almacena credenciales, UUIDs y sesiones en `auth.users`. Django
verifica el JWT contra `/auth/v1/user`, sin introducir un modo de autenticación
alternativo. `core_usuario.supabase_uid` enlaza el perfil con el UUID de Auth.

Los permisos reales están en PostgreSQL: `core_usuario.rol` distingue
consumidor y administrador; `core_usuarionegocio` contiene propietario,
supervisor, empleado, sucursal y estado. Los metadatos de Auth no otorgan esos
permisos. Los negocios y el historial de lealtad son tablas Django del esquema
`public`, no cuentas de Auth.

La configuración previa de desarrollo fuerza PostgreSQL local, aunque usa el
mismo Auth remoto que la demo. La demo obtiene PostgreSQL de su archivo de
entorno y compila Vite en una imagen estática. Esa combinación explica perfiles,
negocios y permisos distintos al iniciar sesión con el mismo UUID.

El entorno nuevo reutiliza la conexión del demo existente. No copia, reasigna
ni elimina los usuarios o negocios existentes. Un perfil sin correspondencia
actual en Auth requiere investigación manual; el seed nunca lo vincula por
coincidencia de correo.

## Seed aditivo e idempotente

`backend/core/management/commands/seed_demo.py` utiliza el namespace
`benefy-demo-v1` y correos reservados `@example.invalid`. Crea siete cuentas:
propietario, supervisor, empleado, administrador y tres clientes. Separa el
provisionamiento de Auth de los perfiles Django.

En el negocio aislado crea una sucursal, membresías auditadas, plan Free,
programa de puntos, tarjeta repetible y recompensas. Genera 36 visitas
históricas mediante el motor existente, con lotes, saldos, movimientos, ciclos,
cupones y canjes reales. Solo corrige las fechas `auto_now_add` de las filas
recién creadas para representar el instante histórico suministrado al motor.

Los UUIDs de Auth se reutilizan y las claves de operación son estables. Un
bloqueo transaccional evita seeds concurrentes. Repetir el seed no duplica el
historial, no restablece contraseñas, no reactiva accesos revocados ni cambia
permisos existentes. Una colisión de identidad cancela la transacción.

El provisionamiento remoto exige que Auth y PostgreSQL pertenezcan al mismo
proyecto. Antes de cualquier escritura:

```powershell
python dev.py seed-plan
python dev.py backup
```

Revisa el destino mostrado por el plan. `backup` realiza un `pg_dump` de
`public` y `auth`, sin modificar datos, y crea un recibo de destino y SHA-256.
Los respaldos contienen información sensible: quedan en `backups/`, ignorados
por Git y excluidos de las imágenes. Protege y conserva esa carpeta.

Solo después de autorización explícita para ese destino, configura en el
archivo local la clave administrativa de Supabase y una contraseña de prueba
de al menos 12 caracteres, y ejecuta:

```powershell
python dev.py seed --allow-remote --expected-target HUELLA_DEL_PLAN --backup-receipt backups/RECIBO.json
```

El recibo debe corresponder al destino y al contenido del dump y tener menos
de 24 horas. Verificar SHA-256 y formato no sustituye una prueba de restauración.
Si Auth se provisiona y luego falla la transacción Django, las cuentas nuevas
se conservan identificadas por metadatos para reintentar; no se eliminan usuarios
como compensación. No se usa `service_role` en el navegador.

## Pruebas locales sin escribir en Supabase

```powershell
python dev.py test-backend --local
python dev.py migrate-local --local
python dev.py seed --local --offline-profiles
python dev.py seed --local --offline-profiles
```

El servicio `postgres` es un PostgreSQL 17 aislado, sin puerto publicado.
El comando de seed local inicia ese servicio y prepara sus migraciones si hace
falta, por lo que también puede ejecutarse directamente, sin los pasos previos.
`test-backend` crea y destruye exclusivamente su base `test_*`. Las ejecuciones
puntuales usan `compose run` con el destino seleccionado; no reutilizan por
accidente el backend ya arrancado con otra configuración.

`--offline-profiles` crea perfiles sintéticos sin cuentas Auth y solo funciona
en la base local. Sirven para probar el motor y la autorización en tests; **no
son cuentas con las que se pueda iniciar sesión**. No se debilita la validación
de JWT. Para conectar la web a esa base aislada usa `python dev.py up --local`;
para volver a los datos de demo remotos usa `python dev.py up` con modo remoto
en el archivo. No se elimina ninguna base al cambiar.

Comprobaciones adicionales:

```powershell
python dev.py check
python dev.py migrate-plan
python -m unittest discover -s tests -v
node frontend-web/tests/unified-smoke.mjs
python tools/verify_python_reload.py
```

Las pruebas de recarga añaden temporalmente un comentario, verifican HMR o
cambio de proceso y restauran los archivos. No generan capturas.

## Inventario y configuraciones anteriores

| Archivos | Función |
| --- | --- |
| `compose.unified.yaml`, `dev.py`, `.env.devdemo.example` | Único flujo recomendado para desarrollo/demo |
| `frontend-web/Dockerfile.dev`, `vite.config.ts` | Vite, dependencias en volumen y polling para Docker Desktop |
| `backend/Dockerfile`, `config/devdemo.py` | Django `runserver` y recarga; código montado en solo lectura |
| `benef-ai/Dockerfile`, `main.py` | Uvicorn y polling de watchfiles |
| `compose.yaml`, `.env.example`, `backend/.env.example` | Desarrollo anterior con PostgreSQL local; conservado como referencia |
| `compose.demo.yaml`, `frontend-web/Dockerfile`, `Caddyfile` | Demo anterior estática, HTTPS local y túnel opcional |
| `backend/Dockerfile.prod`, `entrypoint.sh`, `.env.production.example` | Gunicorn y collectstatic; sin recarga ni migraciones automáticas |
| `frontend-web/.env.example`, `.env.production.example` | Variables públicas del flujo web anterior |
| `benef-ai/.env.example`, `mobile-app/.env.example` | Configuraciones independientes; móvil aún tiene datos simulados |
| `.github/workflows/ci.yml` | Pruebas con PostgreSQL aislado y build web, sin despliegue |
| `frontend-web/tests/server.mjs`, `run.mjs`, `auth-fixture.js` | Servidor de pruebas con Auth/HTTP simulados; no es el demo real |

Los archivos reales anteriores son locales e ignorados; no se eliminan ni se
sobrescriben. Los Compose anteriores permanecen disponibles para volver atrás.
Usar `localhost` con HTTPS sigue llegando a la demo estática anterior; el nuevo
flujo se abre en **http://localhost:5173**.

## Investigación del archivo de producción

Git ignore no elimina archivos. Se encontró `backend/.env.production` en la
copia del índice y del trabajo de un stash automático de GitHub Desktop
asociado a una rama antigua cuyo ignore solo cubría `*.env`. Esto acredita que
el archivo se había añadido al índice y quedó guardado fuera del directorio
de trabajo al hacer stash. No demuestra por sí solo cada desaparición reportada.
No se aplicó ni borró ese stash.

En las imágenes anteriores el archivo tampoco existe por diseño:
`backend/.dockerignore` excluye `.env.*` y `env_file` inyecta variables, no monta
el archivo. La ausencia dentro del contenedor es distinta de su ausencia en el
host. Docker no tiene un montaje con el que pueda borrarlo del host.

Como protección local entre ramas se añadieron reglas de secretos a
`.git/info/exclude`; ese archivo no viaja en commits. Las plantillas permanecen
versionadas. `.env.devdemo` no se sobrescribe en cada arranque. No uses
`git add -f` para archivos de entorno ni restaures stashes sobre secretos sin
revisarlos de forma privada.
