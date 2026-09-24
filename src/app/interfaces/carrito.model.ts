import type { Producto as ProductoDB } from './producto';

// El molde original de tus productos en la base de datos
export interface Producto {
  id: string;
  nombre: string;
  tipo: ProductoDB['tipo'];
  precio: number;
  tipo:string;
  tiempoElaboracion: number;
  fotos: string[];
}

// El molde específico para el carrito (le suma la propiedad "cantidad")
export interface ProductoCarrito extends Producto {
  cantidad: number;
}
