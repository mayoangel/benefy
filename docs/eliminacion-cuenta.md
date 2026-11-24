# Eliminación de cuenta

La baja es una operación de ciclo de vida, no un `DELETE` físico del historial.
El endpoint es idempotente y separa la anonimización en Django del borrado de la
identidad en Supabase Auth.

## Endpoint

```http
POST /api/v1/mi/cuenta/eliminar/
Authorization: Bearer <access_token>
Content-Type: application/json

{"confirmacion":"Eliminar mi cuenta"}
```

La confirmación se compara sin distinguir mayúsculas/minúsculas, pero debe ser
la frase exacta.

## Respuestas

| HTTP | Cuerpo | Significado |
| --- | --- | --- |
| `200` | `{"estado":"completada","supabase_eliminado":true,...}` | Baja completa |
| `202` | `{"estado":"anonimizada","supabase_eliminado":false,...}` | Perfil ya anonimizado; identidad Supabase pendiente |
| `400` | `confirmacion_invalida` | Frase incorrecta |
| `409` | `propietario_activo` | Conserva negocios activos de su propiedad |
| `409` | `cuenta_admin` | Una cuenta `admin_sistema` no puede autoeliminarse |
| `409` | `cuenta_inactiva` | La cuenta ya no está activa |
| `503` | `supabase_no_configurado` | Falta `SUPABASE_SERVICE_ROLE_KEY` o `SUPABASE_URL` |

## Qué se anonimiza

- `nombre`, `apellido`, `telefono`, `foto_perfil` y `correo` del `Usuario`.
- `supabase_uid` y `legacy_firebase_uid`.
- `qr_token`: se rota para invalidar el QR de miembro anterior.
- Notificaciones personales: se eliminan.
- `RegistroComercial`: se elimina el nombre y se sustituye el correo.
- Auditorías de membresía: se conserva la operación, sin el correo personal.
- Membresías activas: se desactivan con auditoría.

## Qué se conserva

Se conservan los asientos transaccionales justificados: visitas, movimientos y
lotes de puntos, cupones, canjes, ciclos de tarjeta y auditorías. El usuario
queda referenciado por su `id` anonimizado para no romper las claves foráneas.

Los puntos y cupones disponibles se expiran/anulan al momento de la baja. Los
registros históricos permanecen, pero ya no son utilizables.

## Propiedad de negocios

Si el usuario es el único propietario activo de un negocio activo, la baja
responde `409` con:

```json
{
  "codigo": "propietario_activo",
  "detalle": "Transfiere la propiedad o cierra los negocios activos antes de eliminar la cuenta.",
  "negocios": [{"id": 12, "nombre": "Café Nómada"}]
}
```

Procedimientos admitidos:

1. **Transferencia:** un `admin_sistema` crea otra membresía `dueno` sin sucursal
   para el negocio mediante `POST /api/v1/usuario-negocio/crear/`. Cuando el
   nuevo propietario queda activo, el usuario original puede eliminarse.
2. **Cierre:** el propietario desactiva el negocio con
   `PATCH /api/v1/negocio/actualizar/{id}/` y `{"status": false}`. La baja
   posterior desactiva la membresía sin dejar un negocio activo huérfano.
3. **Bloqueo:** si no se transfiere ni se cierra, la baja se mantiene bloqueada.

## Fallos parciales y reintentos

La anonimización ocurre en una transacción de PostgreSQL. Después se llama a la
Admin API de Supabase Auth:

```text
DELETE {SUPABASE_URL}/auth/v1/admin/users/{supabase_uid}
```

Si Supabase falla, la cuenta ya está desactivada y anonimizada, pero la
solicitud queda en estado `anonimizada`. El comando de reintento es:

```bash
python manage.py reintentar_eliminaciones_cuenta --limite 100
```

El `404` de Supabase se trata como éxito idempotente. La service role key nunca
se envía al cliente ni se registra en logs.

## Estados de la solicitud

| Estado | Significado |
| --- | --- |
| `pendiente` | Solicitud creada; aún no se anonimiza |
| `anonimizada` | Datos personales anonimizados; identidad Supabase pendiente |
| `completada` | Anonimización y borrado de Supabase terminados |
| `fallida` | Falló la transacción de anonimización; puede reintentarse desde la app mientras la cuenta siga activa |

## Configuración

```dotenv
SUPABASE_URL=https://<proyecto>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role>
```

La service role key es un secreto exclusivo del servidor. No debe tener prefijo
`EXPO_PUBLIC_` ni exponerse en el portal.
