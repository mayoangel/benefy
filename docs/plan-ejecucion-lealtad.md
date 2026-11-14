# Plan de ejecución — Motor de lealtad Benefy (MVP)

**Estado:** implementado en la rama `feat/lealtad-mvp`; migraciones aplicadas en local.
**Alcance:** backend de visitas, puntos, tarjetas y cupones del MVP.
**Fecha:** 14 de noviembre de 2026.

> **Resultado de la ejecución:** fases 0 a 5 implementadas. El esquema quedó en
> las migraciones `0005` a `0007`; la suite tiene 93 pruebas y cubre visitas,
> puntos, tarjetas, adquisición, canje, permisos y concurrencia PostgreSQL.
> No se ejecutaron migraciones en Supabase. La documentación operativa está en
> `docs/reglas-lealtad.md`, `docs/api.md` y `docs/autenticacion.md`.

Este documento describe el diseño técnico, las migraciones, los contratos de API, las pruebas y el orden de ejecución. No sustituye a `docs/reglas-lealtad.md`, que contendrá las reglas de negocio aprobadas; lo complementa con la implementación concreta.

---

## 1. Principios de la implementación

1. **El backend es la única autoridad.** Ninguna regla de puntos, visitas, tarjetas o cupones se valida solo en el cliente.
2. **Operaciones transaccionales.** Toda operación que modifique saldos, lotes, ciclos o cupones ocurre dentro de `transaction.atomic()` con bloqueos explícitos.
3. **Historial inmutable.** Visitas, movimientos de puntos, cupones y canjes no se editan ni se borran. Las correcciones se hacen con anulación o ajuste auditados.
4. **Condiciones congeladas.** Los ciclos de tarjeta y los cupones adquiridos conservan sus condiciones originales mediante snapshots.
5. **Idempotencia explícita.** La adquisición de cupones exige una clave generada por el cliente y reutilizada en reintentos.
6. **Migraciones separadas.** Esquema, corrección de datos y restricciones van en migraciones distintas.
7. **Sin cambios destructivos.** No se eliminan columnas, tablas ni registros históricos. `ProgresoUsuario`, `monto_transaccion` y `tipo='compra'` se conservan por compatibilidad.
8. **Pruebas antes de avanzar.** Cada fase termina con la suite completa en verde y una verificación manual mínima.

---

## 2. Decisiones aprobadas

| Tema | Decisión |
|---|---|
| Zona horaria | `America/Tijuana` por defecto, configurable por negocio |
| QR | Se soportan QR de negocio y de sucursal; la acumulación y el límite son por negocio |
| Visita diaria | Una sola visita válida por cliente y negocio, calculada con la zona del negocio |
| Tipos de registro | La restricción diaria aplica solo a `tipo='visita'` |
| Primera visita | Otorga puntos y avanza tarjetas |
| Puntos por visita | `Dinamica.regla_conversion` de la única dinámica de puntos activa |
| Tarjetas | Varias tarjetas activas; cada visita avanza un sello en cada tarjeta elegible |
| Repetición | Tarjetas repetibles o de una sola ocasión; historial de ciclos conservado |
| Recompensa de tarjeta | Una sola recompensa meta por tarjeta, garantizada en base de datos |
| Catálogo | Recompensas del negocio, con o sin dinámica |
| Expiración de cupones | Fecha explícita o duración desde la adquisición; se congela al adquirir |
| Alianzas | Fuera del MVP; solo se valida que un cupón de alianza no expire después de la alianza |
| Canje | Iniciado por el cliente, irreversible, sin confirmación del cajero |
| Pantalla de canje | 5 minutos por defecto, configurable por entorno; usa hora del backend |
| Visita duplicada | HTTP 200 con `already_registered: true`; no otorga beneficios |
| Puntos | Lotes con origen, cantidad, fecha, expiración y saldo disponible; consumo FIFO |
| Caducidad de puntos | Sin caducidad por defecto; configurable por negocio |
| Ajustes de puntos | Solo `admin_sistema`, auditados, sin saldo negativo |
| Idempotencia de adquisición | Clave obligatoria generada por el cliente y reutilizada en reintentos |
| Límite por usuario | No se implementa en el MVP |
| Eliminación | Prohibida para visitas, movimientos, adquisiciones y canjes |

---

## 3. Ajustes incorporados en esta revisión

| Ajuste solicitado | Implementación |
|---|---|
| La restricción diaria aplica solo a visitas | La restricción única parcial incluye `Q(es_valida=True, tipo='visita')` |
| Conservar condiciones de tarjetas | `CicloTarjeta` guarda meta y snapshots completos de la recompensa; los cambios posteriores no los alteran |
| Desactivar tarjeta sin borrar ciclos | La desactivación impide crear ciclos nuevos; los ciclos `en_curso` siguen avanzando y pueden completarse |
| Sincronizar saldo, lotes y movimientos | Toda variación crea movimientos y actualiza `SaldoPuntos` en la misma transacción; la expiración es idempotente por lote |
| Registrar lotes consumidos | Se crea un `MovimientoPuntos` por cada lote afectado, con referencia a la operación |
| Migraciones locales y Supabase | Se ejecutan en local; en Supabase solo con confirmación final y respaldo previo |
| Idempotencia de adquisición | `clave_idempotencia` obligatoria, única por usuario; reintentos devuelven el mismo cupón |
| Concurrencia al crear saldo o ciclo | `INSERT ... ON CONFLICT DO NOTHING` + `select_for_update`, con restricciones únicas como respaldo |
| Una recompensa meta por tarjeta | Restricción única parcial en base de datos |
| Sin `limite_por_usuario` | Se elimina del diseño del MVP |
| Anulaciones sin reversión automática | Anular visita o cupón no devuelve puntos; el ajuste es una operación separada |
| Un sello por visita | Las tarjetas avanzan exactamente 1; `regla_conversion` solo aplica a puntos |
| Esquema separado de correcciones | Migraciones `schema`, `data` y `constraints` independientes por fase |

---

## 4. Arquitectura de código

