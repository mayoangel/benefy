# Referencia de la API actual

Esta guía describe las rutas de `backend/config/urls.py` y `backend/core/urls.py`.
Los campos y validaciones concretos están en `backend/core/serializers.py`;
el alcance de acceso está en `backend/core/access.py` y `permissions.py`.

## Direcciones y autenticación

| Entorno | Base de la API |
| --- | --- |
| Desarrollo Docker | `http://localhost:8000/api/v1` |
| Demostración con Caddy | `https://localhost/api/v1` |
| Dentro de la red Compose | `http://backend:8000/api/v1` |
| Túnel o dominio público | URL HTTPS del túnel o del dominio configurado en Caddy |

Todas las rutas de negocio requieren `Authorization: Bearer <access_token>`
de Supabase y un perfil Benefy activo. El alta propia admite una identidad
verificada que todavía no tenga perfil. Las sesiones de Django Admin no
autentican peticiones API. Consulta [autenticación y permisos](./autenticacion.md).

## Patrón CRUD conservado

El equipo utiliza una ruta independiente por operación. No hay ViewSets,
router automático ni archivo `urls_v2.py` activo.

| Acción | Método | Patrón |
| --- | --- | --- |
| Crear | POST | `/api/v1/{singular}/crear/` |
| Listar | GET | `/api/v1/{plural}/listar/` |
| Detalle | GET | `/api/v1/{singular}/detalle/{id}/` |
| Actualizar | PUT o PATCH | `/api/v1/{singular}/actualizar/{id}/` |
| Eliminar | DELETE | `/api/v1/{singular}/eliminar/{id}/` |

`{id}` es la PK entera de Django; no es `supabase_uid`, UUID de cupón ni QR.
Conserva la barra final. PUT utiliza los campos requeridos del serializer;
PATCH permite actualización parcial, siempre que los permisos lo permitan.

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

Los 16 recursos suman 80 rutas. Su existencia no concede todas las operaciones
a todos los roles: por ejemplo, el CRUD de escritura de pagos, suscripciones,
alianzas, progreso y cupones queda reservado al administrador del sistema.

Las escrituras genéricas de `registro-actividad`, `progreso-usuario`,
`cupon-usuario` y `canje` están deshabilitadas y responden `405`. Estos datos
solo se crean o modifican mediante los endpoints transaccionales de lealtad.

## Rutas adicionales de identidad

| Método | Ruta | Uso |
| --- | --- | --- |
| GET | `/api/v1/autenticacion/perfil/` | Perfil local del usuario autenticado |
| GET | `/api/v1/mi/contexto/` | Perfil, membresías, negocios y sucursales accesibles y `puede_portal` |
| PATCH | `/api/v1/usuario/rol/{id}/` | Cambiar `rol` o `is_active`; solo `admin_sistema` |

Hay 106 rutas de API en total. Las tres anteriores no sustituyen los CRUD.
El login, registro de identidad, refresh y logout ocurren en Supabase Auth,
no bajo `/api/v1`. `usuario/crear/` crea el perfil Benefy después del login.

### Contexto del portal

```http
GET /api/v1/mi/contexto/
Authorization: Bearer <access_token>
```

Devuelve `usuario`, `es_admin_sistema`, `puede_portal`, `membresias`,
`negocios` y `sucursales`. Las membresías incluyen el rol comercial y la
sucursal asignada. Cada negocio incluye un resumen compacto de su plan
(`codigo`, `nombre`, `orden`). Solo aparecen membresías activas cuyo negocio y
sucursal (esta última si aplica) estén habilitados. Un consumidor sin membresías
recibe `puede_portal: false` y listas vacías. `admin_sistema` recibe los negocios
y sucursales activos de la plataforma. Es la fuente de verdad para decidir qué
dashboard mostrar; los guards de React no sustituyen los permisos de Django.

## Planes y límites

| Método | Ruta | Acceso | Uso |
| --- | --- | --- | --- |
| GET | `/api/v1/planes/` | Usuario activo | Catálogo Free/Premium con límites, características y precios |
| GET | `/api/v1/negocios/{id}/plan/` | Miembros del negocio o admin | Plan vigente, uso, cupos y excedentes |
| POST | `/api/v1/negocios/{id}/plan/` | Solo `admin_sistema` | Cambio manual; requiere `plan_codigo` y `motivo` |
| GET | `/api/v1/negocios/{id}/plan/cambios/` | Miembros del negocio o admin | Historial auditado de cambios |

