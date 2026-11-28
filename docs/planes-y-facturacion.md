# Planes y facturación

El plan pertenece al **negocio**, no al usuario. Una cuenta puede administrar
varios negocios con planes distintos. Los roles `dueno`, `supervisor`,
`empleado` y el privilegio global `admin_sistema` son independientes del plan.

**Estado de facturación:** Stripe Payments, Stripe Billing y Customer Portal se
usan exclusivamente en **Sandbox/Test Mode**. No se procesa dinero real, no se
usan claves live, no se emiten CFDI y no se calculan impuestos. El paso a
producción requiere una fase separada de cumplimiento fiscal, conciliación y
revisión de seguridad.

## Límites de los planes

| Recurso | Free | Premium |
| --- | ---: | ---: |
| Sucursales activas | 1 | 5 |
| Programas de puntos activos | 1 | 1 |
| Tarjetas de sellos activas | 2 | 10 |
| Recompensas activas | 5 | 30 |
| Supervisores activos | 1 | 5 |
| Empleados activos | 3 | 20 |
| Alianzas activas (total) | 1 | 4 |
| Alianzas activas con negocios Free | 1 | 1 |
| Alianzas activas con negocios Premium | 1 | 3 |
| Clientes, visitas y cupones | Ilimitados | Ilimitados |

Los límites se guardan en `PlanSuscripcion.limites` y pueden ajustarse desde
Django Admin o el CRUD administrativo sin migrar:

```json
{
  "sucursales": 1,
  "programas_puntos": 1,
  "tarjetas_sellos": 2,
  "recompensas": 5,
  "supervisores": 1,
  "empleados": 3,
  "alianzas_activas": 1,
  "alianzas_con_free": 1,
  "alianzas_con_premium": 1
}
```

- `null` significa ilimitado explícito; `0`, recurso no permitido; un entero
  positivo es el máximo de recursos activos.
- Una clave ausente, desconocida o un valor inválido es un error de
  configuración; nunca se interpreta como ilimitado.
- Solo los recursos activos consumen cupo y la reactivación vuelve a validar el
  límite. Se mantiene un único programa de puntos activo por negocio.

## Modelos

| Modelo | Contenido |
| --- | --- |
| `PlanSuscripcion` | Nivel comercial (`free`, `premium`) con `nombre`, `descripcion`, `orden`, `limites`, `caracteristicas` y `status` |
| `PlanPrecio` | Modalidad de cobro: `plan`, `intervalo` (`mensual`/`anual`), `stripe_price_id` opcional, `monto`, `divisa` y `status` |
| `ClienteStripe` | Customer de Stripe aislado por negocio y modo (`test`/`live`) |
| `CheckoutStripe` | Checkout idempotente, snapshot de monto y estado |
| `EventoStripe` | Idempotencia de webhooks sin payload sensible |
| `Suscripcion` | Negocio y plan con `status`, `origen` (`manual`, `stripe`, `migracion`, `automatico`), fechas, cancelación, estado/Price de Stripe, gracia y último evento |
| `PlanCambioAuditoria` | Negocio, plan anterior y nuevo, origen, motivo, actor, correo y fecha |
| `Pago` | Factura de prueba única por `stripe_invoice_id`, estado, periodo, intentos y recibo |

`activa` y `prueba` conceden capacidades. `pendiente` conserva Premium solo
mientras `gracia_fin` siga en el futuro, después de un pago fallido; al vencer la
gracia el negocio pasa a Free. `incompleta` y `cancelada` no conceden acceso. Una
cancelación programada se conserva `activa` con `en_cancelacion=true` hasta el
final del periodo. Una restricción de Postgres impide más de una suscripción
vigente por negocio; los cambios cierran la anterior y crean/activan la nueva en
una transacción.

Premium tiene una fila mensual y otra anual con los mismos límites: `399.00 MXN`
al mes y `3,990.00 MXN` al año. Free no requiere precio. Los Price IDs de Sandbox
se vinculan con `python manage.py configurar_stripe_sandbox`.

## Asignación de Free

Al crear un negocio por API se crea, en la misma transacción, el negocio, la
membresía de dueño y una suscripción Free activa con origen `automatico`. Si el
plan Free no existe, la operación falla: no se asume acceso ilimitado.

## Servicio centralizado

`core/services/planes.py` concentra las reglas: `plan_actual`, `limite`,
`uso_actual`, `puede_crear`, `verificar_capacidad`, `tiene_caracteristica` y
`resumen_plan`. La comprobación bloquea la fila del negocio con
`select_for_update()` dentro de una transacción, de modo que dos altas
simultáneas no consumen el mismo último cupo.

