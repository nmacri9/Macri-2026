import { Component, ChangeDetectorRef } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { PedidosService } from '../services/pedidos.service';
import {
  IonContent,
  IonIcon,
  IonPopover,
  NavController,
  ToastController,
  Platform,
  ActionSheetController,
  IonRefresher,
  IonRefresherContent,
  IonButton,
  IonFooter,
} from '@ionic/angular';
import { SupabaseService } from '../services/supabase.service';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { FCM } from '@capacitor-community/fcm';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';
import { addIcons } from 'ionicons';
import {
  arrowForwardOutline,
  chatbubblesOutline,
  gridOutline,
  logOutOutline,
  peopleOutline,
  personCircleOutline,
  personAddOutline,
  restaurantOutline,
  wineOutline,
  cartOutline,
  checkmarkCircleOutline,
  qrCodeOutline,
  listOutline,
  pieChartOutline,
  closeOutline,
  searchOutline,
  notificationsOutline,
  eyeOutline,
  eyeOffOutline,
  chevronForwardOutline,
  arrowUpOutline,
  flashOutline,
  homeOutline,
  cashOutline,
  bookOutline,
  statsChartOutline,
  menuOutline,
  gameControllerOutline,
  timeOutline,
} from 'ionicons/icons';
import { AuthService } from '../services/auth.service';
import { ChatPushService } from '../services/chat-push.service';
import { MesasService } from '../services/mesas.service';

export interface ActividadItem {
  icono: string;
  texto: string;
  ruta: string;
}

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [RouterLink, IonContent, IonIcon, IonPopover, IonRefresher, IonRefresherContent, IonButton],
})
export class HomePage {
  nombreUsuario = 'Usuario';
  rolUsuario = '';
  rolEtiqueta = 'Panel';
  fotoUsuario: string | null = null;
  menuPerfilAbierto = false;
  cerrandoSesion = false;
  errorPerfil = '';
  cargandoPerfil = false;
  cargandoMesa = false;
  errorMesa: string | null = null;
  private clienteHabilitado = false;
  private revisionPerfil = 0;
  private revisionMesa = 0;

  usuarioActual: any = null;

  // Controles de visibilidad por Rol
  puedeGestionarClientes = false;
  puedeCargarPlatos = false;
  puedeCargarBebidas = false;
  esMetre = false;
  esMetrePuro = false;
  esCliente = false;
  esClienteRegistrado = false;
  puedeUsarChat = false;
  esMozo = false;
  clienteVinculadoAMesa = false;
  clienteConMesaAsignada = false;
  estadoAsignacionConocido = false;

  // Métricas en tiempo real para el Dashboard estilo Mercado Pago
  mostrarMetricas = true;
  notificacionesBadge = 0;
  totalMesas = 0;
  mesasOcupadas = 0;
  porcentajeOcupacion = 0;
  clientesPendientesCount = 0;
  listaEsperaCount = 0;
  pedidosPorConfirmarCount = 0;
  comandasActivasCount = 0;

  // Estado en vivo para el Cliente
  estadoPedidoCliente = 'Sin pedido activo';
  totalPedidoCliente = 0;
  tiempoEstimadoCliente = 0;
  pedidoConfirmadoCliente = false;

  // Lista dinámica inferior
  actividadesRecientes: ActividadItem[] = [];

  clienteRecibioPedido = false;
  pedidoEntregadoPorMozo = false;
  pedidoIdCliente: string | null = null;
  puedeEditarPedidoCliente = false;

  constructor(
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
    private navController: NavController,
    private toastController: ToastController,
    private platform: Platform,
    private actionSheetCtrl: ActionSheetController,
    private router: Router,
    private supabase: SupabaseService,
    private chatPush: ChatPushService,
    private mesasService: MesasService,
    private pedidosService: PedidosService
  ) {
    addIcons({
      arrowForwardOutline,
      chatbubblesOutline,
      gridOutline,
      logOutOutline,
      peopleOutline,
      personCircleOutline,
      personAddOutline,
      restaurantOutline,
      wineOutline,
      cartOutline,
      checkmarkCircleOutline,
      qrCodeOutline,
      listOutline,
      pieChartOutline,
      closeOutline,
      searchOutline,
      notificationsOutline,
      eyeOutline,
      eyeOffOutline,
      chevronForwardOutline,
      arrowUpOutline,
      flashOutline,
      homeOutline,
      cashOutline,
      bookOutline,
      statsChartOutline,
      menuOutline,
      gameControllerOutline,
      timeOutline
    });
  }

