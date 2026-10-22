import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonContent, IonItem, IonIcon, IonButton, ModalController, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { restaurantOutline, checkmarkCircleOutline, timeOutline, closeCircleOutline, chevronDownOutline } from 'ionicons/icons';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { SupabaseService } from '../../services/supabase.service';
import { PedidosService } from '../../services/pedidos.service';
import { Cuenta, CuentaService } from '../../services/cuenta.service';
import { AuthService } from '../../services/auth.service';
import { ProductoCarrito } from '../../interfaces/carrito.model';
import { CepaHeaderComponent } from '../../shared/components/cepa-header/cepa-header.component';
import { CepaSpinnerComponent } from '../../shared/components/cepa-spinner/cepa-spinner.component';
import { ConfirmModalComponent } from '../../shared/confirm-modal/confirm-modal.component';

interface PedidoPendiente {
  id: string;
  cliente_id: string; 
  mesa_id: number;
  items: ProductoCarrito[];
  total: number;
  tiempo_estimado: number;
  estado: string;
  created_at?: string;
  estado_cocina?: string; 
  estado_bar?: string;
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
  cuentas: Cuenta[] = [];
  cargandoCuentas = false;
  confirmandoCuenta: string | null = null;
  errorCuentas = '';
  avisoCuentaPendiente: string | null = null;
  cargando = true;
  confirmandoId: string | null = null;
  errorMsg: string | undefined;

  // Pedido desplegado (uno solo a la vez); null = todos contraídos
  pedidoAbiertoId: string | null = null;

  private canal: any;
  private actualizacionCuentas?: ReturnType<typeof setInterval>;

  constructor(
    private supabase: SupabaseService,
    private pedidosService: PedidosService,
    private cuentasService: CuentaService,
    private authService: AuthService,
    private modalCtrl: ModalController,
    private toastCtrl: ToastController,
    private cdr: ChangeDetectorRef
  ) {
    addIcons({ restaurantOutline, checkmarkCircleOutline, timeOutline, closeCircleOutline, chevronDownOutline });
  }

  alternarPedido(id: string) {
    this.pedidoAbiertoId = this.pedidoAbiertoId === id ? null : id;
  }

  trackByPedido(_: number, pedido: PedidoPendiente) {
    return pedido.id;
  }

  cantidadItems(pedido: PedidoPendiente): number {
    return (pedido.items ?? []).reduce((acc, item) => acc + (item.cantidad ?? 1), 0);
  }

  etiquetaEstado(pedido: PedidoPendiente): string {
    if (pedido.estado === 'pendiente_confirmacion') return 'Por confirmar';
    if (pedido.estado === 'listo_para_entregar') return 'Listo para servir';
    return 'En preparación';
  }

  ngOnInit() {
    void this.cargarCuentas();
    this.cargarPedidosPendientes();
    this.escucharNuevosPedidos();
  }

  ngOnDestroy() {
    this.ionViewDidLeave();
    this.canal?.unsubscribe();
  }

  ionViewWillEnter() {
    void this.cargarCuentas();
    void this.cargarPedidosPendientes();
    this.ionViewDidLeave();
    // La lista debe actualizarse también en web o si Realtime se desconecta.
    this.actualizacionCuentas = setInterval(() => void this.cargarCuentas(), 10000);
  }

  ionViewDidLeave() {
    if (this.actualizacionCuentas) clearInterval(this.actualizacionCuentas);
    this.actualizacionCuentas = undefined;
  }

  async cargarCuentas() {
    if (this.cargandoCuentas) return;
    this.cargandoCuentas = true;
    this.errorCuentas = '';
    try { this.cuentas = await this.cuentasService.listarPendientes(); }
    catch (error) {
      this.errorCuentas = error instanceof Error
        ? `No se pudieron cargar las cuentas: ${error.message}`
        : 'No se pudieron cargar las cuentas. Volvé a intentar.';
    }
    finally { this.cargandoCuentas = false; this.cdr.markForCheck(); }
  }

  async confirmarPago(cuenta: Cuenta) {
    if (this.confirmandoCuenta || cuenta.estado !== 'pagada') return;
    this.confirmandoCuenta = cuenta.id;
    try {
      const modal = await this.modalCtrl.create({
        component: ConfirmModalComponent,
        componentProps: { mensaje: `¿Confirmar el pago simulado de la Mesa ${cuenta.mesa_id} por $${cuenta.total} y liberar la mesa?` },
        cssClass: 'modal-alerta',
      });
      await modal.present();
      const { data: confirmado } = await modal.onDidDismiss();
      if (!confirmado) return;
      await this.cuentasService.confirmarPago(cuenta.id);
      this.avisoCuentaPendiente = cuenta.id;
      await this.reintentarAvisoCuenta();
      await this.cargarCuentas();
    } catch (error) {
      this.errorCuentas = error instanceof Error ? error.message : 'No se pudo confirmar el pago.';
    } finally {
      this.confirmandoCuenta = null;
      this.cdr.markForCheck();
    }
  }

  async reintentarAvisoCuenta() {
    if (!this.avisoCuentaPendiente) return;
    try {
      if (await this.cuentasService.notificar(this.avisoCuentaPendiente)) this.avisoCuentaPendiente = null;
    } catch { /* La confirmación está guardada; el aviso queda disponible para reintentar. */ }
    this.cdr.markForCheck();
  }

