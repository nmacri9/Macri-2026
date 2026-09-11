import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientesService } from './clientes.service';
import { SupabaseService } from './supabase.service';

describe('ClientesService', () => {
  const order = vi.fn();
  const filterPending = vi.fn(() => ({ order }));
  const listSelect = vi.fn(() => ({ eq: filterPending }));
  const maybeSingle = vi.fn();
  const updateSelect = vi.fn(() => ({ maybeSingle }));
  const updatePending = vi.fn(() => ({ select: updateSelect }));
  const updateId = vi.fn(() => ({ eq: updatePending }));
  const update = vi.fn(() => ({ eq: updateId }));
  const from = vi.fn(() => ({ select: listSelect, update }));
  let service: ClientesService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ClientesService({ getClient: () => ({ from }) } as unknown as SupabaseService);
  });

  it('consulta solo pendientes sin pedir la columna de contraseña', async () => {
    const clientes = [{ id: 1, estado: 'PENDIENTE' }];
    order.mockResolvedValue({ data: clientes, error: null });
    expect(await service.listarPendientes()).toEqual(clientes);
    expect(from).toHaveBeenCalledWith('clientes');
    expect(filterPending).toHaveBeenCalledWith('estado', 'PENDIENTE');
    expect(listSelect).toHaveBeenCalledWith('id, cliente_id, nombre, apellido, correo, foto_url, estado');
  });

  it.each(['APROBADO', 'RECHAZADO'] as const)('confirma el resultado persistido %s', async estado => {
    maybeSingle.mockResolvedValue({ data: { id: 1, estado }, error: null });
    await service.resolver(1, estado);
    expect(update).toHaveBeenCalledWith({ estado });
    expect(updateId).toHaveBeenCalledWith('id', 1);
    expect(updatePending).toHaveBeenCalledWith('estado', 'PENDIENTE');
    expect(updateSelect).toHaveBeenCalledWith('id, estado');
  });

  it('no considera exitoso un cambio sin filas confirmadas', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(service.resolver(1, 'APROBADO')).rejects.toThrow('No se confirmó');
  });

  it('propaga los errores de permisos del servidor', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: new Error('Acceso denegado') });
    await expect(service.resolver(1, 'RECHAZADO')).rejects.toThrow('Acceso denegado');
  });
});
