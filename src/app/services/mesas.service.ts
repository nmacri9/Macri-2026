import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Mesa } from '../interfaces/mesa';

@Injectable({
    providedIn: 'root'
})
export class MesasService {
    private supabase;

    constructor(private supabaseService: SupabaseService) {
        this.supabase = this.supabaseService.getClient();
    }

    // 1. Obtener mesas que NO tienen una asignación activa actualmente
    async obtenerMesasDisponibles(): Promise<Mesa[]> {
        const { data: ocupadas, error: errOcupadas } = await this.supabase
            .from('asignaciones_mesa')
            .select('mesa_id')
            .eq('activa', true);

        if (errOcupadas) throw errOcupadas;

        const idsOcupados = ocupadas ? ocupadas.map(a => a.mesa_id) : [];

        const { data: todasLasMesas, error: errMesas } = await this.supabase
            .from('mesas')
            .select('*')
            .order('numero', { ascending: true });

        if (errMesas) throw errMesas;

        return (todasLasMesas as Mesa[]).filter(m => !idsOcupados.includes(m.id!));
    }

    // 2. El Metre asigna la mesa a un cliente de la lista de espera
    async asignarMesaACliente(clienteId: string, mesaId: number, metreId: string) {
        // A) Verificar disponibilidad
        const { data: asignacionExistente } = await this.supabase
            .from('asignaciones_mesa')
            .select('id')
            .eq('mesa_id', mesaId)
            .eq('activa', true)
            .maybeSingle();

        if (asignacionExistente) {
            throw new Error('Esta mesa acaba de ser asignada a otro cliente.');
        }

        // B) Crear asignación activa
        const { error: errAsignacion } = await this.supabase
            .from('asignaciones_mesa')
            .insert({
                cliente_id: clienteId,
                mesa_id: mesaId,
                asignado_por: metreId,
                activa: true,
                estado_escaneo: 'PENDIENTE_ESCANEO'
            });

        if (errAsignacion) throw errAsignacion;

        // C) Actualizar disponibilidad en 'mesas'
        const { error: errMesa } = await this.supabase
            .from('mesas')
            .update({ disponibilidad: 'RESERVADA' })
            .eq('id', mesaId);

        if (errMesa) throw errMesa;

        // D) Actualizar estado en 'lista_espera' a 'ASIGNADO'
        const { error: errLista } = await this.supabase
            .from('lista_espera')
            .update({ estado: 'ASIGNADO' })
            .eq('cliente_id', clienteId)
            .eq('estado', 'ESPERANDO');

        if (errLista) throw errLista;
    }

    // 3. Validación y escaneo del QR físico por parte del Cliente
    async validarYVincularMesaQR(clienteId: string, qrTokenLeido: string) {
        const { data: asignacion, error } = await this.supabase
            .from('asignaciones_mesa')
            .select('*, mesas(*)')
            .eq('cliente_id', clienteId)
            .eq('activa', true)
            .maybeSingle();

        if (error) throw error;

        if (!asignacion) {
            throw new Error('Aún no tenés ninguna mesa asignada por el Metre.');
        }

        const mesaAsignada = asignacion.mesas as Mesa;

        const coincideToken = mesaAsignada.qr_token === qrTokenLeido;
        const coincideNumero = `MESA_${mesaAsignada.numero}` === qrTokenLeido;

        if (!coincideToken && !coincideNumero) {
            throw new Error(`Mesa equivocada. Debes vincularte a tu mesa asignada: Mesa N° ${mesaAsignada.numero}.`);
        }

        // C) Actualizar 'asignaciones_mesa'
        const { error: errUpdateAsignacion } = await this.supabase
            .from('asignaciones_mesa')
            .update({ estado_escaneo: 'OCUPADA' })
            .eq('id', asignacion.id);

        if (errUpdateAsignacion) throw errUpdateAsignacion;

        // D) Actualizar 'mesas'
        const { error: errUpdateMesa } = await this.supabase
            .from('mesas')
            .update({ disponibilidad: 'OCUPADA' })
            .eq('id', mesaAsignada.id);

        if (errUpdateMesa) throw errUpdateMesa;

        return asignacion;
    }
}