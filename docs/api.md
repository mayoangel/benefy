# API actual

Rutas de `backend/config/urls.py` y `backend/core/urls.py`. Los campos y
validaciones están en `backend/core/serializers.py`; el alcance de acceso, en
`backend/core/access.py` y `permissions.py`.

## Direcciones y autenticación

| Entorno | Base de la API |
| --- | --- |
| Desarrollo y demostración | `http://localhost:8001/api/v1` |
| Dentro de la red Compose | `http://backend:8000/api/v1` |

Todas las rutas de negocio requieren `Authorization: Bearer <access_token>` de
Supabase y un perfil Benefy activo. La única excepción es el alta propia, que
admite una identidad verificada sin perfil. Las sesiones de Django Admin no
autentican la API. Consulta [autenticación y permisos](./autenticacion.md).

## Patrón CRUD

Una ruta independiente por operación; no hay ViewSets ni router automático.

| Acción | Método | Patrón |
| --- | --- | --- |
| Crear | POST | `/api/v1/{singular}/crear/` |
| Listar | GET | `/api/v1/{plural}/listar/` |
| Detalle | GET | `/api/v1/{singular}/detalle/{id}/` |
| Actualizar | PUT o PATCH | `/api/v1/{singular}/actualizar/{id}/` |
| Eliminar | DELETE | `/api/v1/{singular}/eliminar/{id}/` |

`{id}` es la PK entera de Django, no un UUID ni un QR. Conserva la barra final.
PUT exige los campos requeridos del serializer; PATCH permite actualización
parcial.

| Modelo | Singular | Plural |
| --- | --- | --- |
| Usuario | `usuario` | `usuarios` |
| CategoriaNegocio | `categoria-negocio` | `categorias-negocio` |
| Negocio | `negocio` | `negocios` |
| Sucursal | `sucursal` | `sucursales` |
| UsuarioNegocio | `usuario-negocio` | `usuarios-negocio` |
| Dinamica | `dinamica` | `dinamicas` |
| Alianza | `alianza` | `alianzas` |
| Recompensa | `recompensa` | `recompensas` |
| RegistroActividad | `registro-actividad` | `registros-actividad` |
| ProgresoUsuario | `progreso-usuario` | `progresos-usuario` |
| CuponUsuario | `cupon-usuario` | `cupones-usuario` |
| Canje | `canje` | `canjes` |
| PlanSuscripcion | `plan-suscripcion` | `planes-suscripcion` |
| Suscripcion | `suscripcion` | `suscripciones` |
| Pago | `pago` | `pagos` |
| Notificacion | `notificacion` | `notificaciones` |

Los 16 recursos suman 80 rutas. Su existencia no concede todas las operaciones a
todos los roles: pagos y suscripciones limitan la escritura al `admin_sistema`;
el CRUD genérico de alianzas es de solo lectura y la gestión pasa por el flujo de
dueños. Las escrituras genéricas de `registro-actividad`, `progreso-usuario`,
`cupon-usuario`, `canje` y `alianza` responden `405`; esos datos solo se crean o
modifican con los endpoints transaccionales correspondientes.

## Identidad

| Método | Ruta | Uso |
| --- | --- | --- |
| GET | `/api/v1/autenticacion/perfil/` | Perfil local del usuario autenticado |
| PATCH | `/api/v1/autenticacion/perfil/` | Edita nombre, apellido, teléfono y foto del perfil propio |
| POST | `/api/v1/mi/cuenta/eliminar/` | Baja idempotente: anonimiza y revoca la identidad Supabase |
| GET | `/api/v1/mi/contexto/` | Perfil, membresías, negocios, sucursales y `puede_portal` |
| POST | `/api/v1/negocios/{id}/benef-ai/chat/` | Chat de solo lectura con Benef AI; exige membresía y rate limit |
| PATCH | `/api/v1/usuario/rol/{id}/` | Cambiar `rol` o `is_active`; solo `admin_sistema` |

