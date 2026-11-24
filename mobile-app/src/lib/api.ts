import { supabase } from './supabase';

const RAW_API_URL = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/+$/, '');
// El cliente agrega `/v1/...`; se tolera una base configurada como `/api/v1`.
const API_URL = RAW_API_URL.replace(/\/api\/v1$/, '/api');
const REQUEST_TIMEOUT_MS = 15000;

export class ApiError extends Error {
  status: number;
  codigo?: string;
  datos?: Record<string, unknown>;

  constructor(
    status: number,
    message: string,
    codigo?: string,
    datos?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.codigo = codigo;
    this.datos = datos;
  }
}

export type Perfil = {
  id: number;
  supabase_uid: string | null;
  nombre: string;
  apellido: string;
  telefono: string | null;
  correo: string;
  rol: string;
  foto_perfil: string | null;
  qr_token: string;
  is_active: boolean;
  fecha_registro: string;
  fecha_actualizacion: string;
};

export type PerfilActualizable = {
  nombre?: string;
  apellido?: string;
  telefono?: string | null;
  foto_perfil?: string | null;
};

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

export type Paginado<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type CategoriaResumen = {
  id: number;
  nombre: string;
};

export type SucursalDirectorio = {
  id: number;
  nombre: string;
  direccion: string;
  ciudad: string;
};

export type NegocioDirectorio = {
  id: number;
  nombre: string;
  slug: string;
  descripcion: string;
  direccion: string;
  telefono: string | null;
  logo_url: string | null;
  banner_url: string | null;
  categoria: CategoriaResumen;
  sucursales: SucursalDirectorio[];
};

export type RecompensaCatalogo = {
  id: number;
  titulo: string;
  descripcion: string;
  tipo: string;
  descuento: string | null;
  costo_desbloqueo: number;
  terminos_condiciones: string;
  fecha_expiracion: string | null;
  vigencia_dias: number | null;
  cantidad_disponible: number | null;
  negocio: number | null;
  alianza: number | null;
  negocio_nombre: string | null;
  negocio_logo_url: string | null;
  es_alianza: boolean;
};

export type CatalogoResultado = {
  negocio: {
    id: number;
    nombre: string;
    slug: string;
    descripcion: string;
    direccion: string;
    telefono: string | null;
    logo_url: string | null;
    banner_url: string | null;
    categoria: CategoriaResumen;
    zona_horaria: string;
  };
  sucursales: SucursalDirectorio[];
  recompensas: RecompensaCatalogo[];
};

export type SaldoPuntos = {
  negocio: number;
  negocio_nombre: string | null;
  negocio_slug: string | null;
  negocio_logo_url: string | null;
  saldo_actual: number;
  fecha_actualizacion: string;
};

export type Tarjeta = {
  id: number;
  dinamica: number;
  negocio: number;
  negocio_nombre: string | null;
  negocio_slug: string | null;
  negocio_logo_url: string | null;
  numero_ciclo: number;
  sellos_actuales: number;
  meta: number;
  estado: string;
  recompensa_titulo: string;
  recompensa_descripcion: string;
  recompensa_condiciones: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  cupon: string | null;
};

export type Cupon = {
  id?: number;
  uuid: string;
  recompensa: number;
  negocio: number | null;
  negocio_nombre: string | null;
  negocio_slug: string | null;
  negocio_logo_url: string | null;
  origen: string;
  status: 'disponible' | 'canjeado' | 'vencido' | 'anulado';
  titulo_beneficio: string;
  descripcion_beneficio: string;
  tipo_beneficio: string;
  descuento_beneficio: string | null;
  condiciones_beneficio: string;
  costo_pagado: number;
  fecha_emision: string;
  fecha_expiracion: string;
};

export type BilleteraResultado = {
  saldos: SaldoPuntos[];
  tarjetas: Tarjeta[];
  cupones: Cupon[];
};

export type VisitaHistorial = {
  id: number;
  usuario: number;
  negocio: number;
  negocio_nombre: string | null;
  negocio_slug: string | null;
  negocio_logo_url: string | null;
  sucursal: number | null;
  sucursal_nombre: string | null;
  metodo_validacion: string;
  tipo: string;
  fecha: string;
  fecha_negocio: string;
  es_valida: boolean;
};

export type MovimientoHistorial = {
  id: number;
  negocio: number;
  negocio_nombre: string | null;
  negocio_slug: string | null;
  negocio_logo_url: string | null;
  lote: number | null;
  cupon: string | null;
  tipo: 'otorgado' | 'consumido' | 'expirado' | 'ajuste';
  cantidad: number;
  referencia: string | null;
  descripcion: string;
  fecha: string;
};

export type CanjeHistorial = {
  id: number;
  cupon: string;
  negocio: number | null;
  negocio_nombre: string | null;
  negocio_slug: string | null;
  negocio_logo_url: string | null;
  sucursal: number | null;
  sucursal_nombre: string | null;
  fecha: string;
  origen: string;
  anulado: boolean;
};

