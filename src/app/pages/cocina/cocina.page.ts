import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  IonHeader, IonToolbar, IonTitle, IonContent, 
  IonCard, IonCardHeader, IonCardTitle, IonCardContent, 
  IonBadge, IonList, IonItem, IonLabel, IonButton, IonIcon 
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { checkmarkCircleOutline } from 'ionicons/icons';
import { SupabaseService } from '../../services/supabase.service'; 

@Component({
  selector: 'app-cocina',
  templateUrl: './cocina.page.html',
  styleUrls: ['./cocina.page.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    IonHeader, IonToolbar, IonTitle, IonContent, 
    IonCard, IonCardHeader, IonCardTitle, IonCardContent, 
    IonBadge, IonList, IonItem, IonLabel, IonButton, IonIcon
  ]
})
export class CocinaPage implements OnInit, OnDestroy {
  
  pedidosCocina: any[] = [];
  private canalCocina: any;

  constructor(
    private supabase: SupabaseService,
    private cdr: ChangeDetectorRef
  ) {
    addIcons({ checkmarkCircleOutline });
  }

  ngOnInit() {
    this.cargarPedidos();
    this.escucharNuevosPedidos();
  }

  ngOnDestroy() {
    // Apagamos la escucha de Supabase si el cocinero sale de la pantalla
    if (this.canalCocina) {
      this.canalCocina.unsubscribe();
    }
  }

  async cargarPedidos() {
    try {
      console.log('1. Consultando pedidos a Supabase...');
      // 1. Buscamos pedidos confirmados por el mozo. Ordenamos los más viejos primero.
      const { data, error } = await this.supabase.getClient()
        .from('pedidos')
        .select('*')
        .eq('estado_cocina', 'en_preparacion')
        .order('created_at', { ascending: true });

      console.log('2. Respuesta - Data:', data);
      console.log('3. Respuesta - Error:', error);

      if (error) throw error;

      this.procesarYFiltrar(data || []);
    } catch (error) {
      console.error('Error al cargar pedidos de cocina:', error);
    }
  }

  procesarYFiltrar(pedidosDB: any[]) {
    // 2. sacamos las bebidas y dejamos solo Platos y Postres
    const pedidosFiltrados = pedidosDB.map(pedido => {
      return {
        ...pedido,
        items: pedido.items.filter((item: any) => item.tipo === 'PLATO' || item.tipo === 'POSTRE')
      };
    });

    // 3. Descartamos pedidos que solo tenian bebidas (quedaron con 0 items)
    this.pedidosCocina = pedidosFiltrados.filter(pedido => pedido.items.length > 0);
    this.cdr.detectChanges(); 
  }

  escucharNuevosPedidos() {
    // 4. Mantengo la pantalla viva: si hay cambios en la tabla 'pedidos', recargamos
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

  async marcarComoListo(pedidoId: string) {
    try {
      // 5. El cocinero termina el plato y actualiza la base de datos
      const { error } = await this.supabase.getClient()
        .from('pedidos')
        .update({ estado_cocina: 'listo' })
        .eq('id', pedidoId);

      if (error) throw error;

      console.log(`¡Pedido ${pedidoId} despachado!`);
    } catch (error) {
      console.error('Error al actualizar pedido:', error);
    }
  }
}