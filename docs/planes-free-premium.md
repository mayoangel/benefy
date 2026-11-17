# Planes Free y Premium

**Estado:** implementado en backend, portal web y Supabase (16 de noviembre de 2026).
**Alcance:** capacidades, límites, cambios de plan y migraciones. Stripe, cobros y
facturación siguen fuera de esta entrega.

El plan pertenece al **negocio**, no al usuario. Una cuenta puede administrar
varios negocios con planes distintos. Los roles `dueno`, `supervisor`,
`empleado` y el privilegio global `admin_sistema` son independientes del plan.

## Límites iniciales

| Recurso | Free | Premium |
|---|---:|---:|
| Sucursales activas | 1 | 5 |
| Programas de puntos activos | 1 | 1 |
| Tarjetas de sellos activas | 2 | 10 |
| Recompensas activas | 5 | 30 |
| Supervisores activos | 1 | 5 |
| Empleados activos | 3 | 20 |
| Clientes, visitas y cupones | Ilimitados | Ilimitados |

Los límites se guardan en `PlanSuscripcion.limites` y pueden ajustarse desde
Django Admin o por el CRUD administrativo sin crear una migración:

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

Reglas de representación:

- `null` significa ilimitado explícito.
- `0` significa recurso no permitido.
- Un entero positivo es el máximo de recursos activos.
- Una clave ausente, desconocida o un valor inválido es un error de
  configuración; nunca se interpreta como ilimitado.

Solo los recursos **activos** consumen cupo. La reactivación vuelve a validar el
límite. La regla existente de un único programa de puntos activo por negocio se
mantiene con su restricción de base de datos.

## Modelos

### `PlanSuscripcion`

Nivel comercial (`free`, `premium`) con `nombre`, `descripcion`, `orden`,
`limites`, `caracteristicas` y `status`. No se agregó `es_gratuito` porque el
código estable `free` ya lo identifica; evitamos información duplicada.

### `PlanPrecio`

Modalidad de cobro separada del nivel comercial: `plan`, `intervalo`
(`mensual`/`anual`), `stripe_price_id` opcional, `monto`, `divisa` y `status`.
Premium tiene una fila mensual y otra anual con los mismos límites. Free no
requiere precio. Las referencias Stripe pueden quedar vacías.

### `Suscripcion`

Relación negocio-plan con `status`, `origen` (`manual`, `stripe`, `migracion`,
`automatico`), `fecha_inicio`, `fecha_fin`, periodos opcionales, cancelación y
referencias Stripe opcionales. Solo `activa` y `prueba` conceden capacidades.
Una cancelación programada puede conservar `activa` con `en_cancelacion=true`
hasta el final del periodo.

Restricción de Postgres: una sola suscripción vigente por negocio
(`una_suscripcion_vigente_por_negocio`). Los cambios cierran la anterior como
`cancelada` y crean la nueva en una transacción.

### `PlanCambioAuditoria`

Registra negocio, plan anterior, plan nuevo, origen, motivo, actor, correo del
actor y fecha. Se crea al asignar Free a un negocio nuevo, al migrar negocios
existentes y en cada cambio manual.

## Asignación de Free

Al crear un negocio por API, dentro de la misma transacción se crea el negocio,
la membresía de dueño y una suscripción Free activa con origen `automatico`.
Si el plan Free no existe, la operación falla: no se asume acceso ilimitado.

La migración `0012` asignó Free a los negocios existentes sin suscripción
vigente, sin modificar saldos, cupones, visitas, ciclos ni canjes.

## Servicio centralizado

`core/services/planes.py` concentra las reglas:

```python
plan_actual(negocio)
limite(negocio, recurso)
uso_actual(negocio, recurso)
puede_crear(negocio, recurso, cantidad=1)
verificar_capacidad(negocio, recurso, cantidad=1, ...)
tiene_caracteristica(negocio, clave)
resumen_plan(negocio)
```

La comprobación de capacidad bloquea la fila del negocio con
`select_for_update()` dentro de una transacción. Dos altas simultáneas no pueden
consumir el mismo último cupo.

## Aplicación de límites

`ResourceAccessMixin` valida antes de crear o reactivar:

| Operación | Recurso |
|---|---|
| Crear o reactivar sucursal | `sucursales` |
| Crear o reactivar tarjeta (`Dinamica.tipo='sellos'`) | `tarjetas_sellos` |
| Crear o reactivar recompensa | `recompensas` |
| Crear o reactivar membresía de supervisor | `supervisores` |
| Crear o reactivar membresía de empleado | `empleados` |

La comprobación también se aplica a quien tenga `admin_sistema`: el plan es del
negocio. Editar un recurso que sigue activo en la misma categoría no consume un
cupo nuevo.

Error estable, HTTP `403`:

```json
{
  "codigo": "limite_plan",
  "detalle": "El plan actual no permite crear más recompensas."
}
```

## Endpoints

| Método | Ruta | Acceso | Uso |
|---|---|---|---|
| GET | `/api/v1/planes/` | Usuario activo | Catálogo Free/Premium, límites, características y precios |
| GET | `/api/v1/negocios/{id}/plan/` | Miembros del negocio o admin | Plan, suscripción, uso, cupos, características y excedentes |
| POST | `/api/v1/negocios/{id}/plan/` | Solo `admin_sistema` | Cambio manual con `plan_codigo` y `motivo` |
| GET | `/api/v1/negocios/{id}/plan/cambios/` | Miembros del negocio o admin | Historial auditado de cambios |

`GET /api/v1/mi/contexto/` incluye un resumen compacto del plan en cada negocio
accesible. No expone negocios ni planes de terceros.

## Cambios de plan

- **Free → Premium:** se cierra la suscripción Free y se crea Premium activa en
  la misma transacción. Los límites nuevos aplican de inmediato. No se borra ni
  transforma ningún dato.
- **Premium → Free:** se conservan visitas, saldos, lotes, movimientos, cupones,
  canjes, ciclos, recompensas y auditorías. Los recursos por encima del límite
  quedan como **excedentes**: se consultan y operan, pero no se permiten nuevas
  altas que aumenten el exceso. No hay desactivaciones automáticas.
- Los ciclos de tarjeta ya iniciados conservan sus condiciones y pueden
  terminar. La selección manual de qué tarjetas quedan habilitadas para iniciar
  nuevos ciclos requiere una pantalla administrativa y queda como flujo
  pendiente; por ahora se bloquean nuevas altas de tarjetas si el negocio supera
  el límite.
- El cambio manual exige `admin_sistema`, un motivo y queda auditado. Un dueño
  no puede activar Premium manipulando una solicitud HTTP.

## Interfaz web

El portal muestra:

- plan actual y etiqueta Free/Premium;
- uso y límite de cada recurso con barra de progreso;
- “Límite alcanzado” y advertencia de excedentes;
- funciones Premium con estados “Disponible”, “Incluida · próximamente” o
  “Premium · próximamente”;
- CTA informativo “Conocer Premium” para Free.

No existe checkout ni botón que simule un pago. Las funciones avanzadas sin
implementación no se presentan como operativas (`caracteristicas_implementadas`
está vacío en esta fase). La única diferencia funcional actual es la capacidad.

## Migraciones aplicadas

| Migración | Contenido |
|---|---|
| `0011_planes_esquema` | Modelos `PlanPrecio` y `PlanCambioAuditoria`, campos de plan/suscripción y restricciones |
| `0012_planes_datos` | Free y Premium, límites, precios vacíos, Free para negocios existentes y auditoría inicial |
| `0013_planes_restricciones` | `codigo` obligatorio/único y retiro de campos legacy (`intervalo`, `stripe_price_id`, límites antiguos) |

Se aplicaron primero en PostgreSQL local y después en Supabase, con respaldo
verificado. No se eliminaron tablas, filas ni datos de lealtad.

## Pendiente para Stripe y siguientes fases

1. Precios reales, moneda y periodicidad de Premium.
2. Stripe Checkout, webhooks y sincronización de `stripe_price_id` /
   `stripe_subscription_id`.
3. Renovaciones, pruebas, cancelación al final del periodo y downgrade
   programado.
4. Pantalla administrativa para elegir tarjetas habilitadas tras un downgrade y
   regularizar sucursales o equipo excedentes.
5. Analíticas avanzadas, exportación, personalización y alianzas: están
   configuradas como capacidades Premium, pero todavía no implementadas.