```text
backend/core/
  services/
    __init__.py
    lealtad/
      __init__.py
      errores.py        # excepciones con código y HTTP status
      visitas.py        # registrar visita y resolver QR
      puntos.py         # lotes, movimientos, saldo, FIFO, expiración, ajustes
      tarjetas.py       # ciclos, sellos, meta y emisión de cupón
      cupones.py        # adquisición, canje y anulación
      metricas.py       # consultas agregadas para el panel
  utils/
    __init__.py
    tiempo.py           # zona horaria del negocio y fecha local
  management/commands/
    expirar_puntos.py
    verificar_puntos.py
  test_lealtad_visitas.py
  test_lealtad_puntos.py
  test_lealtad_tarjetas.py
  test_lealtad_cupones.py
  test_lealtad_canje.py
  test_lealtad_permisos.py
  test_helpers.py
```

Reglas de dependencia:

- `visitas` orquesta `puntos` y `tarjetas`.
- `tarjetas` puede emitir cupones mediante `cupones.emitir_cupon_meta`.
- `cupones` usa `puntos.consumir_puntos` para adquisiciones.
- Ningún servicio importa vistas ni serializers.
- Los serializers validan forma y permisos; los servicios validan reglas de negocio.

### 4.1 Utilidades de tiempo

```python
def ahora_utc() -> datetime
def zona_del_negocio(negocio) -> ZoneInfo
def fecha_negocio(negocio, momento: datetime | None = None) -> date
```

- `ahora_utc()` devuelve `timezone.now()`.
- `fecha_negocio` convierte a la zona del negocio y devuelve la fecha local.
- Si `zona_horaria` es inválida, se usa `America/Tijuana` y se registra una advertencia; el serializer impide guardar zonas inválidas.
- `TIME_ZONE` de Django permanece en `UTC`.

---

## 5. Modelo de datos

### 5.1 Cambios en modelos existentes

#### `Negocio`

| Campo | Tipo | Reglas |
|---|---|---|
| `zona_horaria` | `CharField(64, default="America/Tijuana")` | Validada con `zoneinfo.ZoneInfo` |
| `qr_uuid` | `UUIDField(default=uuid4, unique=True, editable=False)` | QR general del negocio |

#### `Dinamica`

| Campo | Tipo | Reglas |
|---|---|---|
| `es_repetible` | `BooleanField(default=False)` | Solo aplica a `tipo='sellos'` |
| `meta` | `PositiveIntegerField(null=True)` | Obligatoria si `tipo='sellos'`; debe ser `>= 1` |
| `fecha_fin` | `DateTimeField(null=True, blank=True)` | `null` = dinámica abierta |
| `dias_expiracion_puntos` | `PositiveIntegerField(null=True)` | `null` = puntos sin caducidad |

`regla_conversion` se conserva. Para `tipo='puntos'` debe ser entera y `>= 1`; para `tipo='sellos'` se ignora porque cada visita avanza un sello. El tipo `cupones` queda como legacy y no lo usa el motor.

#### `Recompensa`

| Campo | Tipo | Reglas |
|---|---|---|
| `negocio` | `FK(Negocio, PROTECT, null=True)` | Obligatorio salvo recompensas de alianza |
| `es_meta` | `BooleanField(default=False)` | Máximo una por dinámica |
| `fecha_expiracion` | `DateTimeField(null=True)` | Alternativa a `vigencia_dias` |
| `vigencia_dias` | `PositiveIntegerField(null=True)` | Alternativa a `fecha_expiracion` |
| `cantidad_disponible` | `PositiveIntegerField(null=True)` | `null` = ilimitado |
| `limite_por_usuario` | No se implementa | Fuera del MVP |

Reglas:

- Debe existir exactamente una forma de vigencia: fecha o duración.
- Si pertenece a una dinámica con `fecha_fin`, la vigencia se recorta a esa fecha al adquirir.
- Si pertenece a una alianza, nunca puede superar `alianza.fecha_fin`.
- Una recompensa meta debe pertenecer a una dinámica y al mismo negocio.
- `on_delete=PROTECT` en `dinamica` y `alianza` para no borrar cupones adquiridos.

#### `RegistroActividad`

| Campo | Tipo | Reglas |
|---|---|---|
| `negocio` | `FK(Negocio, PROTECT)` | Obligatorio tras la migración |
| `sucursal` | `FK(Sucursal, PROTECT, null=True)` | Nula si se usó QR de negocio |
| `fecha_negocio` | `DateField(db_index=True)` | Fecha local del negocio |
| `es_valida` | `BooleanField(default=True)` | Una visita anulada no cuenta como válida |
| `anulada_en` | `DateTimeField(null=True)` | |
| `anulada_por` | `FK(Usuario, SET_NULL, null=True)` | Solo `admin_sistema` |
| `motivo_anulacion` | `TextField(null=True)` | Obligatorio al anular |

`fecha` se conserva con `auto_now_add` en UTC. `tipo` y `monto_transaccion` se conservan por compatibilidad; el motor no usa montos.

#### `CuponUsuario`

| Campo | Tipo | Reglas |
|---|---|---|
| `negocio` | `FK(Negocio, PROTECT, null=True)` | Nulo solo para alianza |
| `origen` | `CharField` | `meta`, `puntos`, `admin` |
| `ciclo` | `FK(CicloTarjeta, PROTECT, null=True)` | Cupón emitido por tarjeta |
| `titulo_beneficio` | `CharField(150)` | Snapshot |
| `descripcion_beneficio` | `TextField` | Snapshot |
| `tipo_beneficio` | `CharField(30)` | Snapshot |
| `descuento_beneficio` | `DecimalField(6,2, null=True)` | Snapshot |
| `condiciones_beneficio` | `TextField` | Snapshot |
| `costo_pagado` | `PositiveIntegerField(default=0)` | Puntos gastados |
| `clave_idempotencia` | `CharField(64, null=True)` | Única por usuario |
| `anulada_en` | `DateTimeField(null=True)` | |
| `anulada_por` | `FK(Usuario, SET_NULL, null=True)` | Solo `admin_sistema` |
| `motivo_anulacion` | `TextField(null=True)` | Obligatorio al anular |

`status` añade `anulado`. Un cupón anulado no vuelve a `disponible`.

#### `Canje`

