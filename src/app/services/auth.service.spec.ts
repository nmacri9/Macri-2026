import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { AuthService, CuentaClienteNoHabilitadaError } from './auth.service';
import { SupabaseService } from './supabase.service';
import { FotosPerfilService } from './fotos-perfil.service';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));

describe('Alta pública de cliente', () => {
  const signUp = vi.fn();
  const insert = vi.fn();
  const registrationFrom = vi.fn(() => ({ insert }));
  const activeSignUp = vi.fn();
  const subirFoto = vi.fn();
  const eliminarFoto = vi.fn();
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    insert.mockResolvedValue({ error: null });
    subirFoto.mockResolvedValue({ url: 'https://storage.test/perfiles/cliente-nuevo/foto.jpg', ruta: 'cliente-nuevo/foto.jpg' });
    eliminarFoto.mockResolvedValue(undefined);
    vi.mocked(createClient).mockReturnValue({ auth: { signUp }, from: registrationFrom } as unknown as ReturnType<typeof createClient>);
    service = new AuthService({
      getClient: () => ({ auth: { signUp: activeSignUp } })
    } as unknown as SupabaseService, { subir: subirFoto, eliminar: eliminarFoto } as unknown as FotosPerfilService);
  });

  it('registra un cliente pendiente con foto sin modificar la sesión activa', async () => {
    const data = { user: { id: 'cliente-nuevo' }, session: null };
    signUp.mockResolvedValue({ data, error: null });

    await expect(service.registrarCliente('cliente@example.com', 'clave-prueba', 'Ana', 'Pérez', '12345678', undefined, 'data:image/jpeg;base64,foto')).resolves.toEqual(data);

    expect(createClient).toHaveBeenCalledWith(expect.any(String), expect.any(String), {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
    expect(signUp).toHaveBeenCalledWith({
      email: 'cliente@example.com', password: 'clave-prueba',
      options: { data: {
        nombres: 'Ana', apellidos: 'Pérez', dni: '12345678', cuil: undefined,
        rol: 'CLIENTE_REGISTRADO', estado: 'PENDIENTE'
      } }
    });
    expect(registrationFrom).toHaveBeenCalledWith('clientes');
    expect(subirFoto).toHaveBeenCalledWith(expect.anything(), 'cliente-nuevo', 'data:image/jpeg;base64,foto');
    expect(insert).toHaveBeenCalledWith({
      cliente_id: 'cliente-nuevo', nombre: 'Ana', apellido: 'Pérez',
      dni: 12345678, correo: 'cliente@example.com',
      foto_url: 'https://storage.test/perfiles/cliente-nuevo/foto.jpg', estado: 'PENDIENTE'
    });
    expect(activeSignUp).not.toHaveBeenCalled();
  });

  it('propaga el error de registro para mostrarlo en el formulario', async () => {
    const error = new Error('Registro rechazado');
    signUp.mockResolvedValue({ data: null, error });
    await expect(service.registrarCliente('cliente@example.com', 'clave-prueba', 'Ana', 'Pérez')).rejects.toThrow('Registro rechazado');
  });

  it('elimina la foto del Storage si falla el insert del cliente', async () => {
    signUp.mockResolvedValue({ data: { user: { id: 'cliente-nuevo' }, session: null }, error: null });
    insert.mockResolvedValue({ error: new Error('No se pudo insertar') });

    await expect(service.registrarCliente(
      'cliente@example.com', 'clave-prueba', 'Ana', 'Pérez',
      '12345678', undefined, 'data:image/jpeg;base64,foto'
    )).rejects.toThrow('No se pudo insertar');

    expect(eliminarFoto).toHaveBeenCalledWith(expect.anything(), 'cliente-nuevo/foto.jpg');
  });
});

describe('Login con clientes separados del personal', () => {
  const clientesResult = vi.fn();
  const usuariosResult = vi.fn();
  const signOut = vi.fn().mockResolvedValue({ error: null });
  const signInWithPassword = vi.fn().mockResolvedValue({ data: { user: { id: 'auth-id' } }, error: null });
  const from = vi.fn((table: string) => table === 'clientes'
    ? { select: () => ({ eq: () => ({ in: () => ({ maybeSingle: clientesResult }) }) }) }
    : { select: () => ({ eq: () => ({ maybeSingle: usuariosResult }) }) });
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    clientesResult.mockResolvedValue({ data: null, error: null });
    usuariosResult.mockResolvedValue({ data: null, error: null });
    service = new AuthService({ getClient: () => ({
      auth: { signInWithPassword, signOut }, from
    }) } as unknown as SupabaseService, {} as FotosPerfilService);
  });

  it.each(['PENDIENTE', 'RECHAZADO'])('no deja ingresar al cliente %s sin consultar usuarios', async estado => {
    clientesResult.mockResolvedValue({ data: { cliente_id: 'auth-id', estado }, error: null });
    await expect(service.login('cliente@example.com', 'clave')).rejects.toBeInstanceOf(CuentaClienteNoHabilitadaError);
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(from).not.toHaveBeenCalledWith('usuarios');
  });

  it('permite al cliente APROBADO aunque no tenga fila en usuarios', async () => {
    clientesResult.mockResolvedValue({ data: {
      cliente_id: 'auth-id', nombre: 'Ana', apellido: 'Pérez', correo: 'ana@example.com', foto_url: 'foto.jpg', estado: 'APROBADO'
    }, error: null });
    await expect(service.login('ana@example.com', 'clave')).resolves.toEqual({ user: { id: 'auth-id' } });
    expect(signOut).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalledWith('usuarios');
    await expect(service.obtenerPerfil()).resolves.toEqual({
      id: 'auth-id', nombres: 'Ana', apellidos: 'Pérez', email: 'ana@example.com',
      foto_url: 'foto.jpg', rol: 'CLIENTE_REGISTRADO', estado: 'APROBADO', origen: 'clientes'
    });
  });

  it('consulta usuarios para el empleado que no está en clientes', async () => {
    usuariosResult.mockResolvedValue({ data: { id: 'auth-id', rol: 'SUPERVISOR', estado: 'ACTIVO' }, error: null });
    await expect(service.login('supervisor@example.com', 'clave')).resolves.toEqual({ user: { id: 'auth-id' } });
    expect(from).toHaveBeenCalledWith('usuarios');
    expect(signOut).not.toHaveBeenCalled();
  });

  it('no usa un perfil antiguo de usuarios para saltar el rechazo en clientes', async () => {
    clientesResult.mockResolvedValue({ data: { cliente_id: 'auth-id', estado: 'RECHAZADO' }, error: null });
    usuariosResult.mockResolvedValue({ data: { rol: 'CLIENTE_REGISTRADO', estado: 'ACTIVO' }, error: null });
    await expect(service.login('cliente@example.com', 'clave')).rejects.toBeInstanceOf(CuentaClienteNoHabilitadaError);
    expect(from).not.toHaveBeenCalledWith('usuarios');
  });

  it('no permite ingresar si falla la consulta a clientes', async () => {
    clientesResult.mockResolvedValue({ data: null, error: new Error('Conexión fallida') });
    await expect(service.login('cliente@example.com', 'clave')).rejects.toThrow('Conexión fallida');
    expect(signOut).toHaveBeenCalled();
    expect(from).not.toHaveBeenCalledWith('usuarios');
  });
});
