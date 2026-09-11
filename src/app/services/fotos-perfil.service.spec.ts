import { describe, expect, it, vi } from 'vitest';
import { SupabaseClient } from '@supabase/supabase-js';
import { FotosPerfilService } from './fotos-perfil.service';

describe('FotosPerfilService', () => {
  it('sube la foto a la carpeta de perfiles y devuelve la URL pública', async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    const getPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl: 'https://storage.test/perfiles/foto.jpg' } });
    const from = vi.fn(() => ({ upload, getPublicUrl }));
    const service = new FotosPerfilService();

    const resultado = await service.subir(
      { storage: { from } } as unknown as SupabaseClient,
      'cliente-id',
      'data:image/jpeg;base64,Zm90bw=='
    );

    expect(from).toHaveBeenCalledWith('productos');
    expect(upload).toHaveBeenCalledWith(
      expect.stringMatching(/^perfiles\/cliente-id\/.+\.jpg$/),
      expect.objectContaining({ type: 'image/jpeg' }),
      { cacheControl: '3600', upsert: false }
    );
    expect(resultado.url).toBe('https://storage.test/perfiles/foto.jpg');
    expect(resultado.ruta).toMatch(/^perfiles\/cliente-id\/.+\.jpg$/);
  });
});
