# API actual

Rutas de `backend/config/urls.py` y `backend/core/urls.py`. Los campos y
validaciones están en `backend/core/serializers.py`; el alcance de acceso, en
`backend/core/access.py` y `permissions.py`.

## Direcciones y autenticación

| Entorno | Base de la API |
| --- | --- |
| Desarrollo Docker | `http://localhost:8000/api/v1` |
| Demostración con Caddy | `https://localhost/api/v1` |
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
todos los roles: pagos, suscripciones, alianzas, progreso y cupones limitan la
escritura al `admin_sistema`. Las escrituras genéricas de `registro-actividad`,
`progreso-usuario`, `cupon-usuario` y `canje` responden `405`; esos datos solo se
crean o modifican con los endpoints transaccionales de lealtad.

## Identidad

| Método | Ruta | Uso |
| --- | --- | --- |
| GET | `/api/v1/autenticacion/perfil/` | Perfil local del usuario autenticado |
| GET | `/api/v1/mi/contexto/` | Perfil, membresías, negocios, sucursales y `puede_portal` |
| PATCH | `/api/v1/usuario/rol/{id}/` | Cambiar `rol` o `is_active`; solo `admin_sistema` |

Hay 106 rutas de API en total. El login, registro de identidad, refresh y logout
ocurren en Supabase Auth, no bajo `/api/v1`. `usuario/crear/` crea el perfil
Benefy después del login.

`GET /api/v1/mi/contexto/` es la fuente de verdad del portal: devuelve `usuario`,
`es_admin_sistema`, `puede_portal`, `membresias`, `negocios` y `sucursales`, con
un resumen del plan de cada negocio. Solo incluye membresías activas de negocios
y sucursales habilitados. Un consumidor sin membresías recibe `puede_portal:
false` y listas vacías; `admin_sistema` recibe los negocios activos de la
plataforma. Los guards de React no sustituyen los permisos de Django.

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

## Invitaciones

| Método | Ruta | Acceso y uso |
| --- | --- | --- |
| GET / POST | `/api/v1/negocios/{id}/invitaciones/` | Propietario, supervisor o admin; lista o invita por correo (no crea membresía) |
| GET | `/api/v1/invitaciones/{token}/` | Invitado o admin; consulta la invitación |
| POST | `/api/v1/invitaciones/{token}/aceptar/` | Invitado autenticado; crea la membresía tras validar el correo |
| POST | `/api/v1/invitaciones/{token}/revocar/` | Propietario, supervisor o admin; revoca una invitación pendiente |

Solo un `admin_sistema` puede invitar a otro propietario. El sistema impide
dejar un negocio sin propietario activo.

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
| POST | `/api/v1/visitas/registrar/` | Consumidor; visita con QR de negocio o sucursal |
| GET | `/api/v1/mi/billetera/` | Consumidor; saldos, tarjetas en curso y cupones |
| GET | `/api/v1/mi/historial/` | Consumidor; visitas, movimientos y canjes propios |
| GET | `/api/v1/negocios/{id}/catalogo/` | Autenticado; recompensas adquiribles |
| POST | `/api/v1/cupones/adquirir/` | Consumidor; adquiere un cupón con puntos |
| POST | `/api/v1/cupones/{uuid}/canjear/` | Dueño del cupón; canje irreversible |
| POST | `/api/v1/admin/puntos/ajustar/` | `admin_sistema`; ajuste auditado |
| POST | `/api/v1/admin/visitas/{id}/anular/` | `admin_sistema`; anula visita con motivo |
| POST | `/api/v1/admin/cupones/{uuid}/anular/` | `admin_sistema`; anula cupón con motivo |
| GET | `/api/v1/negocios/{id}/metricas/` | Dueño, supervisor, empleado o admin; métricas por rango |

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
ordenamiento ni búsqueda (salvo las operaciones del portal). Parámetros como
`?negocio=` o `?page=` no modifican el resultado genérico. Los serializers de
crear, listar, detalle, actualización y borrado pueden exponer campos distintos.

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

Los errores DRF pueden aparecer como `{"detail":"..."}`, listas de mensajes o
errores por campo. Los endpoints de lealtad añaden un `codigo` estable. Nunca
distingas permisos por el texto de un mensaje.

## Rutas fuera de la API de negocio

| Método y ruta | Descripción |
| --- | --- |
| `GET /` en Django | Estado público `{"service":"backend","status":"ok"}`; no consulta la base |
| `/admin/` en Django | Admin con sesión staff propia |
| `GET /` en Benef AI | Estado del microservicio en el puerto 5000 local |

Benef AI documenta su API en `/docs`; el backend Django no genera OpenAPI.

## Límites funcionales

- Registrar actividades no calcula puntos/sellos ni actualiza progreso.
- Los CRUD de saldo/cupón no sustituyen los servicios de acumulación y emisión.
- Crear un canje por CRUD no consume el cupón de forma atómica; usa
  `POST /cupones/{uuid}/canjear/`.
- No hay métricas agregadas avanzadas, ranking, exportaciones, webhooks Stripe
  ni envío push.