Los negocios nuevos reciben Free en la misma transacción que el negocio y la
membresía de dueño. Los límites iniciales y la política de downgrade están en
[planes Free y Premium](./planes-free-premium.md).

Al crear o reactivar recursos por encima del plan, el backend responde `403`:

```json
{
  "codigo": "limite_plan",
  "detalle": "El plan actual no permite crear más recompensas."
}
```

Los límites se aplican en sucursales, tarjetas de sellos (`Dinamica` tipo
`sellos`), recompensas, supervisores y empleados. Los recursos inactivos no
consumen cupo. El programa de puntos conserva su regla de uno activo por negocio.

## Registro comercial

```http
POST /api/v1/onboarding/comercial/
Authorization: Bearer <access_token>
```

Completa de forma idempotente el perfil, negocio, membresía `dueno` y plan Free
usando los datos de registro de la identidad verificada. Solo se permite una vez
por UUID de Supabase; los reintentos devuelven el mismo negocio con
`ya_existia: true`. Los metadatos aportan datos, nunca roles ni permisos.

Códigos: `sin_registro_comercial`, `registro_incompleto`, `registro_invalido`,
`perfil_requiere_vinculacion`, `correo_negocio_en_uso`.

## Operaciones del portal

| Método | Ruta | Acceso | Uso |
| --- | --- | --- | --- |
| GET | `/api/v1/negocios/{id}/visitas/` | Miembros | Visitas paginadas; supervisor/empleado solo su sucursal |
| GET | `/api/v1/negocios/{id}/cupones/` | Propietario/admin | Cupones emitidos paginados |
| GET | `/api/v1/negocios/{id}/canjes/` | Miembros | Canjes paginados por alcance |
| GET | `/api/v1/negocios/{id}/clientes/` | Propietario/admin | Clientes con visitas, puntos y cupones agregados |
| POST | `/api/v1/negocios/{id}/tarjetas/` | Propietario/admin | Crea tarjeta de sellos y recompensa meta en una transacción |

Las consultas aceptan `desde`, `hasta`, `sucursal`, `estado`, `buscar`, `page` y
`page_size` cuando aplica. La respuesta paginada usa
`{count, next, previous, results}`; clientes usa `{count, page, page_size, results}`.

## Invitaciones

| Método | Ruta | Acceso | Uso |
| --- | --- | --- | --- |
| GET | `/api/v1/negocios/{id}/invitaciones/` | Propietario, supervisor o admin | Lista invitaciones del alcance |
| POST | `/api/v1/negocios/{id}/invitaciones/` | Propietario, supervisor o admin | Invita por correo; no crea membresía |
| GET | `/api/v1/invitaciones/{token}/` | Invitado o admin | Consulta la invitación |
| POST | `/api/v1/invitaciones/{token}/aceptar/` | Invitado autenticado | Crea la membresía tras validar el correo |
| POST | `/api/v1/invitaciones/{token}/revocar/` | Propietario, supervisor o admin | Revoca una invitación pendiente |

La membresía no se concede antes de la aceptación. Solo un administrador puede
invitar a otro propietario. El sistema impide dejar un negocio sin propietario
activo.

## Roles

| Nivel | Valores |
|---|---|
| Rol global | `consumidor`, `admin_sistema` |
| Membresía de negocio | `dueno`, `supervisor`, `empleado` |

Todos los usuarios activos pueden usar los endpoints de consumidor. El acceso
a un negocio se obtiene exclusivamente por una membresía activa. `admin_sistema`
es un privilegio global independiente. El alias `admin` se acepta temporalmente
en membresías y se guarda como `supervisor`.

## Motor de lealtad

| Método | Ruta | Acceso | Uso |
| --- | --- | --- | --- |
| POST | `/api/v1/visitas/registrar/` | Consumidor | Registrar visita con QR de negocio o sucursal |
| GET | `/api/v1/mi/billetera/` | Consumidor | Saldos, tarjetas en curso y cupones disponibles |
| GET | `/api/v1/mi/historial/` | Consumidor | Visitas, movimientos de puntos y canjes |
| GET | `/api/v1/negocios/{id}/catalogo/` | Autenticado | Recompensas adquiribles del negocio |
| POST | `/api/v1/cupones/adquirir/` | Consumidor | Adquirir un cupón con puntos |
| POST | `/api/v1/cupones/{uuid}/canjear/` | Dueño del cupón | Canje irreversible iniciado por el cliente |
| POST | `/api/v1/admin/puntos/ajustar/` | `admin_sistema` | Ajuste auditado de puntos |
| POST | `/api/v1/admin/visitas/{id}/anular/` | `admin_sistema` | Anular visita con motivo |
| POST | `/api/v1/admin/cupones/{uuid}/anular/` | `admin_sistema` | Anular cupón con motivo |
| GET | `/api/v1/negocios/{id}/metricas/` | Dueño, supervisor o admin | Métricas básicas por rango de fechas |

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
Content-Type: application/json

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

