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
     * INTEGRANTE 2: Confirma el pedido ('confirmado') y asigna 'en_preparacion'
     * a cocina y bar según la categoría de cada producto.
     */
    async confirmarPedidoYRutear(pedidoId: string, mozoId: string) {
        // 1. Obtener datos del pedido
        const { data: pedido, error: errPedido } = await this.supabase
        .from('pedidos')
        .select('*')
        .eq('id', pedidoId)
        .single();

        if (errPedido || !pedido) throw new Error('No se encontró el pedido.');

        const items = (pedido.items as any[]) || [];

        // 2. Evaluamos el tipo de cada producto de forma flexible
        let tieneCocina = false;
        let tieneBar = false;

        for (const item of items) {
        // Leemos tipo o categoria independientemente de cómo se haya guardado
        const valorTipo = String(item.tipo || item.categoria || '').trim().toUpperCase();

        if (['PLATO', 'PLATOS', 'POSTRE', 'POSTRES', 'COMIDA'].includes(valorTipo)) {
            tieneCocina = true;
        } else if (['BEBIDA', 'BEBIDAS', 'BAR', 'TRAGO', 'TRAGOS'].includes(valorTipo)) {
            tieneBar = true;
        } else {
            // Fallback: Si no viene el tipo explícito, asumimos cocina por defecto
            tieneCocina = true;
        }
        }

        const estadoCocina = tieneCocina ? 'en_preparacion' : 'no_aplica';
        const estadoBar = tieneBar ? 'en_preparacion' : 'no_aplica';

        // 3. Update en la tabla 'pedidos'
        const { error: errUpdate } = await this.supabase
        .from('pedidos')
        .update({
            estado: 'confirmado',
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

    async marcarSectorListo(pedidoId: string, sector: 'cocina' | 'bar'): Promise<void> {
        const campoSector = sector === 'cocina' ? 'estado_cocina' : 'estado_bar';

        const { data, error: errorUpdate } = await this.supabase
            .from('pedidos')
            .update({ [campoSector]: 'listo' })
            .eq('id', pedidoId)
            .select();

        console.log('Resultado del update en Supabase:', { data, errorUpdate });

        if (errorUpdate) throw errorUpdate;
        
        if (!data || data.length === 0) {
            throw new Error(`El pedido ${pedidoId} no se pudo actualizar. ¿Las políticas RLS de Supabase están bloqueando la escritura?`);
        }

        const { data: pedido, error: errorSelect } = await this.supabase
            .from('pedidos')
            .select('estado_cocina, estado_bar, cliente_id, mesa_id')
            .eq('id', pedidoId)
            .single();

        if (errorSelect || !pedido) throw errorSelect;

        const cocinaOk = pedido.estado_cocina === 'listo' || pedido.estado_cocina === 'no_aplica';
        const barOk = pedido.estado_bar === 'listo' || pedido.estado_bar === 'no_aplica';

        if (cocinaOk && barOk) {
            const { error: errorFinal } = await this.supabase
                .from('pedidos')
                .update({ estado: 'listo_para_entregar' })
                .eq('id', pedidoId);

            if (errorFinal) throw errorFinal;

            await this.enviarNotificacion('mozos', '¡Pedido Completo!', `La mesa ${pedido.mesa_id} está lista para servir.`);
            await this.enviarNotificacion(`cliente_${pedido.cliente_id}`, '¡Tu pedido está listo!', 'El mozo lo está llevando a tu mesa.');
        }
    }

    private async enviarNotificacion(topic: string, titulo: string, cuerpo: string): Promise<void> {
        try {
            await this.supabase.functions.invoke('enviar-notificacion', {
                body: { topic, titulo, cuerpo }
            });
        } catch (err) {
            console.warn('Falló la notificación push:', err);
        }
    }
}