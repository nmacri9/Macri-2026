import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

@Injectable({
    providedIn: 'root'
})
export class AuthService {

    private supabase;

    constructor(private supabaseService: SupabaseService) {
    this.supabase = this.supabaseService.getClient();
    }

    async registrarCliente(
    email: string,
    password: string,
    nombres: string,
    apellidos: string,
    dni?: string,
    cuil?: string
    ) {

    const { data, error } = await this.supabase.auth.signUp({
        email,
        password,
        options: {
        data: {
            nombres,
            apellidos,
            dni,
            cuil,
            perfil_id: 7
        }
        }
    });

    if (error) {
        throw error;
    }

    return data;
    }

    async login(email: string, password: string) {

    const { data, error } =
        await this.supabase.auth.signInWithPassword({
        email,
        password
        });

    if (error) {
        throw error;
    }

    return data;
    }

    async logout() {

    const { error } = await this.supabase.auth.signOut();

    if (error) {
        throw error;
    }
    }

    async obtenerUsuarioActual() {

    const { data, error } =
        await this.supabase.auth.getUser();

    if (error) {
        return null;
    }

    return data.user;
    }

    async obtenerPerfil() {

    const usuario = await this.obtenerUsuarioActual();

    if (!usuario) {
        return null;
    }

    const { data, error } = await this.supabase
        .from('usuarios')
        .select(`
        *,
        perfiles (
            id,
            nombre,
            descripcion
        )
        `)
        .eq('id', usuario.id)
        .single();

    if (error) {
        throw error;
    }

    return data;
    }
}