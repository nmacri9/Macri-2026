import { describe, it, expect, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { ChatService, CHAT_CANAL } from './chat.service';
import { SupabaseService } from './supabase.service';
import { MesasService } from './mesas.service';
import { AuthService } from './auth.service';
import { MensajeDB, combinarMensajes, mensajeDesdeDB } from '../interfaces/chat-mensaje';

const fila: MensajeDB = {
  id: 10, created_at: '2026-09-29T17:00:00Z', autor_id: 'cliente', autor_nombre: 'Ana',
  autor_rol: 'CLIENTE_REGISTRADO', mesa_id: 4, texto: 'Hola', respuesta_a: null,
  respuesta_texto: null, respuesta_autor: null
};
const perfil = { id: 'cliente', nombres: 'Ana', apellidos: '', rol: 'CLIENTE_REGISTRADO', estado: 'APROBADO' };

function preparar() {
  const request = vi.fn().mockResolvedValue(new Response(JSON.stringify(fila), {
    status: 201, headers: { 'Content-Type': 'application/json' }
  }));
  const client = createClient('https://example.supabase.co', 'clave-pruebas', {
    global: { fetch: request }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  const obtenerPerfil = vi.fn().mockResolvedValue(perfil);
  const obtenerAsignacionActiva = vi.fn().mockResolvedValue({ mesaId: 4, vinculada: true });
  const service = new ChatService({ getClient: () => client } as unknown as SupabaseService,
    { obtenerAsignacionActiva } as unknown as MesasService, { obtenerPerfil } as unknown as AuthService);
  return { service, request, obtenerPerfil, obtenerAsignacionActiva };
}

describe('Chat con public.mensajes', () => {
  it('envía texto y referencia; la base determina identidad y mesa', async () => {
    const { service, request } = preparar();
    const resultado = await service.enviar('solicitud', '  Hola  ', null, 99);
    const [url, opciones] = request.mock.calls[0];
    expect(String(url)).toContain('/rest/v1/mensajes');
    expect(JSON.parse(opciones.body)).toEqual({ solicitud_id: 'solicitud', texto: 'Hola', respuesta_a: null });
    expect(resultado).toEqual(mensajeDesdeDB(fila));
  });

  it('recupera el mensaje original tras un reintento sin duplicarlo', async () => {
    const { service, request } = preparar();
    request.mockResolvedValueOnce(new Response(JSON.stringify({ code: '23505', message: 'duplicado' }), {
      status: 409, headers: { 'Content-Type': 'application/json' }
    })).mockResolvedValueOnce(new Response(JSON.stringify(fila), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    }));
    expect((await service.enviar('solicitud', 'Hola', null, 4)).id).toBe('10');
    const url = new URL(request.mock.calls[1][0]);
    expect(url.searchParams.get('solicitud_id')).toBe('eq.solicitud');
    expect(url.searchParams.get('autor_id')).toBe('eq.cliente');
  });

  it('pagina por created_at e id y adapta las respuestas al modelo de la pantalla', async () => {
    const { service, request } = preparar();
    request.mockResolvedValueOnce(new Response(JSON.stringify([{ ...fila, respuesta_a: 2 }]), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    }));
    const mensajes = await service.historial(mensajeDesdeDB(fila));
    const url = new URL(request.mock.calls[0][0]);
    expect(url.searchParams.get('order')).toBe('created_at.desc,id.desc');
    expect(url.searchParams.get('or')).toContain('id.lt.10');
    expect(mensajes[0].respuesta_a).toBe('2');
  });

  it('ordena los ids bigint numéricamente para mensajes de la misma fecha', () => {
    const mensajes = combinarMensajes([], [mensajeDesdeDB(fila), mensajeDesdeDB({ ...fila, id: 2 })]);
    expect(mensajes.map(m => m.id)).toEqual(['2', '10']);
  });

  it('bloquea clientes sin asignación y perfiles no habilitados antes de guardar', async () => {
    const { service, request, obtenerPerfil, obtenerAsignacionActiva } = preparar();
    obtenerAsignacionActiva.mockResolvedValueOnce(null);
    await expect(service.enviar('id', 'Hola', null, 4)).rejects.toThrow('mesa asignada');
    obtenerPerfil.mockResolvedValueOnce({ ...perfil, estado: 'PENDIENTE' });
    await expect(service.participante()).rejects.toMatchObject({ code: '42501' });
    expect(request).not.toHaveBeenCalled();
  });

  it('permite al mozo participar sin mesa y al cliente con un id mayor que 9999', async () => {
    const { service, obtenerPerfil, obtenerAsignacionActiva } = preparar();
    obtenerPerfil.mockResolvedValueOnce({ ...perfil, rol: 'MOZO', estado: 'ACTIVO' });
    expect((await service.participante()).numero_mesa).toBeNull();
    expect(obtenerAsignacionActiva).not.toHaveBeenCalled();
    obtenerAsignacionActiva.mockResolvedValueOnce({ mesaId: 10000 });
    expect((await service.participante()).numero_mesa).toBe(10000);
  });

  it('rechaza mensajes vacíos y demasiado largos antes del envío', async () => {
    const { service, request } = preparar();
    await expect(service.enviar('id', '  \n ', null, 4)).rejects.toThrow();
    await expect(service.enviar('id', 'x'.repeat(2001), null, 4)).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });

  it('escucha mensajes reales y deja de procesar al salir de la pantalla', () => {
    let recibir!: (payload: { new: MensajeDB }) => void;
    const canal = {
      on: vi.fn((_event, _filter, callback) => { recibir = callback; return canal; }),
      subscribe: vi.fn().mockReturnThis()
    };
    const client = { channel: vi.fn(() => canal), removeChannel: vi.fn().mockResolvedValue('ok') };
    const service = new ChatService({ getClient: () => client } as unknown as SupabaseService,
      {} as MesasService, {} as AuthService);
    const onMensaje = vi.fn();
    const cerrar = service.conectar(onMensaje, vi.fn());
    expect(client.channel).toHaveBeenCalledWith(CHAT_CANAL);
    expect(canal.on).toHaveBeenCalledWith('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'mensajes'
    }, expect.any(Function));
    recibir({ new: fila });
    cerrar();
    recibir({ new: fila });
    expect(onMensaje).toHaveBeenCalledExactlyOnceWith(mensajeDesdeDB(fila));
  });
});
