-- Bucket de avatares y políticas RLS de Supabase Storage.
-- Ejecutar en el SQL Editor de Supabase con un rol administrador.
-- No cambia datos de negocio; solo configura Storage.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table storage.objects enable row level security;

drop policy if exists "avatars_lectura_publica" on storage.objects;
create policy "avatars_lectura_publica"
on storage.objects for select
using (bucket_id = 'avatars');

drop policy if exists "avatars_alta_propia" on storage.objects;
create policy "avatars_alta_propia"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "avatars_actualizacion_propia" on storage.objects;
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

drop policy if exists "avatars_borrado_propio" on storage.objects;
create policy "avatars_borrado_propio"
on storage.objects for delete to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);
