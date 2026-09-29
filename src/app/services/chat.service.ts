import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { ChatMensaje, ChatParticipante, MensajeDB, mensajeDesdeDB } from '../interfaces/chat-mensaje';
import { MesasService } from './mesas.service';
import { AuthService } from './auth.service';

export type EstadoChat = 'conectando' | 'conectado' | 'desconectado';
export const CHAT_CANAL = 'chat-mozo-cliente';
export const CHAT_TABLA = 'mensajes';
export const CHAT_PAGINA = 50;
export class MesaChatNoAsignadaError extends Error {}

@Injectable({ providedIn: 'root' })
export class ChatService {
  constructor(private supabaseService: SupabaseService, private mesas: MesasService,
    private auth: AuthService) {}

  async participante(): Promise<ChatParticipante> {
    const perfil = await this.auth.obtenerPerfil();
    if (!perfil) throw new Error('Iniciá sesión para entrar al chat.');
    const rol = String(perfil.rol).trim().toUpperCase();
    const habilitado = rol === 'CLIENTE_REGISTRADO' ? perfil.estado === 'APROBADO'
      : ['MOZO', 'CLIENTE_ANONIMO'].includes(rol) && perfil.estado === 'ACTIVO';
    if (!habilitado) throw Object.assign(new Error('Tu usuario no está habilitado para entrar al chat.'), { code: '42501' });
    const persona: ChatParticipante = {
      id: perfil.id,
      nombre: [perfil.nombres, perfil.apellidos].filter(Boolean).join(' '),
      rol: rol as ChatParticipante['rol'],
      numero_mesa: null
    };
    if (persona.rol === 'MOZO') return persona;
    const asignacion = await this.mesas.obtenerAsignacionActiva(persona.id);
    if (!asignacion?.mesaId) {
      throw new MesaChatNoAsignadaError('Necesitás una mesa asignada para consultar al mozo.');
    }
    return { ...persona, numero_mesa: asignacion.mesaId };
  }

  async historial(antes?: ChatMensaje): Promise<ChatMensaje[]> {
    let query = this.supabaseService.getClient().from(CHAT_TABLA)
      .select('*').not('texto', 'is', null).order('created_at', { ascending: false })
      .order('id', { ascending: false }).limit(CHAT_PAGINA);
    if (antes) {
      query = query.or(`created_at.lt.${antes.creado_en},and(created_at.eq.${antes.creado_en},id.lt.${antes.id})`);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(fila => mensajeDesdeDB(fila as MensajeDB));
  }

  async enviar(id: string, texto: string, respuestaA: string | null, numeroMesa: number | null): Promise<ChatMensaje> {
    const limpio = texto.trim();
    if (!limpio || [...limpio].length > 2000) {
      throw new Error('Escribí un mensaje de entre 1 y 2000 caracteres.');
    }
    // Revalidar la asignación en cada envío, por si la mesa fue liberada o cambiada.
    const persona = await this.participante();
    // El trigger fija autor, rol, mesa y hora desde la sesión de Supabase.
    const tabla = this.supabaseService.getClient().from(CHAT_TABLA);
    const { data, error } = await tabla.insert({
      solicitud_id: id, texto: limpio, respuesta_a: respuestaA
    }).select('*').single();
    if (error?.code === '23505') {
      // Un reintento después de perder la respuesta recupera el envío original.
      const { data: existente, error: errorLectura } = await this.supabaseService.getClient()
        .from(CHAT_TABLA).select('*').eq('solicitud_id', id).eq('autor_id', persona.id).single();
      if (errorLectura) throw errorLectura;
      return mensajeDesdeDB(existente as MensajeDB);
    }
    if (error) throw error;
    return mensajeDesdeDB(data as MensajeDB);
  }

  async posteriores(desde: ChatMensaje): Promise<ChatMensaje[]> {
    const { data, error } = await this.supabaseService.getClient().from(CHAT_TABLA)
      .select('*').not('texto', 'is', null).order('created_at', { ascending: true }).order('id', { ascending: true })
      .or(`created_at.gt.${desde.creado_en},and(created_at.eq.${desde.creado_en},id.gt.${desde.id})`)
      .limit(CHAT_PAGINA);
    if (error) throw error;
    return (data ?? []).map(fila => mensajeDesdeDB(fila as MensajeDB));
  }

  async notificar(mensajeId: string): Promise<void> {
    const { data, error } = await this.supabaseService.getClient().functions.invoke('enviar-notificacion', {
      body: { mensaje_id: mensajeId }
    });
    if (error) throw error;
    if (!data?.success) throw new Error('No se pudo enviar la notificación.');
  }

  conectar(recibir: (mensaje: ChatMensaje) => void, estado: (estado: EstadoChat) => void): () => void {
    const supabase = this.supabaseService.getClient();
    let activo = true;
    estado('conectando');
    const canal = supabase.channel(CHAT_CANAL)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: CHAT_TABLA }, payload => {
        if (activo && payload.new['texto']) recibir(mensajeDesdeDB(payload.new as MensajeDB));
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
