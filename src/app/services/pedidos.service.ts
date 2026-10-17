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
   * Confirma el pedido ('confirmado') y asigna 'en_preparacion'
   * a cocina y bar según los ítems del pedido.
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

    // 2. Evaluamos los ítems de manera exhaustiva
    let tieneCocina = false;
    let tieneBar = false;

    for (const item of items) {
      // Normalizamos eliminando tildes y espacios
      const tipoRaw = String(item.tipo || item.categoria || item.producto?.tipo || '').trim().toUpperCase();
      const tipoNormalizado = tipoRaw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      if (['PLATO', 'PLATOS', 'POSTRE', 'POSTRES', 'COMIDA'].includes(tipoNormalizado)) {
        tieneCocina = true;
      } else if (['BEBIDA', 'BEBIDAS', 'BAR', 'TRAGO', 'TRAGOS'].includes(tipoNormalizado)) {
        tieneBar = true;
      } else {
        // Fallback por defecto si no está especificado
        tieneCocina = true;
      }
    }

    // Si por algún motivo ambos dieron false pero hay ítems, asignamos a cocina
    if (!tieneCocina && !tieneBar && items.length > 0) {
      tieneCocina = true;
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

    // 4. Notificaciones push independientes a Cocina y Barra
    await this.notificarSectores(tieneCocina, tieneBar, pedido.mesa_id);
  }

  private async notificarSectores(tieneCocina: boolean, tieneBar: boolean, mesaId: number) {
    if (tieneCocina) {
      try {
        await this.enviarNotificacion(
          'cocina',
          '¡Nueva Comanda de Cocina!',
          `Mesa N° ${mesaId} tiene platos pendientes.`
        );
        console.log(`Push enviada al topic cocina para mesa ${mesaId}`);
      } catch (err) {
        console.warn('Falló push a Cocina:', err);
      }
    }

    if (tieneBar) {
      try {
        await this.enviarNotificacion(
          'bar',
          '¡Nueva Comanda de Bar!',
          `Mesa N° ${mesaId} tiene bebidas pendientes.`
        );
        console.log(`Push enviada al topic bar para mesa ${mesaId}`);
      } catch (err) {
        console.warn('Falló push a Barra:', err);
      }
    }
  }

  async marcarSectorListo(pedidoId: string, sector: 'cocina' | 'bar'): Promise<void> {
    const campoSector = sector === 'cocina' ? 'estado_cocina' : 'estado_bar';

    console.log(`[SectorListo] Actualizando ${sector} a 'listo' para pedido ${pedidoId}...`);

    // 1. Update del sector actual
    const { error: errorUpdate } = await this.supabase
      .from('pedidos')
      .update({ [campoSector]: 'listo' })
      .eq('id', pedidoId);

    if (errorUpdate) {
      console.error('[SectorListo] Error al actualizar sector:', errorUpdate);
      throw errorUpdate;
    }

    // 2. Leemos el pedido fresco directamente de la base
    const { data: pedido, error: errorSelect } = await this.supabase
      .from('pedidos')
      .select('id, mesa_id, cliente_id, estado_cocina, estado_bar')
      .eq('id', pedidoId)
      .single();

    if (errorSelect || !pedido) {
      console.error('[SectorListo] Error leyendo pedido actualizado:', errorSelect);
      throw errorSelect;
    }

    console.log(`[SectorListo] Estados leídos de BD -> Cocina: "${pedido.estado_cocina}", Bar: "${pedido.estado_bar}"`);

    // 3. Normalizamos y evaluamos
    const coc = String(pedido.estado_cocina || '').toLowerCase().trim();
    const bar = String(pedido.estado_bar || '').toLowerCase().trim();

    const cocinaOk = coc === 'listo' || coc === 'no_aplica' || coc === '';
    const barOk = bar === 'listo' || bar === 'no_aplica' || bar === '';

    console.log(`[SectorListo] ¿Cocina terminada?: ${cocinaOk} | ¿Bar terminado?: ${barOk}`);

    if (cocinaOk && barOk) {
      console.log(`[SectorListo] ¡AMBOS LISTOS! Actualizando pedido a 'listo_para_entregar'...`);

      const { error: errorFinal } = await this.supabase
        .from('pedidos')
        .update({ estado: 'listo_para_entregar' })
        .eq('id', pedidoId);

      if (errorFinal) {
        console.error('[SectorListo] Error pasando a listo_para_entregar:', errorFinal);
      }

      // 4. DISPARO INMEDIATO AL MOZO
      console.log('[SectorListo] Enviando push al topic "mozos"...');
      try {
        await this.supabaseService.invocarEdgeFunction('enviar-notificacion', {
          topic: 'mozos',
          titulo: '¡Pedido Completo para Servir!',
          cuerpo: `El pedido de la Mesa ${pedido.mesa_id} está listo en barra y cocina.`
        });
        console.log('[SectorListo] Push a "mozos" enviada con éxito.');
      } catch (errPushMozo) {
        console.error('[SectorListo] Falló la push a mozos:', errPushMozo);
      }

      // 5. DISPARO AL CLIENTE
      if (pedido.cliente_id) {
        try {
          await this.supabaseService.invocarEdgeFunction('enviar-notificacion', {
            topic: `cliente_${pedido.cliente_id}`,
            titulo: '¡Tu comida está lista!',
            cuerpo: 'El mozo ya tiene tu pedido listo para llevártelo a la mesa.'
          });
        } catch (errPushCliente) {
          console.warn('[SectorListo] Falló la push al cliente:', errPushCliente);
        }
      }
    } else {
      console.log(`[SectorListo] Pedido ${pedidoId} aún en espera del otro sector.`);
    }
  }

  private async enviarNotificacion(topic: string, titulo: string, cuerpo: string): Promise<void> {
    try {
      console.log(`Llamando Edge Function enviar-notificacion para topic: "${topic}"`);
      await this.supabaseService.invocarEdgeFunction('enviar-notificacion', {
        topic,
        titulo,
        cuerpo
      });
      console.log(`Notificación enviada con éxito a "${topic}"`);
    } catch (err) {
      console.error(`Error enviando notificación push al topic "${topic}":`, err);
    }
  }
  async entregarPedido(pedidoId: string, clienteId: string): Promise<void> {
    const { error } = await this.supabase
      .from('pedidos')
      .update({ estado: 'entregado' })
      .eq('id', pedidoId);

    if (error) throw error;

    await this.enviarNotificacion(
      `cliente_${clienteId}`,
      '¡Tu pedido llegó a la mesa! 🍽️',
      'Por favor, confirmá la recepción en la app para habilitar los juegos y encuestas.'
    );
  }

  async confirmarRecepcionCliente(pedidoId: string): Promise<void> {
    const { error } = await this.supabase
      .from('pedidos')
      .update({ estado: 'recibido' })
      .eq('id', pedidoId);

    if (error) throw error;
  }
}