import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { createClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { FotosPerfilService } from './fotos-perfil.service';

export type RolUsuario = 
    | 'DUENO' 
    | 'SUPERVISOR' 
    | 'COCINERO' 
    | 'CANTINERO' 
    | 'MOZO' 
    | 'METRE' 
    | 'CLIENTE_REGISTRADO';

export class CuentaClienteNoHabilitadaError extends Error {}

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private supabase;
    private usuarioActual: any = null;

    constructor(
      private supabaseService: SupabaseService,
      private fotosPerfilService: FotosPerfilService
    ) {
    this.supabase = this.supabaseService.getClient();
    }

  // Registro de cliente registrado
    async registrarCliente(
    email: string,
    password: string,
    nombres: string,
    apellidos: string,
    dni?: string,
    cuil?: string,
    fotoUrl?: string
    ) {
    // El alta pública no debe iniciar sesión ni reemplazar la sesión existente.
    const registrationClient = createClient(environment.supabaseUrl, environment.supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
    const { data, error } = await registrationClient.auth.signUp({
        email,
        password,
        options: {
        data: {
            nombres,
            apellidos,
            dni,
            cuil,
            rol: 'CLIENTE_REGISTRADO',
            estado: 'PENDIENTE'
        }
        }
    });

    if (error) throw error;
    if (!data.user) throw new Error('No se pudo completar el registro.');

    if (!fotoUrl) throw new Error('La foto de perfil es obligatoria.');
    const fotoSubida = await this.fotosPerfilService.subir(registrationClient, data.user.id, fotoUrl);

    const { error: clienteError } = await registrationClient
      .from('clientes')
      .insert({
        cliente_id: data.user.id,
        nombre: nombres.trim(),
        apellido: apellidos.trim(),
        dni: dni ? Number(dni) : null,
        correo: email.trim(),
        foto_url: fotoSubida.url,
        estado: 'PENDIENTE'
      });

    if (clienteError) {
      await this.fotosPerfilService.eliminar(registrationClient, fotoSubida.ruta).catch(() => undefined);
      throw clienteError;
    }
    return data;
    }

    async login(email: string, password: string) {
    const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) throw error;
    try {
      const perfil = await this.buscarPerfil(data.user.id);
      if (!perfil) throw new Error('No se pudo verificar el perfil.');
      if (perfil.rol === 'CLIENTE_REGISTRADO' && perfil.estado !== 'APROBADO') {
        throw new CuentaClienteNoHabilitadaError(perfil.estado === 'PENDIENTE'
          ? 'Tu cuenta está pendiente de aprobación.'
          : perfil.estado === 'RECHAZADO'
            ? 'Tu solicitud de registro fue rechazada.'
            : 'Tu cuenta no está habilitada.');
      }
    } catch (error) {
      this.usuarioActual = null;
      await this.supabase.auth.signOut({ scope: 'local' });
      throw error;
    }
    this.usuarioActual = data.user;
    return data;
    }

    async logout() {
    const { error } = await this.supabase.auth.signOut();
    if (error) throw error;
    this.usuarioActual = null;
    }

    async obtenerUsuarioActual() {
    if (this.usuarioActual) return this.usuarioActual;

    const { data, error } = await this.supabase.auth.getUser();
    if (error) return null;
    this.usuarioActual = data.user;
    return data.user;
    }

    async obtenerPerfil() {
      const usuario = await this.obtenerUsuarioActual();
      return usuario ? this.buscarPerfil(usuario.id) : null;
    }

    private async buscarPerfil(authId: string) {
      const { data: cliente, error: clienteError } = await this.supabase
        .from('clientes')
        .select('cliente_id, nombre, apellido, correo, foto_url, estado')
        .eq('cliente_id', authId)
        .in('estado', ['PENDIENTE', 'APROBADO', 'RECHAZADO', 'SUSPENDIDO'])
        .maybeSingle();
      if (clienteError) throw clienteError;
      if (cliente) {
        // Normaliza los nombres para las pantallas, sin crear filas en usuarios.
        return {
          id: cliente.cliente_id,
          nombres: cliente.nombre,
          apellidos: cliente.apellido,
          email: cliente.correo,
          foto_url: cliente.foto_url,
          rol: 'CLIENTE_REGISTRADO',
          estado: cliente.estado,
          origen: 'clientes' as const
        };
      }

      const { data: empleado, error } = await this.supabase
        .from('usuarios')
        .select('id, nombres, apellidos, email, foto_url, rol, estado')
        .eq('id', authId)
        .maybeSingle();
      if (error) throw error;
      if (!empleado || !['DUENO', 'SUPERVISOR', 'COCINERO', 'CANTINERO', 'MOZO', 'METRE'].includes(empleado.rol)) {
        return null;
      }
      return { ...empleado, origen: 'usuarios' as const };
    }
}
