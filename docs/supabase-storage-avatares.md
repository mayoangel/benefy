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

SQL de referencia:

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars', 'avatars', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "avatars_lectura_publica"
on storage.objects for select
using (bucket_id = 'avatars');

create policy "avatars_alta_propia"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "avatars_actualizacion_propia"
on storage.objects for update to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "avatars_borrado_propio"
on storage.objects for delete to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
```

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
