import {
  ApiError,
  crearPerfil,
  getPerfil,
  type Perfil,
} from './api';

function textoMetadata(value: unknown, fallback: string) {
  const texto = typeof value === 'string' && value.trim() ? value.trim() : fallback;
  return texto.slice(0, 100);
}

function telefonoMetadata(value: unknown): string {
  if (typeof value !== 'string') return '';
  const limpio = value.trim().replace(/[^\d+ ().-]/g, '').slice(0, 20);
  return limpio.replace(/\D/g, '').length >= 7 ? limpio : '';
}

/**
 * Recupera el perfil local. Si la identidad de Supabase todavía no tiene
 * perfil en Django, lo crea con los metadatos del registro. Un 409 significa
 * que otra petición ya lo creó, así que se vuelve a consultar.
 */
export async function cargarPerfil(
  token: string,
  metadata: Record<string, unknown> = {},
  email = '',
): Promise<Perfil> {
  try {
    return await getPerfil(token);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 403) throw error;

    const correo = email.trim();
    const nombre = textoMetadata(
      metadata.nombre,
      correo.split('@')[0] || 'Usuario',
    );
    const apellido = textoMetadata(metadata.apellido, 'Benefy');
    const telefono = telefonoMetadata(metadata.telefono);
    const payload = {
      nombre,
      apellido,
      telefono: telefono || null,
    };

    try {
      return await crearPerfil(payload, token);
    } catch (createError) {
      if (createError instanceof ApiError && createError.status === 409) {
        return getPerfil(token);
      }
      throw createError;
    }
  }
}
