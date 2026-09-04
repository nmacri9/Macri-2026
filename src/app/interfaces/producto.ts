export interface Producto {
    id?: number;
    nombre: string;
    descripcion: string;
    tipo: 'PLATO' | 'BEBIDA' | 'POSTRE';
    precio: number;
    tiempo_elaboracion: number;
    imagenes?: string[];
    activo?: boolean;
    created_at?: string;
}