| Campo | Tipo | Reglas |
|---|---|---|
| `cupon` | `FK(CuponUsuario, PROTECT)` | Único |
| `sucursal` | `FK(Sucursal, PROTECT, null=True)` | Nula en canje de cliente |
| `negocio` | `FK(Negocio, PROTECT)` | Negocio del cupón |
| `validado_por` | `FK(Usuario, SET_NULL, null=True)` | Nulo en canje de cliente |
| `origen` | `CharField` | `cliente`, `personal` |
| `metodo` | `CharField` | `visual`, `personal` |
| `token_validacion` | `UUIDField(unique=True, null=True)` | Pantalla de validación |
| `expira_en` | `DateTimeField(null=True)` | Fin del contador |
| `anulado` | `BooleanField(default=False)` | Corrección administrativa |
| `anulado_en`, `anulado_por`, `motivo_anulacion` | | Auditoría |

### 5.2 Modelos nuevos

#### `SaldoPuntos`

| Campo | Tipo |
|---|---|
| `usuario` | `FK(Usuario, PROTECT)` |
| `negocio` | `FK(Negocio, PROTECT)` |
| `saldo_actual` | `PositiveIntegerField(default=0)` |
| `fecha_actualizacion` | `DateTimeField(auto_now=True)` |

Es una caché del saldo. La fuente de verdad son los lotes con `cantidad_disponible > 0` no vencidos.

#### `LotePuntos`

| Campo | Tipo |
|---|---|
| `usuario` | `FK(Usuario, PROTECT)` |
| `negocio` | `FK(Negocio, PROTECT)` |
| `dinamica` | `FK(Dinamica, PROTECT, null=True)` |
| `origen` | `visita`, `ajuste`, `alianza` |
| `cantidad_otorgada` | `PositiveIntegerField` |
| `cantidad_disponible` | `PositiveIntegerField` |
| `fecha_otorgamiento` | `DateTimeField` |
| `fecha_expiracion` | `DateTimeField(null=True)` |
| `referencia` | `CharField(64, null=True)` |
| `creado_por` | `FK(Usuario, SET_NULL, null=True)` |
| `fecha_registro` | `DateTimeField(auto_now_add=True)` |

#### `MovimientoPuntos`

| Campo | Tipo |
|---|---|
| `usuario` | `FK(Usuario, PROTECT)` |
| `negocio` | `FK(Negocio, PROTECT)` |
| `lote` | `FK(LotePuntos, PROTECT, null=True)` |
| `cupon` | `FK(CuponUsuario, PROTECT, null=True)` |
| `tipo` | `otorgado`, `consumido`, `expirado`, `ajuste` |
| `cantidad` | `IntegerField` con signo |
| `referencia` | `CharField(64, null=True)` |
| `descripcion` | `CharField(255)` |
| `creado_por` | `FK(Usuario, SET_NULL, null=True)` |
| `fecha` | `DateTimeField(auto_now_add=True, db_index=True)` |

El ledger es inmutable. Cada consumo o expiración genera un movimiento por lote afectado.

#### `CicloTarjeta`

| Campo | Tipo |
|---|---|
| `usuario` | `FK(Usuario, PROTECT)` |
| `dinamica` | `FK(Dinamica, PROTECT)` |
| `negocio` | `FK(Negocio, PROTECT)` |
| `numero_ciclo` | `PositiveIntegerField` |
| `sellos_actuales` | `PositiveIntegerField(default=0)` |
| `meta` | `PositiveIntegerField` |
| `recompensa` | `FK(Recompensa, PROTECT, null=True)` |
| `recompensa_titulo` | `CharField(150)` |
| `recompensa_descripcion` | `TextField` |
| `recompensa_tipo` | `CharField(30)` |
| `recompensa_descuento` | `DecimalField(6,2, null=True)` |
| `recompensa_condiciones` | `TextField` |
| `recompensa_vigencia_dias` | `PositiveIntegerField(null=True)` |
| `recompensa_fecha_expiracion` | `DateTimeField(null=True)` |
| `estado` | `en_curso`, `completado`, `anulado` |
| `fecha_inicio` | `DateTimeField` |
| `fecha_fin` | `DateTimeField(null=True)` |
| `cupon` | `FK(CuponUsuario, PROTECT, null=True)` |
| `fecha_registro` | `DateTimeField(auto_now_add=True)` |

### 5.3 Restricciones de base de datos

| Nombre | Modelo | Definición |
|---|---|---|
| `visita_unica_diaria_por_negocio` | `RegistroActividad` | `Unique(usuario, negocio, fecha_negocio)` con `Q(es_valida=True, tipo='visita')` |
| `una_dinamica_puntos_activa_por_negocio` | `Dinamica` | `Unique(negocio)` con `Q(tipo='puntos', status=True)` |
| `una_recompensa_meta_por_dinamica` | `Recompensa` | `Unique(dinamica)` con `Q(es_meta=True)` |
| `recompensa_con_origen` | `Recompensa` | `Check(Q(negocio__isnull=False) \| Q(alianza__isnull=False))` |
| `recompensa_con_vigencia` | `Recompensa` | `Check(Q(fecha_expiracion__isnull=False) \| Q(vigencia_dias__isnull=False))` |
| `meta_requiere_dinamica` | `Recompensa` | `Check(Q(es_meta=False) \| Q(dinamica__isnull=False))` |
| `saldo_unico_por_negocio` | `SaldoPuntos` | `Unique(usuario, negocio)` |
| `lote_cantidad_coherente` | `LotePuntos` | `Check(cantidad_disponible <= cantidad_otorgada)` |
| `lote_expiracion_posterior` | `LotePuntos` | `Check(fecha_expiracion IS NULL OR fecha_expiracion >= fecha_otorgamiento)` |
| `un_lote_por_visita` | `LotePuntos` | `Unique(negocio, referencia)` con `Q(origen='visita')` |
| `una_expiracion_por_lote` | `MovimientoPuntos` | `Unique(lote)` con `Q(tipo='expirado')` |
| `un_consumo_por_lote_y_operacion` | `MovimientoPuntos` | `Unique(lote, referencia)` con `Q(tipo__in=['consumido', 'ajuste'], referencia__isnull=False)` |
| `movimiento_cantidad_no_cero` | `MovimientoPuntos` | `Check(~Q(cantidad=0))` |
| `movimiento_signo_coherente` | `MovimientoPuntos` | `Check(Q(tipo='ajuste') \| Q(tipo='otorgado', cantidad__gt=0) \| Q(tipo__in=['consumido', 'expirado'], cantidad__lt=0))` |
| `ciclo_unico_por_numero` | `CicloTarjeta` | `Unique(usuario, dinamica, numero_ciclo)` |
| `un_ciclo_en_curso` | `CicloTarjeta` | `Unique(usuario, dinamica)` con `Q(estado='en_curso')` |
| `ciclo_sellos_en_rango` | `CicloTarjeta` | `Check(sellos_actuales <= meta)` |
| `un_cupon_por_ciclo` | `CuponUsuario` | `Unique(ciclo)` con `Q(ciclo__isnull=False)` |
| `idempotencia_adquisicion_por_usuario` | `CuponUsuario` | `Unique(usuario, clave_idempotencia)` con `Q(clave_idempotencia__isnull=False)` |
| `un_canje_por_cupon` | `Canje` | `Unique(cupon)` |

