import { describe, expect, it, vi } from 'vitest';
import { MesasService } from './mesas.service';
import { SupabaseService } from './supabase.service';

describe('Mesas disponibles para asignación', () => {
  function preparar(mesas: unknown[] | null, asignaciones: unknown[] = [], error: unknown = null) {
    const consultaAsignaciones = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: asignaciones, error })
    };
    const consultaMesas = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: mesas, error: null })
    };
    const from = vi.fn((tabla: string) => tabla === 'mesas' ? consultaMesas : consultaAsignaciones);
    const service = new MesasService({ getClient: () => ({ from }) } as unknown as SupabaseService);
    return { service, from, consultaAsignaciones };
  }

  it('lista todas las mesas cuando no hay asignaciones activas', async () => {
    const mesas = [{ id: 1, numero: 8, capacidad: 4 }, { id: 2, numero: 12, capacidad: 2 }];
    const { service, consultaAsignaciones } = preparar(mesas);
    expect(await service.obtenerMesasDisponibles()).toEqual(mesas);
    expect(consultaAsignaciones.eq).toHaveBeenCalledWith('activa', true);
  });

  it('excluye solamente las mesas con una asignación activa', async () => {
    const mesas = [{ id: 1, numero: 8 }, { id: 2, numero: 12 }];
    const { service } = preparar(mesas, [{ mesa_id: 1 }]);
    expect(await service.obtenerMesasDisponibles()).toEqual([mesas[1]]);
  });

  it('no permite una segunda asignación si la mesa figura VACIA pero conserva una activa', async () => {
    const { service } = preparar([{ id: 2, numero: 1, disponibilidad: 'VACIA' }], [{ mesa_id: 2 }]);
    expect(await service.obtenerMesasDisponibles()).toEqual([]);
  });

  it('conserva el error de permisos para no aparentar que no hay mesas', async () => {
    const error = { code: '42501', message: 'permission denied for table asignaciones_mesa' };
    const { service } = preparar([], [], error);
    await expect(service.obtenerMesasDisponibles()).rejects.toBe(error);
  });

  it('admite una respuesta sin filas sin fallar al filtrar', async () => {
    const { service } = preparar(null);
    expect(await service.obtenerMesasDisponibles()).toEqual([]);
  });

  it('no escribe la asignación si no pudo verificar la disponibilidad', async () => {
    const error = { code: '42501', message: 'permission denied' };
    const consulta = {
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error }), insert: vi.fn()
    };
    const service = new MesasService({ getClient: () => ({ from: () => consulta }) } as unknown as SupabaseService);
    await expect(service.asignarMesaACliente('cliente', 1, 'metre')).rejects.toBe(error);
    expect(consulta.insert).not.toHaveBeenCalled();
  });
});
