import { Component, OnInit, ChangeDetectorRef, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IonContent, IonItem, IonInput, IonButton, IonIcon, IonHeader, IonToolbar, IonButtons, IonTitle } from '@ionic/angular';
import { cameraOutline, camera, qrCodeOutline, personOutline, cardOutline, mailOutline, lockClosedOutline, arrowBackOutline } from 'ionicons/icons';
import { addIcons } from 'ionicons';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { AuthService } from '../../services/auth.service';
import { EmailService } from '../../services/email.service'; 
import { RouterLink } from '@angular/router';
import { CepaSpinnerComponent } from '../../shared/components/cepa-spinner/cepa-spinner.component';
import { ModalController, ToastController } from '@ionic/angular';
import { ConfirmModalComponent } from '../../shared/confirm-modal/confirm-modal.component';
import { SupabaseService } from '../../services/supabase.service';
import { DniScannerService } from '../../services/dni-scanner';

export function confirmarClaveValidator(form: AbstractControl) {
  return form.get('clave')?.value === form.get('confirmarClave')?.value
    ? null : { clavesDistintas: true };
}

@Component({
  selector: 'app-registro-cliente',
  templateUrl: './registro-cliente.page.html',
  styleUrls: ['./registro-cliente.page.scss'],
  standalone: true,
  imports: [
    IonHeader,
    IonToolbar,
    IonButtons,
    IonTitle,
    IonContent,
    IonItem,
    IonInput,
    IonButton,
    IonIcon,
    CommonModule,
    ReactiveFormsModule,
    CepaSpinnerComponent,
    RouterLink
  ]
})
export class RegistroClientePage implements OnInit {
  @ViewChild('archivoFoto') archivoFoto?: ElementRef<HTMLInputElement>;
  registroForm!: FormGroup;
  fotoPreview: string | undefined;
  formEnviado = false;
  errorSupabase: string | undefined;

  cargando = false;
  registroExitoso = false;
  confirmando = false;
  cargandoFoto = false;
  errorFoto = '';

  constructor(
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
    private emailService: EmailService, 
    private modalCtrl: ModalController,
    private toastCtrl: ToastController,
    private supabase: SupabaseService,
    private dniScanner: DniScannerService
  ) {
    addIcons({ cameraOutline, camera, qrCodeOutline, personOutline, cardOutline, mailOutline, lockClosedOutline, arrowBackOutline });
  }

  ngOnInit() {
    this.registroForm = this.fb.group({
      nombres: ['', [Validators.required, Validators.pattern(/^[a-zA-ZÁÉÍÓÚáéíóúÑñ\s]+$/)]],
      apellidos: ['', [Validators.required, Validators.pattern(/^[a-zA-ZÁÉÍÓÚáéíóúÑñ\s]+$/)]],
      dni: ['', [Validators.required, Validators.pattern(/^[0-9]{7,8}$/)]],
      email: ['', [Validators.required, Validators.email]],
      clave: ['', [Validators.required, Validators.minLength(6)]],
      confirmarClave: ['', [Validators.required]],
      foto: ['', [Validators.required]]
    }, { validators: confirmarClaveValidator });
  }

  async escanearDNI() {
    try {
      this.errorSupabase = undefined;
      this.cdr.detectChanges();

      const datosDni = await this.dniScanner.escanear(() => {
        this.errorSupabase = 'Instalando módulo de escáner... aguarde.';
        this.cdr.detectChanges();
      });

      this.registroForm.patchValue({
        apellidos: datosDni.apellidos,
        nombres: datosDni.nombres,
        dni: datosDni.dni
      });
      this.cdr.detectChanges();

    } catch (error: any) {
      await Haptics.impact({ style: ImpactStyle.Heavy });
      this.errorSupabase = 'Error Escáner: ' + (error.message || 'Fallo desconocido');
      this.cdr.detectChanges();
      console.error('Error escaner DNI:', error);
    }
  }

  async tomarFoto() {
    if (this.cargandoFoto || this.cargando) return;

    this.cargandoFoto = true;
    this.errorFoto = '';
    
    try {
      // Usamos CameraSource.Camera para forzar la apertura de la cámara sin pasar por la galería
      const image = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera
      });

      if (!image.dataUrl) throw new Error('No se pudo leer la foto.');
      
