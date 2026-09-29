import { Component, ChangeDetectorRef } from '@angular/core';
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
    cliente_id: number;
    cantidad_personas: number;
    nombre: string;
    estado: string;
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
export class MetreAsignacionPage {
    mesasDisponibles: Mesa[] = [];
    listaEspera: ClienteEspera[] = [];
    cargandoMesas = false;
    cargandoLista = false;
    errorMesas = '';
    errorLista = '';
    asignando = false;
    readonly opcionesSelector = { header: 'Elegir mesa', cssClass: 'alerta-tema-mesa' };

    constructor(
        private mesasService: MesasService,
        private authService: AuthService,
        private supabaseService: SupabaseService,
        private toastController: ToastController,
        private cdr: ChangeDetectorRef
    ) {}


    ionViewWillEnter() {
        return this.actualizar();
    }

    async actualizar() {
        await Promise.all([this.cargarMesas(), this.cargarListaEspera()]);
    }


    async cargarMesas() {
        this.cargandoMesas = true;
        this.errorMesas = '';
        this.cdr.markForCheck();
        try {
            this.mesasDisponibles = await this.mesasService.obtenerMesasDisponibles();
            for (const cliente of this.listaEspera) {
                if (!this.mesasDisponibles.some(mesa => mesa.id === cliente.mesaSeleccionadaId)) {
                    cliente.mesaSeleccionadaId = null;
                }
            }
        } catch (err) {
            this.mesasDisponibles = [];
            this.errorMesas = this.mensajeErrorCarga(err, 'mesas disponibles');
            console.error('Error al cargar mesas disponibles:', err);
        } finally {
            this.cargandoMesas = false;
            this.cdr.markForCheck();
        }
    }


    async cargarListaEspera() {
        this.cargandoLista = true;
        this.errorLista = '';
        this.cdr.markForCheck();
        try {
            const supabase = this.supabaseService.getClient();
            // Solo asignaciones pendientes que todavía no tienen mesa.
            const { data, error } = await supabase
                .from('asignaciones')
                .select('id, cliente_id, estado, cantidad_personas, clientes(nombre, apellido)')
                .eq('estado', 'esperando')
                .is('mesa_id', null)
                .is('fecha_finalizacion', null)
                .order('fecha_ingreso', { ascending: true });


            if (error) throw error;
            this.listaEspera = (data || []).map((item: any) => ({
                id: item.id,
                cliente_id: item.cliente_id,
                nombre: [item.clientes?.nombre, item.clientes?.apellido].filter(Boolean).join(' ') || `Cliente ${item.cliente_id}`,
                estado: item.estado,
                cantidad_personas: item.cantidad_personas,
                mesaSeleccionadaId: null
            }));

        } catch (err) {
            this.listaEspera = [];
            this.errorLista = this.mensajeErrorCarga(err, 'lista de espera');
            console.error('Error al cargar la lista de espera desde Supabase:', err);
        } finally {
            this.cargandoLista = false;
            this.cdr.markForCheck();
        }
    }


    async asignarMesa(cliente: ClienteEspera) {
    if (cliente.mesaSeleccionadaId === null || this.asignando || this.cargandoMesas || this.errorMesas) return;

    const mesa = this.mesasDisponibles.find(m => m.id === cliente.mesaSeleccionadaId);
    if (!mesa) return;

    this.asignando = true;
    this.cdr.markForCheck();
    try {
        const metre = await this.authService.obtenerUsuarioActual();
        if (!metre) throw new Error('La sesión venció. Volvé a iniciar sesión para asignar una mesa.');

        // Actualizamos la asignación pendiente.
        await this.mesasService.asignarMesaACliente(cliente.id, mesa.id);

        const toast = await this.toastController.create({
            message: `Mesa ${mesa.id} asignada con éxito a ${cliente.nombre}`,
            duration: 3000,
            color: 'success'
        });
        await toast.present();
        
        // 2. Recargamos la vista: el cliente asignado desaparecerá de la lista
        await this.actualizar();

    } catch (error: any) {
        console.error('Error al asignar mesa:', error);
        const toast = await this.toastController.create({
            message: error.message || 'Error al asignar la mesa',
            duration: 4000,
            color: 'danger'
        });
        await toast.present();
        await this.actualizar();
    } finally {
        this.asignando = false;
        this.cdr.markForCheck();
    }
}

    private mensajeErrorCarga(error: unknown, recurso: string): string {
        const codigo = (error as { code?: string })?.code;
        if (codigo === '42501') return `Tu usuario no tiene permiso para consultar la ${recurso === 'lista de espera' ? recurso : 'disponibilidad de las mesas'}. Avisá al administrador.`;
        const detalle = (error as { message?: string })?.message;
        if (detalle) return `No se pudo cargar ${recurso}: ${detalle}`;
        return `No se pudo cargar ${recurso === 'lista de espera' ? 'la' : 'las'} ${recurso}. Revisá la conexión y volvé a intentar.`;
    }
}
