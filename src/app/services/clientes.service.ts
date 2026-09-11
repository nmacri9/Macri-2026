import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

export type ResolucionCliente = 'APROBADO' | 'RECHAZADO';

export interface ClientePendiente {
  id: number;
  cliente_id: string;
  nombre: string | null;
  apellido: string;
  correo: string | null;
  foto_url: string | null;
  estado: 'PENDIENTE';
}

@Injectable({ providedIn: 'root' })
export class ClientesService {
  constructor(private readonly supabase: SupabaseService) {}

  async listarPendientes(): Promise<ClientePendiente[]> {
    const { data, error } = await this.supabase.getClient()
      .from('clientes')
      .select('id, cliente_id, nombre, apellido, correo, foto_url, estado')
      .eq('estado', 'PENDIENTE')
      .order('id', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  async resolver(id: number, estado: ResolucionCliente): Promise<void> {
    if (estado !== 'APROBADO' && estado !== 'RECHAZADO') {
      throw new Error('Estado de resolución inválido.');
    }
    // La ruta ya está protegida por roleGuard para dueño y supervisor.
    const { data, error } = await this.supabase.getClient()
      .from('clientes')
      .update({ estado })
      .eq('id', id)
      .eq('estado', 'PENDIENTE')
      .select('id, estado')
      .maybeSingle();
    if (error) throw error;
    const resultado = data as { id: number; estado: string } | null;
    if (!resultado || resultado.id !== id || resultado.estado !== estado) {
      throw new Error('No se confirmó la actualización del cliente.');
    }
  }
}
