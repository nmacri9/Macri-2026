import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Mesa } from '../interfaces/mesa';

@Injectable({ providedIn: 'root' })
export class MesasService {
  private db;
  constructor(supabase: SupabaseService) { this.db = supabase.getClient(); }

  async obtenerClienteId(authId: string): Promise<number | null> {
    const { data, error } = await this.db.from('clientes').select('id').eq('cliente_id', authId).maybeSingle();
    if (error) throw error;
    return data?.id ?? null;
  }

  async tieneAsignacionActiva(authId: string): Promise<boolean> {
    const clienteId = await this.obtenerClienteId(authId);
    if (clienteId === null) return false;
    const { data, error } = await this.db.from('asignaciones').select('id')
      .eq('cliente_id', clienteId).is('fecha_finalizacion', null)
      .in('estado', ['esperando', 'asignado']).limit(1).maybeSingle();
    if (error) throw error;
    return !!data;
  }

  async obtenerAsignacionActiva(authId: string) {
    const clienteId = await this.obtenerClienteId(authId);
    if (clienteId === null) return null;
    const { data, error } = await this.db.from('asignaciones')
      .select('id, mesa_id, fecha_asignacion, mesas(disponibilidad)').eq('cliente_id', clienteId)
      .eq('estado', 'asignado').is('fecha_finalizacion', null).not('mesa_id', 'is', null)
      .order('fecha_asignacion', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const mesa = Array.isArray(data.mesas) ? data.mesas[0] : data.mesas;
    return { mesaId: data.mesa_id, fechaAsignacion: data.fecha_asignacion, vinculada: mesa?.disponibilidad === 'OCUPADA' };
  }

  async obtenerMesasDisponibles(): Promise<Mesa[]> {
    const { data, error } = await this.db.from('mesas').select('*')
      .eq('disponibilidad', 'VACIA').order('id', { ascending: true });
    if (error) throw error;
    return (data ?? []) as Mesa[];
  }

  async asignarMesaACliente(asignacionId: number, mesaId: number) {
    const { data: pendiente, error: errorPendiente } = await this.db.from('asignaciones')
      .select('cantidad_personas, cliente_id').eq('id', asignacionId).eq('estado', 'esperando')
      .is('mesa_id', null).is('fecha_finalizacion', null).maybeSingle();
    if (errorPendiente) throw errorPendiente;
    if (!pendiente) throw new Error('El cliente ya no está en la lista de espera.');

    const { data: mesa, error: errorMesa } = await this.db.from('mesas')
      .select('capacidad, disponibilidad').eq('id', mesaId).single();
    if (errorMesa) throw errorMesa;
    if (mesa.disponibilidad !== 'VACIA') throw new Error('La mesa ya no está disponible.');
    if (mesa.capacidad < pendiente.cantidad_personas) throw new Error('La capacidad de la mesa es insuficiente.');

    const { data: ocupada, error: errorOcupada } = await this.db.from('asignaciones')
      .select('id').eq('mesa_id', mesaId).eq('estado', 'asignado')
      .is('fecha_finalizacion', null).limit(1).maybeSingle();
    if (errorOcupada) throw errorOcupada;
    if (ocupada) throw new Error('Esta mesa acaba de ser asignada a otro cliente.');

    const ahora = new Date().toISOString();
    const { count: asignacionesActualizadas, error } = await this.db.from('asignaciones')
      .update({ mesa_id: mesaId, estado: 'asignado', fecha_asignacion: ahora, updated_at: ahora }, { count: 'exact' })
      .eq('id', asignacionId).eq('estado', 'esperando').is('mesa_id', null)
      .is('fecha_finalizacion', null);
    if (error) throw error;
    if (asignacionesActualizadas !== 1) throw new Error('No se pudo actualizar la asignación. Revisá los permisos o actualizá la lista.');

    const { count: mesasActualizadas, error: errorEstado } = await this.db.from('mesas')
      .update({ disponibilidad: 'RESERVADA' }, { count: 'exact' })
      .eq('id', mesaId).eq('disponibilidad', 'VACIA');
    if (errorEstado) throw errorEstado;
    if (mesasActualizadas !== 1) throw new Error('Se asignó la mesa al cliente, pero no se pudo marcar como RESERVADA. Revisá la mesa.');

    // El topic usa el UUID de Auth, no el id numérico de la tabla clientes.
    // Un fallo del aviso no revierte una asignación que ya se guardó.
    try {
      const { data: cliente, error: errorCliente } = await this.db.from('clientes')
        .select('cliente_id').eq('id', pendiente.cliente_id).single();
      if (errorCliente) throw errorCliente;
      if (!cliente?.cliente_id) throw new Error('El cliente no tiene un usuario asociado.');
      const { data, error: errorPush } = await this.db.functions.invoke('enviar-notificacion', {
        body: {
          topic: `cliente_${cliente.cliente_id}`,
          titulo: '¡Ya tenés mesa asignada!',
          cuerpo: `Te han asignado la mesa ${mesaId}. Acercate y escaneá el QR de tu mesa.`,
          data: { ruta: '/home', mesa_id: String(mesaId) },
        },
      });
      if (errorPush) throw errorPush;
      if (data?.error) throw new Error(data.error);
      return { notificacionEnviada: true };
    } catch (error) {
      console.error('[Push] Mesa asignada, pero no se pudo enviar el aviso al cliente:', error);
      return { notificacionEnviada: false };
    }
  }

  async validarYVincularMesaQR(authId: string, qrTokenLeido: string) {
    const asignacion = await this.obtenerAsignacionActiva(authId);
    if (!asignacion) throw new Error('Aún no tenés ninguna mesa asignada por el Metre.');
    const { data: mesa, error } = await this.db.from('mesas')
      .select('id, qr_token').eq('id', asignacion.mesaId).single();
    if (error) throw error;
    if (mesa.qr_token !== qrTokenLeido && `MESA_${mesa.id}` !== qrTokenLeido) {
      throw new Error(`Mesa equivocada. Debes vincularte a tu mesa asignada: Mesa ${mesa.id}.`);
    }
    const { error: errUpdateMesa } = await this.db.from('mesas')
      .update({ disponibilidad: 'OCUPADA' }).eq('id', mesa.id);
    if (errUpdateMesa) throw errUpdateMesa;
    return asignacion;
  }
}
