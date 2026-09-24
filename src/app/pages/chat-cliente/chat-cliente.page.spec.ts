import { describe, it, expect, vi } from 'vitest';
import { ChatClientePage } from './chat-cliente.page';
import { ChatService, EstadoChat } from '../../services/chat.service';
import { ChatMensaje } from '../../interfaces/chat-mensaje';

const cliente = { id: 'cliente', nombre: 'Ana', rol: 'CLIENTE_REGISTRADO' as const, numero_mesa: null };
const mensaje: ChatMensaje = {
  id: 'mensaje', autor_id: 'cliente', autor_nombre: 'Ana', autor_rol: 'CLIENTE_REGISTRADO',
  numero_mesa: 8, texto: '¿Me traen agua?', creado_en: '2026-09-17T17:00:00Z',
  respuesta_a: null, respuesta_texto: null, respuesta_autor: null
};

describe('Página chat-cliente', () => {
  it('reintenta la push fallida sin volver a insertar el mensaje', async () => {
    const enviar = vi.fn().mockResolvedValue(mensaje);
    const notificar = vi.fn().mockRejectedValueOnce(new Error('Sin FCM')).mockResolvedValue(undefined);
    const page = new ChatClientePage({ enviar, notificar } as unknown as ChatService);
    page.participante.set(cliente);
    page.numeroMesa.set(8);
    page.borrador = mensaje.texto;
    await page.enviar();
    expect(page.mensajes()).toEqual([mensaje]);
    expect(page.errorEnvio()).toBe('');
    expect(page.avisosPendientes()).toEqual(['mensaje']);
    await page.reintentarAvisos();
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(notificar).toHaveBeenCalledTimes(2);
    expect(page.avisosPendientes()).toEqual([]);
    page.ngOnDestroy();
  });

  it('carga el número de mesa vinculado sin pedir que se escriba manualmente', async () => {
    const service = {
      participante: vi.fn().mockResolvedValue({ ...cliente, rol: 'CLIENTE_ANONIMO', numero_mesa: 8 }),
      historial: vi.fn().mockResolvedValue([]), conectar: vi.fn().mockReturnValue(vi.fn())
    };
    const page = new ChatClientePage(service as unknown as ChatService);
    await page.iniciar();
    expect(page.numeroMesa()).toBe(8);
    expect(page.puedeEscribir()).toBe(true);
    page.ngOnDestroy();
  });

  it('bloquea el envío hasta cargar la mesa vinculada del cliente', async () => {
    const enviar = vi.fn().mockResolvedValue(mensaje);
    const page = new ChatClientePage({ enviar, notificar: vi.fn().mockResolvedValue(undefined) } as unknown as ChatService);
    page.participante.set(cliente);
    page.borrador = mensaje.texto;
    await page.enviar();
    expect(enviar).not.toHaveBeenCalled();
    page.numeroMesa.set(8);
    await page.enviar();
    expect(enviar).toHaveBeenCalledWith(expect.any(String), mensaje.texto, null, 8);
    expect(page.mensajes()).toEqual([mensaje]);
    expect(page.borrador).toBe('');
    page.ngOnDestroy();
  });

  it('conserva borrador y UUID al reintentar un envío fallido, sin duplicar el eco de Realtime', async () => {
    const enviar = vi.fn().mockRejectedValueOnce(new Error('Sin conexión')).mockResolvedValue(mensaje);
    const page = new ChatClientePage({ enviar, notificar: vi.fn().mockResolvedValue(undefined) } as unknown as ChatService);
    page.participante.set(cliente);
    page.numeroMesa.set(8);
    page.borrador = mensaje.texto;
    await page.enviar();
    expect(page.borrador).toBe(mensaje.texto);
    expect(page.errorEnvio()).not.toBe('');
    page.mensajes.set([mensaje]);
    await page.enviar();
    expect(enviar.mock.calls[0][0]).toBe(enviar.mock.calls[1][0]);
    expect(page.mensajes()).toHaveLength(1);
    expect(page.errorEnvio()).toBe('');
    page.ngOnDestroy();
  });

  it('un mozo responde a cualquier consulta sin ingresar una mesa manual', async () => {
    const enviar = vi.fn().mockResolvedValue({ ...mensaje, id: 'respuesta', autor_rol: 'MOZO' });
    const page = new ChatClientePage({ enviar, notificar: vi.fn().mockResolvedValue(undefined) } as unknown as ChatService);
    page.participante.set({ ...cliente, id: 'mozo', rol: 'MOZO' });
    page.responder(mensaje);
    page.borrador = 'Ya te llevo agua';
    await page.enviar();
    expect(enviar).toHaveBeenCalledWith(expect.any(String), 'Ya te llevo agua', mensaje.id, null);
    page.ngOnDestroy();
  });

  it('no conecta si se sale de la página mientras se obtiene el perfil', async () => {
    let resolver!: (value: typeof cliente) => void;
    const participante = vi.fn(() => new Promise<typeof cliente>(resolve => { resolver = resolve; }));
    const conectar = vi.fn();
    const page = new ChatClientePage({ participante, conectar } as unknown as ChatService);
    const carga = page.iniciar();
    page.ionViewDidLeave();
    resolver(cliente);
    await carga;
    expect(conectar).not.toHaveBeenCalled();
    expect(page.participante()).toBeNull();
  });

  it('recupera más de una página de mensajes al reconectar sin dejar huecos', async () => {
    let cambiarEstado!: (estado: EstadoChat) => void;
    const lote = Array.from({ length: 50 }, (_, indice) => ({ ...mensaje, id: `nuevo-${indice}` }));
    const posteriores = vi.fn().mockResolvedValueOnce(lote).mockResolvedValueOnce([{ ...mensaje, id: 'ultimo' }]);
    const service = {
      participante: vi.fn().mockResolvedValue(cliente),
      historial: vi.fn().mockResolvedValue([mensaje]),
      posteriores,
      conectar: vi.fn((_recibir, estado) => { cambiarEstado = estado; return vi.fn(); })
    };
    const page = new ChatClientePage(service as unknown as ChatService);
    await page.iniciar();
    cambiarEstado('conectado');
    await vi.waitFor(() => expect(page.mensajes()).toHaveLength(52));
    expect(posteriores).toHaveBeenCalledTimes(2);
    expect(posteriores.mock.calls[1][0].id).toBe('nuevo-49');
    page.ngOnDestroy();
  });
});
