import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientesService } from './clientes.service';
import { SupabaseService } from './supabase.service';
import { EmailService } from './email.service';

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
  const enviarCorreoAprobado = vi.fn();
  const enviarCorreoRechazado = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    enviarCorreoAprobado.mockResolvedValue(true);
    enviarCorreoRechazado.mockResolvedValue(true);
    service = new ClientesService(
      { getClient: () => ({ from }) } as unknown as SupabaseService,
      { enviarCorreoAprobado, enviarCorreoRechazado } as unknown as EmailService
    );
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
    maybeSingle.mockResolvedValue({
      data: { id: 1, estado, nombre: 'Ana', apellido: 'Pérez', correo: 'ana@example.com' }, error: null
    });
    expect(await service.resolver(1, estado)).toEqual({ correoEnviado: true });
    expect(update).toHaveBeenCalledWith({ estado });
    expect(updateId).toHaveBeenCalledWith('id', 1);
    expect(updatePending).toHaveBeenCalledWith('estado', 'PENDIENTE');
    expect(updateSelect).toHaveBeenCalledWith('id, estado, nombre, apellido, correo');
    const enviado = estado === 'APROBADO' ? enviarCorreoAprobado : enviarCorreoRechazado;
    const otro = estado === 'APROBADO' ? enviarCorreoRechazado : enviarCorreoAprobado;
    expect(enviado).toHaveBeenCalledExactlyOnceWith({ nombre: 'Ana Pérez', correo: 'ana@example.com' });
    expect(otro).not.toHaveBeenCalled();
  });

  it('no considera exitoso un cambio sin filas confirmadas', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(service.resolver(1, 'APROBADO')).rejects.toThrow('No se confirmó');
    expect(enviarCorreoAprobado).not.toHaveBeenCalled();
  });

  it('propaga los errores de permisos del servidor', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: new Error('Acceso denegado') });
    await expect(service.resolver(1, 'RECHAZADO')).rejects.toThrow('Acceso denegado');
    expect(enviarCorreoRechazado).not.toHaveBeenCalled();
  });

  it.each(['fallo', 'excepción', 'sin correo'])('conserva la resolución si el correo no sale: %s', async caso => {
    maybeSingle.mockResolvedValue({
      data: { id: 1, estado: 'APROBADO', nombre: 'Ana', correo: caso === 'sin correo' ? null : 'ana@example.com' },
      error: null
    });
    if (caso === 'excepción') enviarCorreoAprobado.mockRejectedValue(new Error('Sin conexión'));
    else enviarCorreoAprobado.mockResolvedValue(false);
    expect(await service.resolver(1, 'APROBADO')).toEqual({ correoEnviado: false });
    if (caso === 'sin correo') expect(enviarCorreoAprobado).not.toHaveBeenCalled();
  });
});
