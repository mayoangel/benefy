# Planes Free y Premium

El plan pertenece al **negocio**, no al usuario. Una cuenta puede administrar
varios negocios con planes distintos. Los roles `dueno`, `supervisor`,
`empleado` y el privilegio global `admin_sistema` son independientes del plan.
Stripe, cobros y facturación no están implementados.

## Límites iniciales

| Recurso | Free | Premium |
| --- | ---: | ---: |
| Sucursales activas | 1 | 5 |
| Programas de puntos activos | 1 | 1 |
| Tarjetas de sellos activas | 2 | 10 |
| Recompensas activas | 5 | 30 |
| Supervisores activos | 1 | 5 |
| Empleados activos | 3 | 20 |
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
  "empleados": 3
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
| `Suscripcion` | Negocio y plan con `status`, `origen` (`manual`, `stripe`, `migracion`, `automatico`), fechas, cancelación y referencias Stripe opcionales |
| `PlanCambioAuditoria` | Negocio, plan anterior y nuevo, origen, motivo, actor, correo y fecha |

Solo `activa` y `prueba` conceden capacidades. Una cancelación programada puede
conservarse `activa` con `en_cancelacion=true` hasta el final del periodo. Una
restricción de Postgres impide más de una suscripción vigente por negocio; los
cambios cierran la anterior y crean la nueva en una transacción.

Premium tiene una fila mensual y otra anual con los mismos límites. Free no
requiere precio.

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
Premium con su estado de disponibilidad y un CTA informativo “Conocer Premium”
para Free. No existe checkout ni botón que simule un pago; la única diferencia
funcional actual es la capacidad.

## Alianzas

`alianzas` es una característica Premium que ya tiene implementación operativa.
El negocio origen necesita Premium para proponer; ambos negocios necesitan
Premium para aceptar. Un negocio Free puede consultar solicitudes recibidas y
mejorar de plan para responder. Los beneficios se crean como recompensas del
negocio que los ofrece y solo se muestran en el catálogo mientras la alianza
está activa y vigente.

## Pendiente

1. Precios reales, moneda y periodicidad de Premium.
2. Stripe Checkout, webhooks y sincronización de `stripe_price_id` /
   `stripe_subscription_id`.
3. Renovaciones, pruebas, cancelación al final del periodo y downgrade
   programado.
4. Pantalla para elegir tarjetas habilitadas y regularizar sucursales o equipo
   excedentes.
5. Analítica avanzada, exportación y personalización: configuradas como
   capacidades Premium, todavía sin implementación operativa.

Migraciones: `0011` (esquema), `0012` (datos y Free para negocios existentes) y
`0013` (restricciones y retiro de campos legacy), aplicadas en local y Supabase.
