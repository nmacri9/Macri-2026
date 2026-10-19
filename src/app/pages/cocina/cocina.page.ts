import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent, 
  IonBadge, IonList, IonItem, IonLabel, IonButton, IonIcon, 
  ModalController 
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { checkmarkCircleOutline } from 'ionicons/icons';
import { SupabaseService } from '../../services/supabase.service';

import { CepaHeaderComponent } from '../../shared/components/cepa-header/cepa-header.component';
import { CepaSpinnerComponent } from '../../shared/components/cepa-spinner/cepa-spinner.component';
import { ConfirmModalComponent } from '../../shared/confirm-modal/confirm-modal.component';
import { PedidosService } from '../../services/pedidos.service';

@Component({
  selector: 'app-cocina',
  templateUrl: './cocina.page.html',
  styleUrls: ['./cocina.page.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent, 
    IonBadge, IonList, IonItem, IonLabel, IonButton, IonIcon,
    CepaHeaderComponent, CepaSpinnerComponent 
  ]
})
export class CocinaPage implements OnInit, OnDestroy {
  
  pedidosCocina: any[] = [];
  private canalCocina: any;
  cargando = false; 

  constructor(
    private supabase: SupabaseService,
    private cdr: ChangeDetectorRef,
    private modalCtrl: ModalController,
    private pedidosService: PedidosService
  ) {
    addIcons({ checkmarkCircleOutline });
  }

  ngOnInit() {
    this.cargarPedidos();
    this.escucharNuevosPedidos();
  }

  ngOnDestroy() {
    if (this.canalCocina) {
      this.canalCocina.unsubscribe();
    }
  }

  // <-- FUNCIÓN AGREGADA -->

  async cargarPedidos() {
    this.cargando = true; 
    try {
      const { data, error } = await this.supabase.getClient()
        .from('pedidos')
        .select('*')
        .eq('estado_cocina', 'en_preparacion') 
        .order('created_at', { ascending: true });

      if (error) throw error;
      this.procesarYFiltrar(data || []);
    } catch (error) {
      console.error('Error al cargar pedidos de cocina:', error);
    } finally {
      this.cargando = false; 
      this.cdr.detectChanges();
    }
  }

  procesarYFiltrar(pedidosDB: any[]) {
    const pedidosFiltrados = pedidosDB.map(pedido => {
      return {
        ...pedido,
        items: pedido.items.filter((item: any) => item.tipo === 'PLATO' || item.tipo === 'POSTRE')
      };
    });
    this.pedidosCocina = pedidosFiltrados.filter(pedido => pedido.items.length > 0);
    this.cdr.detectChanges();
  }

  escucharNuevosPedidos() {
    this.canalCocina = this.supabase.getClient()
      .channel('pedidos_cocina')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pedidos' },
        () => {
          this.cargarPedidos();
        }
      )
      .subscribe();
  }

  async abrirModalConfirmacion(pedidoId: string) {
    const modal = await this.modalCtrl.create({
      component: ConfirmModalComponent,
      componentProps: {
        mensaje: '¿Despachar pedido al mozo?'
      },
      cssClass: 'modal-transparente' 
    });

    await modal.present();

    const { data } = await modal.onDidDismiss();

    if (data === true) {
      this.marcarComoListo(pedidoId);
    }
  }

  async marcarComoListo(pedidoId: string) {
    this.cargando = true; 
    this.cdr.detectChanges();
    try {
      await this.pedidosService.marcarSectorListo(pedidoId, 'cocina');
      console.log(`¡Pedido ${pedidoId} despachado!`);
      
      await this.cargarPedidos(); 

    } catch (error) {
      console.error(' Error al actualizar pedido:', error);
    } finally {
      this.cargando = false; 
      this.cdr.detectChanges();
    }
  }
}