Hay 126 rutas de API en total. El login, registro de identidad, refresh y logout
ocurren en Supabase Auth, no bajo `/api/v1`. `usuario/crear/` crea el perfil
Benefy después del login.

### Perfil propio

```http
PATCH /api/v1/autenticacion/perfil/
Authorization: Bearer <access_token>
Content-Type: application/json

{"nombre":"Ana","apellido":"Pérez","telefono":"6640000000","foto_perfil":"https://..."}
```

Solo admite `nombre`, `apellido`, `telefono` y `foto_perfil`. El correo es la
identidad de Supabase y es de solo lectura en el MVP. Enviar `correo`, `rol`,
`supabase_uid`, `qr_token` o `is_active` responde `400`.

La foto debe ser una URL pública del bucket de avatares de Supabase Storage,
dentro de la carpeta del `supabase_uid` autenticado. Django valida host, bucket,
carpeta, tipo MIME y tamaño mediante una petición `HEAD`. El contrato y las
políticas RLS están en [avatares en Supabase Storage](./supabase-storage-avatares.md).

### Baja de cuenta

```http
POST /api/v1/mi/cuenta/eliminar/
Authorization: Bearer <access_token>
Content-Type: application/json

{"confirmacion":"Eliminar mi cuenta"}
```

Desactiva la cuenta, anonimiza los datos personales, expira puntos/cupones
utilizables, desactiva membresías y conserva el historial transaccional
justificado. Después limpia los avatares del usuario en Supabase Storage y
elimina la identidad de Supabase Auth con la service role key del servidor. Es
idempotente y responde `202` si Storage o la identidad de Supabase quedan
pendientes de reintento.

Rechaza con `409`:

- `propietario_activo`: el usuario es el único propietario activo de uno o más negocios activos;
- `cuenta_admin`: una cuenta `admin_sistema` no puede autoeliminarse.

Procedimiento completo en [eliminación de cuenta](./eliminacion-cuenta.md).

`GET /api/v1/mi/contexto/` es la fuente de verdad del portal: devuelve `usuario`,
`es_admin_sistema`, `puede_portal`, `membresias`, `negocios` y `sucursales`, con
un resumen del plan de cada negocio. Solo incluye membresías activas de negocios
y sucursales habilitados. Un consumidor sin membresías recibe `puede_portal:
false` y listas vacías; `admin_sistema` recibe los negocios activos de la
plataforma. Los guards de React no sustituyen los permisos de Django.

### Benef AI

`POST /api/v1/negocios/{id}/benef-ai/chat/` es el único punto de entrada del
portal al asistente. Requiere bearer de Supabase, membresía efectiva en el
negocio, mensaje de hasta 2000 caracteres e historial de hasta 12 turnos y 12000
caracteres. Rechaza `admin_sistema` y consumidores sin membresía. Aplica
`THROTTLE_BENEF_AI_CHAT` (20/hour por defecto) y reenvía a Benef AI con firma
HMAC-SHA256, timestamp y token de servicio. La respuesta es
`{"answer": "...", "tools_used": ["metricas"]}`. Los detalles de arquitectura,
errores y configuración están en [Benef AI en el dashboard](./benef-ai-chat.md).

## Planes y límites

| Método | Ruta | Acceso y uso |
| --- | --- | --- |
| GET | `/api/v1/planes/` | Usuario activo; catálogo Free/Premium con límites y precios |
| GET | `/api/v1/negocios/{id}/plan/` | Miembros o admin; plan vigente, uso, cupos y excedentes |
| POST | `/api/v1/negocios/{id}/plan/` | Solo `admin_sistema`; requiere `plan_codigo` y `motivo` |
| GET | `/api/v1/negocios/{id}/plan/cambios/` | Miembros o admin; historial auditado |

Crear o reactivar recursos por encima del plan responde `403`:

