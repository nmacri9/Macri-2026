import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
    IonContent, IonItem, IonLabel, IonSelect,
    IonSelectOption, IonButton, ToastController
} from '@ionic/angular';
import { CepaHeaderComponent } from '../../shared/components/cepa-header/cepa-header.component';
import { MesasService } from '../../services/mesas.service';
import { AuthService } from '../../services/auth.service';
import { SupabaseService } from '../../services/supabase.service';
import { Mesa } from '../../interfaces/mesa';

interface ClienteEspera {
    id: number;
    cliente_id: string;
    nombre: string;
    estado: string;
    foto_url?: string;
    mesaSeleccionadaId: number | null;

}

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
    listaEspera: ClienteEspera[] = [];

    constructor(
        private mesasService: MesasService,
        private authService: AuthService,
        private supabaseService: SupabaseService,
        private toastController: ToastController,
        private cdr: ChangeDetectorRef
    ) {}


    async ngOnInit() {
        await this.cargarMesas();
        await this.cargarListaEspera();
    }


    async cargarMesas() {
        try {
            this.mesasDisponibles = await this.mesasService.obtenerMesasDisponibles();
        } catch (err) {
            console.error('Error al cargar mesas disponibles:', err);
        }
    }


    async cargarListaEspera() {
        try {
            const supabase = this.supabaseService.getClient();
            // Consultamos los clientes con estado 'ESPERANDO'
            const { data, error } = await supabase
                .from('lista_espera')
                .select('id, cliente_id, nombre, foto_url, estado')
                .eq('estado', 'ESPERANDO')
                .order('fecha_ingreso', { ascending: true });


            if (error) throw error;
            this.listaEspera = (data || []).map((item: any) => ({
                id: item.id,
                cliente_id: item.cliente_id,
                nombre: item.nombre,
                foto_url: item.foto_url,
                estado: item.estado,
                mesaSeleccionadaId: null
            }));
            this.cdr.detectChanges();

        } catch (err) {
            console.error('Error al cargar la lista de espera desde Supabase:', err);
        }
    }


    async asignarMesa(cliente: ClienteEspera) {
    if (!cliente.mesaSeleccionadaId) return;

    const mesa = this.mesasDisponibles.find(m => m.id === cliente.mesaSeleccionadaId);
    if (!mesa) return;

    try {
        const metre = await this.authService.obtenerUsuarioActual();
        const metreId = metre ? metre.id : '';

        // 1. Asignamos la mesa (esto actualiza asignaciones_mesa, mesas y lista_espera en Supabase)
        await this.mesasService.asignarMesaACliente(cliente.cliente_id, mesa.id, metreId);

        const toast = await this.toastController.create({
            message: `Mesa ${mesa.numero} asignada con éxito a ${cliente.nombre}`,
            duration: 3000,
            color: 'success'
        });
        await toast.present();
        
        // 2. Recargamos la vista: el cliente asignado desaparecerá de la lista
        await this.cargarMesas();
        await this.cargarListaEspera();

    } catch (error: any) {
        console.error('Error al asignar mesa:', error);
        const toast = await this.toastController.create({
            message: error.message || 'Error al asignar la mesa',
            duration: 4000,
            color: 'danger'
        });
        await toast.present();
    }
}
}