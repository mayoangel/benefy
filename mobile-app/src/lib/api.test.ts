import { supabase } from './supabase';
import {
  ApiError,
  adquirirCupon,
  apiRequest,
  canjearCupon,
  eliminarCuenta,
  getBilletera,
  getDirectorio,
  getPerfil,
  marcarNotificacionLeida,
} from './api';

jest.mock('./supabase', () => ({
  supabase: {
    auth: {
      refreshSession: jest.fn(),
    },
  },
}));

const refreshSession = supabase.auth.refreshSession as jest.Mock;
const fetchMock = jest.fn();
const API = 'https://api.benefy.test/api';

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: jest.fn(async () => JSON.stringify(body)),
  } as unknown as Response;
}

function ultimaLlamada() {
  return fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as [string, RequestInit];
}

beforeEach(() => {
  fetchMock.mockReset();
  refreshSession.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

describe('apiRequest', () => {
  it('envía el bearer y devuelve el JSON', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 7 }));
    await expect(apiRequest('/v1/prueba/', 'token-1')).resolves.toEqual({ id: 7 });
    const [url, init] = ultimaLlamada();
    expect(url).toBe(`${API}/v1/prueba/`);
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer token-1');
    expect(new Headers(init.headers).get('Accept')).toBe('application/json');
  });

  it('convierte los errores de dominio en ApiError', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      codigo: 'sin_puntos',
      detalle: 'No tienes puntos suficientes.',
    }, 409));
    await expect(apiRequest('/v1/cupones/adquirir/', 'token'))
      .rejects.toMatchObject({
        name: 'ApiError',
        status: 409,
        codigo: 'sin_puntos',
        message: 'No tienes puntos suficientes.',
      });
  });

  it('une los errores de validación de DRF', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: ['Campo A.', 'Campo B.'] }, 400));
    await expect(apiRequest('/v1/prueba/', 'token'))
      .rejects.toThrow('Campo A. Campo B.');
  });

  it('refresca la sesión una vez tras un 401', async () => {
    refreshSession.mockResolvedValueOnce({
      data: { session: { access_token: 'token-nuevo' } },
    });
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ detail: 'Vencido' }, 401))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    await expect(apiRequest('/v1/perfil/', 'token-viejo')).resolves.toEqual({ ok: true });
    expect(refreshSession).toHaveBeenCalledTimes(1);
    const [, init] = ultimaLlamada();
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer token-nuevo');
  });

  it('informa sesión terminada si el refresh no devuelve token', async () => {
    refreshSession.mockResolvedValueOnce({ data: { session: null } });
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: 'Vencido' }, 401));
    await expect(apiRequest('/v1/perfil/', 'token')).rejects.toMatchObject({
      status: 401,
      codigo: 'sin_sesion',
    });
  });

  it('distingue errores de red', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
    await expect(apiRequest('/v1/perfil/', 'token')).rejects.toMatchObject({
      status: 0,
      codigo: 'red',
    });
  });
});

describe('contratos de endpoints móviles', () => {
  beforeEach(() => {
    fetchMock.mockResolvedValue(jsonResponse({}));
  });

  it('usa las rutas del perfil, directorio y billetera', async () => {
    await getPerfil('token');
    expect(ultimaLlamada()[0]).toBe(`${API}/v1/autenticacion/perfil/`);

    await getDirectorio('token', { q: 'café', categoria: 2, page: 3, pageSize: 12 });
    const directorio = new URL(ultimaLlamada()[0]);
    expect(directorio.pathname).toBe('/api/v1/negocios/descubrir/');
    expect(directorio.searchParams.get('q')).toBe('café');
    expect(directorio.searchParams.get('categoria')).toBe('2');
    expect(directorio.searchParams.get('page')).toBe('3');
    expect(directorio.searchParams.get('page_size')).toBe('12');

    await getBilletera('token', 9);
    expect(new URL(ultimaLlamada()[0]).searchParams.get('negocio')).toBe('9');
  });

  it('envía idempotencia al adquirir y no envía cuerpo al canjear', async () => {
    await adquirirCupon(5, 'clave-uuid', 'token');
    const [url, init] = ultimaLlamada();
    expect(url).toBe(`${API}/v1/cupones/adquirir/`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      recompensa: 5,
      clave_idempotencia: 'clave-uuid',
    });

    await canjearCupon('8f0f8c4d-0000-4000-8000-000000000000', 'token');
    expect(ultimaLlamada()[0])
      .toBe(`${API}/v1/cupones/8f0f8c4d-0000-4000-8000-000000000000/canjear/`);
    expect(ultimaLlamada()[1].method).toBe('POST');
  });

  it('marca una notificación y confirma la baja de cuenta', async () => {
    await marcarNotificacionLeida(4, 'token');
    expect(ultimaLlamada()[0]).toBe(`${API}/v1/notificacion/actualizar/4/`);
    expect(ultimaLlamada()[1].method).toBe('PATCH');
    expect(JSON.parse(ultimaLlamada()[1].body as string)).toEqual({ leida: true });

    await eliminarCuenta('Eliminar mi cuenta', 'token');
    expect(ultimaLlamada()[0]).toBe(`${API}/v1/mi/cuenta/eliminar/`);
    expect(JSON.parse(ultimaLlamada()[1].body as string)).toEqual({
      confirmacion: 'Eliminar mi cuenta',
    });
  });

  it('expone ApiError con datos estructurados', () => {
    const error = new ApiError(409, 'Propietario activo', 'propietario_activo', {
      negocios: [{ id: 1, nombre: 'Café' }],
    });
    expect(error.status).toBe(409);
    expect(error.codigo).toBe('propietario_activo');
    expect(error.datos?.negocios).toHaveLength(1);
  });
});
