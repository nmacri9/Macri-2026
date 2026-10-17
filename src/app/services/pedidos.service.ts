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

    // 1. Actualizamos el sector y le pedimos a Supabase que nos devuelva la fila actualizada en el mismo tiro
    const { data: pedidosActualizados, error: errorUpdate } = await this.supabase
      .from('pedidos')
      .update({ [campoSector]: 'listo' })
      .eq('id', pedidoId)
      .select('id, mesa_id, cliente_id, estado_cocina, estado_bar');

    if (errorUpdate) throw errorUpdate;

    const pedido = pedidosActualizados?.[0];
    if (!pedido) {
      console.warn(`No se pudo obtener el pedido ${pedidoId} tras la actualización.`);
      return;
    }

    console.log(`Sector ${sector} marcado como listo. Estados actuales:`, {
      cocina: pedido.estado_cocina,
      bar: pedido.estado_bar
    });

    // 2. Evaluamos si ambos sectores ya terminaron o no aplican
    const cocinaOk = !pedido.estado_cocina || pedido.estado_cocina === 'listo' || pedido.estado_cocina === 'no_aplica';
    const barOk = !pedido.estado_bar || pedido.estado_bar === 'listo' || pedido.estado_bar === 'no_aplica';

    if (cocinaOk && barOk) {
      console.log(`¡Ambos sectores listos para la Mesa ${pedido.mesa_id}! Pasando a listo_para_entregar y notificando al mozo...`);

      // 3. Pasamos el pedido a 'listo_para_entregar'
      const { error: errorFinal } = await this.supabase
        .from('pedidos')
        .update({ estado: 'listo_para_entregar' })
        .eq('id', pedidoId);

      if (errorFinal) throw errorFinal;

      // 4. Disparo directo mediante invocarEdgeFunction al Mozo (Punto 18)
      await this.enviarNotificacion(
        'mozos',
        '¡Pedido Completo para Servir!',
        `La mesa ${pedido.mesa_id} está lista para entregar.`
      );

      // 5. Notificación al cliente
      if (pedido.cliente_id) {
        await this.enviarNotificacion(
          `cliente_${pedido.cliente_id}`,
          '¡Tu pedido está listo!',
          'El mozo lo está llevando a tu mesa.'
        );
      }
    } else {
      console.log(`Mesa ${pedido.mesa_id}: un sector terminó, pero el otro aún sigue en preparación.`);
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