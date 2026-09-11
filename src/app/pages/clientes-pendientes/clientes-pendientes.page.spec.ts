import { ChangeDetectorRef } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientesPendientesPage } from './clientes-pendientes.page';
import { ClientePendiente, ClientesService } from '../../services/clientes.service';

vi.mock('@capacitor/haptics', () => ({
  Haptics: { impact: vi.fn().mockResolvedValue(undefined) }, ImpactStyle: { Light: 'LIGHT' }
}));

describe('Clientes pendientes', () => {
  let page: ClientesPendientesPage;
  const listarPendientes = vi.fn();
  const resolver = vi.fn();
  const cliente: ClientePendiente = {
    id: 1, cliente_id: 'auth-id', nombre: 'Ana', apellido: 'Pérez',
    correo: 'ana@example.com', foto_url: null, estado: 'PENDIENTE'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    page = new ClientesPendientesPage(
      { markForCheck: vi.fn() } as unknown as ChangeDetectorRef,
      {} as ModalController,
      { listarPendientes, resolver } as unknown as ClientesService
    );
    page.clientesPendientes = [cliente];
  });

  it('vuelve a cargar la lista al entrar a la pantalla', async () => {
    listarPendientes.mockResolvedValue([cliente]);
    await page.ionViewWillEnter();
    expect(listarPendientes).toHaveBeenCalledOnce();
    expect(page.clientesPendientes).toEqual([cliente]);
    expect(page.cargando).toBe(false);
  });

  it('cancelar no escribe ni elimina el cliente del listado', async () => {
    vi.spyOn(page, 'pedirConfirmacion').mockResolvedValue(false);
    await page.aceptarCliente(1, 'Ana');
    expect(resolver).not.toHaveBeenCalled();
    expect(page.clientesPendientes).toEqual([cliente]);
    expect(page.procesandoId).toBeNull();
  });

  it('conserva al cliente si falla la actualización', async () => {
    vi.spyOn(page, 'pedirConfirmacion').mockResolvedValue(true);
    resolver.mockRejectedValue(new Error('Sin permisos'));
    await page.rechazarCliente(1, 'Ana');
    expect(page.clientesPendientes).toEqual([cliente]);
    expect(page.errorMensaje).not.toBe('');
    expect(page.procesandoId).toBeNull();
  });

  it('evita doble envío y retira la solicitud solo tras guardar', async () => {
    vi.spyOn(page, 'pedirConfirmacion').mockResolvedValue(true);
    let completar!: () => void;
    resolver.mockReturnValue(new Promise<void>(resolve => { completar = resolve; }));
    const guardado = page.aceptarCliente(1, 'Ana');
    await Promise.resolve();
    await page.aceptarCliente(1, 'Ana');
    expect(resolver).toHaveBeenCalledOnce();
    expect(resolver).toHaveBeenCalledWith(1, 'APROBADO');
    expect(page.clientesPendientes).toEqual([cliente]);
    completar();
    await guardado;
    expect(page.clientesPendientes).toEqual([]);
    expect(page.mensajeExito).toBe('Cliente aprobado.');
  });
});
