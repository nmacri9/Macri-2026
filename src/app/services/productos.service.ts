import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Producto } from '../interfaces/producto';

@Injectable({
    providedIn: 'root'
    })
    export class ProductosService {
    private supabase;

    constructor(private supabaseService: SupabaseService) {
        this.supabase = this.supabaseService.getClient();
    }

    // Listar todos los productos activos
    async listarProductos() {
        const { data, error } = await this.supabase
        .from('productos')
        .select('*')
        .eq('activo', true)
        .order('nombre');

        if (error) throw error;
        return data ?? [];
    }

    // Listar productos por tipo (PLATO, BEBIDA, POSTRE)
    async listarPorTipo(tipo: Producto['tipo']) {
        const { data, error } = await this.supabase
        .from('productos')
        .select('*')
        .eq('tipo', tipo)
        .eq('activo', true)
        .order('nombre');

        if (error) throw error;
        return data ?? [];
    }

    // Obtener producto por ID
    async obtenerProducto(id: number) {
        const { data, error } = await this.supabase
        .from('productos')
        .select('*')
        .eq('id', id)
        .single();

        if (error) throw error;
        return data;
    }

    // Validar si el producto/bebida ya existe en la carta por nombre y tipo
    async existeProducto(nombre: string, tipo: Producto['tipo']): Promise<boolean> {
        const { data, error } = await this.supabase
        .from('productos')
        .select('id')
        .ilike('nombre', nombre.trim())
        .eq('tipo', tipo)
        .limit(1);

        if (error) throw error;
        return (data && data.length > 0);
    }

    // Subir una imagen al bucket Storage y obtener su URL pública
    async subirImagen(archivo: File, subcarpeta: string): Promise<string> {
        const extension = archivo.name.split('.').pop() || 'jpg';
        const nombreArchivo = `${crypto.randomUUID()}.${extension}`;
        const ruta = `${subcarpeta}/${nombreArchivo}`;

        const { error: uploadError } = await this.supabase
        .storage
        .from('productos')
        .upload(ruta, archivo, {
            cacheControl: '3600',
            upsert: false
        });

        if (uploadError) throw uploadError;

        const { data } = this.supabase
        .storage
        .from('productos')
        .getPublicUrl(ruta);

        if (!data || !data.publicUrl) {
        throw new Error('No se pudo obtener la URL pública de la imagen subida.');
        }

        return data.publicUrl;
    }

    // Alta de producto con subida de sus 3 imágenes (Un solo insert en 'productos')
    async crearProductoConImagenes(producto: Producto, imagenes: File[]) {
        // 1. Validar que no exista previamente en la carta
        const existe = await this.existeProducto(producto.nombre, producto.tipo);
        if (existe) {
        throw new Error(`El producto "${producto.nombre}" ya se encuentra registrado en la carta.`);
        }

        // 2. Subir las imágenes al bucket
        const urlsImagenes: string[] = [];
        const carpeta = producto.tipo ? producto.tipo.toLowerCase() : 'productos';

        for (const img of imagenes) {
        const url = await this.subirImagen(img, carpeta);
        urlsImagenes.push(url);
        }

        // 3. Crear el registro guardando el array de URLs en la columna 'imagenes'
        const { data, error } = await this.supabase
        .from('productos')
        .insert({
            nombre: producto.nombre.trim(),
            descripcion: producto.descripcion.trim(),
            tipo: producto.tipo,
            precio: producto.precio,
            tiempo_elaboracion: producto.tiempo_elaboracion,
            imagenes: urlsImagenes,
            activo: true
        })
        .select()
        .single();

        if (error) throw error;

        return data;
    }

    // Desactivar un producto
    async desactivarProducto(id: number) {
        const { data, error } = await this.supabase
        .from('productos')
        .update({ activo: false })
        .eq('id', id)
        .select()
        .single();

        if (error) throw error;
        return data;
    }
    }