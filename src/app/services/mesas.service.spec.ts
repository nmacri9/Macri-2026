import { describe, expect, it, vi } from 'vitest';
import { MesasService } from './mesas.service';
import { SupabaseService } from './supabase.service';

describe('MesasService', () => {
  function escenarioAsignacion(falloPush = false, falloAsignacion = false) {
    const respuestas = [
      { data: { cantidad_personas: 2, cliente_id: 42 } },
      { data: { capacidad: 4, disponibilidad: 'VACIA' } },
      { data: null },
      { count: falloAsignacion ? 0 : 1 },
      { count: 1 },
      { data: { cliente_id: 'auth-cliente' } },
    ];
    const from = vi.fn(() => {
      const respuesta = respuestas.shift();
      const consulta: any = {};
      for (const metodo of ['select', 'eq', 'is', 'limit', 'update']) {
        consulta[metodo] = vi.fn(() => consulta);
      }
      consulta.single = consulta.maybeSingle = () => Promise.resolve(respuesta);
      consulta.then = (resolve: any, reject: any) => Promise.resolve(respuesta).then(resolve, reject);
      return consulta;
    });
    const invoke = vi.fn().mockResolvedValue(falloPush
      ? { error: new Error('Servidor no disponible') } : { data: { success: true } });
    const service = new MesasService({ getClient: () => ({ from, functions: { invoke } }) } as unknown as SupabaseService);
    return { service, invoke, from };
  }

  it('avisa al UUID del cliente con el número de mesa después de guardarla', async () => {
    const { service, invoke, from } = escenarioAsignacion();
    expect(await service.asignarMesaACliente(1, 5)).toEqual({ notificacionEnviada: true });
    expect(from.mock.calls.length).toBe(6);
    expect(invoke).toHaveBeenCalledWith('enviar-notificacion', {
      body: {
        topic: 'cliente_auth-cliente', titulo: '¡Ya tenés mesa asignada!',
        cuerpo: 'Te han asignado la mesa 5. Acercate y escaneá el QR de tu mesa.',
        data: { ruta: '/home', mesa_id: '5' },
      },
    });
  });

  it('no envía el aviso si no se pudo guardar la asignación', async () => {
    const { service, invoke } = escenarioAsignacion(false, true);
    await expect(service.asignarMesaACliente(1, 5)).rejects.toThrow('No se pudo actualizar');
    expect(invoke).not.toHaveBeenCalled();
  });

  it('informa el fallo del aviso sin presentar la asignación guardada como fallida', async () => {
    const { service } = escenarioAsignacion(true);
    expect(await service.asignarMesaACliente(1, 5)).toEqual({ notificacionEnviada: false });
  });

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
