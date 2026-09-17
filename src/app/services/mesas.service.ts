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
        // A) Traemos los IDs de las mesas que actualmente están asignadas y activas
        const { data: ocupadas, error: errOcupadas } = await this.supabase
        .from('asignaciones_mesa')
        .select('mesa_id')
        .eq('activa', true);

        if (errOcupadas) throw errOcupadas;

        const idsOcupados = ocupadas ? ocupadas.map(a => a.mesa_id) : [];

        // B) Traemos todas las mesas de la tabla unificada 'mesas'
        const { data: todasLasMesas, error: errMesas } = await this.supabase
        .from('mesas')
        .select('*')
        .order('numero', { ascending: true });

        if (errMesas) throw errMesas;

        // C) Filtramos las mesas disponibles excluyendo las ocupadas
        return (todasLasMesas as Mesa[]).filter(m => !idsOcupados.includes(m.id!));
    }

    // 2. El Metre asigna la mesa a un cliente de la lista de espera
    async asignarMesaACliente(clienteId: string, mesaId: number, metreId: string) {
        // A) Verificar que la mesa no se haya asignado justo a otro cliente en paralelo
        const { data: asignacionExistente } = await this.supabase
        .from('asignaciones_mesa')
        .select('id')
        .eq('mesa_id', mesaId)
        .eq('activa', true)
        .maybeSingle();

        if (asignacionExistente) {
        throw new Error('Esta mesa acaba de ser asignada a otro cliente.');
        }

        // B) Insertar en asignaciones_mesa con estado pendiente de escaneo
        const { error } = await this.supabase
        .from('asignaciones_mesa')
        .insert({
            cliente_id: clienteId,
            mesa_id: mesaId,
            asignado_por: metreId,
            activa: true,
            estado_escaneo: 'PENDIENTE_ESCANEO'
        });

        if (error) throw error;
    }

    // 3. Validación y escaneo del QR físico por parte del Cliente (Punto 10)
    async validarYVincularMesaQR(clienteId: string, qrTokenLeido: string) {
        // A) Buscar la asignación activa que el Metre le otorgó a este cliente
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

        // B) VALIDACIÓN CRUCIAL: Comparar el qr_token leído con el de la mesa asignada o por número
        const coincideToken = mesaAsignada.qr_token === qrTokenLeido;
        const coincideNumero = `MESA_${mesaAsignada.numero}` === qrTokenLeido;

        if (!coincideToken && !coincideNumero) {
        throw new Error(`Mesa equivocada. Debes vincularte a tu mesa asignada: Mesa N° ${mesaAsignada.numero}.`);
        }

        // C) Actualizar estado a OCUPADA tras escanear con éxito
        await this.supabase
        .from('asignaciones_mesa')
        .update({ estado_escaneo: 'OCUPADA' })
        .eq('id', asignacion.id);

        return asignacion;
    }

}