import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HomePage } from './home.page';

const push = vi.hoisted(() => ({ subscribeTo: vi.fn() }));
vi.mock('@capacitor-community/fcm', () => ({ FCM: push }));

describe('Home: conservar la visita al volver de la carta', () => {
  const usuario = { id: 'cliente-1', email: 'cliente@example.com', user_metadata: {} };
  const visita = { mesaId: 4, fechaAsignacion: '2026-10-16T10:00:00Z', vinculada: true };
  const pedido = { id: 'pedido-1', estado: 'recibido', total: 35000, tiempo_estimado: 90 };
  const obtenerUsuarioActual = vi.fn();
  const obtenerPerfil = vi.fn();
  const native = vi.fn();
  const getUser = vi.fn();
  const obtenerAsignacionActiva = vi.fn();
  const maybeSingle = vi.fn();
  const consulta = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(), maybeSingle,
  };
  let home: HomePage;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    native.mockReturnValue(false);
    getUser.mockResolvedValue({ data: { user: usuario }, error: null });
    push.subscribeTo.mockResolvedValue({});
    obtenerUsuarioActual.mockResolvedValue(usuario);
    obtenerPerfil.mockResolvedValue({ id: usuario.id, nombres: 'Cliente', rol: 'CLIENTE_REGISTRADO', estado: 'APROBADO' });
    obtenerAsignacionActiva.mockResolvedValue(visita);
    maybeSingle.mockResolvedValue({ data: pedido, error: null });
    home = new HomePage(...[
      { markForCheck: vi.fn(), detectChanges: vi.fn() },
      { obtenerUsuarioActual, obtenerPerfil }, {}, {}, { is: native }, {}, {},
      { getClient: () => ({ from: () => consulta, auth: { getUser } }) },
      { actualizar: vi.fn() }, { obtenerAsignacionActiva }, {},
    ] as unknown as ConstructorParameters<typeof HomePage>);
  });

  it('suscribe directamente al cliente aunque actualizar push no haga nada', async () => {
    native.mockReturnValue(true);
    await home.ionViewWillEnter();
    expect(push.subscribeTo).toHaveBeenCalledWith({ topic: 'cliente_cliente-1' });
    expect(JSON.parse(localStorage.getItem('cepa.chat.push.topics')!)).toContain('cliente_cliente-1');
  });

  it('no suscribe desde el navegador', async () => {
    await home.ionViewWillEnter();
    expect(push.subscribeTo).not.toHaveBeenCalled();
  });

  it('un fallo de FCM no impide cargar la mesa del cliente', async () => {
    native.mockReturnValue(true);
    push.subscribeTo.mockRejectedValueOnce(new Error('Sin conexión a Firebase'));
    await home.ionViewWillEnter();
    expect(home.clienteConMesaAsignada).toBe(true);
    expect(home.errorPerfil).toBe('');
  });

  it('volver al Home conserva el pedido recibido, cuenta, encuesta y chat', async () => {
    await home.ionViewWillEnter();
    await home.ionViewWillEnter();
    expect(home.clienteRecibioPedido).toBe(true);
    expect(home.clienteVinculadoAMesa).toBe(true);
    expect(home.puedeUsarChat).toBe(true);
    expect(home.puedeEditarPedidoCliente).toBe(false);
    expect(home.pedidoIdCliente).toBe('pedido-1');
    expect(obtenerAsignacionActiva).toHaveBeenCalledTimes(2);
    expect(consulta.gte).toHaveBeenCalledWith('created_at', visita.fechaAsignacion);
  });

  it('no borra la visita mientras la consulta del pedido está pendiente', async () => {
    await home.ionViewWillEnter();
    let resolver!: (resultado: unknown) => void;
    maybeSingle.mockReturnValueOnce(new Promise(resolve => { resolver = resolve; }));
    const recarga = home.ionViewWillEnter();
    await vi.waitFor(() => expect(maybeSingle).toHaveBeenCalledTimes(2));
    expect(home.clienteConMesaAsignada).toBe(true);
    expect(home.clienteVinculadoAMesa).toBe(true);
    expect(home.clienteRecibioPedido).toBe(true);
    expect(home.totalPedidoCliente).toBe(35000);
    resolver({ data: pedido, error: null });
    await recarga;
  });

  it.each(['mesa', 'pedido', 'perfil'])('conserva el último estado si falla la consulta de %s', async origen => {
    await home.ionViewWillEnter();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    if (origen === 'mesa') obtenerAsignacionActiva.mockRejectedValueOnce(new Error('Sin conexión'));
    if (origen === 'pedido') maybeSingle.mockResolvedValueOnce({ data: null, error: new Error('Sin conexión') });
    if (origen === 'perfil') obtenerPerfil.mockRejectedValueOnce(new Error('Sin conexión'));
    await home.ionViewWillEnter();
    expect(home.clienteVinculadoAMesa).toBe(true);
    expect(home.clienteRecibioPedido).toBe(true);
    expect(home.pedidoIdCliente).toBe('pedido-1');
    expect(home.errorMesa || home.errorPerfil).toBeTruthy();
    vi.restoreAllMocks();
  });

  it('el reintento de visita recupera juntos mesa y pedido', async () => {
    await home.ionViewWillEnter();
    home.errorMesa = 'Error anterior';
    maybeSingle.mockResolvedValueOnce({ data: { ...pedido, estado: 'rechazado_mozo' }, error: null });
    await home.cargarEstadoMesa();
    expect(home.errorMesa).toBe('');
    expect(home.clienteRecibioPedido).toBe(false);
    expect(home.puedeEditarPedidoCliente).toBe(true);
  });

  it('limpia la visita cuando la base confirma que ya no hay asignación activa', async () => {
    await home.ionViewWillEnter();
    obtenerAsignacionActiva.mockResolvedValueOnce(null);
    await home.ionViewWillEnter();
    expect(home.estadoAsignacionConocido).toBe(true);
    expect(home.clienteConMesaAsignada).toBe(false);
    expect(home.clienteRecibioPedido).toBe(false);
    expect(home.pedidoIdCliente).toBeNull();
    expect(home.puedeUsarChat).toBe(false);
  });

  it('ignora una respuesta vieja si otra recarga ya confirmó el cierre', async () => {
    await home.ionViewWillEnter();
    let resolver!: (valor: unknown) => void;
    obtenerAsignacionActiva.mockReturnValueOnce(new Promise(resolve => { resolver = resolve; }));
    const anterior = home.cargarEstadoMesa();
    obtenerAsignacionActiva.mockResolvedValueOnce(null);
    await home.cargarEstadoMesa();
    resolver(visita);
    await anterior;
    expect(home.clienteConMesaAsignada).toBe(false);
    expect(home.clienteRecibioPedido).toBe(false);
  });

  it('no muestra la visita anterior al cambiar de usuario aunque falle la carga', async () => {
    await home.ionViewWillEnter();
    obtenerUsuarioActual.mockResolvedValueOnce({ ...usuario, id: 'cliente-2' });
    obtenerPerfil.mockRejectedValueOnce(new Error('Sin conexión'));
    const consola = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await home.ionViewWillEnter();
    expect(home.pedidoIdCliente).toBeNull();
    expect(home.clienteRecibioPedido).toBe(false);
    expect(home.clienteVinculadoAMesa).toBe(false);
    consola.mockRestore();
  });
});
