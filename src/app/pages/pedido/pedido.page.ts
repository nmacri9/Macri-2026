import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonContent, IonItem, IonIcon, IonButton } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { addOutline, removeOutline, cartOutline, timeOutline } from 'ionicons/icons';
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

  // Variables para el menú real
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

  constructor(
    private carritoService: CarritoService,
    private supabase: SupabaseService,
    private cdr: ChangeDetectorRef
  ) {
    addIcons({ addOutline, removeOutline, cartOutline, timeOutline });
  }

  ngOnInit() {
    this.cargarMenuReal();

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

  // --- CARGA DEL MENÚ DESDE SUPABASE ---
  async cargarMenuReal() {
    this.cargandoMenu = true;
    try {
      // Ajustá el nombre de la tabla si en tu BD se llama distinto (ej. 'platos', 'productos')
      const { data, error } = await this.supabase.getClient()
        .from('productos') 
        .select('*');
        // .eq('activo', true); // Descomentá esto si tenés una columna para ocultar productos agotados

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
    // Mapeamos los datos de la base de datos a la interfaz ProductoCarrito
    const item: ProductoCarrito = {
      id: productoDB.id,
      nombre: productoDB.nombre,
      precio: productoDB.precio,
      tiempoElaboracion: productoDB.tiempo_elaboracion || productoDB.tiempoElaboracion || 0, 
      fotos: productoDB.fotos || [],
      cantidad: 1,
    };
    this.carritoService.agregarProducto(item);
  }
  // -------------------------------------

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
        .select('mesa_id, mesas(numero)')
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
          items: this.items, 
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

      // Aviso Push
      try {
        await this.supabase.getClient().functions.invoke('enviar-notificacion', {
          body: {
            titulo: '¡Nuevo Pedido en Espera!',
            cuerpo: `La Mesa ${(asignacion as any).mesas?.numero ?? asignacion.mesa_id} mandó su pedido. ¡A revisar!`,
            topic: 'mozos' 
          }
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