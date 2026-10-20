import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmarPedidoPage } from './confirmar-pedido.page';

describe('Cuentas pendientes del mozo', () => {
  const listarPendientes = vi.fn();
  const cuenta = { id: 'cuenta-2', mesa_id: '2', estado: 'pagada', total: 35000 };
  let pagina: ConfirmarPedidoPage;

  beforeEach(() => {
    vi.useFakeTimers();
    listarPendientes.mockReset().mockResolvedValue([]);
    const consulta = {
      select: () => consulta, in: () => consulta,
      order: async () => ({ data: [], error: null }),
    };
    pagina = new ConfirmarPedidoPage(...[
      { getClient: () => ({ from: () => consulta }) }, {},
      { listarPendientes }, {}, {}, {},
      { markForCheck: vi.fn(), detectChanges: vi.fn() },
    ] as unknown as ConstructorParameters<typeof ConfirmarPedidoPage>);
  });

  afterEach(() => {
    pagina.ngOnDestroy();
    vi.useRealTimers();
  });

  it('recupera un pago nuevo sin Push ni eventos Realtime y deja de consultar al salir', async () => {
    pagina.ionViewWillEnter();
    await vi.advanceTimersByTimeAsync(0);
    expect(pagina.cuentas).toEqual([]);
    listarPendientes.mockResolvedValue([cuenta]);
    await vi.advanceTimersByTimeAsync(10000);
    expect(pagina.cuentas).toEqual([cuenta]);
    pagina.ionViewDidLeave();
    await vi.advanceTimersByTimeAsync(20000);
    expect(listarPendientes).toHaveBeenCalledTimes(2);
  });

  it('conserva las cuentas y muestra el motivo si falla la actualización', async () => {
    listarPendientes.mockResolvedValueOnce([cuenta]);
    await pagina.cargarCuentas();
    listarPendientes.mockRejectedValueOnce(new Error('Sin conexión'));
    await pagina.cargarCuentas();
    expect(pagina.cuentas).toEqual([cuenta]);
    expect(pagina.errorCuentas).toContain('Sin conexión');
    expect(pagina.cargandoCuentas).toBe(false);
  });

  it('evita consultas solapadas que podrían sobrescribir una lista más reciente', async () => {
    let resolver!: (cuentas: unknown[]) => void;
    listarPendientes.mockReturnValueOnce(new Promise(resolve => { resolver = resolve; }));
    const carga = pagina.cargarCuentas();
    await pagina.cargarCuentas();
    expect(listarPendientes).toHaveBeenCalledTimes(1);
    resolver([cuenta]);
    await carga;
    expect(pagina.cuentas).toEqual([cuenta]);
  });
});
