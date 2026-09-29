import { describe, expect, it, vi } from 'vitest';
import { MesasService } from './mesas.service';
import { SupabaseService } from './supabase.service';

describe('MesasService', () => {
  it('consulta mesas con disponibilidad VACIA', async () => {
    const consultaMesas = {
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [{ id: 2 }], error: null })
    };
    const from = vi.fn(() => consultaMesas);
    const service = new MesasService({ getClient: () => ({ from }) } as unknown as SupabaseService);
    expect(await service.obtenerMesasDisponibles()).toEqual([{ id: 2 }]);
    expect(consultaMesas.eq).toHaveBeenCalledWith('disponibilidad', 'VACIA');
  });

});