  private async cargarPedidosPendientes() {
    this.cargando = true;
    this.cdr.detectChanges();

    try {
      const { data, error } = await this.supabase.getClient()
        .from('pedidos')
        .select('*')
        .in('estado', ['pendiente_confirmacion', 'confirmado', 'en_preparacion', 'listo_para_entregar'])
        .order('created_at', { ascending: true });

      if (error) throw error;
      this.pedidos = data ?? [];

    } catch (error: any) {
      console.error('Error al cargar pedidos:', error);
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cuentas' }, () => this.cargarCuentas())
      .subscribe((estado: string) => {
        if (estado === 'SUBSCRIBED') void this.cargarCuentas();
      });
  }

  async confirmarPedido(pedido: PedidoPendiente) {
    const modal = await this.modalCtrl.create({
      component: ConfirmModalComponent,
      componentProps: { mensaje: `¿Confirmar el pedido de la Mesa ${pedido.mesa_id}?` },
      cssClass: 'modal-alerta'
    });

    await modal.present();
    const { data: confirmado } = await modal.onDidDismiss();
    if (!confirmado) return;

    this.confirmandoId = pedido.id;
    this.cdr.detectChanges();

    try {
      const mozo = await this.authService.obtenerUsuarioActual();
      const mozoId = mozo ? mozo.id : '';

      // ✅ LLAMADA AL MOTOR DE RUTEO (INTEGRANTE 2)
      // Esta función cambia 'estado' a 'en_preparacion' y evalúa 'estado_cocina' y 'estado_bar'
      await this.pedidosService.confirmarPedidoYRutear(pedido.id, mozoId);

      try {
        await this.supabase.invocarEdgeFunction('enviar-notificacion', {
          titulo: '¡Pedido Confirmado!',
          cuerpo: 'El mozo confirmó tu pedido y ya está en preparación.',
          topic: `cliente_${pedido.cliente_id}`
        });
      } catch (pushError) {
        console.warn('El pedido se confirmó pero falló la push al cliente:', pushError);
      }

      this.pedidos = this.pedidos.filter(p => p.id !== pedido.id);

      const toast = await this.toastCtrl.create({
        message: `Pedido de Mesa ${pedido.mesa_id} confirmado y derivado a los sectores.`,
        duration: 2500,
        position: 'middle',
        cssClass: 'toast-exito',
        icon: 'checkmark-circle-outline'
      });
      await toast.present();

    } catch (error: any) {
      console.error('Error al confirmar pedido:', error);
      await Haptics.impact({ style: ImpactStyle.Heavy });
      this.errorMsg = 'No se pudo confirmar el pedido. Intente nuevamente.';
    } finally {
      this.confirmandoId = null;
      this.cdr.detectChanges();
    }
  }

  async rechazarPedido(pedido: PedidoPendiente) {
    const modal = await this.modalCtrl.create({
      component: ConfirmModalComponent,
      componentProps: { mensaje: `¿Solicitar modificaciones a la Mesa ${pedido.mesa_id}?` },
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
        .update({ estado: 'rechazado_mozo' })
        .eq('id', pedido.id);

      if (error) throw error;

      this.pedidos = this.pedidos.filter(p => p.id !== pedido.id);

      const toast = await this.toastCtrl.create({
        message: `Mesa ${pedido.mesa_id} enviada a corrección.`,
        duration: 2500,
        color: 'warning',
        icon: 'close-circle-outline'
      });
      await toast.present();

      try {
        const numeroMesa = pedido.mesa_id;
        await this.supabase.invocarEdgeFunction('enviar-notificacion', {
          titulo: 'Problemas con tu pedido',
          cuerpo: `El mozo solicitó que revises el pedido de la Mesa ${numeroMesa}. Por favor, modificalo.`,
          topic: `cliente_${pedido.cliente_id}`
        });
      } catch (pushError) {
        console.warn('El pedido se rechazó pero falló la push:', pushError);
      }

    } catch (error: any) {
      console.error('Error al rechazar pedido:', error);
      await Haptics.impact({ style: ImpactStyle.Heavy });
      this.errorMsg = 'No se pudo rechazar el pedido.';
    } finally {
      this.confirmandoId = null;
      this.cdr.detectChanges();
    }
  }

  async entregarPedido(pedido: PedidoPendiente) {
    const modal = await this.modalCtrl.create({
      component: ConfirmModalComponent,
      componentProps: { mensaje: `¿Confirmar entrega en la Mesa ${pedido.mesa_id}?` },
      cssClass: 'modal-alerta'
    });

    await modal.present();
    const { data: confirmado } = await modal.onDidDismiss();
    if (!confirmado) return;

    this.confirmandoId = pedido.id;
    this.cdr.detectChanges();

    try {
      await this.pedidosService.entregarPedido(pedido.id, pedido.cliente_id);

      // Como la app escucha en tiempo real, el pedido desaparecerá o cambiará de estado automáticamente.
      const toast = await this.toastCtrl.create({
        message: `Pedido de Mesa ${pedido.mesa_id} entregado al cliente.`,
        duration: 2500,
        position: 'middle',
        color: 'success',
        icon: 'checkmark-circle-outline'
      });
      await toast.present();

    } catch (error: any) {
      console.error('Error al entregar pedido:', error);
      await Haptics.impact({ style: ImpactStyle.Heavy });
      this.errorMsg = 'No se pudo registrar la entrega.';
    } finally {
      this.confirmandoId = null;
      this.cdr.detectChanges();
    }
  }


}