### Códigos de error de lealtad

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

Los errores del motor usan el formato `{"codigo":"...","detalle":"..."}`.

### Métricas por negocio y sucursal

```http
GET /api/v1/negocios/1/metricas/?desde=2026-11-01&hasta=2026-11-15&sucursal=3
Authorization: Bearer <access_token>
```

Las fechas son ISO y usan la zona horaria del negocio. Sin `sucursal`, el dueño
y `admin_sistema` obtienen el consolidado (`alcance: "negocio"`). Un supervisor
o empleado recibe solo sus sucursales autorizadas (`alcance: "sucursal"`); pedir
otra sucursal responde `403`. Si se filtra por sucursal, la respuesta incluye
`sucursales` y devuelve `null` en `puntos_otorgados`, `puntos_consumidos`,
`cupones_emitidos` y `tarjetas_completadas`, porque esas entidades no tienen
sucursal propia. Nunca se mezclan totales del negocio con datos de una sucursal.

## Ejemplo de lectura

```http
GET /api/v1/sucursales/listar/
Authorization: Bearer <access_token>
Accept: application/json
```

Un dueño ve sus sucursales; un supervisor o empleado de sucursal, las que le
permite su membresía. Un usuario sin membresías recibe una lista vacía en esta
ruta: todavía no hay un catálogo público de comercios para la aplicación móvil.

Las listas devuelven arreglos JSON y no tienen paginación, filtros por periodo,
ordenamiento configurable ni búsqueda implementados. No supongas que parámetros
como `?negocio=`, `?fecha_inicio=` o `?page=` modifican el resultado.

Los serializers de crear, listar, detalle, actualización y borrado pueden
exponer campos diferentes. No presupongas que el JSON de listado es el mismo
del detalle o que todos los POST devuelven un campo `id`.

## Respuestas y errores

| Código | Significado habitual |
| --- | --- |
| 200 | Lectura o actualización exitosa |
| 201 | Registro creado |
| 204 | Eliminación exitosa, sin cuerpo |
| 400 | Datos inválidos o intento de modificar campos restringidos del perfil |
| 401 | Falta bearer, token inválido/vencido, cuenta sin correo confirmado o perfil desactivado |
| 403 | Identidad sin perfil en una ruta protegida, o acción sin permisos |
| 404 | ID inexistente o recurso fuera del alcance del usuario |
| 405 | Método no admitido por esa ruta |
| 409 | Perfil ya existente o correo que requiere vinculación manual |
| 503 | Supabase Auth no configurado o no disponible |

Los errores DRF del CRUD pueden aparecer como `{"detail":"..."}`, listas de
mensajes o errores por campo. Los endpoints del motor de lealtad añaden un
`codigo` estable (`{"codigo":"...","detalle":"..."}`); consúltalo antes que el
texto. Los textos de algunas validaciones pueden depender del idioma configurado
en Django. Nunca distingas permisos mediante el texto de un mensaje.

## Rutas fuera de la API de negocio

| Método y ruta | Descripción |
| --- | --- |
| `GET /` en Django | Estado público `{"service":"backend","status":"ok"}`; no abre conexión a la base |
| `/admin/` en Django | Interfaz administrativa con sesión staff propia |
| `GET /` en Benef AI | Estado del microservicio independiente en el puerto 5000 local |

Benef AI tiene su propia documentación FastAPI en `/docs`; eso no documenta la
API Django. El backend Django no genera actualmente Swagger/OpenAPI.

## Límites funcionales

- Registrar actividades no calcula puntos/sellos ni actualiza progreso.
- Los CRUD de saldo/cupón no sustituyen servicios de acumulación y emisión.
- Crear un canje verifica datos y operador, pero aún no consume el cupón de
  manera atómica ni bloquea canjes simultáneos.
- Los UUID/QR/NFC almacenados no equivalen a un endpoint seguro de escaneo.
- No hay métricas agregadas, ranking, exportaciones, webhooks Stripe ni envío push.
- Las rutas anteriores que usaban `create/list/detail/update/delete` fueron
  reemplazadas por acciones en español; no existen alias de compatibilidad.

Consulta el [estado de implementación](./estado-implementacion.md) antes de
diseñar clientes que dependan de esos flujos.
