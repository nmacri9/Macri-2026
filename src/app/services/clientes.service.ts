import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { EmailService } from './email.service';

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
  constructor(
    private readonly supabase: SupabaseService,
    private readonly emailService: EmailService
  ) {}

  async listarPendientes(): Promise<ClientePendiente[]> {
    const { data, error } = await this.supabase.getClient()
      .from('clientes')
      .select('id, cliente_id, nombre, apellido, correo, foto_url, estado')
      .eq('estado', 'PENDIENTE')
      .order('id', { ascending: true });
    if (error) throw error;
    return data ?? [];
  }

  async resolver(id: number, estado: ResolucionCliente): Promise<{ correoEnviado: boolean }> {
    if (estado !== 'APROBADO' && estado !== 'RECHAZADO') {
      throw new Error('Estado de resolución inválido.');
    }
    // La ruta ya está protegida por roleGuard para dueño y supervisor.
    const { data, error } = await this.supabase.getClient()
      .from('clientes')
      .update({ estado })
      .eq('id', id)
      .eq('estado', 'PENDIENTE')
      .select('id, estado, nombre, apellido, correo')
      .maybeSingle();
    if (error) throw error;
    const resultado = data as {
      id: number; estado: string; nombre: string | null; apellido: string | null; correo: string | null;
    } | null;
    if (!resultado || resultado.id !== id || resultado.estado !== estado) {
      throw new Error('No se confirmó la actualización del cliente.');
    }

    // El correo solo se envía después de confirmar el cambio de estado.
    // Si falla, la resolución sigue guardada y la pantalla informa el problema.
    const correo = resultado.correo?.trim();
    if (!correo) return { correoEnviado: false };
    const datosEmail = {
      nombre: [resultado.nombre, resultado.apellido].filter(Boolean).join(' ').trim() || 'cliente',
      correo
    };
    try {
      const correoEnviado = estado === 'APROBADO'
        ? await this.emailService.enviarCorreoAprobado(datosEmail)
        : await this.emailService.enviarCorreoRechazado(datosEmail);
      return { correoEnviado };
    } catch (error) {
      console.error('No se pudo enviar la notificación al cliente:', error);
      return { correoEnviado: false };
    }
  }
}