### 5.4 Invariantes

1. `SaldoPuntos.saldo_actual` = suma de `cantidad_disponible` de lotes no vencidos.
2. Todo cambio de saldo tiene al menos un `MovimientoPuntos` asociado.
3. Un lote no puede expirar dos veces.
4. Un cupón no puede canjearse dos veces.
5. Un cupón emitido por tarjeta pertenece a un solo ciclo.
6. Un ciclo `en_curso` es único por usuario y dinámica.
7. Una visita válida es única por usuario, negocio y fecha local.
8. Un cupón conserva sus snapshots aunque la recompensa cambie o se desactive.
9. Un ciclo conserva su meta y snapshots aunque la dinámica cambie o se desactive.
10. Ningún ajuste puede dejar `saldo_actual < 0` ni `cantidad_disponible < 0`.

---

## 6. Reglas de negocio y flujos

### 6.1 Registro de visita

**Entrada:** usuario autenticado con rol `consumidor`, `qr_uuid`, `metodo_validacion` (`qr` por defecto).

1. Resolver el QR:
   - Buscar en `Sucursal.qr_uuid`.
   - Si no existe, buscar en `Negocio.qr_uuid`.
   - Si no existe, `404 qr_invalido`.
2. Validar que el negocio esté activo; si hay sucursal, que también esté activa.
3. Calcular `fecha_negocio` con la zona del negocio.
4. Abrir `transaction.atomic()`.
5. Insertar `RegistroActividad` con `tipo='visita'`, `es_valida=True` dentro de un savepoint.
6. Si falla por la restricción única:
   - Recuperar la visita existente.
   - Devolver HTTP 200 con `already_registered: true`.
   - No otorgar puntos ni avanzar tarjetas.
7. Si la inserción fue exitosa:
   - Bloquear o crear `SaldoPuntos` del usuario y negocio.
   - Buscar la dinámica `puntos` activa y vigente.
   - Crear `LotePuntos`, `MovimientoPuntos` y actualizar el saldo.
   - Buscar tarjetas activas y vigentes donde el usuario tenga ciclo `en_curso` o pueda iniciar uno.
   - Avanzar un sello por tarjeta y emitir cupón si se alcanza la meta.
8. Devolver HTTP 201 con el resumen.

**Regla de anulación:** una visita anulada no cuenta como válida, pero el servicio considera cualquier registro previo del día (válido o anulado) para bloquear un nuevo registro automático. Esto evita duplicar beneficios cuando la anulación no revierte puntos. La habilitación de un nuevo registro requiere una operación administrativa posterior, fuera del MVP.

**Concurrencia:** la restricción única parcial es la garantía final. Dos solicitudes simultáneas solo pueden insertar una visita válida.

### 6.2 Puntos

**Otorgamiento por visita**

- Solo si existe una dinámica `puntos` activa y vigente.
- Cantidad = `regla_conversion` entera.
- `fecha_expiracion` = `ahora + dias_expiracion_puntos` si está configurada; si no, `null`.
- Se crea un lote y un movimiento `otorgado`.
- Se actualiza `SaldoPuntos` con `F('saldo_actual') + cantidad`.

**Consumo FIFO**

1. Bloquear el saldo del usuario y negocio.
2. Ejecutar expiración perezosa.
3. Ordenar lotes con `cantidad_disponible > 0` por `fecha_expiracion ASC NULLS LAST`, luego por `fecha_otorgamiento`.
4. Consumir hasta cubrir la cantidad.
5. Por cada lote afectado: descontar `cantidad_disponible`, crear `MovimientoPuntos` con `tipo='consumido'`, `cantidad` negativa y `referencia` de la operación.
6. Actualizar el saldo una sola vez.
7. Si no alcanza, revertir la transacción con `409 puntos_insuficientes`.

**Expiración**

- Comando `expirar_puntos` y ejecución perezosa antes de operaciones de saldo.
- Por cada lote vencido con saldo disponible:
  - Bloquear el lote.
  - Crear un movimiento `expirado` con cantidad negativa.
  - Poner `cantidad_disponible=0`.
  - Descontar del saldo.
- La restricción `una_expiracion_por_lote` impide duplicados.
- Un lote vencido nunca se consume.

**Ajustes administrativos**

- Solo `admin_sistema`.
- Motivo obligatorio y clave de idempotencia obligatoria.
- Ajuste positivo: crea un lote `origen='ajuste'` sin expiración y un movimiento `ajuste` positivo.
- Ajuste negativo: consume lotes FIFO y crea movimientos `ajuste` negativos.
- Nunca permite saldo negativo.
- No edita movimientos existentes.

**Verificación de consistencia**

- Comando `verificar_puntos`: compara `SaldoPuntos.saldo_actual` con la suma de lotes disponibles no vencidos y reporta diferencias sin modificar datos.

### 6.3 Tarjetas

**Inicio de ciclo**

- En la primera visita válida a una tarjeta activa y vigente, se crea el ciclo 1.
- El ciclo copia meta y datos de la recompensa meta.
- Si la tarjeta no tiene recompensa meta, no se activa para nuevos clientes y se registra un error de configuración.

**Avance**

- Cada visita válida suma exactamente 1 sello a cada ciclo `en_curso` elegible.
- Los ciclos existentes siguen avanzando aunque la tarjeta se desactive o cambie de configuración.
- No se crean ciclos nuevos si la tarjeta está inactiva o fuera de vigencia.

**Completado**

1. Bloquear el ciclo.
2. Verificar que `sellos_actuales + 1 >= meta`.
3. Marcar `estado='completado'` y `fecha_fin`.
4. Emitir un cupón usando los snapshots del ciclo.
5. Asociar el cupón al ciclo.
6. Si `es_repetible`, crear el siguiente ciclo con la configuración vigente.
7. Si es de una sola ocasión, no crear otro ciclo.

