# Facturación Stripe Sandbox

Benefy simula la contratación y administración de Premium con Stripe Payments,
Stripe Billing y Customer Portal **exclusivamente en Sandbox/Test Mode**. Esta
fase no procesa dinero real, no usa claves live, no emite CFDI y no calcula
impuestos.

## Alcance

- Free permanece gratuito.
- Premium se contrata mensual ($399 MXN) o anual ($3,990 MXN).
- El precio y el Price ID provienen del catálogo Django (`PlanPrecio`), nunca del
  navegador.
- Stripe Checkout crea la suscripción; los webhooks verificados son la fuente de
  verdad del plan.
- El Customer Portal permite consultar facturas de prueba, actualizar el método
  de pago y cancelar al final del periodo.
- Un downgrade a Free no elimina alianzas ni cupones existentes.

No se modifican `mobile-app` ni `benef-ai`.

## Herramientas Stripe

- Stripe CLI `1.55.14`, instalada con `npm install -g @stripe/cli@latest`.
- `stripe agent setup -y` detectó OpenCode sin plugin propio e instaló 11 skills
  oficiales en `.agents/skills` (herramientas locales ignoradas por Git).
- El MCP remoto oficial (`https://mcp.stripe.com`) se agregó a la configuración
  global de OpenCode. Su autenticación OAuth queda pendiente:
  `opencode mcp auth stripe`.
- `stripe tools plan` requiere una cuenta compatible. En el Sandbox usado
  respondió `Unrecognized request URL` para el endpoint del planner, por lo que
  la arquitectura se contrastó con la documentación oficial y las skills
  `stripe-best-practices` / `stripe-implementation-planner`.
- SDK Python `stripe==17.1.0`, usando `StripeClient` y la API
  `2026-11-18.endive`.

## Variables de entorno

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

## Catálogo

`PlanPrecio` conserva el monto, divisa, intervalo y `stripe_price_id`. La
migración `0020_precios_premium_399` fija:

- Premium mensual: `399.00 MXN`, intervalo `month`.
- Premium anual: `3990.00 MXN`, intervalo `year`.

El comando idempotente siguiente valida el producto y los Price IDs reales de
Sandbox y actualiza el catálogo:

```bash
python manage.py configurar_stripe_sandbox
```

También crea o reutiliza la configuración del Customer Portal y muestra su ID
`bpc_...`. El comando rechaza claves live y productos que no sean de Stripe.

## Arquitectura

### Modelos

| Modelo | Función |
| --- | --- |
| `ClienteStripe` | Relación negocio ↔ Customer por modo (`test`/`live`) |
| `CheckoutStripe` | Sesión Checkout, snapshot de monto, idempotencia y estado |
| `EventoStripe` | Idempotencia de webhooks sin guardar el payload sensible |
| `Suscripcion` | Se amplió con `stripe_mode`, `stripe_status`, `stripe_price_id`, `gracia_fin` y último evento |
| `Pago` | Se amplió con estado pendiente/anulado, estado de factura, intentos, periodo y fecha de pago |

`Negocio.stripe_id` es una columna legacy sin separación de entorno y **no se
usa** para esta integración.

### Servicio central

`core/services/facturacion.py` concentra:

- validación estricta de Test Mode y `livemode=false`;
- creación/reutilización del Customer;
- validación del Price del catálogo contra Stripe (monto, divisa, intervalo);
- Checkout idempotente con bloqueo de la fila del negocio;
- Customer Portal con cancelación `at_period_end`;
- sincronización de suscripciones y facturas;
- procesamiento idempotente de webhooks y reconciliación.

## Endpoints

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

## Checkout

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

## Webhooks y estados

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

### Mapeo de suscripción

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

## Customer Portal

`crear_sesion_portal()` usa `STRIPE_PORTAL_CONFIGURATION_ID` o crea una
configuración idempotente con:

- historial de facturas habilitado;
- actualización de método de pago habilitada;
- cancelación habilitada solo `at_period_end`;
- actualización de plan y pausa deshabilitadas;
- `return_url` al portal de Benefy.

El regreso con `?portal=return` solo llama a sincronización. No cambia el plan
por el parámetro de la URL.

## Reconciliación

```bash
python manage.py reconciliar_stripe
python manage.py reconciliar_stripe --negocio-id 123
```

