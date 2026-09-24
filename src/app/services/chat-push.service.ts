import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { FCM } from '@capacitor-community/fcm';
import { SupabaseService } from './supabase.service';
import { ChatParticipante } from '../interfaces/chat-mensaje';

const STORAGE_KEY = 'cepa.chat.push.topics';

@Injectable({ providedIn: 'root' })
export class ChatPushService {
  private registrado = false;
  private cola: Promise<void> = Promise.resolve();

  constructor(private supabase: SupabaseService) {}

  activar() {
    if (!Capacitor.isNativePlatform()) return;
    if (this.registrado) { void this.actualizar(); return; }
    this.registrado = true;
    this.supabase.getClient().auth.onAuthStateChange(() => {
      // Las consultas se hacen fuera del callback de Auth para no bloquear su lock.
      setTimeout(() => void this.actualizar(), 0);
    });
    void this.actualizar();
  }

  actualizar(): Promise<void> {
    if (!this.registrado) return Promise.resolve();
    this.cola = this.cola.then(() => this.sincronizar()).catch(error => {
      console.error('No se pudieron actualizar las notificaciones del chat:', error);
    });
    return this.cola;
  }

  private async sincronizar() {
    const client = this.supabase.getClient();
    const anteriores: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    // Primero limpiar la cuenta anterior, incluso si el nuevo perfil no usa chat.
    for (const topic of [...anteriores]) {
      await FCM.unsubscribeFrom({ topic });
      anteriores.splice(anteriores.indexOf(topic), 1);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(anteriores));
    }
    const { data: { session } } = await client.auth.getSession();
    let deseados: string[] = [];
    if (session) {
      const { data, error } = await client.rpc('chat_participante');
      if (error?.code === '42501') return;
      if (error) throw error;
      const persona = data as ChatParticipante;
      deseados = [persona.rol === 'MOZO' ? 'mozos' : `chat_cliente_${persona.id}`];
    }
    for (const topic of deseados) {
      // También al reiniciar: FCM puede haber renovado el token del dispositivo.
      await FCM.subscribeTo({ topic });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(deseados));
    }
  }
}
