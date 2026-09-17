import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonContent, IonItem, IonIcon, IonButton, ModalController, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { restaurantOutline, checkmarkCircleOutline, timeOutline } from 'ionicons/icons';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { SupabaseService } from '../../services/supabase.service';
import { ProductoCarrito } from '../../interfaces/carrito.model';
import { CepaHeaderComponent } from '../../shared/components/cepa-header/cepa-header.component';
import { CepaSpinnerComponent } from '../../shared/components/cepa-spinner/cepa-spinner.component';
import { ConfirmModalComponent } from '../../shared/confirm-modal/confirm-modal.component';

interface PedidoPendiente {
  id: string;
  mesa_id: number;
  mesas?: { numero: number }; // TODO: confirmar el nombre real de la columna en la tabla "mesas"
  items: ProductoCarrito[];
  total: number;
  tiempo_estimado: number;
  estado: string;
  created_at?: string;
}

@Component({
  selector: 'app-confirmar-pedido',
  templateUrl: './confirmar-pedido.page.html',
  styleUrls: ['./confirmar-pedido.page.scss'],
  standalone: true,
  imports: [IonContent, IonItem, IonIcon, IonButton, CommonModule, CepaHeaderComponent, CepaSpinnerComponent]
})
export class ConfirmarPedidoPage implements OnInit, OnDestroy {

  pedidos: PedidoPendiente[] = [];
  cargando = true;
  confirmandoId: string | null = null;
  errorMsg: string | undefined;

  private canal: any;

  constructor(
    private supabase: SupabaseService,
    private modalCtrl: ModalController,
    private toastCtrl: ToastController,
    private cdr: ChangeDetectorRef
  ) {
    addIcons({ restaurantOutline, checkmarkCircleOutline, timeOutline });
  }

  ngOnInit() {
    this.cargarPedidosPendientes();
    this.escucharNuevosPedidos();
  }

  ngOnDestroy() {
    this.canal?.unsubscribe();
  }

  private async cargarPedidosPendientes() {
    this.cargando = true;
    this.cdr.detectChanges();

    try {
      const { data, error } = await this.supabase.getClient()
        .from('pedidos')
        .select('*, mesas(numero)')
        .eq('estado', 'pendiente_confirmacion')
        .order('created_at', { ascending: true });

      if (error) throw error;
      this.pedidos = data ?? [];

    } catch (error: any) {
      console.error('Error al cargar pedidos pendientes:', error);
      this.errorMsg = 'No se pudieron cargar los pedidos.';
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  private escucharNuevosPedidos() {
    this.canal = this.supabase.getClient()
      .channel('pedidos-pendientes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pedidos' },
        () => this.cargarPedidosPendientes()
      )
      .subscribe();
  }

  async confirmarPedido(pedido: PedidoPendiente) {
    const modal = await this.modalCtrl.create({
      component: ConfirmModalComponent,
      componentProps: { mensaje: `¿Confirmar el pedido de la Mesa ${pedido.mesas?.numero ?? pedido.mesa_id}?` },
      cssClass: 'modal-alerta'
    });

    await modal.present();
    const { data: confirmado } = await modal.onDidDismiss();
    if (!confirmado) return;

    this.confirmandoId = pedido.id;
    this.cdr.detectChanges();

    try {
      const { error } = await this.supabase.getClient()
        .from('pedidos')
        .update({ estado: 'confirmado' })
        .eq('id', pedido.id);

      if (error) throw error;

      this.pedidos = this.pedidos.filter(p => p.id !== pedido.id);

      const toast = await this.toastCtrl.create({
        message: `Pedido de Mesa ${pedido.mesas?.numero ?? pedido.mesa_id} confirmado.`,
        duration: 2000,
        position: 'middle',
        cssClass: 'toast-exito',
        icon: 'checkmark-circle-outline'
      });
      await toast.present();

      try {
        const numeroMesa = pedido.mesas?.numero ?? pedido.mesa_id;
        await this.supabase.invocarEdgeFunction('enviar-notificacion', {
          titulo: '¡Mesa Confirmada!',
          cuerpo: `Marchando pedido para la Mesa ${numeroMesa}. A preparar todo.`,
          topic: 'cocina'
        });
      } catch (pushError) {
        console.warn('El pedido se confirmó pero falló la push:', pushError);
      }

    } catch (error: any) {
      console.error('Error al confirmar pedido:', error);
      await Haptics.impact({ style: ImpactStyle.Heavy });
      this.errorMsg = 'No se pudo confirmar el pedido. Intente nuevamente.';
    } finally {
      this.confirmandoId = null;
      this.cdr.detectChanges();
    }
  }
}