**Cambios de configuración**

- No afectan ciclos ya iniciados.
- Solo aplican a ciclos nuevos.

**Desactivación**

- Impide iniciar ciclos nuevos.
- No elimina ciclos existentes ni cupones emitidos.
- Los ciclos `en_curso` pueden completarse.
- Cancelar ciclos existentes requiere una operación administrativa futura, fuera del MVP.

### 6.4 Adquisición de cupones

**Entrada:** `recompensa` y `clave_idempotencia` obligatoria.

1. Validar que la clave sea UUID y que el usuario sea consumidor.
2. `transaction.atomic()`.
3. Si ya existe un cupón del usuario con esa clave, devolverlo con HTTP 200.
4. Bloquear la recompensa con `select_for_update`.
5. Validar recompensa activa, negocio activo, vigencia y stock.
6. Bloquear o crear el saldo.
7. Consumir puntos FIFO.
8. Decrementar stock si es finito.
9. Calcular expiración:
   - `vigencia_dias` desde ahora, o `fecha_expiracion`.
   - Recortar a `dinamica.fecha_fin` si existe.
   - Recortar a `alianza.fecha_fin` si existe.
   - Si la fecha resultante no es futura, `409 recompensa_vencida`.
10. Crear `CuponUsuario` con snapshots y `costo_pagado`.
11. Devolver HTTP 201.

La restricción `idempotencia_adquisicion_por_usuario` y el bloqueo de stock impiden dobles adquisiciones.

### 6.5 Canje

1. Validar que el cupón pertenezca al usuario.
2. `transaction.atomic()`.
3. Bloquear el cupón con `select_for_update`.
4. Validar `status='disponible'` y que no esté vencido.
5. Crear `Canje` con `origen='cliente'`, `metodo='visual'`, `sucursal=None`, `negocio`, `token_validacion` y `expira_en = ahora + CANJE_VALIDACION_SEGUNDOS`.
6. Marcar el cupón como `canjeado`.
7. Devolver los datos de la pantalla.

No existe endpoint de confirmación posterior. El cupón se consume al confirmar. La pantalla solo presenta el beneficio.

### 6.6 Anulación administrativa

- Visita: `es_valida=False`, fecha, responsable y motivo. No revierte puntos.
- Cupón: `status='anulado'`, fecha, responsable y motivo. No devuelve puntos ni vuelve a `disponible`.
- Canje: `anulado=True`, fecha, responsable y motivo. No se borra.
- Puntos: se corrigen con un movimiento de ajuste, nunca editando el original.

---

## 7. Contratos de servicios

```python
def registrar_visita(
    *, usuario, qr_uuid, metodo_validacion="qr", ahora=None
) -> ResultadoVisita

def otorgar_puntos(
    *, usuario, negocio, cantidad, origen, referencia,
    fecha_expiracion=None, creado_por=None
) -> LotePuntos

def consumir_puntos(
    *, usuario, negocio, cantidad, referencia, cupon=None
) -> list[MovimientoPuntos]

def expirar_puntos(
    *, usuario=None, negocio=None, ahora=None
) -> int

def ajustar_puntos(
    *, usuario, negocio, cantidad, motivo, creado_por, clave_idempotencia
) -> MovimientoPuntos

def avanzar_tarjetas(
    *, usuario, negocio, ahora=None
) -> list[ResultadoTarjeta]

def adquirir_cupon(
    *, usuario, recompensa_id, clave_idempotencia
) -> CuponUsuario

def canjear_cupon(
    *, usuario, cupon_uuid, ahora=None
) -> ResultadoCanje

def anular_visita(
    *, visita_id, motivo, administrador
) -> RegistroActividad

def anular_cupon(
    *, cupon_uuid, motivo, administrador
) -> CuponUsuario
```

### 7.1 Excepciones

```python
class ErrorLealtad(Exception):
    codigo: str
    detalle: str
    http_status: int
```

Subclases: `QRInvalido`, `NegocioInactivo`, `VisitaDuplicada`, `PuntosInsuficientes`, `SinStock`, `RecompensaInactiva`, `RecompensaVencida`, `CuponNoDisponible`, `CuponAjeno`, `AlianzaVencida`, `SoloConsumidores`, `SaldoNegativo`.

### 7.2 Orden de bloqueo

Para evitar interbloqueos, todas las operaciones respetan este orden:

1. `Recompensa` (stock)
2. `SaldoPuntos`
3. `LotePuntos` (ordenados por expiración)
4. `CicloTarjeta`
5. `CuponUsuario`
6. `Canje`

La visita se inserta antes de los bloqueos de beneficios.

### 7.3 Creación concurrente de saldo y ciclo

```python
# Saldo
SaldoPuntos.objects.bulk_create(
    [SaldoPuntos(usuario=usuario, negocio=negocio)],
    ignore_conflicts=True,
)
saldo = SaldoPuntos.objects.select_for_update().get(
    usuario=usuario, negocio=negocio
)
```

Para ciclos se usa `get_or_create` dentro de `atomic()` y, si hay `IntegrityError`, se recupera el ciclo existente con `select_for_update`. Las restricciones únicas son el respaldo final.

---

## 8. API

Todas las rutas cuelgan de `/api/v1/`.

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| `POST` | `/visitas/registrar/` | Consumidor | Registra visita por QR |
| `GET` | `/mi/billetera/` | Consumidor | Saldos, tarjetas y cupones |
| `GET` | `/mi/historial/` | Consumidor | Visitas, movimientos y canjes |
| `GET` | `/negocios/<id>/catalogo/` | Consumidor | Recompensas adquiribles |
| `POST` | `/cupones/adquirir/` | Consumidor | Adquisición con puntos |
| `POST` | `/cupones/<uuid>/canjear/` | Dueño del cupón | Canje irreversible |
| `POST` | `/admin/puntos/ajustar/` | `admin_sistema` | Ajuste auditado |
| `POST` | `/admin/visitas/<id>/anular/` | `admin_sistema` | Anulación auditada |
| `POST` | `/admin/cupones/<uuid>/anular/` | `admin_sistema` | Anulación auditada |
| `GET` | `/negocios/<id>/metricas/` | Dueño/admin | Métricas básicas |

