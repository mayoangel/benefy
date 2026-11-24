import { ApiError, crearPerfil, getPerfil } from './api';
import { cargarPerfil } from './profile';

jest.mock('./api', () => {
  class ApiError extends Error {
    status: number;
    codigo?: string;
    datos?: Record<string, unknown>;

    constructor(status: number, message: string, codigo?: string, datos?: Record<string, unknown>) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.codigo = codigo;
      this.datos = datos;
    }
  }
  return {
    ApiError,
    getPerfil: jest.fn(),
    crearPerfil: jest.fn(),
  };
});

const getPerfilMock = getPerfil as jest.Mock;
const crearPerfilMock = crearPerfil as jest.Mock;

const perfil = {
  id: 1,
  supabase_uid: 'uid',
  nombre: 'Ana',
  apellido: 'Pérez',
  telefono: '6640000000',
  correo: 'ana@example.com',
  rol: 'consumidor',
  foto_perfil: null,
  qr_token: 'uuid',
  is_active: true,
  fecha_registro: '2026-01-01T00:00:00Z',
  fecha_actualizacion: '2026-01-01T00:00:00Z',
};

beforeEach(() => {
  getPerfilMock.mockReset();
  crearPerfilMock.mockReset();
});

describe('cargarPerfil', () => {
  it('devuelve el perfil existente sin crear otro', async () => {
    getPerfilMock.mockResolvedValueOnce(perfil);
    await expect(cargarPerfil('token')).resolves.toEqual(perfil);
    expect(crearPerfilMock).not.toHaveBeenCalled();
  });

  it('crea el perfil con metadatos saneados cuando Django responde 403', async () => {
    getPerfilMock.mockRejectedValueOnce(new ApiError(403, 'Sin perfil'));
    crearPerfilMock.mockResolvedValueOnce(perfil);
    await expect(cargarPerfil('token', {
      nombre: '  Ana ',
      apellido: ' Pérez ',
      telefono: '+52 (664) 000-0000',
    }, 'ana@example.com')).resolves.toEqual(perfil);
    expect(crearPerfilMock).toHaveBeenCalledWith({
      nombre: 'Ana',
      apellido: 'Pérez',
      telefono: '+52 (664) 000-0000',
    }, 'token');
  });

  it('usa valores seguros si faltan metadatos', async () => {
    getPerfilMock.mockRejectedValueOnce(new ApiError(403, 'Sin perfil'));
    crearPerfilMock.mockResolvedValueOnce(perfil);
    await cargarPerfil('token', {}, 'nueva@example.com');
    expect(crearPerfilMock).toHaveBeenCalledWith({
      nombre: 'nueva',
      apellido: 'Benefy',
      telefono: null,
    }, 'token');
  });

  it('descarta teléfonos inválidos en vez de bloquear el alta', async () => {
    getPerfilMock.mockRejectedValueOnce(new ApiError(403, 'Sin perfil'));
    crearPerfilMock.mockResolvedValueOnce(perfil);
    await cargarPerfil('token', { telefono: 'abc' }, 'ana@example.com');
    expect(crearPerfilMock).toHaveBeenCalledWith(expect.objectContaining({ telefono: null }), 'token');
  });

  it('vuelve a consultar si otra petición creó el perfil primero', async () => {
    getPerfilMock
      .mockRejectedValueOnce(new ApiError(403, 'Sin perfil'))
      .mockResolvedValueOnce(perfil);
    crearPerfilMock.mockRejectedValueOnce(new ApiError(409, 'Ya existe'));
    await expect(cargarPerfil('token', {}, 'ana@example.com')).resolves.toEqual(perfil);
    expect(getPerfilMock).toHaveBeenCalledTimes(2);
  });

  it('propaga errores que no son de perfil ausente', async () => {
    const error = new ApiError(503, 'Supabase no disponible');
    getPerfilMock.mockRejectedValueOnce(error);
    await expect(cargarPerfil('token')).rejects.toBe(error);
    expect(crearPerfilMock).not.toHaveBeenCalled();
  });
});