export type HistorialResultado = {
  visitas: VisitaHistorial[];
  movimientos: MovimientoHistorial[];
  canjes: CanjeHistorial[];
};

export type Notificacion = {
  id: number;
  titulo: string;
  cuerpo: string;
  tipo: string;
  leida: boolean;
  fecha_envio: string;
  usuario: number | null;
};

export type AdquirirCuponResultado = {
  cupon: Cupon;
  saldo_restante: number | null;
};

export type CanjeResultado = {
  canje: {
    token_validacion: string;
    expira_en: string;
    servidor_ahora: string;
    duracion_segundos: number;
  };
  cupon: Cupon;
  negocio: {
    id: number;
    nombre: string | null;
    logo_url: string | null;
  };
};

export type EliminarCuentaResultado = {
  estado: 'completada' | 'anonimizada';
  supabase_eliminado: boolean;
  detalle: string;
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

export async function apiRequest<T>(
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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    const abortado = error instanceof Error && error.name === 'AbortError';
    throw new ApiError(
      0,
      abortado
        ? 'Benefy tardó demasiado en responder. Intenta de nuevo.'
        : 'No se pudo conectar con Benefy. Revisa tu conexión e intenta de nuevo.',
      abortado ? 'timeout' : 'red',
    );
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 401 && retry) {
    try {
      const { data } = await supabase.auth.refreshSession();
      const nuevoToken = data.session?.access_token;
      if (nuevoToken) return apiRequest<T>(path, nuevoToken, init, false);
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
    const datos = body && typeof body === 'object'
      ? body as Record<string, unknown>
      : undefined;
    throw new ApiError(response.status, mensaje, codigo, datos);
  }
  return body as T;
}

const query = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, String(value));
  });
  const text = search.toString();
  return text ? `?${text}` : '';
};

export function getPerfil(token: string) {
  return apiRequest<Perfil>('/v1/autenticacion/perfil/', token);
}

export function actualizarPerfil(payload: PerfilActualizable, token: string) {
  return apiRequest<Perfil>('/v1/autenticacion/perfil/', token, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export function crearPerfil(
  payload: Pick<PerfilActualizable, 'nombre' | 'apellido' | 'telefono'>,
  token: string,
) {
  return apiRequest<Perfil>('/v1/usuario/crear/', token, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function getDirectorio(
  token: string,
  params: { q?: string; categoria?: number; page?: number; pageSize?: number } = {},
) {
  return apiRequest<Paginado<NegocioDirectorio>>(
    `/v1/negocios/descubrir/${query({
      q: params.q,
      categoria: params.categoria,
      page: params.page,
      page_size: params.pageSize,
    })}`,
    token,
  );
}

export function getCatalogo(negocioId: number, token: string) {
  return apiRequest<CatalogoResultado>(`/v1/negocios/${negocioId}/catalogo/`, token);
}

export function getBilletera(token: string, negocioId?: number) {
  return apiRequest<BilleteraResultado>(
    `/v1/mi/billetera/${query({ negocio: negocioId })}`,
    token,
  );
}

export function getHistorial(token: string, negocioId?: number) {
  return apiRequest<HistorialResultado>(
    `/v1/mi/historial/${query({ negocio: negocioId })}`,
    token,
  );
}

export function getMisCupones(token: string) {
  return apiRequest<Cupon[]>('/v1/cupones-usuario/listar/', token);
}

export function getNotificaciones(token: string) {
  return apiRequest<Notificacion[]>('/v1/notificaciones/listar/', token);
}

export function marcarNotificacionLeida(id: number, token: string) {
  return apiRequest<Notificacion>(`/v1/notificacion/actualizar/${id}/`, token, {
    method: 'PATCH',
    body: JSON.stringify({ leida: true }),
  });
}

export function adquirirCupon(
  recompensa: number,
  claveIdempotencia: string,
  token: string,
) {
  return apiRequest<AdquirirCuponResultado>('/v1/cupones/adquirir/', token, {
    method: 'POST',
    body: JSON.stringify({ recompensa, clave_idempotencia: claveIdempotencia }),
  });
}

export function canjearCupon(uuid: string, token: string) {
  return apiRequest<CanjeResultado>(`/v1/cupones/${uuid}/canjear/`, token, {
    method: 'POST',
  });
}

export function eliminarCuenta(confirmacion: string, token: string) {
  return apiRequest<EliminarCuentaResultado>('/v1/mi/cuenta/eliminar/', token, {
    method: 'POST',
    body: JSON.stringify({ confirmacion }),
  });
}

export function resolverQr(qrUuid: string, token: string) {
  return apiRequest<ResolverQrResultado>('/v1/visitas/resolver/', token, {
    method: 'POST',
    body: JSON.stringify({ qr_uuid: qrUuid }),
  });
}

export function registrarVisita(qrUuid: string, token: string) {
  return apiRequest<VisitaResultado>('/v1/visitas/registrar/', token, {
    method: 'POST',
    body: JSON.stringify({ qr_uuid: qrUuid, metodo_validacion: 'qr' }),
  });
}