### 8.1 Registrar visita

**Request**

```json
{
  "qr_uuid": "3f1c2a9e-8f4b-4f2a-9c1d-2b7e6a5d4c3b",
  "metodo_validacion": "qr"
}
```

**201 Created**

```json
{
  "visita": {
    "id": 101,
    "negocio": 5,
    "sucursal": 3,
    "fecha_negocio": "2026-11-14",
    "puntos_otorgados": 10,
    "tarjetas": [
      {
        "dinamica": 8,
        "ciclo": 2,
        "sellos_actuales": 3,
        "meta": 5,
        "completado": false
      }
    ],
    "cupones_emitidos": []
  },
  "already_registered": false
}
```

**200 OK (duplicado)**

```json
{
  "visita": {
    "id": 101,
    "negocio": 5,
    "sucursal": 3,
    "fecha_negocio": "2026-11-14"
  },
  "already_registered": true,
  "puntos_otorgados": 0,
  "tarjetas": [],
  "cupones_emitidos": []
}
```

### 8.2 Adquirir cupón

**Request**

```json
{
  "recompensa": 12,
  "clave_idempotencia": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"
}
```

**201 Created / 200 OK en reintento**

```json
{
  "cupon": {
    "uuid": "9a8b7c6d-5e4f-4a3b-2c1d-0e9f8a7b6c5d",
    "recompensa": 12,
    "titulo": "Café gratis",
    "fecha_expiracion": "2027-01-13T23:59:59-08:00",
    "status": "disponible",
    "costo_pagado": 50
  },
  "saldo_restante": 120
}
```

### 8.3 Canjear cupón

**200 OK**

```json
{
  "canje": {
    "token_validacion": "5e4d3c2b-1a0f-4e9d-8c7b-6a5f4e3d2c1b",
    "expira_en": "2026-11-14T18:35:00Z",
    "servidor_ahora": "2026-11-14T18:30:00Z",
    "duracion_segundos": 300
  },
  "cupon": {
    "uuid": "9a8b7c6d-5e4f-4a3b-2c1d-0e9f8a7b6c5d",
    "titulo": "Café gratis",
    "descripcion": "Un café americano de 12 oz",
    "condiciones": "Válido en cualquier sucursal",
    "status": "canjeado"
  },
  "negocio": {
    "id": 5,
    "nombre": "Café Central",
    "logo_url": "https://..."
  }
}
```

### 8.4 Códigos de error

| Código | HTTP | Caso |
|---|---|---|
| `qr_invalido` | 404 | QR no encontrado |
| `negocio_inactivo` | 403 | Negocio o sucursal inactivos |
| `solo_consumidores` | 403 | Usuario sin rol consumidor |
| `puntos_insuficientes` | 409 | Saldo menor al costo |
| `sin_stock` | 409 | Recompensa agotada |
| `recompensa_inactiva` | 409 | Recompensa retirada |
| `recompensa_vencida` | 409 | Vigencia no futura |
| `cupon_no_disponible` | 409 | Cupón canjeado, anulado o vencido |
| `cupon_ajeno` | 403 | Cupón de otro usuario |
| `alianza_vencida` | 409 | Cupón de alianza fuera de vigencia |
| `saldo_negativo` | 409 | Ajuste que dejaría saldo negativo |
| `idempotencia_invalida` | 400 | Clave ausente o mal formada |

Formato:

```json
{
  "codigo": "puntos_insuficientes",
  "detalle": "El saldo disponible es menor al costo de la recompensa."
}
```

### 8.5 Escrituras deshabilitadas

Quedan solo lectura:

- `registro-actividad/*`
- `progreso-usuario/*`
- `cupon-usuario/*`
- `canje/*`

Los intentos de `POST`, `PUT`, `PATCH` o `DELETE` responden `405 Method Not Allowed`. Las lecturas conservan el alcance de `access.py`.

---

## 9. Migraciones

### 9.1 Reglas generales

1. Cada fase puede tener hasta tres migraciones:
   - `*_esquema`: campos y tablas nuevas, sin restricciones finales.
   - `*_datos`: corrección o backfill defensivo.
   - `*_restricciones`: `AlterField` a no nulo y restricciones únicas/check.
2. Los campos no nulos se añaden primero como nulos, se rellenan y luego se alteran.
3. No se eliminan columnas ni tablas.
4. Las migraciones de datos deben ser idempotentes y no fallar si no hay registros.
5. La base local está vacía; aun así se escriben las correcciones para reproducibilidad.
6. En Supabase se ejecutarán solo al final, con respaldo y confirmación final.

### 9.2 Migraciones por fase

> **Implementación real:** al no existir datos y para reducir el riesgo de
> migraciones intermedias, el esquema completo se concentró en `0005`, la
> corrección defensiva en `0006` y las restricciones en `0007`. La separación
> esquema/datos/restricciones se mantiene. La tabla siguiente conserva el plan
> original por fases.

| Fase | Migración | Tipo | Contenido |
|---|---|---|---|
| 1 | `0005_lealtad_esquema_base` | Esquema | `Negocio.zona_horaria`, `Negocio.qr_uuid`, `Dinamica.fecha_fin` nula, `Dinamica.dias_expiracion_puntos`, `RegistroActividad.negocio/sucursal/fecha_negocio/es_valida/auditoría`, `SaldoPuntos`, `LotePuntos`, `MovimientoPuntos` |
| 1 | `0006_lealtad_datos_base` | Datos | Backfill defensivo de `negocio`, `fecha_negocio` y duplicados; sin datos esperados |
| 1 | `0007_lealtad_restricciones_base` | Restricciones | `negocio` no nulo, `fecha_negocio` no nula, restricción diaria, restricciones de puntos y dinámica activa |
| 2 | `0008_tarjetas_esquema` | Esquema | `CicloTarjeta`, `Dinamica.es_repetible/meta` nula, `Recompensa.negocio/es_meta/vigencia/stock`, campos de cupón para tarjetas |
| 2 | `0009_tarjetas_datos` | Datos | Migrar `ProgresoUsuario` a `CicloTarjeta`; snapshots de cupones existentes; sin datos esperados |
| 2 | `0010_tarjetas_restricciones` | Restricciones | Una recompensa meta por dinámica, un ciclo por número, un ciclo en curso, un cupón por ciclo |
| 3 | `0011_catalogo_esquema` | Esquema | `CuponUsuario.costo_pagado`, `clave_idempotencia` |
| 3 | `0012_catalogo_datos` | Datos | Backfill de `costo_pagado=0` y snapshots faltantes |
| 3 | `0013_catalogo_restricciones` | Restricciones | Idempotencia por usuario y coherencia de vigencia de recompensas |
| 4 | `0014_canje_esquema` | Esquema | `Canje.negocio/origen/metodo/token/expira_en/sucursal nula/auditoría` |
| 4 | `0015_canje_datos` | Datos | Backfill de canjes legacy; sin datos esperados |
| 4 | `0016_canje_restricciones` | Restricciones | Un canje por cupón, token único |

