// import { RouterLink } from '@angular/router';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { IonContent, IonItem, IonInput, IonButton, IonIcon, IonSelect, IonSelectOption, IonHeader, IonToolbar, IonButtons, IonModal } from '@ionic/angular';
import { cameraOutline, camera, qrCodeOutline, personOutline, cardOutline, documentTextOutline, mailOutline, lockClosedOutline, briefcaseOutline, exitOutline, closeOutline } from 'ionicons/icons';
import { addIcons } from 'ionicons';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { SupabaseService } from '../../services/supabase.service';
import { CepaSpinnerComponent } from '../../shared/components/cepa-spinner/cepa-spinner.component';
import { ModalController, ToastController } from '@ionic/angular';
import { ConfirmModalComponent } from '../../shared/confirm-modal/confirm-modal.component';
import { DniScannerService } from '../../services/dni-scanner'; 
import { CepaHeaderComponent } from '../../shared/components/cepa-header/cepa-header.component';

@Component({
  selector: 'app-registro-empleado',
  templateUrl: './registro-empleado.page.html',
  styleUrls: ['./registro-empleado.page.scss'],
  standalone: true,
  imports: [
    // RouterLink,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonContent, 
    IonItem, 
    IonInput, 
    IonButton, 
    IonIcon, 
    IonSelect, 
    IonSelectOption,
    IonModal, 
    CommonModule, 
    ReactiveFormsModule,
    CepaSpinnerComponent,
    CepaHeaderComponent
  ]
})
export class RegistroEmpleadoPage implements OnInit {
  registroForm!: FormGroup;
  fotoPreview: string | undefined;
  formEnviado = false;
  errorSupabase: string | undefined;
  cargando = false;

modalAbierta = false;

  constructor(
    private fb: FormBuilder, 
    private cdr: ChangeDetectorRef,
    private supabase: SupabaseService,
    private modalCtrl: ModalController,
    private toastCtrl: ToastController,
    private dniScanner: DniScannerService
  ) {
    addIcons({cameraOutline, camera, qrCodeOutline, personOutline, cardOutline, documentTextOutline, mailOutline, lockClosedOutline, briefcaseOutline, exitOutline, closeOutline});
  }

  ngOnInit() {
    this.registroForm = this.fb.group({
      nombres: ['', [Validators.required, Validators.pattern(/^[a-zA-ZÁÉÍÓÚáéíóúÑñ\s]+$/)]],
      apellidos: ['', [Validators.required, Validators.pattern(/^[a-zA-ZÁÉÍÓÚáéíóúÑñ\s]+$/)]],
      dni: ['', [Validators.required, Validators.pattern(/^[0-9]{7,8}$/)]],
      cuil: ['', [Validators.required, Validators.pattern(/^[0-9]{10,11}$/)]],
      email: ['', [Validators.required, Validators.email]],
      clave: ['', [Validators.required, Validators.minLength(6)]],
      confirmarClave: ['', [Validators.required]],
      perfil: ['', [Validators.required]],
      foto: ['', [Validators.required]] 
    }, { validators: this.clavesIgualesValidator });
  }

  // Validador personalizado para chequear que ambas contraseñas coincidan
  clavesIgualesValidator(group: AbstractControl): ValidationErrors | null {
    const clave = group.get('clave')?.value;
    const confirmar = group.get('confirmarClave')?.value;
    return clave === confirmar ? null : { mismatch: true };
  }

abrirModal() {
    if (this.fotoPreview) {
      this.modalAbierta = true;
    }
  }

cerrarModal() {
    this.modalAbierta = false;
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
    }
  }

  async tomarFoto() {
    try {
      const image = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt 
      });
      this.fotoPreview = image.dataUrl;
      this.registroForm.patchValue({ foto: this.fotoPreview });
      this.cdr.detectChanges();
    } catch (error: any) {
      alert('Hubo un error al abrir la cámara: ' + error.message);
    }
  }

  async confirmarAlta() {
    this.formEnviado = true;
    this.registroForm.markAllAsTouched();
    if (this.registroForm.invalid) return; 
    
    const modal = await this.modalCtrl.create({
      component: ConfirmModalComponent,
      componentProps: { mensaje: '¿Desea dar de alta a este empleado?' },
      cssClass: 'modal-alerta'
    });
    await modal.present();
    const { data } = await modal.onDidDismiss();
    if (data) this.registrar(); 
  }

  async mostrarMensajeExito() {
    const toast = await this.toastCtrl.create({
      message: '¡Empleado cargado con éxito!',
      duration: 2500, 
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
      const datosEmpleado = this.registroForm.value;
      const { data: sesionAdmin } = await this.supabase.getClient().auth.getSession();
      const { data: authData, error: authError } = await this.supabase.getClient().auth.signUp({
        email: datosEmpleado.email,
        password: datosEmpleado.clave,
        options: {
          data: {
            nombres: datosEmpleado.nombres,
            apellidos: datosEmpleado.apellidos,
            dni: datosEmpleado.dni,
            cuil: datosEmpleado.cuil,
            foto_url: 'foto-pendiente-de-carga',
            rol: datosEmpleado.perfil.toUpperCase()
          }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('No se generó el ID de usuario en Auth.');
      await new Promise(resolve => setTimeout(resolve, 1500));

      const { error: errorFoto } = await this.supabase.getClient()
        .from('usuarios') 
        .update({ foto_url: datosEmpleado.foto })
        .eq('id', authData.user.id);

      if (errorFoto) throw new Error('El empleado se creó, pero hubo un problema al adjuntar la foto.');

      if (sesionAdmin.session) {
        await this.supabase.getClient().auth.setSession({
          access_token: sesionAdmin.session.access_token,
          refresh_token: sesionAdmin.session.refresh_token,
        });
      }

      this.registroForm.reset();
      this.formEnviado = false;
      this.fotoPreview = undefined;
      this.mostrarMensajeExito();
    } catch (error: any) {
      this.errorSupabase = error?.message ? `No se pudo guardar: ${error.message}` : 'Error al guardar.';
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }
}