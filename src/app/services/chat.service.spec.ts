import { describe, it, expect, vi } from 'vitest';
import { ChatService, CHAT_CANAL } from './chat.service';
import { SupabaseService } from './supabase.service';
import { ChatMensaje, combinarMensajes } from '../interfaces/chat-mensaje';

const mensaje = (id: string, creado_en = '2026-09-17T17:00:00Z'): ChatMensaje => ({
  id, creado_en, autor_id: 'cliente', autor_nombre: 'Ana', autor_rol: 'CLIENTE_REGISTRADO',
  numero_mesa: 4, texto: '¿Me traen agua?', respuesta_a: null, respuesta_texto: null, respuesta_autor: null
});

describe('Chat del salón', () => {
  it('combina historial, envío y Realtime sin duplicar y conserva el orden', () => {
    const original = mensaje('b');
    const resultado = combinarMensajes([original], [mensaje('c', '2026-09-17T17:01:00Z'), original, mensaje('a')]);
    expect(resultado.map(item => item.id)).toEqual(['a', 'b', 'c']);
  });

  it('envía solo texto, mesa declarada y referencias; el servidor determina el autor y la hora', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: mensaje('id'), error: null });
    const service = new ChatService({ getClient: () => ({ rpc }) } as unknown as SupabaseService);
    await service.enviar('id', '  Hola\n¿Hay agua?  ', 'consulta', 4);
    expect(rpc).toHaveBeenCalledWith('chat_enviar', {
      p_id: 'id', p_texto: 'Hola\n¿Hay agua?', p_respuesta_a: 'consulta', p_numero_mesa: 4
    });
  });

  it('rechaza mensajes vacíos, demasiado largos y mesas inválidas antes del envío', async () => {
    const rpc = vi.fn();
    const service = new ChatService({ getClient: () => ({ rpc }) } as unknown as SupabaseService);
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
    const service = new ChatService({ getClient: () => ({ rpc }) } as unknown as SupabaseService);
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
    const service = new ChatService({ getClient: () => client } as unknown as SupabaseService);
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