### 9.3 Backfill defensivo

Aunque no haya datos, las migraciones de datos implementan:

- `RegistroActividad.negocio` desde `sucursal.negocio`.
- `fecha_negocio` desde `fecha` convertida a la zona del negocio.
- Duplicados históricos: conservar el más antiguo y marcar el resto `es_valida=False`.
- `Recompensa.negocio` desde `dinamica.negocio`.
- `CuponUsuario.negocio` y snapshots desde la recompensa.
- `Canje.negocio` desde `sucursal`, `origen='personal'`, `metodo='personal'`.
- `ProgresoUsuario` a `CicloTarjeta` con `numero_ciclo=1`.
- Si hay varias dinámicas de puntos activas, conservar la más reciente y desactivar las demás, registrando el cambio en el log de la migración.

### 9.4 Supabase

- Las migraciones se prueban primero en local y en el montaje demo.
- Antes de Supabase: respaldo, revisión del SQL y ventana de mantenimiento.
- Se usará conexión directa o session pooler para DDL; el transaction pooler no es adecuado para migraciones.
- No se ejecutará ninguna migración en Supabase sin confirmación final expresa.

### 9.5 Rollback

- Las migraciones de esquema son reversibles mientras no se eliminen datos.
- Las migraciones de datos no revierten borrados; solo se ejecutan operaciones aditivas.
- En caso de fallo en Supabase, se restaura el respaldo, no se intenta un rollback destructivo.

---

## 10. Pruebas

### 10.1 Organización

- Se conservan `core/tests.py` y `core/test_auth.py`.
- Las pruebas nuevas van en archivos `core/test_lealtad_*.py`.
- Los helpers de creación de datos van en `core/test_helpers.py`.
- Se usan `TestCase` para la mayoría y `TransactionTestCase` para concurrencia.

### 10.2 Matriz de pruebas

| Área | Casos |
|---|---|
| Visitas | Primera visita, duplicado, dos sucursales el mismo día, negocios distintos, QR inválido, negocio inactivo, sucursal inactiva, cambio de zona horaria, DST, visita anulada |
| Puntos | Otorgamiento, saldo por negocio, cambio de regla sin efecto retroactivo, FIFO por expiración, lotes sin expiración al final, expiración idempotente, verificación de consistencia |
| Tarjetas | Primera visita crea ciclo, avance de un sello, meta, repetible, una sola vez, historial, cambio de meta a mitad de ciclo, desactivación con ciclo en curso, concurrencia |
| Adquisición | Saldo insuficiente, stock finito, stock ilimitado, idempotencia, reintento, recompensa inactiva, vencimiento, recorte por dinámica, concurrencia |
| Canje | Doble canje, cupón vencido, cupón ajeno, token, expiración del contador, cupón anulado, canje sin sucursal |
| Protección | Cupón sobrevive a desactivación de recompensa y dinámica; ciclo conserva snapshots; no se borran históricos |
| Permisos | Consumidor no opera sobre otro; negocio aislado; admin autorizado; escrituras genéricas bloqueadas |
| Migraciones | `makemigrations --check`, migración desde cero, backfill defensivo |

### 10.3 Concurrencia

- `TransactionTestCase` con hilos y `connections.close_all()` en cada hilo.
- Casos:
  - Dos visitas simultáneas del mismo usuario y negocio.
  - Dos adquisiciones simultáneas con la misma clave.
  - Dos adquisiciones simultáneas del último stock.
  - Dos canjes simultáneos del mismo cupón.
  - Creación simultánea de saldo y ciclo.
- Solo se ejecutan en PostgreSQL; se omiten en otros motores.

### 10.4 Comandos

```powershell
docker compose exec backend python manage.py makemigrations --check --dry-run
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py test core
docker compose exec backend python manage.py verificar_puntos
```

---

## 11. Fases de ejecución

### Fase 0 — Documentación y andamiaje

**Objetivos**

- Crear `docs/reglas-lealtad.md` con las reglas aprobadas.
- Crear `core/services/lealtad/` y `core/utils/tiempo.py` con firmas y excepciones.
- Añadir `CANJE_VALIDACION_SEGUNDOS` a `settings.py`, `.env.example` y `.env.production.example`.
- Documentar el comando de expiración en `docs/run_project.md`.

**Entregables**

- Documentación y módulos vacíos sin lógica.
- Suite existente en verde.

**Criterio de salida**

- `python manage.py test core` pasa.
- `makemigrations --check` sin cambios.

---

### Fase 1 — Esquema base, visitas y puntos

**Objetivos**

- Migraciones `0005` a `0007`.
- Implementar `tiempo.py`, `errores.py`, `puntos.py` y `visitas.py`.
- Endpoint `POST /visitas/registrar/`.
- Endpoint `POST /admin/puntos/ajustar/`.
- Comandos `expirar_puntos` y `verificar_puntos`.

**Entregables**

- Visita con límite diario por negocio y zona horaria.
- Puntos con lotes, movimientos, saldo y FIFO.
- Respuesta 200 para duplicados.
- Ajustes auditados.

**Pruebas**

- `test_lealtad_visitas.py`
- `test_lealtad_puntos.py`
- `test_lealtad_permisos.py` (parcial)

**Criterio de salida**

- Suite completa en verde.
- Prueba manual: registrar visita, repetir, consultar saldo y ajustar puntos.
- No se modifican endpoints existentes salvo las escrituras deshabilitadas de `registro-actividad`.

---

### Fase 2 — Tarjetas y ciclos

**Objetivos**

