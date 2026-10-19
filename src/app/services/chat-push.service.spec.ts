import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatPushService } from './chat-push.service';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';

const mocks = vi.hoisted(() => ({
  native: vi.fn(), subscribeTo: vi.fn(), unsubscribeFrom: vi.fn()
}));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: mocks.native } }));
vi.mock('@capacitor-community/fcm', () => ({ FCM: mocks }));

describe('Suscripciones push del chat', () => {
  const getSession = vi.fn();
  const onAuthStateChange = vi.fn();
  const obtenerPerfil = vi.fn();
  const crear = () => new ChatPushService({
    getClient: () => ({ auth: { getSession, onAuthStateChange } })
  } as unknown as SupabaseService, { obtenerPerfil } as unknown as AuthService);

  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    mocks.native.mockReturnValue(true);
    mocks.subscribeTo.mockResolvedValue({});
    mocks.unsubscribeFrom.mockResolvedValue({});
    getSession.mockResolvedValue({ data: { session: { user: { id: 'mozo' } } } });
    obtenerPerfil.mockResolvedValue({ id: 'mozo', rol: 'MOZO', estado: 'ACTIVO' });
  });

  it('suscribe cada dispositivo del mozo al mismo topic', async () => {
    const service = crear();
    service.activar();
    await vi.waitFor(() => expect(mocks.subscribeTo).toHaveBeenCalledWith({ topic: 'mozos' }));
    expect(onAuthStateChange).toHaveBeenCalledTimes(1);
  });

  it('cambia de mozo a cliente sin conservar la suscripción del mozo', async () => {
    const service = crear();
    service.activar();
    await vi.waitFor(() => expect(mocks.subscribeTo).toHaveBeenCalledWith({ topic: 'mozos' }));
    getSession.mockResolvedValue({ data: { session: { user: { id: 'cliente' } } } });
    obtenerPerfil.mockResolvedValue({ id: 'cliente', rol: 'CLIENTE_ANONIMO', estado: 'ACTIVO' });
    await service.actualizar();
    expect(mocks.unsubscribeFrom).toHaveBeenCalledWith({ topic: 'mozos' });
    expect(mocks.subscribeTo).toHaveBeenLastCalledWith({ topic: 'chat_cliente_cliente' });
    expect(JSON.parse(localStorage.getItem('cepa.chat.push.topics')!)).toEqual(['cliente_cliente', 'chat_cliente_cliente']);
  });

  it('elimina la suscripción cuando se cierra sesión', async () => {
    localStorage.setItem('cepa.chat.push.topics', JSON.stringify(['chat_cliente_anterior']));
    getSession.mockResolvedValue({ data: { session: null } });
    const service = crear();
    service.activar();
    await service.actualizar();
    expect(mocks.unsubscribeFrom).toHaveBeenCalledWith({ topic: 'chat_cliente_anterior' });
    expect(mocks.subscribeTo).not.toHaveBeenCalled();
    expect(obtenerPerfil).not.toHaveBeenCalled();
  });

  it('limpia los topics aunque el nuevo usuario no pueda participar', async () => {
    localStorage.setItem('cepa.chat.push.topics', JSON.stringify(['mozos']));
    obtenerPerfil.mockResolvedValue({ id: 'mozo', rol: 'CLIENTE_REGISTRADO', estado: 'PENDIENTE' });
    const service = crear();
    service.activar();
    await service.actualizar();
    expect(mocks.unsubscribeFrom).toHaveBeenCalledWith({ topic: 'mozos' });
    expect(mocks.subscribeTo).not.toHaveBeenCalled();
  });

  it('espera el registro antes de suscribir', async () => {
    await crear().actualizar();
    expect(mocks.subscribeTo).not.toHaveBeenCalled();
    expect(getSession).not.toHaveBeenCalled();
  });

  it('no desuscribe al mozo durante las actualizaciones de perfil', async () => {
    const service = crear();
    service.activar();
    await service.actualizar();
    await service.actualizar();
    expect(mocks.unsubscribeFrom).not.toHaveBeenCalledWith({ topic: 'mozos' });
  });

  it.each([['METRE', 'metre_lista_espera'], ['COCINERO', 'cocina'], ['CANTINERO', 'bar']])('suscribe el rol %s', async (rol, topic) => {
    obtenerPerfil.mockResolvedValue({ id: 'mozo', rol, estado: 'ACTIVO' });
    const service = crear();
    service.activar();
    await service.actualizar();
    expect(mocks.subscribeTo).toHaveBeenCalledWith({ topic });
  });

  it('reintenta una suscripción fallida al actualizar y no bloquea la cola', async () => {
    mocks.subscribeTo.mockRejectedValueOnce(new Error('Sin conexión'));
    const service = crear();
    service.activar();
    await service.actualizar();
    expect(mocks.subscribeTo).toHaveBeenCalledTimes(2);
    expect(JSON.parse(localStorage.getItem('cepa.chat.push.topics')!)).toEqual(['mozos']);
  });

  it('no usa FCM en el navegador', async () => {
    mocks.native.mockReturnValue(false);
    const service = crear();
    service.activar();
    await service.actualizar();
    expect(getSession).not.toHaveBeenCalled();
    expect(mocks.subscribeTo).not.toHaveBeenCalled();
  });

  it.each([['DUENO', 'duenos'], ['SUPERVISOR', 'supervisores']])('suscribe %s a pagos y limpia al salir', async (rol, topic) => {
    obtenerPerfil.mockResolvedValue({ id: 'mozo', rol, estado: 'ACTIVO' });
    const service = crear();
    service.activar();
    await service.actualizar();
    expect(mocks.subscribeTo).toHaveBeenCalledWith({ topic });
    getSession.mockResolvedValue({ data: { session: null } });
    await service.actualizar();
    expect(mocks.unsubscribeFrom).toHaveBeenCalledWith({ topic });
  });
});
