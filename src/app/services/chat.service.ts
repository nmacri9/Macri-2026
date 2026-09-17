import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { ChatMensaje, ChatParticipante } from '../interfaces/chat-mensaje';

export type EstadoChat = 'conectando' | 'conectado' | 'desconectado';
export const CHAT_CANAL = 'chat-mozo-cliente';
export const CHAT_PAGINA = 50;

@Injectable({ providedIn: 'root' })
export class ChatService {
  constructor(private supabaseService: SupabaseService) {}

  async participante(): Promise<ChatParticipante> {
    const { data, error } = await this.supabaseService.getClient().rpc('chat_participante');
    if (error) throw error;
    return data as ChatParticipante;
  }

  async historial(antes?: ChatMensaje): Promise<ChatMensaje[]> {
    let query = this.supabaseService.getClient().from('chat_mensajes')
      .select('*').order('creado_en', { ascending: false })
      .order('id', { ascending: false }).limit(CHAT_PAGINA);
    if (antes) {
      // Desempate por UUID: no se pierden mensajes con la misma fecha.
      query = query.or(`creado_en.lt.${antes.creado_en},and(creado_en.eq.${antes.creado_en},id.lt.${antes.id})`);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as ChatMensaje[];
  }

  async enviar(id: string, texto: string, respuestaA: string | null, numeroMesa: number | null): Promise<ChatMensaje> {
    const limpio = texto.trim();
    if (!limpio || [...limpio].length > 2000) {
      throw new Error('Escribí un mensaje de entre 1 y 2000 caracteres.');
    }
    if (numeroMesa !== null && (!Number.isInteger(numeroMesa) || numeroMesa < 1 || numeroMesa > 9999)) {
      throw new Error('Ingresá un número de mesa entre 1 y 9999.');
    }
    // La identidad y la hora se resuelven en la base. La mesa se declara manualmente
    // hasta que el proyecto tenga terminado el flujo de asignaciones.
    const { data, error } = await this.supabaseService.getClient().rpc('chat_enviar', {
      p_id: id, p_texto: limpio, p_respuesta_a: respuestaA, p_numero_mesa: numeroMesa
    });
    if (error) throw error;
    return data as ChatMensaje;
  }

  async posteriores(desde: ChatMensaje): Promise<ChatMensaje[]> {
    const { data, error } = await this.supabaseService.getClient().from('chat_mensajes')
      .select('*').order('creado_en', { ascending: true }).order('id', { ascending: true })
      .or(`creado_en.gt.${desde.creado_en},and(creado_en.eq.${desde.creado_en},id.gt.${desde.id})`)
      .limit(CHAT_PAGINA);
    if (error) throw error;
    return (data ?? []) as ChatMensaje[];
  }

  conectar(recibir: (mensaje: ChatMensaje) => void, estado: (estado: EstadoChat) => void): () => void {
    const supabase = this.supabaseService.getClient();
    let activo = true;
    estado('conectando');
    const canal = supabase.channel(CHAT_CANAL)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_mensajes' }, payload => {
        if (activo) recibir(payload.new as ChatMensaje);
      })
      .subscribe(status => {
        if (!activo) return;
        estado(status === 'SUBSCRIBED' ? 'conectado' : 'desconectado');
      });
    return () => {
      activo = false;
      void supabase.removeChannel(canal);
    };
  }
}
