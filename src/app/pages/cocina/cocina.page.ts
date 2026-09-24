import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent, 
  IonBadge, IonList, IonItem, IonLabel, IonButton, IonIcon, 
  ModalController // Importamos el controlador de modales
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { checkmarkCircleOutline } from 'ionicons/icons';
import { SupabaseService } from '../../services/supabase.service';

// Importamos tus componentes globales
import { CepaHeaderComponent } from '../../shared/components/cepa-header/cepa-header.component';
import { CepaSpinnerComponent } from '../../shared/components/cepa-spinner/cepa-spinner.component';
import { ConfirmModalComponent } from '../../shared/confirm-modal/confirm-modal.component';

@Component({
  selector: 'app-cocina',
  templateUrl: './cocina.page.html',
  styleUrls: ['./cocina.page.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent, 
    IonBadge, IonList, IonItem, IonLabel, IonButton, IonIcon,
    CepaHeaderComponent, CepaSpinnerComponent // No hace falta poner ConfirmModalComponent acá si se usa por ModalController
  ]
})
export class CocinaPage implements OnInit, OnDestroy {
  
  pedidosCocina: any[] = [];
  private canalCocina: any;
  cargando = false; // Variable global del spinner

  constructor(
    private supabase: SupabaseService,
    private cdr: ChangeDetectorRef,
    private modalCtrl: ModalController // Inyectamos el controlador
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

  async cargarPedidos() {
    this.cargando = true; // Mostramos tu spinner global
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
      this.cargando = false; // Ocultamos el spinner
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
    this.cargando = true; // Activamos el spinner
    this.cdr.detectChanges();
    try {
      const { error } = await this.supabase.getClient()
        .from('pedidos')
        .update({ estado_cocina: 'listo' })
        .eq('id', pedidoId);

      if (error) throw error;
      console.log(`¡Pedido ${pedidoId} despachado!`);
    } catch (error) {
      console.error('Error al actualizar pedido:', error);
    } finally {
      this.cargando = false; // Ocultamos el spinner
      this.cdr.detectChanges();
    }
  }
}