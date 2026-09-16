import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonContent, IonItem, IonIcon, IonButton } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { addOutline, removeOutline, cartOutline } from 'ionicons/icons';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Subscription } from 'rxjs';
import { CarritoService } from '../../services/carrito.service';
import { ProductoCarrito } from '../../interfaces/carrito.model';
import { SupabaseService } from '../../services/supabase.service';
import { CepaHeaderComponent } from '../../shared/components/cepa-header/cepa-header.component';
import { CepaSpinnerComponent } from '../../shared/components/cepa-spinner/cepa-spinner.component';

type EstadoPedido = 'carrito' | 'pendiente_confirmacion' | 'confirmado';

@Component({
  selector: 'app-pedido',
  templateUrl: './pedido.page.html',
  styleUrls: ['./pedido.page.scss'],
  standalone: true,
  imports: [IonContent, IonItem, IonIcon, IonButton, CommonModule, CepaHeaderComponent, CepaSpinnerComponent]
})
export class PedidoPage implements OnInit, OnDestroy {

  items: ProductoCarrito[] = [];
  total = 0;
  tiempoEstimado = 0;

  estadoPedido: EstadoPedido = 'carrito';
  pedidoId: string | null = null;
  enviando = false;
  errorPedido: string | undefined;

  private subs: Subscription[] = [];
  private canalRealtime: any;

  constructor(
    private carritoService: CarritoService,
    private supabase: SupabaseService,
    private cdr: ChangeDetectorRef
  ) {
    addIcons({ addOutline, removeOutline, cartOutline });
  }

  ngOnInit() {
    this.subs.push(
      this.carritoService.items$.subscribe(items => {
        this.items = items;
        this.cdr.detectChanges();
      })
    );

    this.subs.push(
      this.carritoService.total$.subscribe(total => {
        this.total = total;
        this.cdr.detectChanges();
      })
    );

    this.subs.push(
      this.carritoService.tiempoEstimado$.subscribe(tiempo => {
        this.tiempoEstimado = tiempo;
        this.cdr.detectChanges();
      })
    );
  }

  ngOnDestroy() {
    this.subs.forEach(sub => sub.unsubscribe());
    this.canalRealtime?.unsubscribe();
  }

  sumar(item: ProductoCarrito) {
    this.carritoService.agregarProducto(item);
  }

  restar(item: ProductoCarrito) {
    this.carritoService.restarProducto(item.id);
  }

  async enviarPedido() {
    if (this.items.length === 0) {
      await Haptics.impact({ style: ImpactStyle.Heavy });
      this.errorPedido = 'El carrito está vacío.';
      return;
    }

    this.enviando = true;
    this.errorPedido = undefined;
    this.cdr.detectChanges();

    try {
      const { data: userData, error: userError } = await this.supabase.getClient().auth.getUser();
      if (userError || !userData.user) throw new Error('No se pudo identificar al usuario.');

      const { data: asignacion, error: asignacionError } = await this.supabase.getClient()
        .from('asignaciones_mesa')
        .select('mesa_id')
        .eq('cliente_id', userData.user.id)
        .eq('activa', true)
        .single();

      if (asignacionError || !asignacion) {
        throw new Error('No se encontró una mesa asignada. Escaneá el QR de tu mesa antes de pedir.');
      }

      const { data, error } = await this.supabase.getClient()
        .from('pedidos')
        .insert({
          cliente_id: userData.user.id,
          mesa_id: asignacion.mesa_id,
          items: this.items, // ajustar si el equipo decide usar una tabla pedido_items en vez de JSON
          total: this.total,
          tiempo_estimado: this.tiempoEstimado,
          estado: 'pendiente_confirmacion'
        })
        .select()
        .single();

      if (error) throw error;

      this.pedidoId = data.id;
      this.estadoPedido = 'pendiente_confirmacion';
      this.carritoService.vaciar();
      this.escucharCambiosDeEstado(data.id);

    } catch (error: any) {
      console.error('Error al enviar pedido:', error);
      this.errorPedido = error?.message || 'No se pudo enviar el pedido. Intente nuevamente.';
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } finally {
      this.enviando = false;
      this.cdr.detectChanges();
    }
  }

  private escucharCambiosDeEstado(pedidoId: string) {
    this.canalRealtime = this.supabase.getClient()
      .channel(`pedido-${pedidoId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pedidos', filter: `id=eq.${pedidoId}` },
        (payload: any) => {
          if (payload.new.estado === 'confirmado') {
            this.estadoPedido = 'confirmado';
            this.cdr.detectChanges();
          }
        }
      )
      .subscribe();
  }
}