import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  IonHeader, IonToolbar, IonTitle, IonContent, 
  IonCard, IonCardHeader, IonCardTitle, IonCardContent, 
  IonBadge, IonList, IonItem, IonLabel, IonButton, IonIcon 
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { checkmarkCircleOutline } from 'ionicons/icons';

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
export class CocinaPage implements OnInit {
  
  // Array final que usará el HTML para dibujar las tarjetas
  pedidosCocina: any[] = [];

  // Datos simulados: simulando lo que devolverá Supabase
  pedidosSimulados = [
    {
      id: 'ped-001',
      mesa_id: 3,
      created_at: '2026-09-22T19:30:00Z',
      estado: 'en_preparacion',
      items: [
        { nombre: 'Milanesa con fritas', cantidad: 2, tipo: 'PLATO' },
        { nombre: 'Coca Cola 2L', cantidad: 1, tipo: 'BEBIDA' }, // Esto se va a filtrar
        { nombre: 'Flan Casero', cantidad: 1, tipo: 'POSTRE' }
      ]
    },
    {
      id: 'ped-002',
      mesa_id: 5,
      created_at: '2026-09-22T19:35:00Z',
      estado: 'en_preparacion',
      items: [
        { nombre: 'Ravioles con Tuco', cantidad: 3, tipo: 'PLATO' },
        { nombre: 'Vino Tinto', cantidad: 1, tipo: 'BEBIDA' } // Esto se va a filtrar
      ]
    }
  ];

  constructor() {
    // Registramos el ícono para el botón de "Pedido Listo"
    addIcons({ checkmarkCircleOutline });
  }

  ngOnInit() {
    this.procesarPedidos();
  }

  procesarPedidos() {
    // Mapeamos los pedidos para sacar las bebidas
    const pedidosFiltrados = this.pedidosSimulados.map(pedido => {
      return {
        ...pedido,
        // Filtramos dejando solo PLATO y POSTRE
        items: pedido.items.filter((item: any) => item.tipo === 'PLATO' || item.tipo === 'POSTRE')
      };
    });

    // Eliminamos los pedidos que se quedaron vacíos
    this.pedidosCocina = pedidosFiltrados.filter(pedido => pedido.items.length > 0);
  }

  marcarComoListo(pedidoId: string) {
    console.log(`¡Pedido ${pedidoId} marcado como LISTO_COCINA!`);
    
    // Lo sacamos visualmente de la pantalla
    this.pedidosCocina = this.pedidosCocina.filter(p => p.id !== pedidoId);
  }
}