  ionViewWillEnter() {
    return this.cargarPerfil();
  }

  alternarMetricas() {
    this.mostrarMetricas = !this.mostrarMetricas;
  }

  async recargarPantalla(event: any) {
    await this.cargarPerfil();
    event.target.complete();
  }

  async cerrarSesion(menu: IonPopover) {
    if (this.cerrandoSesion) return;
    this.cerrandoSesion = true;
    try {
      try {
        await FCM.deleteInstance();
      } catch (fcmError) {
        console.warn('FCM no disponible para borrar instancia:', fcmError);
      }

      await this.authService.logout();
      await menu.dismiss();
      await this.navController.navigateRoot('/login', { replaceUrl: true });
    } catch (error) {
      console.error('No se pudo cerrar la sesión:', error);
      const toast = await this.toastController.create({
        message: 'No se pudo cerrar la sesión. Intentá nuevamente.',
        duration: 4000,
        position: 'bottom'
      });
      await toast.present();
    } finally {
      this.cerrandoSesion = false;
      this.cdr.markForCheck();
    }
  }

  async cargarPerfil() {
    const revision = ++this.revisionPerfil;
    ++this.revisionMesa;
    this.cargandoPerfil = true;
    this.cargandoMesa = false;
    this.errorPerfil = '';
    this.cdr.markForCheck();

    try {
      const usuario = await this.authService.obtenerUsuarioActual();
      if (revision !== this.revisionPerfil) return;

      if (usuario?.id !== this.usuarioActual?.id || !usuario) {
        this.limpiarEstadoUsuario();
      }

      if (!usuario) throw new Error('No se pudo obtener el usuario actual.');

      this.usuarioActual = usuario;
      this.nombreUsuario = usuario.email || 'Usuario';
      this.fotoUsuario = usuario.user_metadata?.['foto_url'] || null;

      const perfil = await this.authService.obtenerPerfil();
      if (revision !== this.revisionPerfil) return;
      if (!perfil) throw new Error('No se pudo obtener el perfil actual.');

      void this.chatPush.actualizar();

      const nombreCompleto = [perfil.nombres, perfil.apellidos].filter(Boolean).join(' ');
      this.nombreUsuario = nombreCompleto || perfil.email || this.nombreUsuario;
      this.fotoUsuario = perfil.foto_url || this.fotoUsuario;

      const rol = String(perfil.rol ?? '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      this.rolUsuario = rol;

      const etiquetasRol: Record<string, string> = {
        'DUENO': 'Dueño / Manager',
        'SUPERVISOR': 'Supervisor',
        'METRE': 'Metre de Salón',
        'MOZO': 'Mozo',
        'COCINERO': 'Chef / Cocina',
        'CANTINERO': 'Bartender / Barra',
        'CLIENTE_REGISTRADO': 'Cliente',
        'CLIENTE_ANONIMO': 'Invitado'
      };
      this.rolEtiqueta = etiquetasRol[rol] || rol;

      // Fallback de fotos locales para el acceso rápido
      if (!this.fotoUsuario) {
        const fotosPorDefecto: Record<string, string> = {
          'DUENO': 'assets/perfiles/Dueño.png',
          'SUPERVISOR': 'assets/perfiles/Supervisor.png',
          'METRE': 'assets/perfiles/Metre.png',
          'MOZO': 'assets/perfiles/mozo.png',
          'COCINERO': 'assets/perfiles/cocinero.png',
          'CANTINERO': 'assets/perfiles/cantinero.png',
          'CLIENTE_REGISTRADO': 'assets/perfiles/cliente.png',
          'CLIENTE_ANONIMO': 'assets/perfiles/anonimo.png'
        };
        this.fotoUsuario = fotosPorDefecto[rol] || null;
      }

      // =========================================================================
      // 1. ASIGNACIÓN INMEDIATA DE ROLES (ANTES DE CUALQUIER OTRA COSA)
      // =========================================================================
      this.puedeGestionarClientes = perfil.estado === 'ACTIVO' && ['DUENO', 'SUPERVISOR'].includes(rol);
      this.puedeCargarPlatos = perfil.estado === 'ACTIVO' && rol === 'COCINERO';
      this.puedeCargarBebidas = perfil.estado === 'ACTIVO' && rol === 'CANTINERO';
      this.esMetre = ['METRE', 'SUPERVISOR', 'DUENO'].includes(rol);
      this.esMetrePuro = perfil.estado === 'ACTIVO' && rol === 'METRE';
      this.esMozo = rol === 'MOZO' && perfil.estado === 'ACTIVO';
      this.esCliente = ['CLIENTE_REGISTRADO', 'CLIENTE_ANONIMO'].includes(rol);
      this.esClienteRegistrado = rol === 'CLIENTE_REGISTRADO' && perfil.estado === 'APROBADO';
      this.clienteHabilitado = this.esCliente
        && (rol === 'CLIENTE_ANONIMO' ? perfil.estado === 'ACTIVO' : perfil.estado === 'APROBADO');

      if (!this.esCliente) {
        this.puedeUsarChat = this.esMozo;
      }

      // FORZAMOS A ANGULAR A PINTAR LA PANTALLA YA MISMO
      this.cdr.detectChanges();

      // =========================================================================
      // 2. FCM EN SEGUNDO PLANO (NO BLOQUEANTE)
      // =========================================================================
      if (this.platform.is('capacitor')) {
        (async () => {
          try {
            await FCM.unsubscribeFrom({ topic: 'aprobacion_pendientes' });
            await FCM.unsubscribeFrom({ topic: 'metre_lista_espera' });
            await FCM.unsubscribeFrom({ topic: 'cocina' });
            await FCM.unsubscribeFrom({ topic: 'bar' });
            await FCM.unsubscribeFrom({ topic: 'mozos' });

            if (['DUENO', 'SUPERVISOR'].includes(rol)) {
              await FCM.subscribeTo({ topic: 'aprobacion_pendientes' });
            }
            if (['METRE'].includes(rol)) {
              await FCM.subscribeTo({ topic: 'metre_lista_espera' });
            }
            if (['MOZO', 'mozo'].includes(rol)) {
              await FCM.subscribeTo({ topic: 'mozos' });
            }
            if (['COCINERO'].includes(rol)) {
              await FCM.subscribeTo({ topic: 'cocina' });
            }
            if (['CANTINERO'].includes(rol)) {
              await FCM.subscribeTo({ topic: 'bar' });
            }
            if (['CLIENTE_REGISTRADO', 'CLIENTE_ANONIMO'].includes(rol)) {
              const { data: authData } = await this.supabase.getClient().auth.getUser();
              if (authData?.user?.id) {
                await FCM.subscribeTo({ topic: `cliente_${authData.user.id}` });
              }
            }
          } catch (err) {
            console.warn('Error configurando topics de FCM (no bloqueante):', err);
          }
        })();
      }

      // =========================================================================
      // 3. CONSULTAS SECUNDARIAS
      // =========================================================================
      if (this.esCliente) {
        await this.cargarEstadoMesa();
      }

      if (revision !== this.revisionPerfil) return;
      await this.cargarMetricasDashboard(rol);

    } catch (error) {
      if (revision !== this.revisionPerfil) return;
      console.error('No se pudo cargar el perfil del usuario:', error);
      this.errorPerfil = 'No pudimos cargar tu perfil. Volvé a intentar.';
    } finally {
      if (revision === this.revisionPerfil) {
        this.cargandoPerfil = false;
        this.cdr.detectChanges();
      }
    }
  }

  private limpiarEstadoUsuario() {
    this.usuarioActual = null;
    this.nombreUsuario = 'Usuario';
    this.fotoUsuario = null;
    this.clienteHabilitado = false;
    this.puedeGestionarClientes = false;
    this.puedeCargarPlatos = false;
    this.puedeCargarBebidas = false;
    this.esMetre = false;
    this.esMetrePuro = false;
    this.esCliente = false;
    this.esClienteRegistrado = false;
    this.esMozo = false;
    this.puedeUsarChat = false;
    this.clienteConMesaAsignada = false;
    this.clienteVinculadoAMesa = false;
    this.estadoAsignacionConocido = false;
    this.clienteRecibioPedido = false;
    this.pedidoEntregadoPorMozo = false;
    this.pedidoConfirmadoCliente = false;
    this.puedeEditarPedidoCliente = false;
    this.pedidoIdCliente = null;
    this.totalPedidoCliente = 0;
    this.tiempoEstimadoCliente = 0;
    this.estadoPedidoCliente = 'Sin pedido activo';
    this.errorMesa = '';
    this.actividadesRecientes = [];
  }

  // =========================================================================
  // CONEXIÓN REAL A SUPABASE PARA EL DASHBOARD POR ROL
  // =========================================================================
  async cargarMetricasDashboard(rol: string) {
    const db = this.supabase.getClient();

    try {
      // 1. Métricas de Mesas y Asignaciones (Dueño, Supervisor, Metre, Mozo)
      if (!this.esCliente) {
        const [mesasRes, ocupadasRes, esperaRes] = await Promise.allSettled([
          db.from('mesas').select('*', { count: 'exact', head: true }),
          db.from('asignaciones').select('*', { count: 'exact', head: true }).eq('estado', 'asignado').is('fecha_finalizacion', null),
          db.from('asignaciones').select('*', { count: 'exact', head: true }).eq('estado', 'esperando')
        ]);

        if (mesasRes.status === 'fulfilled') this.totalMesas = mesasRes.value.count || 0;
        if (ocupadasRes.status === 'fulfilled') this.mesasOcupadas = ocupadasRes.value.count || 0;
        if (esperaRes.status === 'fulfilled') this.listaEsperaCount = esperaRes.value.count || 0;

        this.porcentajeOcupacion = this.totalMesas > 0
          ? Math.round((this.mesasOcupadas / this.totalMesas) * 100)
          : 0;
      }

      // 2. Datos específicos para DUEÑO / SUPERVISOR
      if (this.puedeGestionarClientes) {
        const { count } = await db
          .from('clientes')
          .select('*', { count: 'exact', head: true })
          .eq('estado', 'PENDIENTE');

        this.clientesPendientesCount = count || 0;
        this.notificacionesBadge = this.clientesPendientesCount;

        const [ultEmp, ultPlato, ultMesa] = await Promise.allSettled([
          db.from('usuarios').select('nombres, apellidos').neq('rol', 'CLIENTE_REGISTRADO').order('created_at', { ascending: false }).limit(1).maybeSingle(),
          db.from('productos').select('nombre').order('created_at', { ascending: false }).limit(1).maybeSingle(),
          db.from('mesas').select('numero').order('created_at', { ascending: false }).limit(1).maybeSingle()
        ]);

        const nombreEmp = ultEmp.status === 'fulfilled' && ultEmp.value.data
          ? `${ultEmp.value.data.nombres || ''} ${ultEmp.value.data.apellidos || ''}`.trim()
          : 'Personal activo';
        const nombrePlato = ultPlato.status === 'fulfilled' && ultPlato.value.data?.nombre
          ? ultPlato.value.data.nombre
          : 'Carta actualizada';
        const numMesa = ultMesa.status === 'fulfilled' && ultMesa.value.data?.numero
          ? `Mesa ${ultMesa.value.data.numero}`
          : 'Salón configurado';

        this.actividadesRecientes = [
          { icono: 'person-add-outline', texto: `Último alta: “${nombreEmp}”`, ruta: '/registro-empleado' },
          { icono: 'restaurant-outline', texto: `Producto en carta: “${nombrePlato}”`, ruta: '/menu-productos' },
          { icono: 'grid-outline', texto: `Última mesa: “${numMesa}”`, ruta: '/alta-mesa' }
        ];
      }

      // 3. Datos específicos para METRE
      if (this.esMetrePuro) {
        this.notificacionesBadge = this.listaEsperaCount;
        
        const { data: ultimosEspera } = await db
          .from('asignaciones')
          .select(`
            created_at,
            usuarios (nombres, apellidos)
          `)
          .eq('estado', 'esperando')
          .order('created_at', { ascending: false })
          .limit(3);

        if (ultimosEspera && ultimosEspera.length > 0) {
          this.actividadesRecientes = ultimosEspera.map((asignacion: any) => {
            const cliente = asignacion.usuarios;
            const nombre = cliente ? `${cliente.nombres} ${cliente.apellidos}`.trim() : 'Un cliente';
            return {
              icono: 'person-add-outline',
              texto: `${nombre} se anotó en espera`,
              ruta: '/metre-asignacion'
            };
          });
        } else {
          this.actividadesRecientes = [
            { icono: 'people-outline', texto: 'No hay clientes recientes en espera', ruta: '/metre-asignacion' }
          ];
        }
      }

      // 4. Datos específicos para MOZO
      if (this.esMozo) {
        const { count } = await db
          .from('pedidos')
          .select('*', { count: 'exact', head: true })
          .eq('estado', 'pendiente_confirmacion');

        this.pedidosPorConfirmarCount = count || 0;
        this.notificacionesBadge = this.pedidosPorConfirmarCount;
        this.actividadesRecientes = [
          { icono: 'checkmark-circle-outline', texto: `Pedidos por confirmar: ${this.pedidosPorConfirmarCount}`, ruta: '/confirmar-pedido' },
          { icono: 'chatbubbles-outline', texto: 'Abrir canal de consultas de mesas', ruta: '/chat-cliente' },
          { icono: 'book-outline', texto: 'Ver carta de productos', ruta: '/menu-productos' }
        ];
      }

      // 5. Datos específicos para COCINERO / CANTINERO
      if (this.puedeCargarPlatos || this.puedeCargarBebidas) {
        const columnaSector = this.puedeCargarPlatos ? 'estado_cocina' : 'estado_bar';
        const { count } = await db
          .from('pedidos')
          .select('*', { count: 'exact', head: true })
          .eq(columnaSector, 'en_preparacion');

        this.comandasActivasCount = count || 0;
        this.notificacionesBadge = this.comandasActivasCount;
        this.actividadesRecientes = [
          { icono: 'list-outline', texto: `Comandas en preparación: ${this.comandasActivasCount}`, ruta: '/cocina' },
          {
            icono: this.puedeCargarPlatos ? 'restaurant-outline' : 'wine-outline',
            texto: this.puedeCargarPlatos ? 'Agregar nuevo plato a la carta' : 'Agregar nueva bebida a la carta',
            ruta: this.puedeCargarPlatos ? '/alta-plato' : '/alta-bebida'
          },
          { icono: 'book-outline', texto: 'Ver menú completo', ruta: '/menu-productos' }
        ];
      }

      // 6. Datos específicos para CLIENTE
      if (this.esCliente && this.usuarioActual) {
        this.actividadesRecientes = [
          { icono: 'book-outline', texto: 'Ver Carta Digital completa', ruta: '/menu-productos' },

        ];
      }
    } catch (err) {
      console.warn('Algunas métricas secundarias no pudieron cargarse:', err);
    } finally {
      this.cdr.markForCheck();
    }
  }

  // =========================================================================
  // CONTROL DEL BOTÓN QR CENTRAL
  // =========================================================================
  accionBotonQR() {
    if (this.esCliente) {
      if (this.cargandoPerfil || this.cargandoMesa || !this.estadoAsignacionConocido) return;
      if (this.clienteConMesaAsignada) {
        this.verificarAccesoMesa();
      } else {
        this.escanearQRIngreso();
      }
      return;
    }
    if (this.esMozo) {
      this.router.navigate(['/confirmar-pedido']);
      return;
    }
    if (this.esMetrePuro) {
      this.router.navigate(['/metre-asignacion']);
      return;
    }
    if (this.puedeCargarPlatos) {
      this.router.navigate(['/cocina']);
      return;
    }
    if (this.puedeCargarBebidas) {
      this.router.navigate(['/barra']);
      return;
    }
    this.router.navigate(['/clientes-pendientes']);
  }

  // =========================================================================
  // LÓGICA DE ASIGNACIONES (CLIENTE)
  // =========================================================================
  async cargarEstadoMesa() {
    if (!this.clienteHabilitado || !this.usuarioActual) return;
    const revision = ++this.revisionMesa;
    const clienteId = this.usuarioActual.id;
    this.cargandoMesa = true;
    this.errorMesa = '';
    this.cdr.markForCheck();

    try {
      const asignacion = await this.mesasService.obtenerAsignacionActiva(clienteId);
      if (revision !== this.revisionMesa) return;
      let pedido: { id: string; estado: string; total: number; tiempo_estimado: number } | null = null;
      if (asignacion) {
        const { data, error } = await this.supabase.getClient().from('pedidos')
          .select('id, estado, total, tiempo_estimado')
          .eq('cliente_id', clienteId).eq('mesa_id', asignacion.mesaId)
          .gte('created_at', asignacion.fechaAsignacion)
          .order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (error) throw error;
        pedido = data;
      }
      if (revision !== this.revisionMesa || this.usuarioActual?.id !== clienteId) return;
      // Mesa y pedido se reemplazan juntos, solo después de una lectura exitosa.
      this.clienteConMesaAsignada = !!asignacion;
      this.clienteVinculadoAMesa = !!asignacion?.vinculada;
      this.estadoAsignacionConocido = true;
      this.puedeUsarChat = this.clienteVinculadoAMesa;
      this.pedidoIdCliente = pedido?.id ?? null;
      this.totalPedidoCliente = pedido?.total ?? 0;
      this.tiempoEstimadoCliente = pedido?.tiempo_estimado ?? 0;
      this.clienteRecibioPedido = pedido?.estado === 'recibido';
      this.pedidoEntregadoPorMozo = pedido?.estado === 'entregado';
      this.pedidoConfirmadoCliente = !!pedido && ['confirmado', 'en_preparacion', 'listo', 'listo_para_entregar', 'entregado', 'recibido'].includes(pedido.estado);
      this.puedeEditarPedidoCliente = this.clienteVinculadoAMesa && (!pedido || pedido.estado === 'rechazado_mozo');
      const etiquetas: Record<string, string> = {
        pendiente_confirmacion: 'Esperando al mozo', rechazado_mozo: 'Revisar pedido',
        confirmado: 'En preparación', en_preparacion: 'En preparación',
        listo: '¡Listo para servir!', listo_para_entregar: '¡Tu pedido está listo!',
        entregado: 'Confirmá que recibiste tu pedido', recibido: 'Disfrutá tu comida',
      };
      this.estadoPedidoCliente = pedido ? etiquetas[pedido.estado] ?? pedido.estado
        : this.clienteVinculadoAMesa ? 'Mesa habilitada' : 'En recepción';
    } catch (error) {
      if (revision !== this.revisionMesa) return;
      console.error('No se pudo consultar la mesa del cliente:', error);
      this.errorMesa = 'No pudimos actualizar tu visita. Conservamos el último estado disponible. Volvé a intentar.';
    } finally {
      if (revision === this.revisionMesa) {
        this.cargandoMesa = false;
        this.cdr.markForCheck();
      }
    }
  }

  async escanearQRIngreso() {
    let contenidoQR = '';

    if (this.platform.is('capacitor')) {
      try {
        const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
        if (!available) {
          await BarcodeScanner.installGoogleBarcodeScannerModule();
        }

        const { camera } = await BarcodeScanner.requestPermissions();

        if (camera === 'granted' || camera === 'limited') {
          const { barcodes } = await BarcodeScanner.scan({
            formats: [BarcodeFormat.QrCode],
          });

          if (barcodes && barcodes.length > 0) {
            contenidoQR = barcodes[0].rawValue ?? '';
          }
        } else {
          return;
        }
      } catch (error) {
        console.error('Error al escanear', error);
        return;
      }
    } else {
      // Puente web para pruebas en PC
      contenidoQR = 'QR_INGRESO_CEPA';
    }

    if (contenidoQR === 'QR_INGRESO_CEPA') {
      await Haptics.impact({ style: ImpactStyle.Light });
      this.mostrarOpcionesIngreso();
    } else {
      const toast = await this.toastController.create({
        message: 'Código QR inválido. Escaneá el de la puerta del local.',
        duration: 3000,
        color: 'danger',
        position: 'bottom'
      });
      await toast.present();
    }
  }

  async mostrarOpcionesIngreso() {
    const actionSheet = await this.actionSheetCtrl.create({
      header: '¡Bienvenido a Cepa!',
      subHeader: '¿Qué querés hacer?',
      cssClass: 'cepa-action-sheet',
      buttons: [
        {
          text: 'Lista de Espera',
          icon: 'list-outline',
          handler: () => {
            this.anotarseEnLista();
          }
        },
        {
          text: 'Ver Encuestas',
          icon: 'pie-chart-outline',
          handler: () => {
            this.router.navigate(['/graficos-encuestas']);
          }
        },
        {
          text: 'Cancelar',
          icon: 'close-outline',
          role: 'cancel'
        }
      ]
    });
    await actionSheet.present();
  }

  async anotarseEnLista() {
    if (!this.usuarioActual) return;

    try {
      let clienteId = await this.mesasService.obtenerClienteId(this.usuarioActual.id);
      if (clienteId === null && this.esCliente && this.usuarioActual.email?.startsWith('anonimo_')) {
        const { data: creado, error: errorCliente } = await this.supabase.getClient()
          .from('clientes').insert({
            cliente_id: this.usuarioActual.id,
            nombre: this.nombreUsuario,
            apellido: '',
            correo: this.usuarioActual.email,
            estado: 'APROBADO'
          }).select('id').single();
        if (errorCliente) throw errorCliente;
        clienteId = creado.id;
      }
      if (clienteId === null) throw new Error('No se encontró tu registro de cliente.');
      const { data: existente, error: errorConsulta } = await this.supabase.getClient()
        .from('asignaciones').select('id, estado')
        .eq('cliente_id', clienteId).is('fecha_finalizacion', null)
        .limit(1).maybeSingle();

      if (errorConsulta) throw errorConsulta;

      if (existente) {
        const toast = await this.toastController.create({
          message: existente.estado === 'esperando' ? 'Ya te encuentras anotado en la lista de espera.' : 'Ya tenés una mesa asignada.',
          duration: 3000,
          color: 'warning',
          position: 'bottom'
        });
        await toast.present();
        return;
      }

      const { error: errorInsert } = await this.supabase.getClient()
        .from('asignaciones')
        .insert({
          cantidad_personas: 1, 
          cliente_id: clienteId,
        });

      if (errorInsert) throw errorInsert;

      const toast = await this.toastController.create({
        message: '¡Ya estás en la lista de espera! El Metre te asignará una mesa.',
        duration: 4000,
        color: 'success',
        position: 'bottom'
      });
      await toast.present();

      await this.notificarMetre();
      await this.cargarEstadoMesa(); 

    } catch (error: any) {
      console.error('DETALLE DEL ERROR EN SUPABASE:', error);
      const toast = await this.toastController.create({
        message: `Error al anotarte: ${error.message || 'Error desconocido'}`,
        duration: 4000,
        color: 'danger',
        position: 'bottom'
      });
      await toast.present();
    }
  }

  async verificarAccesoMesa() {
    if (!this.usuarioActual) return;

    try {

      const data = await this.mesasService.obtenerAsignacionActiva(this.usuarioActual.id);

      if (!data) {
        const toast = await this.toastController.create({
          message: '⛔ Acceso Denegado: No podés escanear una mesa si antes no te anotaste en la lista de espera.',
          duration: 4000,
          position: 'middle',
          color: 'danger',
          cssClass: 'toast-denegado-cepa'
        });
        await toast.present();
        return;
      }

      this.router.navigate(['/cliente-escaneo-mesa']);
    } catch (err) {
      console.error('Error al verificar acceso a mesa:', err);
      const toast = await this.toastController.create({
        message: 'Debes estar en la lista de espera para acceder a las mesas.',
        duration: 3000,
        color: 'danger',
        position: 'bottom'
      });
      await toast.present();
    }
  }

  async notificarMetre() {
    try {
      await this.supabase.getClient().functions.invoke('enviar-notificacion', {
        body: {
          topic: 'metre_lista_espera',
          titulo: 'Nuevo cliente en lista de espera',
          cuerpo: `${this.nombreUsuario} está esperando una mesa.`
        }
      });
    } catch (error) {
      console.error('Error al notificar al metre:', error);
    }
  }

  async contarClientesPendientes() {
    try {
      const { count, error } = await this.supabase.getClient()
        .from('clientes') // Apuntamos a tu tabla real
        .select('*', { count: 'exact', head: true })
        .eq('estado', 'PENDIENTE'); 

      if (error) throw error;
      
      this.clientesPendientesCount = count || 0;
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error al contar clientes:', error);
      this.clientesPendientesCount = 0;
    }
  }

  async confirmarRecepcion() {
    console.log('ID del pedido a confirmar:', this.pedidoIdCliente); // Para ver en consola qué tiene

    if (!this.pedidoIdCliente) {
      const toast = await this.toastController.create({
        message: 'Error: No se encontró el ID del pedido. Refrescá la pantalla deslizando hacia abajo.',
        duration: 3000,
        color: 'danger'
      });
      await toast.present();
      return;
    }
    
    try {
      await this.pedidosService.confirmarRecepcionCliente(this.pedidoIdCliente);
      
      this.clienteRecibioPedido = true;
      this.pedidoEntregadoPorMozo = false;
      this.estadoPedidoCliente = 'Disfrutá tu comida';
      
      const toast = await this.toastController.create({
        message: '¡Gracias por confirmar! Se han desbloqueado los juegos y la encuesta.',
        duration: 3500,
        color: 'success',
        position: 'top'
      });
      await toast.present();
      
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error al confirmar recepción en la base de datos:', error);
    }
  }
}