```json
{"codigo": "limite_plan", "detalle": "El plan actual no permite crear más recompensas."}
```

Aplica a sucursales, tarjetas de sellos (`Dinamica` tipo `sellos`), recompensas,
supervisores y empleados. Los recursos inactivos no consumen cupo. Reglas y
política de downgrade en [planes Free y Premium](./planes-free-premium.md).

## Suscripción y facturación Sandbox

Requieren propietario (`dueno`) o `admin_sistema`; supervisores, empleados y
consumidores reciben `403`.

| Método | Ruta | Uso |
| --- | --- | --- |
| GET | `/api/v1/negocios/{id}/facturacion/` | Plan, precios, límites, estado Stripe, aviso demo e historial |
| POST | `/api/v1/negocios/{id}/facturacion/checkout/` | `{"intervalo":"mensual"}` o `"anual"`; devuelve URL de Checkout |
| POST | `/api/v1/negocios/{id}/facturacion/portal/` | Devuelve URL temporal del Customer Portal |
| POST | `/api/v1/negocios/{id}/facturacion/sincronizar/` | Reconcilia desde Stripe; `session_id` opcional |
| POST | `/api/v1/stripe/webhook/` | Público; valida la firma Stripe sobre el body original |

El precio nunca se acepta desde React: solo el intervalo. Un intento con Premium
vigente responde `409 premium_activo`. El webhook rechaza firmas inválidas y
eventos `livemode=true`. Detalle de estados, gracia y Customer Portal en
[Facturación Stripe Sandbox](./facturacion-stripe-sandbox.md).

## Registro comercial

```http
POST /api/v1/onboarding/comercial/
Authorization: Bearer <access_token>
```

Crea de forma idempotente perfil, negocio, membresía `dueno` y plan Free. Solo se
permite una vez por UUID de Supabase; los reintentos devuelven el mismo negocio
con `ya_existia: true`. Los metadatos aportan datos, nunca roles ni permisos.
Códigos: `sin_registro_comercial`, `registro_incompleto`, `registro_invalido`,
`perfil_requiere_vinculacion`, `correo_negocio_en_uso`.

## Imágenes de negocio

| Método | Ruta | Acceso |
| --- | --- | --- |
| POST | `/api/v1/negocios/{id}/imagenes/subida/` | Dueño del negocio o `admin_sistema`; solicita autorización de subida |

La solicitud declara el tipo de imagen, el MIME y el tamaño local:

```json
{"tipo":"logo","content_type":"image/webp","size_bytes":240000}
```

La respuesta incluye `bucket`, `path`, `token`, `public_url`, `content_type`,
`max_bytes` y `expires_in`. El cliente usa `bucket`, `path` y `token` con
`supabase.storage.from(bucket).uploadToSignedUrl(path, token, archivo,
{contentType, upsert: false})`. Luego debe guardar `public_url` en el campo
correspondiente mediante `PATCH /api/v1/negocio/actualizar/{id}/`.

La firma se crea únicamente después de verificar que el usuario puede
administrar el negocio. Los permisos de subida directa a ese bucket no se
conceden a `anon` ni a todos los usuarios `authenticated`; consulta
[imágenes de negocio en Supabase Storage](./supabase-storage-negocios.md).
Formatos permitidos, tamaño máximo y vigencia se devuelven en la respuesta; el
backend vuelve a verificar host, ruta, tipo y tamaño del objeto al guardar la
URL. El límite de solicitudes predeterminado es 20 por hora y usuario.

## Operaciones del portal

| Método | Ruta | Acceso y uso |
| --- | --- | --- |
| GET | `/api/v1/negocios/{id}/visitas/` | Miembros; supervisor/empleado solo su sucursal |
| GET | `/api/v1/negocios/{id}/cupones/` | Propietario o admin; cupones emitidos |
| GET | `/api/v1/negocios/{id}/canjes/` | Miembros; canjes por alcance |
| GET | `/api/v1/negocios/{id}/clientes/` | Propietario o admin; clientes agregados |
| POST | `/api/v1/negocios/{id}/tarjetas/` | Propietario o admin; tarjeta y recompensa meta en una transacción |

