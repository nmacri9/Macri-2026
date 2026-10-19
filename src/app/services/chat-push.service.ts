import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { FCM } from '@capacitor-community/fcm';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';

const STORAGE_KEY = 'cepa.chat.push.topics';
const TOPICS_PERSONAL: Record<string, string[]> = {
  MOZO: ['mozos'], METRE: ['metre_lista_espera'], COCINERO: ['cocina'], CANTINERO: ['bar'],
  DUENO: ['aprobacion_pendientes', 'duenos'], SUPERVISOR: ['aprobacion_pendientes', 'supervisores'],
};

@Injectable({ providedIn: 'root' })
export class ChatPushService {
  private registrado = false;
  private limpiarLegacy = true;
  private cola: Promise<void> = Promise.resolve();

  constructor(private supabase: SupabaseService, private auth: AuthService) {}

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
      console.error('[Push] Fallo sincronizando suscripciones; se reintentará al actualizar el perfil:', error);
    });
    return this.cola;
  }

  private async sincronizar() {
    const client = this.supabase.getClient();
    const { data: { session }, error } = await client.auth.getSession();
    if (error) throw error;
    let deseados: string[] = [];
    if (session) {
      const persona = await this.auth.obtenerPerfil();
      if (!persona || persona.id !== session.user.id) throw new Error('Perfil pendiente de cargar');
      const rol = persona.rol.trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const habilitado = rol === 'CLIENTE_REGISTRADO' ? persona.estado === 'APROBADO'
        : (rol in TOPICS_PERSONAL || rol === 'CLIENTE_ANONIMO') && persona.estado === 'ACTIVO';
      if (habilitado) deseados = TOPICS_PERSONAL[rol] ?? [`cliente_${persona.id}`, `chat_cliente_${persona.id}`];
    }
    const anteriores: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    // Recuperar también las suscripciones de personal creadas por las pantallas antiguas.
    const conocidos = new Set([...anteriores, ...(this.limpiarLegacy ? Object.values(TOPICS_PERSONAL).flat() : [])]);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...conocidos]));
    for (const topic of conocidos) {
      if (deseados.includes(topic)) continue;
      await FCM.unsubscribeFrom({ topic });
      conocidos.delete(topic);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...conocidos]));
      console.info('[Push] Suscripción eliminada:', topic);
    }
    this.limpiarLegacy = false;
    for (const topic of deseados) {
      // Reafirmar la suscripción después de reinicios o renovación del token.
      await FCM.subscribeTo({ topic });
      conocidos.add(topic);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...conocidos]));
      console.info('[Push] Suscripción confirmada:', topic);
    }
    console.info('[Push] Sincronización completa:', deseados);
  }
}
