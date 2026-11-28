# Desarrollo local y demostración

> Este documento no forma parte de la operación de producción. Para desplegar y
> operar Benefy, consulta [operaciones](./operaciones.md).

La única configuración de servicios es `compose.yaml`. Docker agrupa los
contenedores bajo `benefy` (`benefy-backend-1`, `benefy-web-1` y
`benefy-benef-ai-1`). Las credenciales se configuran en `.env` en la raíz.

## Arranque

Requiere Docker Desktop con Compose v2. El launcher requiere Python 3.11 o
posterior; Node y las dependencias de los servicios se instalan en Docker.

```powershell
python dev.py up
# Alternativa sin launcher:
docker compose up -d --build --wait
```

Web: http://localhost:5173. API: http://localhost:8001. IA:
http://localhost:5001. Los puertos solo se publican en loopback. El código se
monta en solo lectura, Vite usa HMR y los servicios Python recarga automática.
No se ejecutan migraciones ni seeds al arrancar.

```powershell
python dev.py check
docker compose logs --tail 50 backend
python dev.py down
# Alternativa: docker compose down
```

Detener conserva volúmenes. No uses `down -v` para una parada normal.

## Configuración

Para una instalación nueva, copia `.env.example` a `.env` y configura sus
valores. No sobrescribas un archivo existente. `dev.py init --from RUTA` permite
importar explícitamente otro archivo y nunca sobrescribe `.env`.

Usa comillas simples para valores con `$` o `#`: Compose los interpreta
literalmente. No incluyas secretos en Git ni imprimas `docker compose config`
sin `--quiet`. El launcher valida la clave publicable y que Auth y PostgreSQL
correspondan al mismo proyecto; da prioridad al archivo sobre variables antiguas
de la terminal. Para evitar diferencias al ejecutar Compose directamente, no
mantengas variables `DB_*` o `SUPABASE_*` antiguas exportadas en la terminal.

El frontend solo recibe variables públicas seleccionadas. Las claves
administrativas y contraseñas del seed se pasan exclusivamente a su contenedor
temporal. No se cargan archivos `.env` secundarios dentro de los servicios.
Después de cambiar variables ejecuta `up`; `restart` no actualiza el entorno.

## Comandos del launcher

| Comando | Uso |
| --- | --- |
| `python dev.py init` | Crea `.env` desde una plantilla, sin sobrescribir |
| `python dev.py up` | Arranca backend, web y Benef AI |
| `python dev.py down` | Detiene sin borrar volúmenes |
| `python dev.py status` | Muestra el estado de los servicios |
| `python dev.py check` | Valida Compose y `manage.py check` |
| `python dev.py migrate-plan` | Muestra el plan de migraciones |
| `python dev.py migrate-local` | Migra solo PostgreSQL local aislado |
| `python dev.py test-backend --local` | Ejecuta la suite Django sobre PostgreSQL aislado |
| `python dev.py backup` | Crea un respaldo local verificado |
| `python dev.py seed-plan` | Muestra el plan del dataset, sin escribir |
| `python dev.py seed --local --offline-profiles` | Genera el dataset sin Auth remoto |
| `python dev.py demo-init` | Completa el dataset de demostración sin duplicados |
| `python dev.py demo-reset` | Reemplaza el dataset autorizado, con respaldo previo |

## Dataset de demostración

```powershell
python dev.py demo-init
python dev.py demo-reset
```

`demo-init` completa el dataset sin duplicar datos ni restablecer contraseñas,
membresías o permisos existentes. `demo-reset` reemplaza los datos ficticios
exclusivamente del proyecto autorizado. Ambos verifican el destino y crean y
decodifican un respaldo previo. No se ejecuta ninguno durante el arranque
habitual.

**`demo-reset` elimina los datos actuales de demostración.** Primero verifica el
destino, crea un respaldo de `public` y `auth`, decodifica su archivo completo
con `pg_restore`, verifica sus tablas y registra SHA-256 y destino. Si cualquiera
de esos pasos falla, no se inicia el reemplazo.

