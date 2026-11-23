import { supabase } from './supabase.ts';
import type {
  AlianzaDetalle,
  AlianzaResumen,
  CanjeResumen,
  CategoriaResumen,
  ClienteResumen,
  ContextoPortal,
  CuponResumen,
  DinamicaResumen,
  FacturacionNegocio,
  InvitacionResumen,
  MembresiaResumen,
  MetricasPortal,
  NegocioAliado,
  NegocioDetalle,
  NegocioResumen,
  OnboardingResultado,
  PaginaClientes,
  PaginaResultados,
  PlanCatalogo,
  PlanNegocio,
  RecompensaAlianza,
  RecompensaResumen,
  SucursalDetalle,
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
    if (response.status === 403 && !path.startsWith('/mi/contexto/')) {
      window.dispatchEvent(new Event('benefy:contexto-invalidado'));
    }
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

function jsonRequest(method: 'PATCH' | 'PUT', body: unknown): RequestInit {
  return { method, body: JSON.stringify(body) };
}

type ValorQuery = string | number | boolean | undefined | null;

function query(params: Record<string, ValorQuery>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([clave, valor]) => {
    if (valor !== undefined && valor !== null && valor !== '') {
      search.set(clave, String(valor));
    }
  });
  const texto = search.toString();
  return texto ? `?${texto}` : '';
}

