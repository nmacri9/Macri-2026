import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

@Injectable({
    providedIn: 'root'
})
export class PedidosService {
    private supabase;

    constructor(private supabaseService: SupabaseService) {
        this.supabase = this.supabaseService.getClient();
    }

    /**
     * INTEGRANTE 2: Confirma el pedido (Mozo), rutea ítems a Cocina y Bar,
     * y cambia el estado a 'en_preparacion'.
     */
    async confirmarPedidoYRutear(pedidoId: string, mozoId: string) {
        // 1. Obtener datos del pedido
        const { data: pedido, error: errPedido } = await this.supabase
        .from('pedidos')
        .select('*')
        .eq('id', pedidoId)
        .single();

        if (errPedido || !pedido) throw new Error('No se encontró el pedido.');

        const items = pedido.items as any[];

        // 2. Ruteo según el campo 'tipo' de los productos elegidos
        const tieneCocina = items.some((item: any) => 
        ['PLATO', 'POSTRE'].includes(String(item.tipo).toUpperCase())
        );
        const tieneBar = items.some((item: any) => 
        ['BEBIDA'].includes(String(item.tipo).toUpperCase())
        );

        const estadoCocina = tieneCocina ? 'en_preparacion' : 'no_aplica';
        const estadoBar = tieneBar ? 'en_preparacion' : 'no_aplica';

        // 3. Update en la tabla 'pedidos'
        const { error: errUpdate } = await this.supabase
        .from('pedidos')
        .update({
            estado: 'en_preparacion',
            estado_cocina: estadoCocina,
            estado_bar: estadoBar,
            confirmado_por: mozoId,
            fecha_confirmacion: new Date().toISOString()
        })
        .eq('id', pedidoId);

        if (errUpdate) throw errUpdate;

        // 4. Notificaciones push a Cocinero y Bartender
        await this.notificarSectores(tieneCocina, tieneBar, pedido.mesa_id);
    }

    private async notificarSectores(tieneCocina: boolean, tieneBar: boolean, mesaId: number) {
        try {
        if (tieneCocina) {
            await this.supabase.functions.invoke('enviar-notificacion', {
            body: {
                topic: 'cocina',
                titulo: '¡Nueva Comanda de Cocina!',
                cuerpo: `Mesa N° ${mesaId} tiene platos pendientes.`
            }
            });
        }

        if (tieneBar) {
            await this.supabase.functions.invoke('enviar-notificacion', {
            body: {
                topic: 'bar',
                titulo: '¡Nueva Comanda de Bar!',
                cuerpo: `Mesa N° ${mesaId} tiene bebidas pendientes.`
            }
            });
        }
        } catch (err) {
        console.warn('Falló la notificación push a los sectores:', err);
        }
    }
}