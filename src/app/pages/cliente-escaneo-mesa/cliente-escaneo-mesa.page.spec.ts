import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NavController, ToastController } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { MesasService } from '../../services/mesas.service';
import { ClienteEscaneoMesaPage } from './cliente-escaneo-mesa.page';

const scanner = vi.hoisted(() => ({ scan: vi.fn(), isGoogleBarcodeScannerModuleAvailable: vi.fn(), installGoogleBarcodeScannerModule: vi.fn() }));
vi.mock('@capacitor-mlkit/barcode-scanning', () => ({ BarcodeScanner: scanner, BarcodeFormat: { QrCode: 'QR_CODE' } }));
vi.mock('@capacitor/core', async importOriginal => {
  const original = await importOriginal<typeof import('@capacitor/core')>();
  return { ...original, Capacitor: { ...original.Capacitor, isNativePlatform: () => true, getPlatform: () => 'android' } };
});

describe('Escaneo de mesa', () => {
  const validarYVincularMesaQR = vi.fn();
  const navigateRoot = vi.fn();
  const present = vi.fn();
  const create = vi.fn();
  const crear = () => new ClienteEscaneoMesaPage(
    { validarYVincularMesaQR } as unknown as MesasService,
    { obtenerUsuarioActual: vi.fn().mockResolvedValue({ id: 'cliente' }) } as unknown as AuthService,
    { create } as unknown as ToastController,
    { navigateRoot } as unknown as NavController
  );
  beforeEach(() => {
    vi.resetAllMocks();
    create.mockResolvedValue({ present });
    scanner.isGoogleBarcodeScannerModuleAvailable.mockResolvedValue({ available: true });
    scanner.scan.mockResolvedValue({ barcodes: [{ rawValue: 'token-mesa' }] });
  });
  it('abre el lector y muestra el menú solamente después de validar el QR', async () => {
    const page = crear();
    await page.escanearMesa();
    expect(scanner.scan).toHaveBeenCalledWith({ formats: ['QR_CODE'] });
    expect(validarYVincularMesaQR).toHaveBeenCalledWith('cliente', 'token-mesa');
    expect(navigateRoot).toHaveBeenCalledWith('/menu-productos');
    expect(page.escaneando).toBe(false);
  });
  it('no abre el menú al escanear otra mesa', async () => {
    validarYVincularMesaQR.mockRejectedValue(new Error('Mesa equivocada'));
    await crear().escanearMesa();
    expect(navigateRoot).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ message: 'Mesa equivocada' }));
  });
  it('espera a que el módulo de Android esté instalado antes de abrirlo', async () => {
    scanner.isGoogleBarcodeScannerModuleAvailable.mockResolvedValue({ available: false });
    await crear().escanearMesa();
    expect(scanner.installGoogleBarcodeScannerModule).toHaveBeenCalled();
    expect(scanner.scan).not.toHaveBeenCalled();
    expect(navigateRoot).not.toHaveBeenCalled();
  });
  it('permite cancelar sin vincular ni navegar', async () => {
    scanner.scan.mockResolvedValue({ barcodes: [] });
    await crear().escanearMesa();
    expect(validarYVincularMesaQR).not.toHaveBeenCalled();
    expect(navigateRoot).not.toHaveBeenCalled();
  });
});
