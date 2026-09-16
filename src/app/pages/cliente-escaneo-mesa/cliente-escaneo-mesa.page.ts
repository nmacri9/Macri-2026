import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonContent, IonButton, IonIcon, ToastController, NavController } from '@ionic/angular';
import { CepaHeaderComponent } from '../../shared/components/cepa-header/cepa-header.component';
import { MesasService } from '../../services/mesas.service';
import { AuthService } from '../../services/auth.service';
import { addIcons } from 'ionicons';
import { qrCodeOutline, cameraOutline } from 'ionicons/icons';

@Component({
    selector: 'app-cliente-escaneo-mesa',
    templateUrl: './cliente-escaneo-mesa.page.html',
    styleUrls: ['./cliente-escaneo-mesa.page.scss'],
    imports: [CommonModule, IonContent, IonButton, IonIcon, CepaHeaderComponent]
})
export class ClienteEscaneoMesaPage {
    escaneando: boolean = false;

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

    async procesarQRLeido(qrData: string) {
        try {
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

    async simularEscaneoMesa(numeroMesa: number) {
        // Busca el token real de la mesa seleccionada o envía el token
        const mesas = await this.mesasService.obtenerMesasDisponibles();
        const mesa = mesas.find(m => m.numero === numeroMesa);
        
        // Pasa el qr_token si existe, o en su defecto el string de respaldo
        const qrData = mesa ? mesa.qr_token : `MESA_${numeroMesa}`;
        this.procesarQRLeido(qrData);
    }
}