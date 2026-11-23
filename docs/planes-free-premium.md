# Planes Free y Premium

El plan pertenece al **negocio**, no al usuario. Una cuenta puede administrar
varios negocios con planes distintos. Los roles `dueno`, `supervisor`,
`empleado` y el privilegio global `admin_sistema` son independientes del plan.
Premium se contrata con Stripe Checkout/Billing exclusivamente en Sandbox/Test
Mode. No se procesa dinero real ni se emiten facturas fiscales. Ver
[Facturación Stripe Sandbox](./facturacion-stripe-sandbox.md).

## Límites iniciales

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

## Alianzas

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

## Pendiente

1. Aplicar migraciones en Supabase remoto con respaldo y autorización expresa.
2. Configurar el endpoint de webhooks y el signing secret del despliegue.
3. Impuestos, CFDI y conciliación contable: fuera de esta fase.
4. Pantalla para elegir tarjetas habilitadas y regularizar sucursales o equipo
   excedentes.
5. Analítica avanzada, exportación y personalización: configuradas como
   capacidades Premium, todavía sin implementación operativa.

Migraciones: `0011` (esquema), `0012` (datos y Free para negocios existentes),
`0013` (restricciones y retiro de campos legacy), `0018` (cupos y capacidades de
alianzas), `0019` (esquema Stripe Sandbox) y `0020` (precios 399/3,990). Las
migraciones `0019` y `0020` solo se aplicaron en PostgreSQL local aislado; no en
Supabase remoto.
