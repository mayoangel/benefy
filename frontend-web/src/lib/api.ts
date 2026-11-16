import { supabase } from './supabase.ts';
import type {
  CategoriaResumen,
  ContextoPortal,
  CuponResumen,
  MembresiaResumen,
  MetricasPortal,
  NegocioResumen,
  SucursalResumen,
  UsuarioPortal,
  UsuarioResumen,
  VisitaResumen,
} from './types.ts';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');

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

let refreshPromise: Promise<string | null> | null = null;

async function getToken(forceRefresh = false): Promise<string | null> {
  if (forceRefresh) {
    if (!refreshPromise) {
      refreshPromise = supabase.auth
        .refreshSession()
        .then(({ data }) => data.session?.access_token ?? null)
        .catch(() => null)
        .finally(() => {
          refreshPromise = null;
        });
    }
    return refreshPromise;
  }

  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

function extraerMensaje(body: unknown): { mensaje: string; codigo?: string } {
  if (!body || typeof body !== 'object') {
    return { mensaje: 'No se pudo completar la solicitud.' };
  }
  const dato = body as Record<string, unknown>;
  if (typeof dato.codigo === 'string') {
    const detalle = typeof dato.detalle === 'string' ? dato.detalle : 'Error de negocio.';
    return { mensaje: detalle, codigo: dato.codigo };
  }
  if (typeof dato.detail === 'string') {
    return { mensaje: dato.detail };
  }
  if (Array.isArray(dato.detail)) {
    return { mensaje: dato.detail.join(' ') };
  }
  const primerCampo = Object.values(dato).flat()[0];
  return {
    mensaje: typeof primerCampo === 'string'
      ? primerCampo
      : 'No se pudo completar la solicitud.',
  };
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<T> {
  let token = await getToken();
  if (!token) {
    throw new ApiError(401, 'Tu sesión terminó. Inicia sesión nuevamente.');
  }

  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (response.status === 401 && retry) {
    const refreshed = await getToken(true);
    if (refreshed) {
      return request<T>(path, init, false);
    }
    throw new ApiError(401, 'Tu sesión terminó. Inicia sesión nuevamente.');
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

function jsonBody(body: unknown): RequestInit {
  return {
    method: 'POST',
    body: JSON.stringify(body),
  };
}

export const api = {
  getProfile: () => request<UsuarioPortal>('/autenticacion/perfil/'),
  getContext: () => request<ContextoPortal>('/mi/contexto/'),
  createProfile: (nombre: string, apellido: string) =>
    request<UsuarioPortal>('/usuario/crear/', jsonBody({ nombre, apellido })),
  getCategories: () => request<CategoriaResumen[]>('/categorias-negocio/listar/'),
  createBusiness: (data: {
    nombre: string;
    direccion: string;
    correo: string;
    telefono?: string;
    categoria: number;
  }) => request('/negocio/crear/', jsonBody(data)),
  getBusiness: (id: number) => request<NegocioResumen>(`/negocio/detalle/${id}/`),
  getBusinesses: () => request<NegocioResumen[]>('/negocios/listar/'),
  getBranches: () => request<SucursalResumen[]>('/sucursales/listar/'),
  getMemberships: () => request<MembresiaResumen[]>('/usuarios-negocio/listar/'),
  getUsers: () => request<UsuarioResumen[]>('/usuarios/listar/'),
  getMetrics: (businessId: number, branchId?: number) => {
    const query = branchId ? `?sucursal=${branchId}` : '';
    return request<MetricasPortal>(`/negocios/${businessId}/metricas/${query}`);
  },
  getVisits: () => request<VisitaResumen[]>('/registros-actividad/listar/'),
  getCoupons: () => request<CuponResumen[]>('/cupones-usuario/listar/'),
};