Las consultas aceptan `desde`, `hasta`, `sucursal`, `estado`, `buscar`, `page` y
`page_size` cuando aplica. La respuesta paginada usa `{count, next, previous,
results}`; clientes usa `{count, page, page_size, results}`.

`GET /api/v1/sucursales/listar/` y `GET /api/v1/negocio/detalle/{id}/` incluyen
`qr_uuid` para que el portal genere los QR imprimibles de sucursal y de negocio.
El valor se envía tal cual a `POST /api/v1/visitas/registrar/`; no es una URL ni
un token de un solo uso. El QR del negocio completo también se acepta en el
registro de visitas.

## Invitaciones

| Método | Ruta | Acceso y uso |
| --- | --- | --- |
| GET / POST | `/api/v1/negocios/{id}/invitaciones/` | Propietario, supervisor o admin; lista o invita por correo (no crea membresía) |
| GET | `/api/v1/invitaciones/{token}/` | Invitado o admin; consulta la invitación |
| POST | `/api/v1/invitaciones/{token}/aceptar/` | Invitado autenticado; crea la membresía tras validar el correo |
| POST | `/api/v1/invitaciones/{token}/revocar/` | Propietario, supervisor o admin; revoca una invitación pendiente |

Solo un `admin_sistema` puede invitar a otro propietario. El sistema impide
dejar un negocio sin propietario activo.

## Alianzas comerciales

El CRUD genérico de `alianza` es de solo lectura. El portal usa el flujo
bilateral, disponible solo para propietarios de los negocios; Free puede recibir
y aceptar, y Premium además puede proponer.

| Método | Ruta | Uso |
| --- | --- | --- |
| GET | `/api/v1/alianzas/?negocio={id}&vista=recibidas` | Solicitudes recibidas pendientes |
| GET | `/api/v1/alianzas/?negocio={id}&vista=enviadas` | Solicitudes enviadas pendientes |
| GET | `/api/v1/alianzas/?negocio={id}&vista=activas` | Alianzas vigentes |
| GET | `/api/v1/alianzas/?negocio={id}&vista=historial` | Rechazadas y finalizadas |
| GET | `/api/v1/alianzas/descubrir/?negocio={id}&q=&categoria=` | Directorio público de comercios elegibles |
| POST | `/api/v1/alianzas/solicitudes/` | Propuesta con condición y fechas |
| GET | `/api/v1/alianzas/{id}/?negocio={id}` | Detalle, eventos y beneficios |
| POST | `/api/v1/alianzas/{id}/aceptar/` | Solo el dueño receptor |
| POST | `/api/v1/alianzas/{id}/rechazar/` | Solo el dueño receptor |
| POST | `/api/v1/alianzas/{id}/finalizar/` | Cualquiera de los dos dueños |
| POST | `/api/v1/alianzas/{id}/recompensas/` | Beneficio de uno de los negocios participantes |

Crear una propuesta requiere `alianzas_proponer`, disponible en Premium. Un
negocio Free sí puede recibir, aceptar, rechazar, finalizar y administrar los
beneficios del negocio que ofrece. Al aceptar se valida el cupo de ambos
negocios: Free permite 1 alianza activa total; Premium permite 1 activa con
negocios Free, 3 con negocios Premium y 4 en total. Las solicitudes pendientes no
consumen cupo y una alianza finalizada o vencida lo libera. La validación bloquea
ambos negocios en orden de PK dentro de una transacción.

```text
pendiente -> activa
pendiente -> rechazada
activa -> finalizada
```

La condición se guarda en `Alianza.condicion_participacion`. Los beneficios
estructurados son `Recompensa` con `alianza` y `negocio`; cada negocio ofrece
los suyos, puede administrarlos con `PATCH /api/v1/recompensa/actualizar/{id}/`
y el catálogo solo los muestra mientras la alianza está activa y vigente. No se
comparten clientes, ventas ni datos privados entre negocios.

