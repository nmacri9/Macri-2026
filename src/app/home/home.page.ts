import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { IonContent, IonHeader, IonIcon, IonPopover, IonTitle, IonToolbar, NavController, ToastController,Platform, AlertController } from '@ionic/angular';
import { SupabaseService } from '../services/supabase.service';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';
import { addIcons } from 'ionicons';
import {
  arrowForwardOutline,
  gridOutline,
  logOutOutline,
  peopleOutline,
  personCircleOutline,
  personAddOutline,
  restaurantOutline,
  wineOutline,
  qrCodeOutline
} from 'ionicons/icons';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [RouterLink, IonContent, IonHeader, IonIcon, IonPopover, IonTitle, IonToolbar],
})
export class HomePage implements OnInit {
  nombreUsuario = 'Usuario';
  fotoUsuario: string | null = null;
  menuPerfilAbierto = false;
  cerrandoSesion = false;
  
  usuarioActual: any = null;


  // Controles de visibilidad por Rol
  puedeGestionarClientes = false;
  esMetre = false;
  esCliente = false;

  constructor(
    private cdr: ChangeDetectorRef, 
    private authService: AuthService,
    private navController: NavController, 
    private toastController: ToastController,
    private platform: Platform,
    private alertCtrl: AlertController,
    private router: Router,
    private supabase: SupabaseService
  ) {
    addIcons({
      arrowForwardOutline,
      gridOutline,
      logOutOutline,
      peopleOutline,
      personCircleOutline,
      personAddOutline,
      restaurantOutline,
      wineOutline
    });
  }

  ngOnInit() {
    this.cargarPerfil();
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

  private async cargarPerfil() {
    try {
      const usuario = await this.authService.obtenerUsuarioActual();

      if (!usuario) {
        return;
      }

      this.usuarioActual = usuario;

      this.nombreUsuario = usuario.email || 'Usuario';
      this.fotoUsuario = usuario.user_metadata?.['foto_url'] || null;

      this.cdr.detectChanges();

      const perfil = await this.authService.obtenerPerfil();

      if (!perfil) {
        return;
      }

      const nombreCompleto = [perfil.nombres, perfil.apellidos]
        .filter(Boolean)
        .join(' ');

      this.nombreUsuario = nombreCompleto || perfil.email || this.nombreUsuario;
      this.fotoUsuario = perfil.foto_url || this.fotoUsuario;
      
      const rol = String(perfil.rol ?? '').trim().toUpperCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      // Roles administrativos (Dueño / Supervisor)
      this.puedeGestionarClientes = perfil.estado === 'ACTIVO' && ['DUENO', 'SUPERVISOR'].includes(rol);
      
      // Metre
      this.esMetre = ['METRE', 'DUENO', 'SUPERVISOR'].includes(rol);
      
      // Clientes
      this.esCliente = ['CLIENTE_REGISTRADO', 'CLIENTE_ANONIMO'].includes(rol);

      this.cdr.detectChanges();

    } catch (error) {
      console.error('No se pudo cargar el perfil del usuario:', error);
    }
  }

// =========================================================================
  // PUNTO 9: LÓGICA DE ESCANEO DE INGRESO Y LISTA DE ESPERA
  // =========================================================================

 async escanearQRIngreso() {
    let contenidoQR = '';

    if (this.platform.is('capacitor')) {
      try {
        
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

    // Validamos lo que leyó el escáner
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
    const alert = await this.alertCtrl.create({
      header: '¡Bienvenido a Cepa!',
      message: '¿Qué querés hacer?',
      cssClass: 'cepa-alert',
      buttons: [
        {
          text: 'Ver Encuestas',
          role: 'cancel',
          handler: () => {
            
            this.router.navigate(['/graficos-encuestas']); 
          }
        },
        {
          text: 'Lista de Espera',
          handler: () => {
            this.anotarseEnLista();
          }
        }
      ]
    });
    await alert.present();
  }

  async anotarseEnLista() {
    if (!this.usuarioActual) return;

    try {
      // 1. Validar si el cliente ya está en la lista de espera
      const { data: existente, error: errorConsulta } = await this.supabase.getClient()
        .from('lista_espera')
        .select('*')
        .eq('cliente_id', this.usuarioActual.id)
        .eq('estado', 'ESPERANDO') 
        .maybeSingle();

      if (errorConsulta) throw errorConsulta;

      if (existente) {
        // Si ya existe, le avisamos y cortamos la ejecución
        const toast = await this.toastController.create({
          message: 'Ya te encuentras anotado en la lista de espera.',
          duration: 3000,
          color: 'warning',
          position: 'bottom'
        });
        await toast.present();
        return;
      }

      // 2. Si no existe, procedo a insertarlo
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

  // VALIDACION!! No dejo entrar a mesas sin estar en lista o asignado
  async verificarAccesoMesa() {
    if (!this.usuarioActual) return;

    try {
      // Consultamos si el cliente figura en la lista de espera o si ya tiene mesa asignada
      const { data, error } = await this.supabase.getClient()
        .from('lista_espera')
        .select('*')
        .eq('id_cliente', this.usuarioActual.id)
        .single();

      // Si no está en la lista o da error (porque no existe el registro)
      if (error || !data) {
        const alert = await this.alertCtrl.create({
          header: 'Acceso Denegado',
          message: 'No podés escanear una mesa si antes no escaneaste el QR de ingreso y te anotaste en la lista de espera.',
          buttons: ['OK']
        });
        await alert.present();
        return;
      }

      // Si paso la validación, lo dejamos pasar a la pantalla de escaneo de mesa
      this.router.navigate(['/cliente-escaneo-mesa']);

    } catch (err) {
      console.error('Error al verificar acceso a mesa:', err);
      // Por seguridad, bloqueamos el acceso
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
          topic: 'aprobacion_pendientes', // O el topic exclusivo que uses para el Metre
          titulo: 'Nuevo cliente en lista de espera',
          cuerpo: `${this.nombreUsuario} está esperando una mesa.`
        }
      });
    } catch (error) {
      console.error('Error al notificar al metre:', error);
    }
  }
}










