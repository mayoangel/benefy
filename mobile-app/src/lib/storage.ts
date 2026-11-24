import { File } from 'expo-file-system';

import { supabase } from './supabase';

const BUCKET = 'avatars';
const MAX_BYTES = 5 * 1024 * 1024;
const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export class AvatarError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AvatarError';
  }
}

async function readImage(uri: string, declaredMimeType?: string | null) {
  let file: File;
  try {
    file = new File(uri);
  } catch {
    throw new AvatarError('No se pudo leer la imagen seleccionada.');
  }
  const contentType = (file.type || declaredMimeType || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  if (!MIME_EXTENSIONS[contentType]) {
    throw new AvatarError('La foto debe ser JPEG, PNG o WebP.');
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    throw new AvatarError('La foto debe pesar menos de 5 MB.');
  }
  let bytes: Uint8Array;
  try {
    bytes = await file.bytes();
  } catch {
    throw new AvatarError('No se pudo leer la imagen seleccionada.');
  }
  if (bytes.byteLength <= 0 || bytes.byteLength > MAX_BYTES) {
    throw new AvatarError('La foto debe pesar menos de 5 MB.');
  }
  return { contentType, bytes };
}

export async function uploadAvatar(
  uri: string,
  userId: string,
  declaredMimeType?: string | null,
): Promise<{ url: string; path: string }> {
  const { contentType, bytes } = await readImage(uri, declaredMimeType);
  const extension = MIME_EXTENSIONS[contentType];
  const path = `${userId}/perfil-${Date.now()}.${extension}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType,
    cacheControl: '3600',
    upsert: false,
  });
  if (error) {
    const detalle = error.message.toLowerCase();
    throw new AvatarError(
      detalle.includes('bucket not found') || detalle.includes('bucket does not exist')
        ? 'El almacenamiento de fotos no está configurado. Contacta a soporte de Benefy.'
        : detalle.includes('row-level security') || detalle.includes('permission')
          ? 'No tienes permiso para subir esta foto. Revisa la configuración de Storage.'
          : 'No se pudo subir la foto. Intenta de nuevo.',
    );
  }
  const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: publicData.publicUrl, path };
}

export async function removeAvatarUrl(url: string, userId: string): Promise<void> {
  try {
    const parsed = new URL(url);
    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const index = parsed.pathname.indexOf(marker);
    if (index < 0) return;
    const path = decodeURIComponent(parsed.pathname.slice(index + marker.length));
    if (!path.startsWith(`${userId}/`)) return;
    await supabase.storage.from(BUCKET).remove([path]);
  } catch {
    // La limpieza es best-effort; el nuevo avatar ya quedó guardado.
  }
}
