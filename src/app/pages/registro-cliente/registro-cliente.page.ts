import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IonContent, IonItem, IonInput, IonButton, IonIcon, IonSelect, IonSelectOption } from '@ionic/angular';
import { cameraOutline, camera, qrCodeOutline, personOutline, cardOutline, mailOutline, lockClosedOutline, briefcaseOutline } from 'ionicons/icons';
import { addIcons } from 'ionicons';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { SupabaseService } from '../../services/supabase.service';
import { CepaSpinnerComponent } from '../../shared/components/cepa-spinner/cepa-spinner.component';
import { ModalController, ToastController } from '@ionic/angular';
import { ConfirmModalComponent } from '../../shared/confirm-modal/confirm-modal.component';
import { CepaHeaderComponent } from '../../shared/components/cepa-header/cepa-header.component';
import { DniScannerService } from '../../services/dni-scanner';

@Component({
  selector: 'app-registro-cliente',
  templateUrl: './registro-cliente.page.html',
  styleUrls: ['./registro-cliente.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonItem,
    IonInput,
    IonButton,
    IonIcon,
    IonSelect,
    IonSelectOption,
    CommonModule,
    ReactiveFormsModule,
    CepaSpinnerComponent,
    CepaHeaderComponent
  ]
})
export class RegistroClientePage implements OnInit {
  registroForm!: FormGroup;
  fotoPreview: string | undefined;
  formEnviado = false;
  errorSupabase: string | undefined;

  cargando = false;

  constructor(
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private supabase: SupabaseService,
    private modalCtrl: ModalController,
    private toastCtrl: ToastController,
    private dniScanner: DniScannerService
  ) {
    addIcons({ cameraOutline, camera, qrCodeOutline, personOutline, cardOutline, mailOutline, lockClosedOutline, briefcaseOutline });
  }

  ngOnInit() {
    this.registroForm = this.fb.group({
      nombres: ['', [Validators.required, Validators.pattern(/^[a-zA-ZÁÉÍÓÚáéíóúÑñ\s]+$/)]],
      apellidos: ['', [Validators.required, Validators.pattern(/^[a-zA-ZÁÉÍÓÚáéíóúÑñ\s]+$/)]],
      dni: ['', [Validators.required, Validators.pattern(/^[0-9]{7,8}$/)]],
      email: ['', [Validators.required, Validators.email]],
      clave: ['', [Validators.required, Validators.minLength(6)]],
      perfil: ['', [Validators.required]],
      foto: ['', [Validators.required]]
    });
  }

  async escanearDNI() {
    try {
      this.errorSupabase = undefined;
      this.cdr.detectChanges();

      // El service avisa por callback si tiene que instalar el módulo de escaneo
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
    try {
      const image = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera // Forzado a cámara: bloquea el acceso a la galería
      });

      this.fotoPreview = image.dataUrl;
      this.registroForm.patchValue({ foto: this.fotoPreview });
      this.cdr.detectChanges();
    } catch (error: any) {
      alert('Hubo un error al abrir la cámara: ' + error.message);
      console.error('Error cámara:', error);
    }
  }

  async confirmarAlta() {
    this.formEnviado = true;
    this.registroForm.markAllAsTouched();
    if (this.registroForm.invalid) {
      return;
    }
    const modal = await this.modalCtrl.create({
      component: ConfirmModalComponent,
      componentProps: { mensaje: '¿Desea registrarse con estos datos?' },
      cssClass: 'modal-alerta'
    });

    await modal.present();
    const { data } = await modal.onDidDismiss();

    if (data) {
      this.registrar();
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
    if (this.cargando) return;

    this.formEnviado = true;
    this.errorSupabase = undefined;

    if (this.registroForm.invalid) {
      await Haptics.impact({ style: ImpactStyle.Heavy });
      return;
    }

    this.cargando = true;
    this.cdr.detectChanges();

    try {
      await new Promise(resolve => setTimeout(resolve, 1500));

      const datosCliente = this.registroForm.value;
      const { data: sesionAdmin } = await this.supabase.getClient().auth.getSession();
      const { data: authData, error: authError } = await this.supabase.getClient().auth.signUp({
        email: datosCliente.email,
        password: datosCliente.clave,
        options: {
          data: {
            nombres: datosCliente.nombres,
            apellidos: datosCliente.apellidos,
            dni: datosCliente.dni,
            foto_url: datosCliente.foto,
            rol: datosCliente.perfil.toUpperCase(),
            estado: 'PENDIENTE' // Queda pendiente de aprobación por dueño/supervisor
          }                     // ESTO FALTA ARREGLAR CUANDO SE HAGA SUPABASE
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('No se generó el ID de usuario en Auth.');
      if (sesionAdmin.session) {
        await this.supabase.getClient().auth.setSession({
          access_token: sesionAdmin.session.access_token,
          refresh_token: sesionAdmin.session.refresh_token,
        });
      }

      console.log('Cliente registrado, pendiente de aprobación');

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