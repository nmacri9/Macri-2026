import { describe, it, expect, vi } from 'vitest';
import { ChatService, CHAT_CANAL } from './chat.service';
import { SupabaseService } from './supabase.service';
import { MesasService } from './mesas.service';
import { ChatMensaje, combinarMensajes } from '../interfaces/chat-mensaje';

const mensaje = (id: string, creado_en = '2026-09-17T17:00:00Z'): ChatMensaje => ({
  id, creado_en, autor_id: 'cliente', autor_nombre: 'Ana', autor_rol: 'CLIENTE_REGISTRADO',
  numero_mesa: 4, texto: '¿Me traen agua?', respuesta_a: null, respuesta_texto: null, respuesta_autor: null
});

const mesas = { obtenerAsignacionActiva: vi.fn().mockResolvedValue({ vinculada: true, numero: 4 }) } as unknown as MesasService;

describe('Chat del salón', () => {
  it('rechaza el envío si el cliente ya no tiene una asignación activa', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: 'cliente', rol: 'CLIENTE_ANONIMO' }, error: null });
    const sinMesa = { obtenerAsignacionActiva: vi.fn().mockResolvedValue(null) } as unknown as MesasService;
    const service = new ChatService({ getClient: () => ({ rpc }) } as unknown as SupabaseService, sinMesa);
    await expect(service.enviar('id', 'Hola', null, 4)).rejects.toThrow('mesa asignada');
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('chat_participante');
  });

  it('notifica usando solo el id guardado y detecta errores de la función', async () => {
    const invoke = vi.fn().mockResolvedValueOnce({ data: { success: true }, error: null })
      .mockResolvedValueOnce({ data: null, error: new Error('FCM no disponible') });
    const service = new ChatService({ getClient: () => ({ functions: { invoke } }) } as unknown as SupabaseService, mesas);
    await service.notificar('mensaje');
    expect(invoke).toHaveBeenCalledWith('enviar-notificacion', { body: { mensaje_id: 'mensaje' } });
    await expect(service.notificar('mensaje')).rejects.toThrow('FCM no disponible');
  });

  it('combina historial, envío y Realtime sin duplicar y conserva el orden', () => {
    const original = mensaje('b');
    const resultado = combinarMensajes([original], [mensaje('c', '2026-09-17T17:01:00Z'), original, mensaje('a')]);
    expect(resultado.map(item => item.id)).toEqual(['a', 'b', 'c']);
  });

  it('usa la mesa asignada aunque se intente enviar otra; el servidor determina el autor y la hora', async () => {
    const rpc = vi.fn().mockResolvedValueOnce({ data: { id: 'cliente', rol: 'CLIENTE_REGISTRADO' }, error: null })
      .mockResolvedValueOnce({ data: mensaje('id'), error: null });
    const service = new ChatService({ getClient: () => ({ rpc }) } as unknown as SupabaseService, mesas);
    await service.enviar('id', '  Hola\n¿Hay agua?  ', 'consulta', 99);
    expect(rpc).toHaveBeenCalledWith('chat_enviar', {
      p_id: 'id', p_texto: 'Hola\n¿Hay agua?', p_respuesta_a: 'consulta', p_numero_mesa: 4
    });
  });

  it('rechaza mensajes vacíos, demasiado largos y mesas inválidas antes del envío', async () => {
    const rpc = vi.fn();
    const service = new ChatService({ getClient: () => ({ rpc }) } as unknown as SupabaseService, mesas);
    await expect(service.enviar('id', '  \n ', null, 1)).rejects.toThrow();
    await expect(service.enviar('id', 'x'.repeat(2001), null, 1)).rejects.toThrow();
    for (const mesa of [0, -1, 1.5, 10000, NaN]) {
      await expect(service.enviar('id', 'Hola', null, mesa)).rejects.toThrow();
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it('propaga el error del servidor para conservar el borrador', async () => {
    const error = { code: '42501', message: 'No autorizado' };
    const rpc = vi.fn().mockResolvedValue({ data: null, error });
    const service = new ChatService({ getClient: () => ({ rpc }) } as unknown as SupabaseService, mesas);
    await expect(service.enviar('id', 'Hola', null, 4)).rejects.toBe(error);
  });

  it('escucha el canal correcto y deja de procesar eventos al salir de la pantalla', () => {
    let recibir!: (payload: { new: ChatMensaje }) => void;
    let estado!: (status: string) => void;
    const canal = {
      on: vi.fn((_event, _filter, callback) => { recibir = callback; return canal; }),
      subscribe: vi.fn(callback => { estado = callback; return canal; })
    };
    const client = { channel: vi.fn(() => canal), removeChannel: vi.fn().mockResolvedValue('ok') };
    const service = new ChatService({ getClient: () => client } as unknown as SupabaseService, mesas);
    const onMensaje = vi.fn();
    const onEstado = vi.fn();
    const cerrar = service.conectar(onMensaje, onEstado);
    expect(client.channel).toHaveBeenCalledWith(CHAT_CANAL);
    expect(canal.on).toHaveBeenCalledWith('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'chat_mensajes'
    }, expect.any(Function));
    estado('SUBSCRIBED');
    expect(onEstado).toHaveBeenLastCalledWith('conectado');
    recibir({ new: mensaje('a') });
    cerrar();
    recibir({ new: mensaje('b') });
    estado('CLOSED');
    expect(onMensaje).toHaveBeenCalledTimes(1);
    expect(onEstado).toHaveBeenLastCalledWith('conectado');
    expect(client.removeChannel).toHaveBeenCalledWith(canal);
  });
});
