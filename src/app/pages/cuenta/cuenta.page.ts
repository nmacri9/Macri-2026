import { ChangeDetectorRef, Component, LOCALE_ID, OnDestroy } from '@angular/core';
import { CommonModule, registerLocaleData } from '@angular/common';
import localeEsAr from '@angular/common/locales/es-AR';
import { RouterLink } from '@angular/router';
import { IonContent, IonButton, IonIcon, IonSpinner } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';
import { BarcodeFormat, BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { addIcons } from 'ionicons';
import { qrCodeOutline, checkmarkCircle, receiptOutline, arrowBackOutline } from 'ionicons/icons';
import { Cuenta, CuentaService, SATISFACCION } from '../../services/cuenta.service';
import { CepaHeaderComponent } from '../../shared/components/cepa-header/cepa-header.component';

registerLocaleData(localeEsAr);

@Component({
  selector: 'app-cuenta',
  standalone: true,
  providers: [{ provide: LOCALE_ID, useValue: 'es-AR' }],
  imports: [CommonModule, RouterLink, IonContent, IonButton, IonIcon, IonSpinner, CepaHeaderComponent],
  templateUrl: './cuenta.page.html',
  styleUrls: ['./cuenta.page.scss'],
})
export class CuentaPage implements OnDestroy {
  cuenta: Cuenta | null = null;
  cargando = true;
  procesando = false;
  error = '';
  avisosPendientes = false;
  disponible = false;
  readonly esNativo = Capacitor.isNativePlatform();
  readonly satisfaccion = SATISFACCION;
  private detenerEscucha?: () => void;
  mostrarDetalle = false;

  constructor(private cuentas: CuentaService, private cdr: ChangeDetectorRef) {
    addIcons({ qrCodeOutline, checkmarkCircle, receiptOutline, arrowBackOutline });
  }

  ionViewWillEnter() { void this.cargar(); }
  ionViewDidLeave() { this.detenerEscucha?.(); }
  ngOnDestroy() { this.detenerEscucha?.(); }

  private escuchar() {
    this.detenerEscucha?.();
    if (this.cuenta) this.detenerEscucha = this.cuentas.escuchar(this.cuenta.id, cuenta => {
      this.cuenta = cuenta;
      this.cdr.markForCheck();
    });
  }

  async cargar() {
    this.mostrarDetalle = false;
    this.cargando = true;
    this.disponible = false;
    this.error = '';
    try {
      this.cuenta = await this.cuentas.ejecutar('consultar');
      this.escuchar();
      this.disponible = true;
      if (this.cuenta) await this.enviarAvisos();
    } catch (error) {
      this.error = this.mensajeError(error);
    } finally {
      this.cargando = false;
      this.cdr.markForCheck();
    }
  }

  async solicitar() {
    await this.operar(async () => {
      this.cuenta = await this.cuentas.ejecutar('solicitar');
      this.escuchar();
      await this.enviarAvisos();
    });
  }

  async escanear() {
    await this.operar(async () => {
      if (!this.esNativo) throw new Error('Abrí CEPA en tu celular para leer el QR de propina.');
      if (Capacitor.getPlatform() === 'android') {
        const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
        if (!available) {
          await BarcodeScanner.installGoogleBarcodeScannerModule();
          throw new Error('El lector se está preparando. Esperá unos segundos y volvé a intentar.');
        }
      }
      if (Capacitor.getPlatform() === 'ios') {
        const { camera } = await BarcodeScanner.requestPermissions();
        if (camera !== 'granted' && camera !== 'limited') throw new Error('Habilitá el permiso de cámara para leer el QR.');
      }
      const { barcodes } = await BarcodeScanner.scan({ formats: [BarcodeFormat.QrCode] });
      const qr = barcodes[0]?.rawValue;
      if (qr) this.cuenta = await this.cuentas.ejecutar('propina', qr);
    });
  }

  async pagar() {
    if (this.cuenta?.estado !== 'lista' || this.cuenta.propina_porcentaje === null) return;
    await this.operar(async () => {
      this.cuenta = await this.cuentas.ejecutar('pagar');
      await this.enviarAvisos();
    });
  }

  async reintentarAvisos() { await this.operar(() => this.enviarAvisos()); }

  private async enviarAvisos() {
    if (!this.cuenta) return;
    try {
      this.avisosPendientes = !(await this.cuentas.notificar(this.cuenta.id));
    } catch {
      // El pago ya quedó registrado: un fallo de Push nunca invita a pagar otra vez.
      this.avisosPendientes = true;
    }
  }

  private async operar(accion: () => Promise<void>) {
    if (this.procesando || this.cargando) return;
    this.procesando = true;
    this.error = '';
    try { await accion(); }
    catch (error) { this.error = this.mensajeError(error); }
    finally { this.procesando = false; this.cdr.markForCheck(); }
  }

  private mensajeError(error: unknown) {
    return error instanceof Error ? error.message : 'No pudimos completar la operación. Volvé a intentar.';
  }
}
