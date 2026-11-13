# Referencia de la API actual

Esta guía describe las rutas de `backend/config/urls.py` y `backend/core/urls.py`.
Los campos y validaciones concretos están en `backend/core/serializers.py`;
el alcance de acceso está en `backend/core/access.py` y `permissions.py`.

## Direcciones y autenticación

| Entorno | Base de la API |
| --- | --- |
| Desarrollo Docker | `http://localhost:8000/api/v1` |
| Producción Compose, acceso desde el mismo host | `http://127.0.0.1:8001/api/v1` por defecto |
| Producción pública | Dominio HTTPS configurado en el proxy; aún no definido en el repositorio |

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

## Rutas adicionales de identidad

| Método | Ruta | Uso |
| --- | --- | --- |
| GET | `/api/v1/autenticacion/perfil/` | Perfil local del usuario autenticado |
| PATCH | `/api/v1/usuario/rol/{id}/` | Cambiar `rol` o `is_active`; solo `admin_sistema` |

Hay 82 rutas de API en total. Las dos anteriores no sustituyen los CRUD.
El login, registro de identidad, refresh y logout ocurren en Supabase Auth,
no bajo `/api/v1`. `usuario/crear/` crea el perfil Benefy después del login.

## Ejemplo de lectura

```http
GET /api/v1/sucursales/listar/
Authorization: Bearer <access_token>
Accept: application/json
```

Un dueño ve sus sucursales; un empleado/admin de sucursal, las que le permite
su membresía. Un consumidor sin membresías recibe una lista vacía en esta ruta:
todavía no hay un catálogo público de comercios para la aplicación móvil.

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

Los errores DRF pueden aparecer como `{"detail":"..."}`, listas de mensajes
o errores por campo. No hay un envoltorio global de respuesta ni un identificador
de error estable; los textos de algunas validaciones pueden depender del idioma
configurado en Django. Nunca distingas permisos mediante el texto de un mensaje.

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
