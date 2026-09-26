import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonContent, IonItem, IonIcon, IonButton, IonSpinner, IonFooter } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { addOutline, removeOutline, cartOutline, timeOutline, alertCircleOutline } from 'ionicons/icons';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { FCM } from '@capacitor-community/fcm';
import { Subscription } from 'rxjs';
import { CarritoService } from '../../services/carrito.service';
import { ProductoCarrito } from '../../interfaces/carrito.model';
import { SupabaseService } from '../../services/supabase.service';
import { CepaHeaderComponent } from '../../shared/components/cepa-header/cepa-header.component';
import { CepaSpinnerComponent } from '../../shared/components/cepa-spinner/cepa-spinner.component';

type EstadoPedido = 'carrito' | 'pendiente_confirmacion' | 'rechazado_mozo' | 'confirmado';

@Component({
  selector: 'app-pedido',
  templateUrl: './pedido.page.html',
  styleUrls: ['./pedido.page.scss'],
  standalone: true,
  imports: [IonContent, IonItem,IonFooter , IonIcon, IonButton, IonSpinner, CommonModule, CepaHeaderComponent, CepaSpinnerComponent]
})
export class PedidoPage implements OnInit, OnDestroy {

  productosMenu: any[] = [];
  cargandoMenu = true;

  items: ProductoCarrito[] = [];
  total = 0;
  tiempoEstimado = 0;

  estadoPedido: EstadoPedido = 'carrito';
  pedidoId: string | null = null;
  enviando = false;
  errorPedido: string | undefined;

  private subs: Subscription[] = [];
  private canalRealtime: any;
  private intervaloChequeo: any;

  constructor(
    private carritoService: CarritoService,
    private supabase: SupabaseService,
    private cdr: ChangeDetectorRef
  ) {
    addIcons({ addOutline, removeOutline, cartOutline, timeOutline, alertCircleOutline });
  }

  ngOnInit() {
    this.cargarMenuReal();
    this.verificarPedidoActivoYSuscribirPush();

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
    if (this.intervaloChequeo) {
      clearInterval(this.intervaloChequeo);
    }
  }