      this.fotoPreview = image.dataUrl;
      this.registroForm.patchValue({ foto: this.fotoPreview });
      this.registroForm.get('foto')?.markAsDirty();
      
    } catch (error: any) {
      if (!/cancel|canceled|cancelled|no image picked/i.test(error?.message ?? '')) {
        this.errorFoto = 'No se pudo capturar la foto. Revisá los permisos de la cámara e intentá nuevamente.';
      }
    } finally {
      this.cargandoFoto = false;
      this.cdr.detectChanges();
    }
  }

  async cargarArchivoFoto(event: Event) {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    if (!archivo) return;

    this.cargandoFoto = true;
    this.errorFoto = '';
    try {
      if (!archivo.type.startsWith('image/')) {
        throw new Error('El archivo seleccionado no es una imagen.');
      }
      const dataUrl = await this.leerArchivoComoDataUrl(archivo);
      this.fotoPreview = dataUrl;
      this.registroForm.patchValue({ foto: dataUrl });
      this.registroForm.get('foto')?.markAsDirty();
    } catch {
      this.errorFoto = 'No se pudo cargar la foto. Elegí otra imagen e intentá nuevamente.';
    } finally {
      this.cargandoFoto = false;
      this.cdr.detectChanges();
    }
  }

  private leerArchivoComoDataUrl(archivo: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('No se pudo leer la imagen.'));
      reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer la imagen.'));
      reader.readAsDataURL(archivo);
    });
  }

  async confirmarAlta() {
    if (this.cargando || this.cargandoFoto || this.confirmando || this.registroExitoso) return;
    this.formEnviado = true;
    this.registroForm.markAllAsTouched();
    if (this.registroForm.invalid) {
      return;
    }
    this.confirmando = true;
    try {
      const modal = await this.modalCtrl.create({
        component: ConfirmModalComponent,
        componentProps: { mensaje: '¿Desea registrarse con estos datos?' },
        cssClass: 'modal-alerta'
      });

      await modal.present();
      const { data } = await modal.onDidDismiss();

      if (data) {
        await this.registrar();
      }
    } finally {
      this.confirmando = false;
      this.cdr.markForCheck();
    }
  }

  async mostrarMensajeExito() {
    const toast = await this.toastCtrl.create({
      message: '¡Registro enviado! Tu cuenta quedó pendiente de aprobación.',
      duration: 3000,
      position: 'middle',
      cssClass: 'toast-exito',
      icon: 'checkmark-circle-outline'
    });
    await toast.present();
  }

  async registrar() {
    if (this.cargando || this.cargandoFoto || this.registroExitoso) return;

    this.formEnviado = true;
    this.errorSupabase = undefined;

    if (this.registroForm.invalid) {
      await Haptics.impact({ style: ImpactStyle.Heavy });
      return;
    }

    this.cargando = true;
    this.cdr.detectChanges();

    try {
      const datosCliente = this.registroForm.value;
      const emailCliente = datosCliente.email.trim();
      const nombreCompleto = `${datosCliente.nombres.trim()} ${datosCliente.apellidos.trim()}`;

      // 1. Guardar cliente en Supabase
      await this.authService.registrarCliente(
        emailCliente, datosCliente.clave,
        datosCliente.nombres.trim(), datosCliente.apellidos.trim(),
        datosCliente.dni, undefined, datosCliente.foto
      );

      // 2. Enviar correo automático de Registro Pendiente vía EmailJS 📩
      try {
        await this.emailService.enviarCorreoPendiente({
          nombre: nombreCompleto,
          correo: emailCliente
        });
      } catch (emailError) {
        console.warn('El usuario fue creado en Supabase pero falló el envío del correo:', emailError);
      }

      // --- 3. DISPARAR LA NOTIFICACIÓN PUSH A LOS DUEÑOS/SUPERVISORES  ---
      try {
        await this.supabase.getClient().functions.invoke('enviar-notificacion', {
          body: {
            titulo: '¡Nuevo Cliente Registrado!',
            cuerpo: `${nombreCompleto} está pendiente de aprobación.`,
            topic: 'aprobacion_pendientes'
          }
        });
      } catch (pushError) {
        console.warn('El cliente se registró pero falló el envío de la push:', pushError);
      }

      this.registroExitoso = true;
      this.registroForm.reset();
      this.formEnviado = false;
      this.fotoPreview = undefined;
      this.mostrarMensajeExito();

    } catch (error: any) {
      console.error('Error al guardar en Supabase:', error);
      this.errorSupabase = error?.message
        ? `No se pudo registrar: ${error.message}`
        : 'No se pudo completar el registro. Intente nuevamente.';
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }
}
