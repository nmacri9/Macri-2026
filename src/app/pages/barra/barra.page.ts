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
import { PedidosService } from '../../services/pedidos.service'; 

import { CepaHeaderComponent } from '../../shared/components/cepa-header/cepa-header.component';
import { CepaSpinnerComponent } from '../../shared/components/cepa-spinner/cepa-spinner.component';
import { ConfirmModalComponent } from '../../shared/confirm-modal/confirm-modal.component';

@Component({
  selector: 'app-barra', 
  templateUrl: './barra.page.html', 
  styleUrls: ['./barra.page.scss'], 
  standalone: true,
  imports: [
    CommonModule, 
    IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent, 
    IonBadge, IonList, IonItem, IonLabel, IonButton, IonIcon,
    CepaHeaderComponent, CepaSpinnerComponent 
  ]
})
export class BarraPage implements OnInit, OnDestroy {
  
  pedidosBarra: any[] = [];
  private canalBarra: any;
  cargando = false; 

  constructor(
    private supabase: SupabaseService,
    private pedidosService: PedidosService, 
    private cdr: ChangeDetectorRef,
    private modalCtrl: ModalController 
  ) {
    addIcons({ checkmarkCircleOutline });
  }

  ngOnInit() {
    this.cargarPedidos();
    this.escucharNuevosPedidos();
  }

  ngOnDestroy() {
    if (this.canalBarra) {
      this.canalBarra.unsubscribe();
    }
  }

  async cargarPedidos() {
    this.cargando = true; 
    try {
      const { data, error } = await this.supabase.getClient()
        .from('pedidos')
        .select('*')
        .eq('estado_bar', 'en_preparacion') 
        .order('created_at', { ascending: true });

      if (error) throw error;
      

      this.procesarYFiltrar(data || []);
    } catch (error) {
      console.error('Error al cargar pedidos de barra:', error);
    } finally {
      this.cargando = false; 
      this.cdr.detectChanges();
    }
  }

  procesarYFiltrar(pedidosDB: any[]) {
    const pedidosFiltrados = pedidosDB.map(pedido => {
      console.log('Evaluando items del pedido:', pedido.items);
      return {
        ...pedido,
        items: (pedido.items || []).filter((item: any) => {
          console.log('   -> Tipo de item:', item.tipo);
          return item.tipo === 'BEBIDA';
        })
      };
    });
    this.pedidosBarra = pedidosFiltrados.filter(pedido => pedido.items.length > 0);
    this.cdr.detectChanges();
  }

  escucharNuevosPedidos() {
    this.canalBarra = this.supabase.getClient()
      .channel('pedidos_bar')
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
        mensaje: '¿Despachar bebidas al mozo?'
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
      await this.pedidosService.marcarSectorListo(pedidoId, 'bar'); 
      console.log(`¡Bebidas del pedido ${pedidoId} despachadas!`);
      
      await this.cargarPedidos(); 

    } catch (error) {
      console.error('Error al actualizar pedido:', error);
    } finally {
      this.cargando = false; 
      this.cdr.detectChanges();
    }
  }
}