`ResourceAccessMixin` valida antes de crear o reactivar sucursales, tarjetas de
sellos, recompensas y membresías de supervisor o empleado. La regla también
aplica a `admin_sistema`: el plan es del negocio. Editar un recurso activo en la
misma categoría no consume un cupo nuevo. Error estable, HTTP `403`:

```json
{"codigo": "limite_plan", "detalle": "El plan actual no permite crear más recompensas."}
```

Los endpoints de plan están en [api.md](./api.md#planes-y-límites).

## Cambios de plan

- **Free → Premium:** se cierra la suscripción Free y se crea Premium activa en
  la misma transacción. Los límites nuevos aplican de inmediato y no se borra ni
  transforma ningún dato.
- **Premium → Free:** se conservan visitas, saldos, lotes, movimientos, cupones,
  canjes, ciclos, recompensas y auditorías. Los recursos por encima del límite
  quedan como **excedentes**: se consultan y operan, pero no se permiten nuevas
  altas que aumenten el exceso. No hay desactivaciones automáticas.
- Los ciclos de tarjeta ya iniciados conservan sus condiciones y pueden
  terminar. La selección manual de tarjetas habilitadas tras un downgrade queda
  pendiente; por ahora se bloquean nuevas altas si el negocio supera el límite.
- El cambio manual exige `admin_sistema`, un motivo y auditoría. Un dueño no
  puede activar Premium manipulando una solicitud HTTP.

## Interfaz web

El portal muestra el plan actual y su etiqueta, el uso y límite de cada recurso
con barra de progreso, avisos de “Límite alcanzado” y excedentes, funciones
Premium con su estado de disponibilidad y una pantalla **Suscripción** con:

- precio mensual/anual y aviso claro de demostración Sandbox;
- botón “Contratar Premium” que redirige a Stripe Checkout;
- estado de la suscripción, próxima renovación, cancelación programada y gracia;
- botón “Administrar suscripción” para el Customer Portal;
- historial de pagos de prueba.

No hay formularios propios de tarjeta. El retorno de Checkout/Portal no cambia el
plan; Django sincroniza desde Stripe.

## Alianzas y límites

Free puede participar en una alianza activa: recibir, aceptar, rechazar,
finalizar y administrar los beneficios del negocio que ofrece, pero no puede
enviar solicitudes. Premium puede enviar y recibir solicitudes, con una alianza
activa máxima con un negocio Free, tres con negocios Premium y cuatro en total.

Los cupos se comprueban al aceptar para ambos negocios, bloqueando sus filas en
orden de PK dentro de una transacción. Las solicitudes pendientes no consumen
cupo; las activas lo consumen hasta finalizar o vencer. Un downgrade no finaliza
alianzas existentes: deja los excedentes visibles y bloquea nuevas solicitudes o
aceptaciones que superen el cupo vigente. Los beneficios son recompensas del
negocio que los ofrece y solo aparecen en el catálogo mientras la alianza está
activa y vigente.

## Stripe Sandbox

### Variables de entorno

Solo backend. Nunca deben llegar al navegador ni a Git.

| Variable | Obligatoria | Uso |
| --- | --- | --- |
| `STRIPE_ENABLED` | Sí para operar | `true` habilita la facturación |
| `STRIPE_MODE` | Sí | Debe ser `test`; cualquier otro valor se rechaza |
| `STRIPE_SECRET_KEY` | Sí | `sk_test_...` o `rk_test_...`; se rechazan `sk_live_`, `rk_live_` |
| `STRIPE_PUBLISHABLE_KEY` | Opcional | Se valida que no sea live; no se envía al frontend |
| `STRIPE_WEBHOOK_SECRET` | Sí para webhooks | Secreto del endpoint o del listener local (`whsec_...`) |
| `STRIPE_PREMIUM_PRODUCT_ID` | Opcional | Producto Sandbox usado por el comando de catálogo |
| `STRIPE_PREMIUM_PRICE_ID` | Opcional | Price mensual de Sandbox para vincular el catálogo |
| `STRIPE_PREMIUM_ANNUAL_PRICE_ID` | Opcional | Price anual de Sandbox |
| `STRIPE_PORTAL_CONFIGURATION_ID` | Recomendada | Configuración `bpc_...` del Customer Portal |
| `STRIPE_GRACE_DAYS` | No | Días de gracia por pago fallido; por defecto `3`, `0` retira al vencer el periodo |
| `STRIPE_CHECKOUT_TTL_MINUTES` | No | Vigencia de la sesión Checkout; por defecto `60` |
| `FRONTEND_URL` | Sí | Origen del portal para `success_url`, `cancel_url` y retorno del portal |

Las claves se cargan desde `.env` ignorados por Git o variables del despliegue.
`STRIPE_WEBHOOK_SECRET` no es una API key: es el secreto de firma y puede ser
distinto entre el listener local y el endpoint remoto.

### Catálogo

`PlanPrecio` conserva el monto, divisa, intervalo y `stripe_price_id`. El
catálogo se aprovisiona o sincroniza con el comando idempotente:

```bash
python manage.py configurar_stripe_sandbox
```

El comando valida el producto y los Price IDs reales de Sandbox, actualiza el
catálogo y crea o reutiliza la configuración del Customer Portal. Rechaza claves
live y productos que no sean de Stripe.

### Endpoints

Todos los endpoints del negocio exigen ser propietario (`dueno`) o
`admin_sistema`; supervisores y empleados reciben `403`.

| Método | Ruta | Uso |
| --- | --- | --- |
| GET | `/api/v1/negocios/{id}/facturacion/` | Plan, precios, límites, estado, aviso demo e historial |
| POST | `/api/v1/negocios/{id}/facturacion/checkout/` | `{"intervalo":"mensual"}` o `"anual"`; devuelve URL de Checkout |
| POST | `/api/v1/negocios/{id}/facturacion/portal/` | Devuelve URL temporal del Customer Portal |
| POST | `/api/v1/negocios/{id}/facturacion/sincronizar/` | Reconcilia desde Stripe; acepta `session_id` del retorno |
| POST | `/api/v1/stripe/webhook/` | Público; autenticado únicamente por firma Stripe |

El endpoint de facturación no expone `stripe_price_id`, `stripe_customer_id`,
`stripe_subscription_id` ni secretos.

### Checkout

1. React envía solo `intervalo`.
2. Django verifica propietario, plan vigente y catálogo.
3. Se bloquea el negocio con `select_for_update()` para serializar solicitudes.
4. Se reutiliza un Checkout abierto no vencido; si no, se crea uno con
   `mode=subscription`, `customer`, Price del catálogo, metadata y
   `idempotency_key`.
5. React redirige a la URL alojada por Stripe. No existe formulario propio de
   tarjeta.
6. El retorno a `success_url` solo dispara una consulta a Stripe. No activa
   Premium por sí mismo.
7. La activación ocurre cuando el webhook verificado confirma una suscripción
   `active`/`trialing` o dentro de la gracia de `past_due`.

No se aceptan Price IDs, montos ni estados enviados por React. Si ya hay Premium
o una suscripción remota relevante, responde `409 premium_activo` y no crea otra.

### Webhooks y estados

Eventos manejados:

- `checkout.session.completed`
- `checkout.session.expired`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `customer.subscription.paused` / `resumed`
- `invoice.paid`
- `invoice.payment_failed`
- `invoice.payment_action_required`

La firma se valida sobre `request.body` con `STRIPE_WEBHOOK_SECRET`. Se rechaza
cualquier evento con `livemode != false`. Los eventos se registran en
`EventoStripe` por `event_id` único; los duplicados responden `200` sin volver a
aplicar el cambio. Los fallos se registran sin payload ni claves y responden
`5xx` para que Stripe reintente.

Antes de aplicar un cambio se consulta el objeto actual en Stripe. Además se
descarta un evento más antiguo que el último `created` aplicado al mismo
suscripción o factura. Esto evita regresiones por entregas fuera de orden.

| Stripe | Benefy | Acceso Premium |
| --- | --- | --- |
| `trialing` | `prueba` | Sí |
| `active` | `activa` | Sí |
| `past_due` | `pendiente` con `gracia_fin` | Sí, solo durante la gracia |
| `unpaid` | `pendiente` sin gracia | No |
| `paused` | `pendiente` sin gracia | No |
| `incomplete` | `incompleta` | No |
| `incomplete_expired` / `canceled` | `cancelada` | No |

La gracia se calcula como `max(ahora, fin_del_periodo) + STRIPE_GRACE_DAYS`. Al
vencer, `plan_actual()` deja de conceder Premium y el negocio ve Free. No hay
gracia indefinida. Un pago posterior que devuelva la suscripción a `active`
restaura Premium.

### Pagos

`Pago.stripe_invoice_id` es único. `invoice.paid` actualiza el pago a `pagado`;
`invoice.payment_failed` lo deja `pendiente`; `void` se registra `anulado` y
`uncollectible` como `fallido`. Los reintentos y eventos duplicados no crean
pagos repetidos. El historial enlaza el recibo de prueba alojado por Stripe.

### Renovaciones y cancelaciones

- Stripe genera la factura de renovación; `invoice.paid` actualiza periodo y
  pago. No se construyen bucles manuales de cobro.
- El Customer Portal solo ofrece cancelación al final del periodo
  (`mode=at_period_end`). Premium sigue activo hasta `periodo_actual_fin` y
  `customer.subscription.deleted` ejecuta el downgrade.
- Una cancelación inmediata hecha fuera de las acciones permitidas (por ejemplo,
  Dashboard o API de Stripe) también se respeta si el objeto verificado llega
  como `canceled` o `deleted`; no se inventa estado local.
- El downgrade no elimina alianzas y los cupones conservan su vigencia. Las
  reglas actuales de límites Free/Premium se mantienen.

### Customer Portal

`crear_sesion_portal()` usa `STRIPE_PORTAL_CONFIGURATION_ID` o crea una
configuración idempotente con:

- historial de facturas habilitado;
- actualización de método de pago habilitada;
- cancelación habilitada solo `at_period_end`;
- actualización de plan y pausa deshabilitadas;
- `return_url` al portal de Benefy.

El regreso con `?portal=return` solo llama a sincronización. No cambia el plan
por el parámetro de la URL.

### Reconciliación

```bash
python manage.py reconciliar_stripe
python manage.py reconciliar_stripe --negocio-id 123
```

Consulta las suscripciones y facturas del Customer Sandbox y corrige el estado
local. Es útil cuando un webhook se perdió o durante soporte. No imprime
secretos.

### Configuración del Dashboard

Antes de habilitar el flujo en un entorno:

1. Confirma que el endpoint remoto apunta a
   `https://<backend>/api/v1/stripe/webhook/` y que solo recibe los eventos
   listados arriba.
2. Configura el signing secret del endpoint en `STRIPE_WEBHOOK_SECRET` del
   despliegue; es distinto del listener local.
3. Revisa branding, nombre público, logo y política de privacidad del Customer
   Portal.
4. Confirma que el Customer Portal solo permite cancelación al final del periodo
   y actualización de pago; no habilites cambio de plan ni pausa.
5. Verifica que el producto Sandbox y sus dos precios sigan activos.
6. Define las variables del backend en el panel del servicio. No pongas claves
   Stripe en el frontend.
7. Mantén el entorno en Test Mode.

### Riesgos y límites de producción

- No hay impuestos, CFDI, facturación fiscal ni conciliación contable.
- No se implementan reintentos propios ni correos de cobranza; se delega en
  Stripe. La política local solo acota el acceso.
- No se permite cambio de plan ni pausa desde el portal.
- La configuración del Customer Portal se cachea 23 h si no se define
  `STRIPE_PORTAL_CONFIGURATION_ID`; en un entorno estable conviene fijar el ID.
- Las claves de prueba deben rotarse si se comparten. Se recomienda migrar a
  claves restringidas `rk_test_` con permisos mínimos.
- La suite de integración real con Test Clock no se ejecuta en CI por defecto;
  se documenta como verificación manual/Sandbox para no depender de red ni de
  credenciales.
- No cambiar a claves live sin una fase separada de cumplimiento fiscal, CFDI,
  impuestos, conciliación y revisión de seguridad.

### Verificación

La lógica de checkout, webhooks, estados, gracia, portal y reconciliación se
verifica con la suite del backend. Para una prueba manual en Sandbox, consulta
[desarrollo local](./desarrollo-local.md#stripe-sandbox).

La comprobación de solo lectura del catálogo Sandbox se ejecuta con:

```bash
python tools/verify_stripe_sandbox.py
```

Requiere `STRIPE_SECRET_KEY` de test y el Price ID mensual; el anual es
opcional. Verifica que los objetos sean de Test Mode, estén activos y conserven
monto, divisa e intervalo. No crea ni modifica objetos. El workflow manual
`.github/workflows/stripe-sandbox.yml` ejecuta esta comprobación con secretos del
repositorio.

### Migraciones

El esquema de Stripe y los precios se aplican con el procedimiento controlado
de [operaciones](./operaciones.md#migraciones). No se debe asumir el estado de
las migraciones por la documentación: compruébalo con `showmigrations core` y
`migrate --plan` antes de operar.
