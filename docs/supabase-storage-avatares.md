# Avatares en Supabase Storage

El backend no almacena archivos de imagen. El móvil sube el avatar directamente
a Supabase Storage y después envía la URL pública al perfil. Django valida que
la URL pertenezca al bucket y a la carpeta del usuario autenticado.

## Bucket

Nombre por defecto: `avatars`.

Configuración recomendada:

- lectura pública para servir el avatar;
- escritura, actualización y borrado restringidos por RLS al propietario;
- límite de 5 MB;
- tipos permitidos: `image/jpeg`, `image/png`, `image/webp`.

SQL canónico e idempotente:

[`docs/sql/avatars_storage.sql`](./sql/avatars_storage.sql)

El archivo crea/actualiza el bucket, activa RLS y aplica políticas separadas para
lectura, alta, actualización y borrado. Las políticas de escritura exigen que el
primer segmento de la ruta sea `auth.uid()::text`; la actualización también
valida el nuevo nombre con `with check`, por lo que un usuario no puede mover su
objeto a la carpeta de otro.

La lógica de políticas se validó en PostgreSQL aislado con dos identidades:
inserción ajena, cambio de carpeta y borrado ajeno fueron rechazados; el dueño
pudo crear y borrar su propio objeto. Esa prueba no se ejecutó contra Supabase
remoto.

## Convención de ruta

```text
avatars/{supabase_uid}/{archivo}.jpg
```

Django exige que la URL empiece por:

```text
https://<proyecto>.supabase.co/storage/v1/object/public/avatars/{supabase_uid}/
```

No acepta otros hosts, otros buckets, `http://`, rutas fuera de la carpeta del
usuario ni URLs con query string.

## Flujo del cliente

1. El usuario elige una imagen con el selector del dispositivo.
2. La app sube el archivo a `avatars/{supabase_uid}/perfil-{uuid}.jpg` usando la
   sesión de Supabase.
3. Obtiene la URL pública.
4. Envía `PATCH /api/v1/autenticacion/perfil/`:

```json
{"foto_perfil":"https://<proyecto>.supabase.co/storage/v1/object/public/avatars/<uid>/perfil-uuid.jpg"}
```

5. Django hace `HEAD` al objeto, valida `Content-Type` y `Content-Length`, y
   guarda la URL en `Usuario.foto_perfil`.

Para quitar la foto se envía `{"foto_perfil": ""}`.

## Baja de cuenta

En la eliminación de cuenta, Django usa la service role key para listar y
borrar por páginas todos los objetos bajo `avatars/{supabase_uid}/`. La limpieza
es idempotente: una carpeta vacía o un bucket inexistente se consideran
completados. Si Storage falla, la solicitud `0021`/`0022` queda en estado
`anonimizada` y el comando `reintentar_eliminaciones_cuenta` vuelve a intentar
la limpieza y el borrado de Supabase Auth.

## Variables del backend

```dotenv
SUPABASE_STORAGE_BUCKET_AVATARS=avatars
SUPABASE_STORAGE_MAX_BYTES=5242880
SUPABASE_STORAGE_ALLOWED_TYPES=image/jpeg,image/png,image/webp
```

`SUPABASE_SERVICE_ROLE_KEY` no se usa para subir avatares desde el móvil. Si en
el futuro el backend genera URLs firmadas o administra objetos, esa clave debe
permanecer exclusivamente en el servidor.

## Errores

La validación de la foto responde `400` como error de campo `foto_perfil` si:

- la URL no es del bucket/host/carpeta permitidos;
- el objeto no existe;
- el `Content-Type` no es una imagen permitida;
- el tamaño es cero, supera el límite o no se puede determinar;
- Supabase Storage no responde.
