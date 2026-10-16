import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChangeDetectorRef } from '@angular/core';
import { CuentaPage } from './cuenta.page';
import { Cuenta, CuentaService } from '../../services/cuenta.service';

const scanner = vi.hoisted(() => ({ scan: vi.fn() }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android' } }));
vi.mock('@capacitor-mlkit/barcode-scanning', () => ({
  BarcodeFormat: { QrCode: 'QR_CODE' },
  BarcodeScanner: { scan: scanner.scan, isGoogleBarcodeScannerModuleAvailable: async () => ({ available: true }) },
}));

describe('Cuenta: QR obligatorio y pago simulado', () => {
  const ejecutar = vi.fn();
  const notificar = vi.fn();
  let pagina: CuentaPage;
  const cuenta = (estado: Cuenta['estado'], porcentaje: number | null = null): Cuenta => ({
    id: 'cuenta', mesa_id: '4', estado, items: [], subtotal: 1000, descuento: 100,
    descuento_porcentaje: 10, propina_porcentaje: porcentaje, propina: 0, total: 900,
    pagada_en: null, confirmada_en: null,
  });
  beforeEach(() => {
    vi.resetAllMocks();
    pagina = new CuentaPage({ ejecutar, notificar, escuchar: () => () => undefined } as unknown as CuentaService,
      { markForCheck: vi.fn() } as unknown as ChangeDetectorRef);
    pagina.cargando = false;
  });

  it('no permite pagar antes del QR, incluso invocando el método directamente', async () => {
    pagina.cuenta = cuenta('solicitada');
    await pagina.pagar();
    pagina.cuenta = cuenta('lista');
    await pagina.pagar();
    expect(ejecutar).not.toHaveBeenCalled();
  });

  it('cancelar el lector mantiene bloqueada la cuenta', async () => {
    pagina.cuenta = cuenta('solicitada');
    scanner.scan.mockResolvedValue({ barcodes: [] });
    await pagina.escanear();
    expect(ejecutar).not.toHaveBeenCalled();
    expect(pagina.cuenta.estado).toBe('solicitada');
    expect(pagina.procesando).toBe(false);
  });

  it('un QR rechazado por el servidor no habilita el ticket', async () => {
    pagina.cuenta = cuenta('solicitada');
    scanner.scan.mockResolvedValue({ barcodes: [{ rawValue: 'MESA_4' }] });
    ejecutar.mockRejectedValue(new Error('QR inválido'));
    await pagina.escanear();
    expect(pagina.cuenta.estado).toBe('solicitada');
    expect(pagina.error).toBe('QR inválido');
  });

  it('acepta 0% leído por QR y no repite el pago si falla la Push', async () => {
    pagina.cuenta = cuenta('lista', 0);
    ejecutar.mockResolvedValue(cuenta('pagada', 0));
    notificar.mockRejectedValue(new Error('Sin conexión'));
    await pagina.pagar();
    expect(pagina.cuenta?.estado).toBe('pagada');
    expect(pagina.avisosPendientes).toBe(true);
    expect(pagina.error).toBe('');
    notificar.mockResolvedValue(true);
    await pagina.reintentarAvisos();
    await pagina.pagar();
    expect(ejecutar).toHaveBeenCalledTimes(1);
    expect(pagina.avisosPendientes).toBe(false);
  });

  it('ignora el doble toque mientras el pago está en curso', async () => {
    pagina.cuenta = cuenta('lista', 20);
    let resolver!: (valor: Cuenta) => void;
    ejecutar.mockReturnValue(new Promise<Cuenta>(resolve => { resolver = resolve; }));
    notificar.mockResolvedValue(true);
    const primero = pagina.pagar();
    await pagina.pagar();
    expect(ejecutar).toHaveBeenCalledTimes(1);
    resolver(cuenta('pagada', 20));
    await primero;
  });
});
