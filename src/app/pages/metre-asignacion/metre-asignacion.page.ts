import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
    IonContent, IonItem, IonLabel, IonSelect, 
    IonSelectOption, IonButton, ToastController 
} from '@ionic/angular';
import { CepaHeaderComponent } from '../../shared/components/cepa-header/cepa-header.component';
import { MesasService } from '../../services/mesas.service';
import { AuthService } from '../../services/auth.service';
import { Mesa } from '../../interfaces/mesa';

@Component({
    selector: 'app-metre-asignacion',
    templateUrl: './metre-asignacion.page.html',
    styleUrls: ['./metre-asignacion.page.scss'],
    standalone: true,
    imports: [
        CommonModule, FormsModule, IonContent, IonItem, 
        IonLabel, IonSelect, IonSelectOption, IonButton, CepaHeaderComponent
    ]
})
export class MetreAsignacionPage implements OnInit {
    mesasDisponibles: Mesa[] = [];
    // Lista de prueba simulada para trabajar en paralelo
    listaEspera = [
        { id: 'usr-1', cliente_id: 'usr-1', nombre: 'Juan Pérez', estado: 'EN_ESPERA', mesaSeleccionadaId: null },
        { id: 'usr-2', cliente_id: 'usr-2', nombre: 'Maria Gomez', estado: 'EN_ESPERA', mesaSeleccionadaId: null }
    ];

    constructor(
        private mesasService: MesasService,
        private authService: AuthService,
        private toastController: ToastController
    ) {}

    async ngOnInit() {
        await this.cargarMesas();
    }

    async cargarMesas() {
        try {
            this.mesasDisponibles = await this.mesasService.obtenerMesasDisponibles();
        } catch (err) {
            console.error(err);
        }
    }

    async asignarMesa(cliente: any) {
        const mesa = this.mesasDisponibles.find(m => m.id === cliente.mesaSeleccionadaId);
        if (!mesa) return;

        try {
            // Obtenemos el ID del Metre autenticado
            const metre = await this.authService.obtenerUsuarioActual();
            const metreId = metre ? metre.id : '';

            // Firma requerida por MesasService: (clienteId: string, mesaId: number, metreId: string)
            await this.mesasService.asignarMesaACliente(cliente.cliente_id, mesa.id, metreId);
            
            const toast = await this.toastController.create({
                message: `Mesa ${mesa.numero} asignada con éxito a ${cliente.nombre}`,
                duration: 3000,
                color: 'success'
            });
            await toast.present();
            
            await this.cargarMesas(); // Recargar la lista de disponibles
        } catch (error: any) {
            const toast = await this.toastController.create({
                message: error.message || 'Error al asignar la mesa',
                duration: 4000,
                color: 'danger'
            });
            await toast.present();
        }
    }
}