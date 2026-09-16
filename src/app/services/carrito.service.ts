import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map } from 'rxjs';
import { Producto, ProductoCarrito } from '../interfaces/carrito.model';

@Injectable({ providedIn: 'root' })
export class CarritoService {

  private itemsSubject = new BehaviorSubject<ProductoCarrito[]>([]);
  items$: Observable<ProductoCarrito[]> = this.itemsSubject.asObservable();

  // Total en $: suma de precio * cantidad de cada item
  total$: Observable<number> = this.items$.pipe(
    map(items => items.reduce((acc, item) => acc + item.precio * item.cantidad, 0))
  );

  // Tiempo estimado: el MAX entre los productos del carrito (se preparan en paralelo, no en serie)
  tiempoEstimado$: Observable<number> = this.items$.pipe(
    map(items => items.length === 0
      ? 0
      : Math.max(...items.map(item => item.tiempoElaboracion))
    )
  );

  agregarProducto(producto: Producto): void {
    const items = this.itemsSubject.value;
    const existente = items.find(item => item.id === producto.id);

    if (existente) {
      this.actualizarCantidad(producto.id, existente.cantidad + 1);
    } else {
      this.itemsSubject.next([...items, { ...producto, cantidad: 1 }]);
    }
  }

  restarProducto(productoId: string): void {
    const items = this.itemsSubject.value;
    const existente = items.find(item => item.id === productoId);
    if (!existente) return;

    if (existente.cantidad <= 1) {
      this.eliminarProducto(productoId);
    } else {
      this.actualizarCantidad(productoId, existente.cantidad - 1);
    }
  }

  eliminarProducto(productoId: string): void {
    const items = this.itemsSubject.value.filter(item => item.id !== productoId);
    this.itemsSubject.next(items);
  }

  private actualizarCantidad(productoId: string, cantidad: number): void {
    const items = this.itemsSubject.value.map(item =>
      item.id === productoId ? { ...item, cantidad } : item
    );
    this.itemsSubject.next(items);
  }

  obtenerSnapshot(): ProductoCarrito[] {
    return this.itemsSubject.value;
  }

  vaciar(): void {
    this.itemsSubject.next([]);
  }
}