export const api = {
  getProfile: () => request<UsuarioPortal>('/autenticacion/perfil/'),
  completeOnboarding: () =>
    request<OnboardingResultado>('/onboarding/comercial/', { method: 'POST' }),
  getContext: () => request<ContextoPortal>('/mi/contexto/'),
  getPlans: () => request<PlanCatalogo[]>('/planes/'),
  getBusinessPlan: (businessId: number) =>
    request<PlanNegocio>(`/negocios/${businessId}/plan/`),
  getBilling: (businessId: number) =>
    request<FacturacionNegocio>(`/negocios/${businessId}/facturacion/`),
  createCheckout: (businessId: number, intervalo: 'mensual' | 'anual') =>
    request<{ url: string; session_id: string; reutilizada: boolean; modo: string }>(
      `/negocios/${businessId}/facturacion/checkout/`,
      jsonBody({ intervalo }),
    ),
  createBillingPortal: (businessId: number) =>
    request<{ url: string; modo: string }>(
      `/negocios/${businessId}/facturacion/portal/`,
      { method: 'POST' },
    ),
  syncBilling: (businessId: number, sessionId?: string) =>
    request<FacturacionNegocio>(
      `/negocios/${businessId}/facturacion/sincronizar/`,
      jsonBody(sessionId ? { session_id: sessionId } : {}),
    ),
  getAlliances: (businessId: number, params: Record<string, ValorQuery> = {}) =>
    request<AlianzaResumen[]>(
      `/alianzas/${query({ negocio: businessId, ...params })}`,
    ),
  discoverAlliances: (
    businessId: number,
    params: Record<string, ValorQuery> = {},
  ) => request<NegocioAliado[]>(
    `/alianzas/descubrir/${query({ negocio: businessId, ...params })}`,
  ),
  getAlliance: (
    businessId: number,
    allianceId: number,
  ) => request<AlianzaDetalle>(
    `/alianzas/${allianceId}/${query({ negocio: businessId })}`,
  ),
  createAlliance: (data: Record<string, unknown>) =>
    request<AlianzaDetalle>('/alianzas/solicitudes/', jsonBody(data)),
  acceptAlliance: (businessId: number, allianceId: number) =>
    request<AlianzaDetalle>(
      `/alianzas/${allianceId}/aceptar/${query({ negocio: businessId })}`,
      { method: 'POST' },
    ),
  rejectAlliance: (businessId: number, allianceId: number) =>
    request<AlianzaDetalle>(
      `/alianzas/${allianceId}/rechazar/${query({ negocio: businessId })}`,
      { method: 'POST' },
    ),
  finalizeAlliance: (businessId: number, allianceId: number) =>
    request<AlianzaDetalle>(
      `/alianzas/${allianceId}/finalizar/${query({ negocio: businessId })}`,
      { method: 'POST' },
    ),
  createAllianceReward: (
    businessId: number,
    allianceId: number,
    data: Record<string, unknown>,
  ) => request<RecompensaAlianza>(
    `/alianzas/${allianceId}/recompensas/${query({ negocio: businessId })}`,
    jsonBody({ ...data, negocio: businessId }),
  ),
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
  getBusinessDetail: (id: number) =>
    request<NegocioDetalle>(`/negocio/detalle/${id}/`),
  updateBusiness: (id: number, data: Record<string, unknown>) =>
    request<NegocioDetalle>(`/negocio/actualizar/${id}/`, jsonRequest('PATCH', data)),
  getBusinesses: () => request<NegocioResumen[]>('/negocios/listar/'),
  getBranches: () => request<SucursalResumen[]>('/sucursales/listar/'),
  getBranchDetail: (id: number) =>
    request<SucursalDetalle>(`/sucursal/detalle/${id}/`),
  createBranch: (data: Record<string, unknown>) =>
    request('/sucursal/crear/', jsonBody(data)),
  updateBranch: (id: number, data: Record<string, unknown>) =>
    request<SucursalDetalle>(`/sucursal/actualizar/${id}/`, jsonRequest('PATCH', data)),
  getDynamics: () => request<DinamicaResumen[]>('/dinamicas/listar/'),
  getDynamicDetail: (id: number) =>
    request<DinamicaResumen>(`/dinamica/detalle/${id}/`),
  createDynamic: (data: Record<string, unknown>) =>
    request<DinamicaResumen>('/dinamica/crear/', jsonBody(data)),
  updateDynamic: (id: number, data: Record<string, unknown>) =>
    request<DinamicaResumen>(`/dinamica/actualizar/${id}/`, jsonRequest('PATCH', data)),
  getRewards: () => request<RecompensaResumen[]>('/recompensas/listar/'),
  createReward: (data: Record<string, unknown>) =>
    request<RecompensaResumen>('/recompensa/crear/', jsonBody(data)),
  updateReward: (id: number, data: Record<string, unknown>) =>
    request<RecompensaResumen>(`/recompensa/actualizar/${id}/`, jsonRequest('PATCH', data)),
  createCard: (businessId: number, data: Record<string, unknown>) =>
    request<{ tarjeta: DinamicaResumen; recompensa: RecompensaResumen }>(
      `/negocios/${businessId}/tarjetas/`,
      jsonBody(data),
    ),
  getMemberships: () => request<MembresiaResumen[]>('/usuarios-negocio/listar/'),
  updateMembership: (id: number, data: Record<string, unknown>) =>
    request<MembresiaResumen>(
      `/usuario-negocio/actualizar/${id}/`, jsonRequest('PATCH', data),
    ),
  getUsers: () => request<UsuarioResumen[]>('/usuarios/listar/'),
  getMetrics: (
    businessId: number,
    options: { sucursal?: number; desde?: string; hasta?: string } = {},
  ) => request<MetricasPortal>(
    `/negocios/${businessId}/metricas/${query(options)}`,
  ),
  getBusinessVisits: (businessId: number, params: Record<string, ValorQuery> = {}) =>
    request<PaginaResultados<VisitaResumen>>(
      `/negocios/${businessId}/visitas/${query(params)}`,
    ),
  getBusinessCoupons: (businessId: number, params: Record<string, ValorQuery> = {}) =>
    request<PaginaResultados<CuponResumen>>(
      `/negocios/${businessId}/cupones/${query(params)}`,
    ),
  getBusinessRedemptions: (
    businessId: number,
    params: Record<string, ValorQuery> = {},
  ) => request<PaginaResultados<CanjeResumen>>(
    `/negocios/${businessId}/canjes/${query(params)}`,
  ),
  getBusinessClients: (businessId: number, params: Record<string, ValorQuery> = {}) =>
    request<PaginaClientes>(
      `/negocios/${businessId}/clientes/${query(params)}`,
    ),
  getInvitations: (businessId: number) =>
    request<InvitacionResumen[]>(`/negocios/${businessId}/invitaciones/`),
  createInvitation: (businessId: number, data: Record<string, unknown>) =>
    request<InvitacionResumen>(
      `/negocios/${businessId}/invitaciones/`, jsonBody(data),
    ),
  getInvitation: (token: string) =>
    request<InvitacionResumen>(`/invitaciones/${token}/`),
  acceptInvitation: (token: string) =>
    request<{ aceptada: boolean; membresia_id: number; negocio_id: number }>(
      `/invitaciones/${token}/aceptar/`, { method: 'POST' },
    ),
  revokeInvitation: (token: string) =>
    request<InvitacionResumen>(
      `/invitaciones/${token}/revocar/`, { method: 'POST' },
    ),
  getVisits: () => request<VisitaResumen[]>('/registros-actividad/listar/'),
  getCoupons: () => request<CuponResumen[]>('/cupones-usuario/listar/'),
};
