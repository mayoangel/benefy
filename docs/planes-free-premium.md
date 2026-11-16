# Propuesta técnica: planes Free y Premium

**Estado:** análisis y diseño; no implementado.
**Objetivo:** preparar la arquitectura de suscripciones sin definir todavía límites numéricos ni integrar Stripe.

---

## 1. Modelo actual

### `PlanSuscripcion`

| Campo | Uso actual |
|---|---|
| `nombre` | Nombre del plan |
| `descripcion` | Descripción comercial |
| `intervalo` | `mensual` o `anual` |
| `stripe_price_id` | Precio de Stripe, único y obligatorio |
| `limite_sucursales` | Límite numérico |
| `limite_dinamicas` | Límite numérico |
| `status` | Activo/inactivo |

### `Suscripcion`

| Campo | Uso actual |
|---|---|
| `stripe_subscription_id` | Identificador de Stripe, único y obligatorio |
| `status` | `activa`, `pendiente`, `prueba`, `incompleta`, `cancelada` |
| `periodo_actual_inicio/fin` | Periodo de facturación |
| `en_cancelacion` | Bandera de cancelación |
| `negocio` | Negocio suscrito |
| `plan` | Plan contratado |

## 2. Diagnóstico

El modelo **puede reutilizarse**, pero hoy está acoplado a Stripe y no representa un plan gratuito:

- `PlanSuscripcion.stripe_price_id` es obligatorio y único; Free no tiene precio Stripe.
- `Suscripcion.stripe_subscription_id` es obligatorio y único; Free no tiene suscripción Stripe.
- `periodo_actual_inicio/fin` son obligatorios; Free no necesariamente tiene periodo de cobro.
- No existe un código estable de plan (`free`, `premium`).
- No hay restricción de una suscripción activa por negocio.
- Solo existen límites para sucursales y dinámicas.
- No hay servicio central de capacidades; las restricciones se implementarían de forma dispersa.
- Las membresías comerciales no dependen de la suscripción, lo cual es correcto y debe conservarse.

## 3. Arquitectura propuesta

### 3.1 Catálogo de planes

Reutilizar `PlanSuscripcion` y añadir:

| Campo nuevo | Tipo | Uso |
|---|---|---|
| `codigo` | `CharField` único | `free`, `premium` |
| `es_gratuito` | `BooleanField` | Distingue Free |
| `orden` | `PositiveIntegerField` | Orden comercial |
| `stripe_price_id` | Pasa a `null=True` | Free no lo usa |
| `limites` | `JSONField(default=dict)` | Capacidades por recurso |
| `caracteristicas` | `JSONField(default=dict)` | Flags Premium |

Los límites numéricos definitivos **no se definen todavía**. Pueden quedar `null` o vacíos hasta la decisión comercial.

Ejemplo de `limites`:

```json
{
  "sucursales": null,
  "dinamicas": null,
  "tarjetas": null,
  "recompensas": null,
  "empleados": null
}
```

Ejemplo de `caracteristicas`:

```json
{
  "analiticas_avanzadas": false,
  "exportacion": false,
  "soporte_prioritario": false
}
```

### 3.2 Suscripción del negocio

Reutilizar `Suscripcion` y añadir:

| Campo nuevo | Tipo | Uso |
|---|---|---|
| `stripe_subscription_id` | Pasa a `null=True` | Free no tiene Stripe |
| `origen` | `manual`, `stripe`, `migracion` | Procedencia |
| `fecha_inicio` | `DateTimeField(null=True)` | Inicio lógico |
| `fecha_fin` | `DateTimeField(null=True)` | Fin o downgrade programado |

Restricción:

```text
UniqueConstraint(negocio, condition=Q(status='activa'))
```

Esto garantiza una sola suscripción activa por negocio.

### 3.3 Free por defecto

Al crear un negocio:

1. Se crea la membresía de dueño.
2. Se asigna el plan Free como suscripción activa.
3. El negocio no necesita Stripe ni pago.

Los negocios existentes se migrarían a Free si no tienen suscripción activa.

## 4. Servicio de capacidades

Crear `core/services/planes.py`:

```python
plan_actual(negocio)
limite(negocio, recurso)
puede_crear(negocio, recurso, cantidad_actual)
tiene_caracteristica(negocio, clave)
```

Reglas:

- Si no hay suscripción activa, se usa Free como respaldo.
- Si un límite es `None`, se interpreta como “sin límite definido” o “pendiente de decisión”; no se debe inventar un número.
- La ausencia del plan Free en la base se considera un error de configuración, no acceso ilimitado.
- La consulta debe ser eficiente: una suscripción activa por negocio.

## 5. Endpoints y enforcement

### Consulta

| Endpoint | Uso |
|---|---|
| `GET /negocios/{id}/plan/` | Plan actual y capacidades |
| `GET /planes/` | Catálogo Free/Premium |
| `GET /mi/contexto/` | Incluir resumen de plan por negocio |

### Mutaciones donde aplicar límites

| Operación | Punto de control |
|---|---|
| Crear sucursal | `SucursalCreate` / servicio |
| Crear dinámica o tarjeta | `DinamicaCreate` |
| Crear recompensa | `RecompensaCreate` |
| Crear empleado/supervisor | `UsuarioNegocioCreate` |
| Funciones Premium | Endpoints de analíticas/exportación |

El backend debe devolver un error estable, por ejemplo:

```json
{
  "codigo": "limite_plan",
  "detalle": "El plan actual no permite crear más sucursales."
}
```

HTTP propuesto: `403` o `409`. Preferible `403` con `codigo`.

No se aplicarán límites hasta que se aprueben los números.

## 6. Cambios de plan

### Free → Premium

- Activar Premium de inmediato.
- Habilitar capacidades Premium.
- Conservar todos los datos existentes.
- En el futuro, el cobro lo gestionará Stripe.

### Premium → Free

- No eliminar ningún dato.
- No invalidar cupones, recompensas, tarjetas, visitas ni puntos.
- Los cupones ya adquiridos conservan su vigencia.
- Los recursos que excedan el nuevo límite quedan en modo lectura, sin permitir crear más.
- Las funciones Premium quedan ocultas o bloqueadas.
- El downgrade puede ser inmediato en modo manual; con Stripe se ejecutará al final del periodo.

### Política explícita para excedentes

Recomendación:

1. Nunca borrar recursos automáticamente.
2. Bloquear nuevas altas por encima del límite.
3. Mantener lectura y operación de lo existente.
4. Marcar visualmente el excedente en el panel.
5. Permitir regularizar o volver a Premium.

## 7. Frontend

- Mostrar `Free` o `Premium` en el portal.
- Mostrar CTA “Mejorar a Premium”.
- Marcar funciones Premium bloqueadas.
- No ocultar datos históricos.
- En Free, mostrar el límite y el estado de uso.
- En una fase posterior, integrar checkout de Stripe.

## 8. Migraciones propuestas

No implementadas:

```text
0011_planes_esquema
  - PlanSuscripcion.codigo/es_gratuito/orden/limites/caracteristicas
  - stripe_price_id nullable

0012_planes_datos
  - crear Free y Premium
  - asignar Free a negocios sin suscripción activa
  - migrar suscripciones existentes

0013_planes_restricciones
  - una suscripción activa por negocio
```

## 9. Decisiones pendientes

1. Límites exactos de sucursales, tarjetas, recompensas, empleados y dinámicas.
2. Funciones exclusivas de Premium.
3. Política de downgrade: inmediata o al final del periodo.
4. Precio y periodicidad de Premium.
5. Integración con Stripe y webhooks.
6. Si Free tendrá límites de cupones activos o de clientes.
7. Si las alianzas serán una capacidad Premium.

## 10. Recomendación

Para el MVP:

- Implementar Free/Premium **después** de estabilizar el portal y los dashboards.
- Reutilizar `PlanSuscripcion` y `Suscripcion`.
- No implementar Stripe todavía.
- No fijar límites numéricos hasta la decisión comercial.
- Centralizar las capacidades en un servicio y no repartir condicionales por los serializers.
- Proteger siempre los datos históricos y los cupones adquiridos.

Este documento no modifica el esquema ni las reglas actuales.