Los secretos y contraseñas están en `.env`, que no se versiona. El seed requiere
`SUPABASE_SEED_ADMIN_KEY` y `BENEFY_SHOWCASE_PASSWORDS` (un objeto JSON
serializado con las entradas `admin`, `business`, `user`, `supervisor`,
`employee` y `customers`). El frontend nunca recibe estos valores.

### Cuentas y permisos

| Cuenta | Permisos |
| --- | --- |
| `admin@benefy.com` | Administrador del portal de plataforma |
| `business@benefy.com` | Propietario de los negocios del dataset |
| `user@benefy.com` | Cliente: billetera, puntos, tarjetas, cupones e historial |
| `supervisor@benefy.com` | Supervisor de la primera sucursal de cada negocio |
| `employee@benefy.com` | Empleado de la primera sucursal de cada negocio |
| Cuentas de clientes | Cuentas ficticias con perfiles e historial de consumo |

Todos se crean con Auth Admin y `email_confirm: true`. No se invoca signup,
invitaciones, recuperación ni envío de correos. El reinicio puede reutilizar las
cuentas principales y actualizar sus contraseñas mediante Admin. La
inicialización posterior conserva UUIDs y contraseñas. Los permisos comerciales
siguen residiendo en Django; no se conceden mediante metadatos de Auth.

### Negocios

| Negocio | Plan | Sucursales |
| --- | --- | --- |
| Café Aurora | Premium | Centro, Río |
| Barbería Norte | Free | Centro |
| Impulso Fitness | Premium | Río, Playas |
| Casa Verde | Free | Cacho |

Cada negocio tiene programa de puntos, tarjeta repetible, recompensa de puntos,
descuento y premio de tarjeta. Los recursos se comprueban contra los límites del
plan existente. La asignación Free/Premium y las membresías usan los servicios
auditados de dominio.

El dataset inicial contiene clientes, visitas, puntos, ciclos, cupones y canjes
con fechas, sucursales y frecuencias deterministas. Visitas, otorgamientos,
consumos FIFO, expiraciones, ciclos, cupones y canjes pasan por los servicios
existentes; no se insertan saldos calculados artificialmente. Las correcciones
de fechas históricas solo afectan filas recién creadas por el seed.

La validación comprueba saldo frente a lotes y movimientos, signos y cantidades,
duplicados diarios válidos, estado de cupones canjeados, alcance de sucursales y
límites de plan. El historial permite consultar las estadísticas existentes; el
seed no añade gráficas ni funcionalidades analíticas nuevas a la web.

### Alcance del reemplazo

La limpieza usa una lista explícita de modelos `core`, en orden de dependencias.
No usa `TRUNCATE CASCADE`, no reinicia esquemas y no altera tablas, migraciones,
funciones, triggers, políticas RLS, catálogos de planes/precios ni configuración
global de Auth. Una huella de esas estructuras se compara antes y después.

Las cuentas anteriores que no formen parte del dataset nuevo se eliminan
individualmente con Auth Admin, después de retirar sus referencias de negocio.
No se borra directamente `auth.users` ni se limpia indiscriminadamente `auth` o
`storage`. La presencia de objetos Storage, pagos o referencias externas al
conjunto autorizado bloquea el reinicio y exige revisión.

Un bloqueo de sesión impide ejecuciones concurrentes del seed. Auth y PostgreSQL
no comparten una transacción distribuida: si hay una interrupción, se conserva
el respaldo y se puede reanudar con `demo-init` después de revisar el estado.
No se eliminan cuentas nuevas como compensación automática de un fallo.

### Verificación

```powershell
python dev.py test-backend --local
python tools/verify_showcase.py
python tools/verify_showcase.py --exercise
```

La primera prueba usa exclusivamente una base local aislada. La verificación
real prueba los cinco logins, confirmación, roles, métricas, planes, billetera,
historial y logout con rechazo del refresh token. `--exercise` registra una
visita diaria y adquiere/canjea un cupón con clave estable: puede añadir un
registro legítimo de prueba, pero repetirla no duplica esa operación.

