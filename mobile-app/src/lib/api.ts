import { supabase } from './supabase';

const API_URL = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '');

export class ApiError extends Error {
  status: number;
  codigo?: string;

  constructor(status: number, message: string, codigo?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.codigo = codigo;
  }
}

export type NegocioQr = {
  id: number;
  nombre: string;
  logo_url: string | null;
};

export type SucursalQr = {
  id: number;
  nombre: string;
};

export type ResolverQrResultado = {
  negocio: NegocioQr;
  sucursal: SucursalQr | null;
  puede_registrar: boolean;
};

export type TarjetaResultado = {
  dinamica: number;
  ciclo: number;
  numero_ciclo: number;
  sellos_actuales: number;
  meta: number;
  completado: boolean;
  cupon: string | null;
};

export type VisitaResultado = {
  visita: {
    id: number;
    negocio: number;
    sucursal: number | null;
    fecha_negocio: string;
    es_valida: boolean;
  };
  already_registered: boolean;
  puntos_otorgados: number;
  tarjetas: TarjetaResultado[];
  cupones_emitidos: string[];
};

function extraerMensaje(body: unknown): { mensaje: string; codigo?: string } {
  if (!body || typeof body !== 'object') {
    return { mensaje: 'No se pudo completar la solicitud.' };
  }
  const dato = body as Record<string, unknown>;
  if (typeof dato.codigo === 'string') {
    return {
      mensaje: typeof dato.detalle === 'string' ? dato.detalle : 'Error de Benefy.',
      codigo: dato.codigo,
    };
  }
  if (typeof dato.detail === 'string') {
    return { mensaje: dato.detail };
  }
  if (Array.isArray(dato.detail)) {
    return { mensaje: dato.detail.join(' ') };
  }
  const primero = Object.values(dato).flat()[0];
  return {
    mensaje: typeof primero === 'string'
      ? primero
      : 'No se pudo completar la solicitud.',
  };
}

async function request<T>(
  path: string,
  token: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  if (!API_URL) {
    throw new ApiError(
      0,
      'La API móvil no está configurada. Define EXPO_PUBLIC_API_URL.',
      'api_no_configurada',
    );
  }
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(
      0,
      'No se pudo conectar con Benefy. Revisa tu conexión e intenta de nuevo.',
      'red',
    );
  }

  if (response.status === 401 && retry) {
    try {
      const { data } = await supabase.auth.refreshSession();
      const nuevoToken = data.session?.access_token;
      if (nuevoToken) return request<T>(path, nuevoToken, init, false);
    } catch {
      // Se reporta el 401 original si el refresh no está disponible.
    }
  }
  if (response.status === 401) {
    throw new ApiError(
      401,
      'Tu sesión terminó. Inicia sesión nuevamente.',
      'sin_sesion',
    );
  }

  const text = await response.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    const { mensaje, codigo } = extraerMensaje(body);
    throw new ApiError(response.status, mensaje, codigo);
  }
  return body as T;
}

export function resolverQr(qrUuid: string, token: string) {
  return request<ResolverQrResultado>(
    '/v1/visitas/resolver/',
    token,
    {
      method: 'POST',
      body: JSON.stringify({ qr_uuid: qrUuid }),
    },
  );
}

export function registrarVisita(qrUuid: string, token: string) {
  return request<VisitaResultado>(
    '/v1/visitas/registrar/',
    token,
    {
      method: 'POST',
      body: JSON.stringify({ qr_uuid: qrUuid, metodo_validacion: 'qr' }),
    },
  );
}
