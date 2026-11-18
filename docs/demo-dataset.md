# Dataset de presentación de Benefy

El único proyecto autorizado para reemplazo es `rmwwrgahhuztylqkduya`.
El launcher y el comando Django verifican por separado que Auth y PostgreSQL
correspondan a ese identificador. No se permite utilizar el comando de reinicio
en otro proyecto, aunque se proporcionen credenciales válidas.

## Uso habitual

```powershell
python dev.py up
python dev.py demo-init
python dev.py down
```

La web está en http://localhost:5173. `demo-init` completa el dataset gestionado
sin duplicar datos ni restablecer contraseñas, membresías o permisos existentes.
Si encuentra datos anteriores ajenos al dataset, exige un reinicio explícito.

Para reemplazar completamente los datos ficticios del proyecto autorizado:

```powershell
python dev.py demo-reset
```

**Este último comando elimina los datos actuales de demostración.** Primero
verifica el destino, crea un respaldo de `public` y `auth`, decodifica su archivo
completo con `pg_restore`, verifica sus tablas y registra SHA-256 y destino.
Si cualquiera de esos pasos falla, no se inicia el reemplazo.

Los secretos y contraseñas están en `.env`, que no se versiona. El seed
requiere `SUPABASE_SEED_ADMIN_KEY` y `BENEFY_SHOWCASE_PASSWORDS` (un objeto JSON
serializado con las entradas `admin`, `business`, `user`, `supervisor`,
`employee` y `customers`). El frontend nunca recibe estos valores.

## Cuentas y permisos

| Cuenta | Permisos |
| --- | --- |
| `admin@benefy.com` | Administrador del portal de plataforma |
| `business@benefy.com` | Propietario de los cuatro negocios |
| `user@benefy.com` | Cliente: billetera, puntos, tarjetas, cupones e historial mediante la API |
| `supervisor@benefy.com` | Supervisor de la primera sucursal de cada negocio |
| `employee@benefy.com` | Empleado de la primera sucursal de cada negocio |
| 59 clientes adicionales | Cuentas ficticias con perfiles e historial de consumo |

Todos se crean con Auth Admin y `email_confirm: true`. No se invoca signup,
invitaciones, recuperación ni envío de correos. El reinicio puede reutilizar las
cuentas principales y actualizar sus contraseñas mediante Admin. La
inicialización posterior conserva UUIDs y contraseñas. Los permisos comerciales
siguen residiendo en Django; no se conceden mediante metadatos de Auth.

El portal web sigue siendo comercial. Un cliente sin membresía ve la pantalla
de acceso restringido; sus datos se consultan con `/api/v1/mi/billetera/` y
`/api/v1/mi/historial/`. La app móvil todavía usa datos simulados. No se añade
una interfaz de cliente ni se debilitan los guards para esta demostración.

## Negocios

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

El dataset inicial contiene 60 clientes y 1.134 visitas repartidas en 180 días.
Las fechas, sucursales y frecuencias son deterministas. Visitas, otorgamientos,
consumos FIFO, expiraciones, ciclos, cupones y canjes pasan por los servicios
existentes; no se insertan saldos calculados artificialmente. Las correcciones
de fechas históricas solo afectan filas recién creadas por el seed.

La validación comprueba saldo frente a lotes y movimientos, signos y cantidades,
duplicados diarios válidos, estado de cupones canjeados, alcance de sucursales y
límites de plan. El historial permite consultar las estadísticas existentes;
el seed no añade gráficas ni funcionalidades analíticas nuevas a la web.

## Alcance del reemplazo

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

## Verificación

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

`frontend-web/tests/showcase-live.mjs` verifica los logins y la navegación reales
en Edge, sin mocks ni capturas; recibe las contraseñas solo por entorno. Estas
pruebas de sesiones deben ejecutarse secuencialmente para que un logout global
de un cliente no cierre la sesión de otra prueba.

Los respaldos y sus recibos están en `backups/`, fuera de Git y de las imágenes.
Verificar y decodificar el archivo no equivale a ejecutar una restauración
completa sobre un proyecto Supabase; no se realiza una restauración remota de
prueba ni se modifican otros proyectos.