`frontend-web/scripts/showcase-live.mjs` verifica los logins y la navegación
reales en Chromium, sin mocks ni capturas; recibe las contraseñas solo por
entorno. Usa `PLAYWRIGHT_CHANNEL=msedge` para ejecutarlo en Edge.
Estas pruebas de sesiones deben ejecutarse secuencialmente para que un logout
global de un cliente no cierre la sesión de otra prueba.

Los respaldos y sus recibos están en `backups/`, fuera de Git y de las imágenes.
Verificar y decodificar el archivo no equivale a ejecutar una restauración
completa sobre un proyecto Supabase; no se realiza una restauración remota de
prueba ni se modifican otros proyectos.

## Pruebas

### Backend

```powershell
python dev.py test-backend --local
```

El perfil `local` del mismo Compose contiene un PostgreSQL aislado sin puerto
publicado. `test-backend` crea y destruye exclusivamente su base `test_*`. No
ejecutes pruebas de Django en el backend conectado al Supabase remoto.

Las pruebas de demostración e históricas están separadas de la suite principal:

```powershell
docker compose run --rm backend python manage.py test optional_tests
```

No forman parte del CI ni deben ejecutarse contra un destino remoto sin
autorización y respaldo.

### Frontend

```powershell
cd frontend-web
npm ci
npm test
npm run typecheck
npm run build
npm run test:e2e
```

Las pruebas E2E usan respuestas controladas en el puerto 5174 y Chromium; no
modifican la base remota. Si falta el navegador, ejecuta
`npx playwright install chromium`. Define `PLAYWRIGHT_CHANNEL=msedge` para usar
Edge. `tests/smoke.mjs` comprueba el servidor real y HMR sin
credenciales. Las pruebas visuales comprueban el responsive del portal.

### Móvil

```powershell
cd mobile-app
npm test
npm run typecheck
npm run lint
npx expo-doctor
npx expo export --platform android
```

### Benef AI

```powershell
cd benef-ai
python -m unittest discover -s tests -v
```

La suite usa mocks: no consume Gemini, Django ni Supabase reales.

### Herramientas del repositorio

```powershell
python -m unittest discover -s tools/tests -v
python tools/verify_python_reload.py
python tools/verify_showcase.py
```

Las comprobaciones de recarga añaden un comentario temporal y lo restauran.

## Stripe Sandbox

Para probar la facturación manualmente:

1. Configura las claves de Sandbox en `.env` y ejecuta:

```bash
python manage.py configurar_stripe_sandbox
```

2. Arranca Django en `http://localhost:8001`.
3. Escucha webhooks:

```bash
stripe listen --all-snapshot \
  --forward-to http://127.0.0.1:8001/api/v1/stripe/webhook/
```

Copia el `whsec_...` del listener a `STRIPE_WEBHOOK_SECRET`.

4. Entra al portal como propietario y abre **Suscripción**.
5. Contrata Premium y usa tarjetas de prueba:
   - `4242 4242 4242 4242`: pago exitoso.
   - `4000 0000 0000 0002`: rechazo.
   - `4000 0027 6000 3184`: autenticación 3D Secure.
   - `4000 0000 0000 0341`: fallo al adjuntar; útil para renovaciones fallidas.
6. Para renovar sin esperar, usa **Run simulation** en el Dashboard de Stripe o
   un Test Clock por API. Avanza hasta después del periodo y verifica que el
   segundo pago aparezca en el historial.
7. Para cancelar, abre **Administrar suscripción** y elige cancelar al final del
   periodo. El portal no ofrece cancelación inmediata.
8. Para simular un pago fallido en una renovación, cambia el método de pago de
   prueba por una tarjeta que falle y avanza el reloj; verifica el estado
   `pendiente`, `gracia_fin` y el downgrade posterior.
9. Si un webhook se pierde, ejecuta `reconciliar_stripe --negocio-id <id>`.

No se aplican migraciones ni se crean suscripciones en el Supabase remoto. La
suite de integración real con Test Clock no se ejecuta en CI.
