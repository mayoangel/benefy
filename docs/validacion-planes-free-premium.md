# Validación de planes Free y Premium

**Fecha:** 16 de noviembre de 2026.
**Alcance:** migraciones, conservación de datos, límites, cambios de plan y E2E
con JWT reales de Supabase. No incluye Stripe ni cobros.

## Respaldo previo

Se creó un respaldo personalizado antes de aplicar las migraciones:

| Dato | Valor |
|---|---|
| Archivo | `benefy_supabase_pre_planes_20261116.dump` |
| Ubicación local | `C:\Users\angel\AppData\Local\Temp\opencode\benefy-backups\` |
| Formato | `pg_dump -Fc` (esquema + datos, sin propietarios ni privilegios) |
| Tamaño | 458,922 bytes |
| SHA-256 | `1F846E3ECAE66D06B2F83EC25951B61507064FBDEFF135B5A21F8577E30CFF26` |
| Entradas de datos | 71 |
| Tablas públicas | 31 |

Verificación: se restauró únicamente el esquema `public` en una base local
temporal y se compararon los conteos con el preflight. La restauración terminó
con código 0 y la base temporal se eliminó después. Los conteos coincidieron:

| Tabla | Preflight | Restauración |
|---|---:|---:|
| Usuarios | 7 | 7 |
| Negocios | 1 | 1 |
| Sucursales | 1 | 1 |
| Visitas | 5 | 5 |
| Cupones | 6 | 6 |
| Canjes | 1 | 1 |
| Ciclos de tarjeta | 9 | 9 |

No se imprimieron contraseñas, tokens ni claves.

## Preflight de Supabase

- Migraciones aplicadas: `0001`–`0010`.
- `PlanSuscripcion`: 0 filas.
- `Suscripcion`: 0 filas.
- Suscripciones vigentes duplicadas: ninguna.
- Periodos inválidos: ninguno.
- Negocios sin suscripción vigente: 1.

No había datos ambiguos que impidieran las restricciones.

## Migraciones

Aplicadas primero en PostgreSQL local y después en Supabase:

| Migración | Resultado |
|---|---|
| `0011_planes_esquema` | OK |
| `0012_planes_datos` | OK |
| `0013_planes_restricciones` | OK |

Comprobaciones posteriores:

- `manage.py check`: sin incidencias.
- `makemigrations --check --dry-run`: sin cambios.
- `showmigrations core`: `0001`–`0013` aplicadas en ambos entornos.
- Índice único parcial `una_suscripcion_vigente_por_negocio` creado.
- Restricciones `suscripcion_periodo_valido`, `suscripcion_fechas_validas` y
  `precio_unico_por_intervalo` creadas.
- `codigo` y `nombre` de plan únicos.
- Suscripciones vigentes duplicadas: ninguna.

## Estado posterior en Supabase

Planes configurados:

- **Free:** 1 sucursal, 1 programa de puntos, 2 tarjetas de sellos, 5
  recompensas, 1 supervisor, 3 empleados.
- **Premium:** 5 sucursales, 1 programa de puntos, 10 tarjetas, 30 recompensas,
  5 supervisores, 20 empleados.
- Premium tiene modalidades mensual y anual, sin precio ni `stripe_price_id`.

El negocio existente recibió Free con origen `migracion`. Después del E2E se
restauró a Free: conserva una suscripción activa y dos suscripciones históricas
canceladas (Premium de prueba y Free anterior). La auditoría registra los tres
cambios.

Conteos posteriores, idénticos al preflight:

| Tabla | Filas |
|---|---:|
| Usuarios | 7 |
| Negocios | 1 |
| Sucursales | 1 |
| Membresías | 2 |
| Dinámicas | 3 |
| Recompensas | 5 |
| Visitas | 5 |
| Cupones | 6 |
| Canjes | 1 |
| Ciclos de tarjeta | 9 |
| Saldos | 4 |
| Lotes de puntos | 6 |
| Movimientos de puntos | 7 |

## Pruebas automatizadas

- Django: **153 pruebas OK** (incluye configuración).
- Cobertura nueva: catálogo, contexto con plan, Free automático, fallback Free
  sin suscripción, configuración inválida, límites de sucursales, tarjetas,
  recompensas, supervisores y empleados, recursos inactivos, reactivación,
  edición sin consumo nuevo, concurrencia del último cupo, cambio de plan,
  permisos, auditoría, unicidad vigente, estados cancelados, dos negocios con
  planes distintos, downgrade con conservación de cupones y ciclos, y
  aislamiento.
- `npm run typecheck` y `npm run build`: OK.

## E2E con JWT reales

### API: 24/24

Incluye:

- login de `admin@benefy.com`, `business@benefy.com` y `user@benefy.com`;
- contexto con plan Free para el negocio y sin negocios para el consumidor;
- catálogo Free/Premium;
- consulta de plan por el dueño;
- `user` recibe `403` al consultar un plan ajeno;
- el dueño no puede activar Premium;
- Free rechaza una segunda sucursal con `403 limite_plan`;
- el admin activa Premium (límite 5) y el dueño crea una sucursal adicional;
- limpieza de la sucursal creada;
- restauración a Free y auditoría de tres cambios;
- métricas de lealtad intactas (5 visitas).

### Navegador: 12/12

Con Playwright y Microsoft Edge:

- redirección sin sesión;
- dashboard de dueño con métricas reales;
- panel de plan, uso de seis recursos, etiqueta “Plan Free” y CTA informativo;
- funciones futuras mostradas como “Premium · próximamente”, no disponibles;
- navegación a visitas;
- persistencia de sesión tras recargar;
- logout y bloqueo del portal;
- panel global con el plan de cada negocio;
- acceso restringido del consumidor;
- error de credenciales;
- recuperación de contraseña con la llamada interceptada.

## Montaje demo

- Backend y web reconstruidos con el código nuevo.
- Backend, web y base saludables.
- `https://localhost/health/db/`: `200`.
- SPA: `200`.
- No se modificó el esquema `auth` de Supabase ni se ejecutaron operaciones
  destructivas.

## Pendiente

Stripe, precios definitivos, checkout, webhooks, renovación automática,
downgrade programado y la pantalla de regularización de excedentes. Las
funciones Premium de analítica avanzada, exportación, personalización y alianzas
siguen sin implementación operativa.
