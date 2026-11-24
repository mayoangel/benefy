import { File } from 'expo-file-system';

import { supabase } from './supabase';
import { AvatarError, removeAvatarUrl, uploadAvatar } from './storage';

jest.mock('expo-file-system', () => {
  class MockFile {
    static type = 'image/jpeg';
    static size = 1024;
    type = MockFile.type;
    size = MockFile.size;
    uri: string;

    constructor(uri: string) {
      this.uri = uri;
    }

    async bytes() {
      return new Uint8Array(MockFile.size);
    }
  }
  return { File: MockFile };
});

jest.mock('./supabase', () => ({
  supabase: {
    storage: {
      from: jest.fn(),
    },
  },
}));

const MockFile = File as unknown as { type: string; size: number };
const from = supabase.storage.from as jest.Mock;

beforeEach(() => {
  from.mockReset();
  MockFile.type = 'image/jpeg';
  MockFile.size = 1024;
});

describe('uploadAvatar', () => {
  it('rechaza archivos que no son imágenes permitidas', async () => {
    MockFile.type = 'application/pdf';
    await expect(uploadAvatar('file://foto.pdf', 'uid-1')).rejects.toThrow(
      'La foto debe ser JPEG, PNG o WebP.',
    );
    expect(from).not.toHaveBeenCalled();
  });

  it('rechaza imágenes de más de 5 MB', async () => {
    MockFile.type = 'image/png';
    MockFile.size = 5 * 1024 * 1024 + 1;
    await expect(uploadAvatar('file://foto.png', 'uid-1')).rejects.toBeInstanceOf(AvatarError);
    expect(from).not.toHaveBeenCalled();
  });

  it('sube a la carpeta del usuario y devuelve la URL pública', async () => {
    const upload = jest.fn().mockResolvedValue({ error: null });
    const getPublicUrl = jest.fn().mockReturnValue({
      data: { publicUrl: 'https://project.supabase.co/storage/v1/object/public/avatars/uid-1/perfil-1.jpg' },
    });
    from.mockReturnValue({ upload, getPublicUrl });

    await expect(uploadAvatar('file://foto.jpg', 'uid-1')).resolves.toEqual({
      url: 'https://project.supabase.co/storage/v1/object/public/avatars/uid-1/perfil-1.jpg',
      path: expect.stringMatching(/^uid-1\/perfil-\d+\.jpg$/),
    });
    expect(from).toHaveBeenCalledWith('avatars');
    expect(upload).toHaveBeenCalledWith(
      expect.stringMatching(/^uid-1\/perfil-\d+\.jpg$/),
      expect.any(Uint8Array),
      expect.objectContaining({ contentType: 'image/jpeg', upsert: false }),
    );
  });

  it('traduce el rechazo de RLS a un mensaje accionable', async () => {
    from.mockReturnValue({
      upload: jest.fn().mockResolvedValue({
        error: { message: 'new row violates row-level security policy' },
      }),
    });
    await expect(uploadAvatar('file://foto.jpg', 'uid-1')).rejects.toThrow(
      'No tienes permiso para subir esta foto. Revisa la configuración de Storage.',
    );
  });

  it('explica cuando el bucket todavía no está configurado', async () => {
    from.mockReturnValue({
      upload: jest.fn().mockResolvedValue({
        error: { message: 'Bucket not found' },
      }),
    });
    await expect(uploadAvatar('file://foto.jpg', 'uid-1')).rejects.toThrow(
      'El almacenamiento de fotos no está configurado. Contacta a soporte de Benefy.',
    );
  });
});

describe('removeAvatarUrl', () => {
  it('borra solo objetos de la carpeta del usuario autenticado', async () => {
    const remove = jest.fn().mockResolvedValue({ error: null });
    from.mockReturnValue({ remove });

    await removeAvatarUrl(
      'https://project.supabase.co/storage/v1/object/public/avatars/uid-1/perfil-1.jpg',
      'uid-1',
    );
    expect(remove).toHaveBeenCalledWith(['uid-1/perfil-1.jpg']);

    remove.mockClear();
    await removeAvatarUrl(
      'https://project.supabase.co/storage/v1/object/public/avatars/otro-uid/perfil-1.jpg',
      'uid-1',
    );
    expect(remove).not.toHaveBeenCalled();
  });

  it('ignora URLs externas o inválidas sin lanzar', async () => {
    await expect(removeAvatarUrl('https://example.com/foto.jpg', 'uid-1')).resolves.toBeUndefined();
    await expect(removeAvatarUrl('no-es-url', 'uid-1')).resolves.toBeUndefined();
  });
});
