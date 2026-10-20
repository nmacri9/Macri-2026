import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonContent, IonButton, IonIcon, ToastController, NavController } from '@ionic/angular';
import { CepaHeaderComponent } from '../../shared/components/cepa-header/cepa-header.component';
import { MesasService } from '../../services/mesas.service';
import { AuthService } from '../../services/auth.service';
import { addIcons } from 'ionicons';
import { qrCodeOutline, cameraOutline } from 'ionicons/icons';
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';

@Component({
    selector: 'app-cliente-escaneo-mesa',
    templateUrl: './cliente-escaneo-mesa.page.html',
    styleUrls: ['./cliente-escaneo-mesa.page.scss'],
    imports: [CommonModule, IonContent, IonButton, IonIcon, CepaHeaderComponent]
})
export class ClienteEscaneoMesaPage {
    escaneando: boolean = false;
    readonly esNativo = Capacitor.isNativePlatform();
    mesaAsignadaNumero: number | null = null;

    constructor(
        private mesasService: MesasService,
        private authService: AuthService,
        private toastController: ToastController,
        private navController: NavController
    ) {
        addIcons({
        'qr-code-outline': qrCodeOutline,
        'camera-outline': cameraOutline
        });
    }

    async ionViewWillEnter() {
    try {
        const usuario = await this.authService.obtenerUsuarioActual();
        if (usuario) {
            const asignacion = await this.mesasService.obtenerAsignacionActiva(usuario.id);
            
            // Usamos 'as any' para decirle a TypeScript que ignore la validación estricta acá
            if (asignacion && (asignacion as any).numero) {
                this.mesaAsignadaNumero = (asignacion as any).numero;
            }
        }
    } catch (error) {
        console.warn('No se pudo obtener el número de mesa previo al escaneo', error);
    }
}

    async procesarQRLeido(qrData: string) {
        try {
        if (qrData.trim() === 'QR_INGRESO_CEPA') {
            await this.navController.navigateForward('/graficos-encuestas');
            return;
        }

        const usuario = await this.authService.obtenerUsuarioActual();
        if (!usuario) throw new Error('Sesión no encontrada');

        await this.mesasService.validarYVincularMesaQR(usuario.id, qrData);

        const toast = await this.toastController.create({
            message: '¡Mesa vinculada con éxito! Redirigiendo al menú...',
            duration: 2500,
            color: 'success'
        });
        await toast.present();

        this.navController.navigateRoot('/menu-productos');

        } catch (error: any) {
        const toast = await this.toastController.create({
            message: error.message,
            duration: 4000,
            color: 'warning',
            position: 'bottom'
        });
        await toast.present();
        }
    }

    async escanearMesa() {
        if (this.escaneando) return;
        this.escaneando = true;
        try {
            if (Capacitor.getPlatform() === 'android') {
                const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
                if (!available) {
                    await BarcodeScanner.installGoogleBarcodeScannerModule();
                    throw new Error('Se está preparando el lector. Esperá unos segundos y volvé a escanear.');
                }
            }
            if (Capacitor.getPlatform() === 'ios') {
                const { camera } = await BarcodeScanner.requestPermissions();
                if (camera !== 'granted' && camera !== 'limited') {
                    throw new Error('Habilitá el permiso de cámara para escanear tu mesa.');
                }
            }
            const { barcodes } = await BarcodeScanner.scan({ formats: [BarcodeFormat.QrCode] });
            const contenido = barcodes[0]?.rawValue;
            if (contenido) await this.procesarQRLeido(contenido);
        } catch (error: unknown) {
            const toast = await this.toastController.create({
                message: error instanceof Error ? error.message : 'No se pudo leer el QR. Volvé a intentar.',
                duration: 4000, color: 'warning', position: 'bottom'
            });
            await toast.present();
        } finally {
            this.escaneando = false;
        }
    }

    async simularEscaneoMesa(numeroMesa: number) {
        await this.procesarQRLeido(`MESA_${numeroMesa}`);
    }
}