Consulta las suscripciones y facturas del Customer Sandbox y corrige el estado
local. Es útil cuando un webhook se perdió o durante soporte. No imprime
secretos.

## Pruebas

### Unitarias e integración de Django

```bash
python dev.py test-backend --local
```

Cubren, entre otros:

- propietario Free inicia Checkout y usuarios ajenos/consumidores reciben `403`;
- Checkout exitoso, pago rechazado y precio manipulado;
- firma inválida, evento live, evento duplicado y fuera de orden;
- renovación, cancelación programada, cancelación inmediata verificada y
  downgrade;
- portal con cancelación al final del periodo;
- negocio con Premium existente;
- idempotencia de pagos/eventos y persistencia de IDs Stripe;
- concurrencia de Checkout;
- alianzas y cupones conservados después del downgrade.

### Frontend

```bash
cd frontend-web
npm test
npm run typecheck
npm run build
```

### Sandbox real

Se ejecutó un flujo real con Test Clock sobre PostgreSQL local aislado:

1. Checkout real en `mode=subscription` con el Price mensual del catálogo.
2. Cliente, sesión, suscripción e invoice IDs persistidos con `stripe_mode=test`.
3. Alta Premium por webhook (`customer.subscription.created` / `invoice.paid`).
4. Renovación simulada con Test Clock y segundo pago de `399.00 MXN`.
5. Cancelación programada: Premium conservado.
6. Avance al fin del periodo: `customer.subscription.deleted`, downgrade a Free.

No se aplicaron migraciones ni se crearon suscripciones en Supabase remoto.

## Cómo probar manualmente

1. Configura las claves de Sandbox en `.env` y ejecuta:
   `python manage.py configurar_stripe_sandbox`.
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

## Configuración pendiente en Stripe Dashboard

1. Confirmar que el endpoint remoto apunta a
   `https://<backend>/api/v1/stripe/webhook/` y que solo recibe los eventos
   listados arriba.
2. Configurar el signing secret del endpoint remoto en
   `STRIPE_WEBHOOK_SECRET` del despliegue (distinto del listener local).
3. Revisar branding, nombre público, logo y política de privacidad del Customer
   Portal en el Sandbox.
4. Confirmar que el Customer Portal solo permite cancelación al final del
   periodo y actualización de pago; no habilitar cambio de plan ni pausa.
5. Verificar que el producto Sandbox y sus dos precios sigan activos.
6. Crear variables en Railway (backend) y Cloudflare Pages solo con valores
   públicos si alguna vez se requieren; nunca `STRIPE_SECRET_KEY` ni
   `STRIPE_WEBHOOK_SECRET` en el frontend.
7. Mantener el entorno en Test Mode. No cambiar a live sin una fase separada de
   cumplimiento fiscal, CFDI, impuestos, conciliación y revisión de seguridad.

## Migraciones y despliegue

- `0019_stripe_sandbox_esquema`: modelos/campos Stripe.
- `0020_precios_premium_399`: precios definitivos.
- Se aplicaron y probaron solo en PostgreSQL local aislado.
- **No** se aplicaron en Supabase remoto. Antes de hacerlo: revisar el plan de
  migración, crear respaldo recuperable, validar dependencias/restricciones y
  ejecutar la suite sobre PostgreSQL aislado con autorización explícita.
- La migración no modifica suscripciones históricas ni pagos existentes; solo
  agrega columnas/tablas y fija precios del catálogo.

## Riesgos y limitaciones

- No hay impuestos, CFDI, facturación fiscal ni conciliación contable.
- No se implementan reintentos propios ni correos de cobranza; se delega en
  Stripe. La política local solo acota el acceso.
- No se permite cambio de plan ni pausa desde el portal.
- El planner oficial no está disponible en este Sandbox; el MCP remoto requiere
  OAuth antes de exponer herramientas al agente.
- La configuración del Customer Portal se cachea 23 h si no se define
  `STRIPE_PORTAL_CONFIGURATION_ID`; en producción Sandbox conviene fijar el ID.
- Las claves de prueba deben rotarse si se comparten. Se recomienda migrar a
  claves restringidas `rk_test_` con permisos mínimos.
- La suite de integración real con Test Clock no se ejecuta en CI por defecto;
  se documenta como verificación manual/Sandbox para no depender de red ni de
  credenciales.
