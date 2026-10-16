import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface Cuenta {
  id: string;
  mesa_id: string;
  estado: 'solicitada' | 'lista' | 'pagada' | 'confirmada';
  items: { nombre: string; cantidad: number; precio: number }[];
  subtotal: number;
  descuento_porcentaje: number;
  descuento: number;
  propina_porcentaje: number | null;
  propina: number;
  total: number;
  pagada_en: string | null;
  confirmada_en: string | null;
}

export const SATISFACCION: Record<number, string> = {
  20: 'Excelente', 15: 'Muy Bueno', 10: 'Bueno', 5: 'Regular', 0: 'Malo',
};

@Injectable({ providedIn: 'root' })
export class CuentaService {
  constructor(private supabase: SupabaseService) {}

  escuchar(cuentaId: string, actualizar: (cuenta: Cuenta) => void): () => void {
    const db = this.supabase.getClient();
    const canal = db.channel(`cuenta-${cuentaId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'cuentas', filter: `id=eq.${cuentaId}` },
        evento => actualizar(evento.new as Cuenta)).subscribe();
    return () => { void db.removeChannel(canal); };
  }

  async listarPendientes(): Promise<Cuenta[]> {
    const { data, error } = await this.supabase.getClient().from('cuentas').select('*')
      .in('estado', ['solicitada', 'lista', 'pagada']).order('creada_en');
    if (error) throw new Error(error.message);
    return data as Cuenta[];
  }

  async confirmarPago(cuentaId: string) {
    const { error } = await this.supabase.getClient().rpc('confirmar_pago_cuenta', { p_cuenta_id: cuentaId });
    if (error) throw new Error(error.message);
  }

  async ejecutar(accion: 'consultar' | 'solicitar' | 'propina' | 'pagar', qr?: string): Promise<Cuenta | null> {
    const { data, error } = await this.supabase.getClient().rpc('gestionar_cuenta', {
      p_accion: accion, p_qr: qr ?? null,
    });
    if (error) throw new Error(error.message);
    return data as Cuenta | null;
  }

  async notificar(cuentaId: string): Promise<boolean> {
    const resultado = await this.supabase.invocarEdgeFunction<{ pendientes: number }>(
      'enviar-notificacion', { cuenta_id: cuentaId },
    );
    return resultado.pendientes === 0;
  }
}