La propuesta incluye `negocio`, `negocio_destino`, `condicion_participacion`,
`fecha_inicio` y `fecha_fin` en ISO 8601. Las respuestas de listado y detalle
incluyen los nombres y datos públicos de ambos negocios, la dirección relativa
al negocio consultado (`enviada` o `recibida`), los eventos y los beneficios.
El administrador puede consultar, pero no responder por los negocios.

## Roles

| Nivel | Valores |
| --- | --- |
| Rol global | `consumidor`, `admin_sistema` |
| Membresía de negocio | `dueno`, `supervisor`, `empleado` |

Todos los usuarios activos pueden consumir. El acceso a un negocio se obtiene
exclusivamente por una membresía activa. El alias `admin` se acepta
temporalmente en membresías y se guarda como `supervisor`. La matriz completa
está en [autenticación](./autenticacion.md#matriz-de-permisos).

## Motor de lealtad

| Método | Ruta | Acceso y uso |
| --- | --- | --- |
| POST | `/api/v1/visitas/resolver/` | Consumidor; resuelve el comercio de un QR sin registrar la visita |
| POST | `/api/v1/visitas/registrar/` | Consumidor; visita con QR de negocio o sucursal |
| GET | `/api/v1/mi/billetera/` | Consumidor; saldos, tarjetas en curso y cupones |
| GET | `/api/v1/mi/historial/` | Consumidor; visitas, movimientos y canjes propios |
| GET | `/api/v1/negocios/descubrir/` | Consumidor; directorio paginado de negocios activos |
| GET | `/api/v1/negocios/{id}/catalogo/` | Autenticado; datos públicos del negocio y recompensas adquiribles |
| POST | `/api/v1/cupones/adquirir/` | Consumidor; adquiere un cupón con puntos |
| POST | `/api/v1/cupones/{uuid}/canjear/` | Dueño del cupón; canje irreversible |
| POST | `/api/v1/admin/puntos/ajustar/` | `admin_sistema`; ajuste auditado |
| POST | `/api/v1/admin/visitas/{id}/anular/` | `admin_sistema`; anula visita con motivo |
| POST | `/api/v1/admin/cupones/{uuid}/anular/` | `admin_sistema`; anula cupón con motivo |
| GET | `/api/v1/negocios/{id}/metricas/` | Dueño, supervisor, empleado o admin; métricas por rango |

### Directorio de negocios para consumidores

```http
GET /api/v1/negocios/descubrir/?q=cafe&categoria=3&page=1&page_size=20
Authorization: Bearer <access_token>
```

Devuelve solo negocios `status=true`, con sucursales activas. Campos públicos:
`id`, `nombre`, `slug`, `descripcion`, `direccion`, `telefono`, `logo_url`,
`banner_url`, `categoria` y `sucursales` (`id`, `nombre`, `direccion`, `ciudad`).
No expone `qr_uuid`, `correo`, `stripe_id` ni datos internos.

- `q` busca en nombre, descripción, dirección y sucursales activas.
- `categoria` filtra por ID; un valor no numérico responde
  `400 categoria_invalida`.
- `page` y `page_size` usan paginación DRF (`count`, `next`, `previous`,
  `results`); `page_size` máximo es 50.

### Campos enriquecidos del móvil

`GET /api/v1/mi/billetera/` y `GET /api/v1/mi/historial/` mantienen sus campos
anteriores y agregan `negocio_nombre`, `negocio_slug` y `negocio_logo_url` en
saldos, tarjetas, cupones, movimientos y visitas. Las visitas y canjes también
incluyen `sucursal_nombre`. El catálogo agrega `slug`, `descripcion`, `direccion`,
`telefono`, `banner_url` y `categoria` del negocio.

`GET /api/v1/cupones-usuario/listar/` agrega `negocio_nombre`, `negocio_slug`,
`negocio_logo_url`, `uuid`, `titulo_beneficio`, `descripcion_beneficio`,
`tipo_beneficio`, `descuento_beneficio`, `condiciones_beneficio`,
`costo_pagado`, `fecha_emision` y `fecha_expiracion`.
`GET /api/v1/notificaciones/listar/` incluye `cuerpo`, `leida` y `fecha_envio`
para que la bandeja móvil no dependa de datos locales.

### Resolver QR antes de registrar

```http
POST /api/v1/visitas/resolver/
Authorization: Bearer <access_token>
Content-Type: application/json

{"qr_uuid":"3f1c2a9e-8f4b-4f2a-9c1d-2b7e6a5d4c3b"}
```

Devuelve el negocio, la sucursal —o `null` si es el QR del negocio completo— y
`puede_registrar`. No crea visitas ni consume el límite diario. Un QR inexistente
responde `404 qr_invalido`; un negocio o sucursal inactivos responden
`403 negocio_inactivo`.

### Registrar visita

```http
POST /api/v1/visitas/registrar/
Authorization: Bearer <access_token>
Content-Type: application/json

{"qr_uuid":"3f1c2a9e-8f4b-4f2a-9c1d-2b7e6a5d4c3b","metodo_validacion":"qr"}
```

La primera visita del día responde `201` con los puntos otorgados, las tarjetas
avanzadas y los cupones emitidos. Un segundo intento el mismo día responde `200`:

```json
{
  "visita": {"id": 101, "fecha_negocio": "2026-11-14"},
  "already_registered": true,
  "puntos_otorgados": 0,
  "tarjetas": [],
  "cupones_emitidos": []
}
```

### Adquirir y canjear cupones

```http
POST /api/v1/cupones/adquirir/
Authorization: Bearer <access_token>

{"recompensa": 12, "clave_idempotencia": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"}
```

La clave de idempotencia es obligatoria. Reutilizarla con la misma recompensa
devuelve el mismo cupón con `200`; usarla con otra recompensa u operación
devuelve `409 conflicto_idempotencia`.

```http
POST /api/v1/cupones/9a8b7c6d-5e4f-4a3b-2c1d-0e9f8a7b6c5d/canjear/
Authorization: Bearer <access_token>
```

El canje responde con `token_validacion`, `expira_en`, `servidor_ahora` y
`duracion_segundos`. El cupón queda `canjeado` en la misma transacción y no
puede reactivarse.

### Errores de lealtad

| Código | HTTP | Caso |
| --- | --- | --- |
| `qr_invalido` | 404 | QR no encontrado |
| `negocio_inactivo` | 403 | Negocio o sucursal inactivos |
| `puntos_insuficientes` | 409 | Saldo menor al costo |
| `sin_stock` | 409 | Recompensa agotada |
| `recompensa_inactiva` | 409 | Recompensa retirada |
| `recompensa_vencida` | 409 | Vigencia no disponible |
| `cupon_no_disponible` | 409 | Cupón canjeado, anulado o vencido |
| `cupon_no_encontrado` | 404 | UUID inexistente |
| `cupon_ajeno` | 403 | Cupón de otro usuario |
| `conflicto_idempotencia` | 409 | Clave reutilizada con otros parámetros |
| `saldo_negativo` | 409 | Ajuste que dejaría saldo negativo |
| `alianza_vencida` | 409 | Alianza fuera de vigencia |
| `alianza_duplicada` | 409 | Ya existe una solicitud pendiente o alianza activa |
| `alianza_ya_respondida` | 409 | La solicitud ya fue aceptada o rechazada |
| `alianza_no_activa` | 409 | Se intentó operar una alianza no activa |
| `sin_permiso_alianza` | 403 | El usuario no es dueño de un negocio participante |

Formato: `{"codigo":"...","detalle":"..."}`.

### Métricas por negocio y sucursal

```http
GET /api/v1/negocios/1/metricas/?desde=2026-11-01&hasta=2026-11-15&sucursal=3
Authorization: Bearer <access_token>
```

Las fechas son ISO y usan la zona horaria del negocio. Sin `sucursal`, el dueño y
`admin_sistema` obtienen el consolidado (`alcance: "negocio"`). Un supervisor o
empleado recibe solo sus sucursales autorizadas (`alcance: "sucursal"`); pedir
otra responde `403`. Al filtrar por sucursal, `puntos_otorgados`,
`puntos_consumidos`, `cupones_emitidos` y `tarjetas_completadas` devuelven `null`
porque esas entidades no tienen sucursal propia. Nunca se mezclan totales del
negocio con datos de una sucursal.

## Lecturas y errores

Los listados devuelven arreglos JSON sin paginación, filtros por periodo,
ordenamiento ni búsqueda (salvo las operaciones del portal y el directorio
móvil). Parámetros como `?negocio=` o `?page=` no modifican el resultado genérico.
Los serializers de crear, listar, detalle, actualización y borrado pueden exponer
campos distintos.

| Código | Significado habitual |
| --- | --- |
| 200 | Lectura o actualización exitosa |
| 201 | Registro creado |
| 204 | Eliminación exitosa, sin cuerpo |
| 400 | Datos inválidos o campos restringidos |
| 401 | Falta bearer, token inválido/vencido, correo sin confirmar o perfil desactivado |
| 403 | Identidad sin perfil en ruta protegida, o acción sin permisos |
| 404 | ID inexistente o recurso fuera del alcance |
| 405 | Método no admitido por esa ruta |
| 409 | Perfil ya existente, correo por vincular o conflicto de lealtad |
| 503 | Supabase Auth no configurado o no disponible |

Errores estables de baja de cuenta:

| Código | HTTP | Caso |
| --- | --- | --- |
| `confirmacion_invalida` | 400 | No se escribió la frase exacta de confirmación |
| `propietario_activo` | 409 | El usuario es el único propietario activo de un negocio activo |
| `cuenta_admin` | 409 | Una cuenta `admin_sistema` intenta autoeliminarse |
| `cuenta_inactiva` | 409 | La cuenta ya no está activa |
| `supabase_no_configurado` | 503 | Falta la service role key o la URL de Supabase |
| `categoria_invalida` | 400 | El filtro de categoría del directorio no es numérico |

Los errores DRF pueden aparecer como `{"detail":"..."}`, listas de mensajes o
errores por campo. Los endpoints de lealtad añaden un `codigo` estable. Nunca
distingas permisos por el texto de un mensaje.

## Rutas fuera de la API de negocio

| Método y ruta | Descripción |
| --- | --- |
| `GET /` en Django | Alias de liveness `{"service":"backend","status":"ok"}`; no consulta la base |
| `GET /health/live/` | Liveness; no consulta PostgreSQL |
| `GET /health/db/` | Readiness; consulta PostgreSQL y responde `503` si falla |
| `GET /health/ready/` | Alias de readiness |
| `/admin/` en Django | Admin con sesión staff propia; `ADMIN_ENABLED=False` lo desactiva |
| `GET /` en Benef AI | Estado del microservicio en el puerto 5001 local |

Benef AI documenta su API en `/docs`; el backend Django no genera OpenAPI.

## Límites funcionales

- Registrar actividades no calcula puntos/sellos ni actualiza progreso.
- Los CRUD de saldo/cupón no sustituyen los servicios de acumulación y emisión.
- Crear un canje por CRUD no consume el cupón de forma atómica; usa
  `POST /cupones/{uuid}/canjear/`.
- No hay métricas agregadas avanzadas, ranking, exportaciones ni envío push.
- Los pagos son de demostración Stripe Sandbox; no hay CFDI, impuestos ni cobros
  reales.
