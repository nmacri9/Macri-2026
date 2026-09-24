import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonSpinner } from '@ionic/angular';
import { Producto } from '../../interfaces/producto';
import { ProductosService } from '../../services/productos.service';
import { CepaHeaderComponent } from '../../shared/components/cepa-header/cepa-header.component';

interface ProductoEnMenu extends Producto {
  fotos: (string | null)[];
  fotoActual: number;
  fotosFallidas: boolean[];
}

@Component({
  selector: 'app-menu-productos',
  standalone: true,
  imports: [IonContent, IonSpinner, CepaHeaderComponent, RouterLink],
  templateUrl: './menu-productos.page.html',
  styleUrls: ['./menu-productos.page.scss'],
})
export class MenuProductosPage {
  private readonly productosService = inject(ProductosService);
  readonly productos = signal<ProductoEnMenu[]>([]);
  readonly cargando = signal(true);
  readonly error = signal('');
  readonly tipos = { PLATO: 'Plato', BEBIDA: 'Bebida', POSTRE: 'Postre' };
  private readonly formatoPrecio = new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS',
  });

  ionViewWillEnter() {
    void this.cargarProductos();
  }

  async cargarProductos() {
    this.cargando.set(true);
    this.error.set('');
    try {
      const productos: Producto[] = await this.productosService.listarProductos();
      this.productos.set(productos.map(producto => ({
        ...producto,
        fotos: [0, 1, 2].map(indice => producto.imagenes?.[indice] || null),
        fotoActual: 0,
        fotosFallidas: [false, false, false],
      })));
    } catch {
      this.error.set('No pudimos cargar el menú. Revisá tu conexión y volvé a intentar.');
    } finally {
      this.cargando.set(false);
    }
  }

  cambiarFoto(producto: ProductoEnMenu, desplazamiento: number) {
    producto.fotoActual = (producto.fotoActual + desplazamiento + 3) % 3;
  }

  precio(valor: number): string {
    return this.formatoPrecio.format(valor);
  }
}