- Migraciones `0008` a `0010`.
- Implementar `tarjetas.py`.
- Integrar el avance de tarjetas en `registrar_visita`.
- Emisión de cupón meta al completar.

**Entregables**

- Tarjetas repetibles y de una sola ocasión.
- Snapshots de meta y recompensa.
- Historial de ciclos.
- Desactivación sin borrar ciclos.

**Pruebas**

- `test_lealtad_tarjetas.py`
- Concurrencia al completar meta.

**Criterio de salida**

- Suite completa en verde.
- Prueba manual: completar una tarjeta y verificar cupón emitido.

---

### Fase 3 — Catálogo y adquisición

**Objetivos**

- Migraciones `0011` a `0013`.
- Implementar catálogo y `cupones.adquirir_cupon`.
- Endpoint `GET /negocios/<id>/catalogo/`.
- Endpoint `POST /cupones/adquirir/`.

**Entregables**

- Stock atómico, snapshots, expiración y idempotencia.
- Protección de cupones ante cambios posteriores.

**Pruebas**

- `test_lealtad_cupones.py`
- Concurrencia de stock e idempotencia.

**Criterio de salida**

- Suite completa en verde.
- Prueba manual: adquirir cupón, reintentar con la misma clave y verificar un solo cupón.

---

### Fase 4 — Canje

**Objetivos**

- Migraciones `0014` a `0016`.
- Implementar `canjear_cupon`.
- Endpoint `POST /cupones/<uuid>/canjear/`.
- Datos de pantalla de validación.

**Entregables**

- Canje irreversible iniciado por el cliente.
- Token y contador con hora del backend.
- Un solo canje por cupón.

**Pruebas**

- `test_lealtad_canje.py`
- Concurrencia de doble canje.

**Criterio de salida**

- Suite completa en verde.
- Prueba manual: canjear y verificar que un segundo intento falla.

---

### Fase 5 — Billetera, historial y métricas

**Objetivos**

- Endpoints `GET /mi/billetera/`, `GET /mi/historial/` y `GET /negocios/<id>/metricas/`.
- Anulación administrativa de visitas y cupones.
- Paginación y filtros básicos.

**Entregables**

- Consultas del cliente y del panel.
- Anulaciones auditadas.

**Pruebas**

- `test_lealtad_permisos.py`
- Pruebas de consultas y aislamiento.

**Criterio de salida**

- Suite completa en verde.
- Revisión de rendimiento de consultas principales.

---

### Fase 6 — Documentación y despliegue

**Objetivos**

- Actualizar `docs/api.md`, `docs/estado-implementacion.md`, `docs/autenticacion.md` y `docs/run_project.md`.
- Revisar `compose.yaml` y `compose.demo.yaml`.
- Preparar el despliegue a Supabase.

**Entregables**

- Documentación sincronizada.
- Lista de migraciones y respaldo.
- Confirmación final para Supabase.

**Criterio de salida**

- Suite completa en verde.
- Revisión manual de la API documentada.
- Autorización expresa para migrar Supabase.

---

## 12. Configuración

| Variable | Valor por defecto | Uso |
|---|---|---|
| `CANJE_VALIDACION_SEGUNDOS` | `300` | Duración de la pantalla de canje |
| `TIME_ZONE` | `UTC` | Django; no se cambia |
| `zona_horaria` del negocio | `America/Tijuana` | Fecha local de visitas |

La duración se lee con un helper de entorno y se valida como entero positivo. Si el valor es inválido, se usa `300` y se registra una advertencia.

---

## 13. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Doble visita por concurrencia | Restricción única parcial y savepoint |
| Doble otorgamiento de puntos | Una visita solo se inserta una vez; lote único por visita |
| Saldo descuadrado | Movimientos y saldo en la misma transacción; comando de verificación |
| Expiración duplicada | Restricción única por lote y bloqueo |
| Doble adquisición | Clave de idempotencia única y bloqueo de stock |
| Doble canje | Restricción única por cupón y bloqueo |
| Deadlocks | Orden de bloqueo documentado |
| Cambios retroactivos | Snapshots en ciclos y cupones |
| Borrado accidental | `PROTECT`, escrituras deshabilitadas y anulación auditada |
| Migración fallida en Supabase | Respaldo, prueba local, conexión directa y confirmación final |
| Serializers monolíticos | Lógica nueva en servicios; serializers solo validan forma |

---

## 14. Fuera del alcance del MVP

- Alianzas con puntos compartidos.
- Beneficios cruzados entre negocios.
- NFC.
- QR dinámicos o regenerables.
- Límite de adquisiciones por usuario.
- Cancelación administrativa de ciclos en curso.
- Analíticas avanzadas de alianzas.
- Integración con POS, pagos o montos de compra.
- Notificaciones push.
- Stripe y suscripciones.
- Benef AI.

---

## 15. Criterios de aceptación del MVP

1. Un cliente puede escanear un QR de negocio o sucursal y registrar una visita.
2. Una segunda visita del mismo día al mismo negocio responde 200 con `already_registered: true` y no otorga beneficios.
3. La primera visita otorga puntos y avanza tarjetas.
4. Los puntos se guardan en lotes y se consumen FIFO.
5. Las tarjetas respetan meta, repetición y snapshots.
6. Un cupón se adquiere de forma atómica, con stock e idempotencia.
7. Un cupón se canjea una sola vez, de forma irreversible.
8. Los cupones adquiridos sobreviven a cambios y desactivaciones.
9. Las visitas, movimientos, cupones y canjes no se editan ni se borran.
10. Los ajustes y anulaciones quedan auditados con fecha, responsable y motivo.
11. Las pruebas existentes y las nuevas pasan.
12. La documentación de API y estado queda actualizada.

---

## 16. Autorizaciones pendientes

1. **Supabase:** la instrucción de migrar está preaprobada, pero se pedirá confirmación final antes de ejecutar DDL, con respaldo previo.
2. **Cambios destructivos:** no se planea ninguno. Si una migración los requiriera, se detendrá la ejecución y se solicitará autorización.
3. **Interpretaciones operativas:** se aplican las siguientes salvo indicación contraria:
   - Una visita anulada sigue bloqueando el registro automático de una nueva visita ese día.
   - Los ciclos en curso continúan avanzando aunque la tarjeta se desactive.
   - La anulación de un cupón no devuelve puntos automáticamente.
   - Los ajustes positivos crean un lote sin expiración.
