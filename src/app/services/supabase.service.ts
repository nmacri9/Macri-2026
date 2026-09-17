import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment.prod';

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseKey
    );
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }
  /**
   * Wrapper para invocar una Edge Function de Supabase sin tener que
   * repetir getClient().functions.invoke(...) en cada página.
   * Uso: await this.supabase.invocarEdgeFunction('enviar-notificacion', { titulo, cuerpo, topic });
   */
  async invocarEdgeFunction<T = any>(nombre: string, body: Record<string, any>): Promise<T> {
    const { data, error } = await this.supabase.functions.invoke(nombre, { body });
    if (error) {
      throw error;
    }
    return data as T;
  }
}