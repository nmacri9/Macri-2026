import { Component, ChangeDetectorRef } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { IonContent, IonHeader, IonIcon, IonPopover, IonTitle, IonToolbar, NavController, ToastController, Platform, ActionSheetController, IonRefresher, IonRefresherContent } from '@ionic/angular';
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
  closeOutline
} from 'ionicons/icons';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [RouterLink, IonContent, IonHeader, IonIcon, IonPopover, IonTitle, IonToolbar, IonRefresher, IonRefresherContent],
})
export class HomePage {
  nombreUsuario = 'Usuario';
  fotoUsuario: string | null = null;
  menuPerfilAbierto = false;
  cerrandoSesion = false;
  errorPerfil = '';
  
  usuarioActual: any = null;

  // Controles de visibilidad por Rol
  puedeGestionarClientes = false;
  puedeCargarPlatos = false;
  puedeCargarBebidas = false;
  esMetre = false;
  esCliente = false;
  puedeUsarChat = false;
  esMozo = false;
  clienteVinculadoAMesa = false;

  constructor(
    private cdr: ChangeDetectorRef, 
    private authService: AuthService,
    private navController: NavController, 
    private toastController: ToastController,
    private platform: Platform,
    private actionSheetCtrl: ActionSheetController,
    private router: Router,
    private supabase: SupabaseService
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
      closeOutline
    });
  }

  ionViewWillEnter() {
    return this.cargarPerfil();
  }

  // Función para el pull-to-refresh
  async recargarPantalla(event: any) {
    await this.cargarPerfil();
    event.target.complete();
  }

  async cerrarSesion(menu: IonPopover) {
    if (this.cerrandoSesion) return;
    this.cerrandoSesion = true;
    try {
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
    this.errorPerfil = '';
    this.usuarioActual = null;
    this.nombreUsuario = 'Usuario';
    this.fotoUsuario = null;
    this.puedeGestionarClientes = false;
    this.puedeCargarPlatos = false;
    this.puedeCargarBebidas = false;
    this.esMetre = false;
    this.esCliente = false;
    this.esMozo = false;
    this.puedeUsarChat = false;
    this.clienteVinculadoAMesa = false; // <--- REINICIAR LA VARIABLE
    this.cdr.markForCheck();

    try {
      const usuario = await this.authService.obtenerUsuarioActual();
      if (!usuario) throw new Error('No se pudo obtener el usuario actual.');
      
      this.usuarioActual = usuario;
      this.nombreUsuario = usuario.email || 'Usuario';
      this.fotoUsuario = usuario.user_metadata?.['foto_url'] || null;
      this.cdr.detectChanges();

      const perfil = await this.authService.obtenerPerfil();
      if (!perfil) throw new Error('No se pudo obtener el perfil actual.');
      
      const nombreCompleto = [perfil.nombres, perfil.apellidos].filter(Boolean).join(' ');
      this.nombreUsuario = nombreCompleto || perfil.email || this.nombreUsuario;
      this.fotoUsuario = perfil.foto_url || this.fotoUsuario;
      
      const rol = String(perfil.rol ?? '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      // =========================================================================
      // GESTIÓN DINÁMICA DE CANALES PUSH
      // =========================================================================
      if (this.platform.is('capacitor')) {
        try {
          await FCM.unsubscribeFrom({ topic: 'aprobacion_pendientes' });
          await FCM.unsubscribeFrom({ topic: 'metre_lista_espera' });

          if (['DUENO', 'SUPERVISOR'].includes(rol)) {
            await FCM.subscribeTo({ topic: 'aprobacion_pendientes' });
          }
          
          if (['METRE'].includes(rol)) { 
            await FCM.subscribeTo({ topic: 'metre_lista_espera' });
          }
        } catch (err) {
          console.error('Error configurando topics de FCM:', err);
        }
      }
      // =========================================================================

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

      this.puedeGestionarClientes = perfil.estado === 'ACTIVO' && ['DUENO', 'SUPERVISOR'].includes(rol);
      this.puedeCargarPlatos = perfil.estado === 'ACTIVO' && rol === 'COCINERO';
      this.puedeCargarBebidas = perfil.estado === 'ACTIVO' && rol === 'CANTINERO';
      this.esMetre = ['METRE', 'SUPERVISOR', 'DUENO'].includes(rol);
      this.esMozo = (rol === 'MOZO' && perfil.estado === 'ACTIVO');
      this.esCliente = ['CLIENTE_REGISTRADO', 'CLIENTE_ANONIMO'].includes(rol);

      // =========================================================================
      // Lógica robusta de estado de mesa
      // =========================================================================
      if (this.esCliente) {
        const { data } = await this.supabase.getClient()
          .from('lista_espera')
          .select('estado')
          .eq('cliente_id', this.usuarioActual.id)
          .maybeSingle();

        if (data && data.estado) {
          const estadoMesa = data.estado.toUpperCase();
          // Validamos múltiples posibles estados que haya puesto tu compañero
          if (['SENTADO', 'MESA_VINCULADA', 'ASIGNADA', 'ASIGNADO', 'OCUPADA'].includes(estadoMesa)) {
            this.clienteVinculadoAMesa = true;
          }
        }
      }

      // El chat requiere que el cliente tenga la mesa vinculada
      this.puedeUsarChat = (rol === 'MOZO' && perfil.estado === 'ACTIVO')
        || (this.esCliente && this.clienteVinculadoAMesa && (rol === 'CLIENTE_ANONIMO' || perfil.estado === 'APROBADO'));

      this.cdr.detectChanges();
    } catch (error) {
      console.error('No se pudo cargar el perfil del usuario:', error);
      this.errorPerfil = 'No pudimos cargar tus opciones. Volvé a intentar.';
    } finally {
      this.cdr.markForCheck();
    }
  }

  // =========================================================================
  // PUNTO 9: LÓGICA DE ESCANEO DE INGRESO Y LISTA DE ESPERA
  // =========================================================================

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
          console.log('Permiso de cámara denegado');
          return;
        }
      } catch (error) {
        console.error('Error al escanear', error);
        return;
      }
    } else {
      // Puente WEB para probar en PC sin cámara
      console.log('Simulando escaneo de QR de ingreso en la PC...');
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
      const { data: existente, error: errorConsulta } = await this.supabase.getClient()
        .from('lista_espera')
        .select('*')
        .eq('cliente_id', this.usuarioActual.id)
        .eq('estado', 'ESPERANDO') 
        .maybeSingle();

      if (errorConsulta) throw errorConsulta;

      if (existente) {
        const toast = await this.toastController.create({
          message: 'Ya te encuentras anotado en la lista de espera.',
          duration: 3000,
          color: 'warning',
          position: 'bottom'
        });
        await toast.present();
        return;
      }

      const { error: errorInsert } = await this.supabase.getClient()
        .from('lista_espera')
        .insert({
          cliente_id: this.usuarioActual.id,
          nombre: this.nombreUsuario,
          estado: 'ESPERANDO'
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
      const { data, error } = await this.supabase.getClient()
        .from('lista_espera')
        .select('*')
        .eq('cliente_id', this.usuarioActual.id)
        .single();

      if (error || !data) {
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
}