  async verificarPedidoActivoYSuscribirPush() {
    try {
      const { data: userData } = await this.supabase.getClient().auth.getUser();
      if (!userData?.user) return;

      // Suscribimos el celular al canal personal del cliente para recibir el rechazo del mozo
      try {
        await FCM.subscribeTo({ topic: `cliente_${userData.user.id}` });
      } catch (fcmErr) {
        console.warn('FCM no disponible en navegador web:', fcmErr);
      }

      const { data: ultimoPedido } = await this.supabase.getClient()
        .from('pedidos')
        .select('*')
        .eq('cliente_id', userData.user.id)
        .in('estado', ['pendiente_confirmacion', 'rechazado_mozo', 'confirmado'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (ultimoPedido) {
        this.pedidoId = ultimoPedido.id;
        this.aplicarCambioDeEstado(ultimoPedido);
        this.escucharCambiosDeEstado(ultimoPedido.id);
      }
    } catch (err) {
      console.warn('No se pudo verificar pedido previo:', err);
    }
  }

  async cargarMenuReal() {
    this.cargandoMenu = true;
    try {
      const { data, error } = await this.supabase.getClient()
        .from('productos') 
        .select('*')
        .eq('activo', true);

      if (error) throw error;
      this.productosMenu = data || [];
    } catch (error) {
      console.error('Error al cargar el menú:', error);
    } finally {
      this.cargandoMenu = false;
      this.cdr.detectChanges();
    }
  }

  agregarAlCarrito(productoDB: any) {
    const item: ProductoCarrito = {
      id: productoDB.id,
      nombre: productoDB.nombre,
      tipo: productoDB.tipo,
      precio: productoDB.precio,
      tiempoElaboracion: productoDB.tiempo_elaboracion || productoDB.tiempoElaboracion || 0, 
      fotos: productoDB.imagenes || productoDB.fotos || [],
      cantidad: 1,
    };
    this.carritoService.agregarProducto(item);
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

      try {
        await FCM.subscribeTo({ topic: `cliente_${userData.user.id}` });
      } catch {}

      const { data: asignacionDB } = await this.supabase.getClient()
        .from('asignaciones_mesa')
        .select('mesa_id, mesas(numero)')
        .eq('cliente_id', userData.user.id)
        .is('fecha_fin', null)
        .order('fecha_asignacion', { ascending: false })
        .limit(1)
        .maybeSingle();

      const asignacion = asignacionDB ?? { mesa_id: 2, mesas: { numero: 1 } };
      const eraRechazado = this.estadoPedido === 'rechazado_mozo';

      let actualizadoConExito = false;

      if (eraRechazado && this.pedidoId) {
        // Pedimos .select() para comprobar que el RLS de Supabase realmente dejó actualizar la fila
        const { data: updateData, error: updateError } = await this.supabase.getClient()
          .from('pedidos')
          .update({
            items: this.items, 
            total: this.total, 
            tiempo_estimado: this.tiempoEstimado, 
            estado: 'pendiente_confirmacion' 
          })
          .eq('id', this.pedidoId)
          .select();

        if (!updateError && updateData && updateData.length > 0) {
          actualizadoConExito = true;
        }
      }

      // Si es un pedido nuevo, o si el RLS bloqueó el UPDATE, insertamos el pedido corregido
      if (!actualizadoConExito) {
        const { data, error } = await this.supabase.getClient()
          .from('pedidos')
          .insert({
            cliente_id: userData.user.id,
            mesa_id: asignacion.mesa_id,
            items: this.items, 
            total: this.total,
            tiempo_estimado: this.tiempoEstimado,
            estado: 'pendiente_confirmacion'
          })
          .select()
          .single();

        if (error) throw error;
        this.pedidoId = data.id;
      }

      this.estadoPedido = 'pendiente_confirmacion';
      this.carritoService.vaciar();

      if (this.pedidoId) {
        this.escucharCambiosDeEstado(this.pedidoId);
      }

      const numeroMesa = (asignacion as any).mesas?.numero ?? asignacion.mesa_id;

      try {
        await this.supabase.invocarEdgeFunction('enviar-notificacion', {
          titulo: eraRechazado ? '¡Pedido Modificado!' : '¡Nuevo Pedido en Espera!',
          cuerpo: eraRechazado 
            ? `La Mesa ${numeroMesa} modificó su pedido y volvió a enviarlo.`
            : `La Mesa ${numeroMesa} mandó su pedido. ¡A revisar!`,
          topic: 'mozos'
        });
      } catch (pushError) {
        console.warn('El pedido se guardó pero falló la push:', pushError);
      }

    } catch (error: any) {
      console.error('Error al enviar pedido:', error);
      this.errorPedido = error?.message || 'No se pudo enviar el pedido. Intente nuevamente.';
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } finally {
      this.enviando = false;
      this.cdr.detectChanges();
    }
  }

  private aplicarCambioDeEstado(pedido: any) {
    if (pedido.estado === 'confirmado' && this.estadoPedido !== 'confirmado') {
      this.estadoPedido = 'confirmado';
      if (this.intervaloChequeo) clearInterval(this.intervaloChequeo);
      this.cdr.detectChanges();
    } 
    else if (pedido.estado === 'rechazado_mozo' && this.estadoPedido !== 'rechazado_mozo') {
      this.estadoPedido = 'rechazado_mozo';
      if (this.intervaloChequeo) clearInterval(this.intervaloChequeo);

      this.carritoService.vaciar();
      (pedido.items || []).forEach((item: any) => {
        for (let i = 0; i < item.cantidad; i++) {
          this.carritoService.agregarProducto(item);
        }
      });

      this.cdr.detectChanges();
    }
    else if (pedido.estado === 'pendiente_confirmacion') {
      this.estadoPedido = 'pendiente_confirmacion';
      this.cdr.detectChanges();
    }
  }

  private escucharCambiosDeEstado(pedidoId: string) {
    this.canalRealtime?.unsubscribe();
    if (this.intervaloChequeo) clearInterval(this.intervaloChequeo);

    this.canalRealtime = this.supabase.getClient()
      .channel(`pedido-${pedidoId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pedidos', filter: `id=eq.${pedidoId}` },
        (payload: any) => {
          this.aplicarCambioDeEstado(payload.new);
        }
      )
      .subscribe();

    this.intervaloChequeo = setInterval(async () => {
      if (this.estadoPedido !== 'pendiente_confirmacion') return;

      const { data } = await this.supabase.getClient()
        .from('pedidos')
        .select('*')
        .eq('id', pedidoId)
        .maybeSingle();

      if (data && data.estado !== 'pendiente_confirmacion') {
        this.aplicarCambioDeEstado(data);
      }
    }, 3000);
  }
}