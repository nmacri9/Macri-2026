import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IonContent, IonItem, IonInput, IonButton, IonIcon, IonSelect, IonSelectOption } from '@ionic/angular';
import { cameraOutline,camera, qrCodeOutline, personOutline, cardOutline, documentTextOutline, mailOutline, lockClosedOutline, briefcaseOutline } from 'ionicons/icons';
import { addIcons } from 'ionicons';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { SupabaseService } from '../../services/supabase.service';
import { CepaSpinnerComponent } from '../../shared/components/cepa-spinner/cepa-spinner.component';
import { ModalController, ToastController } from '@ionic/angular';
import { ConfirmModalComponent } from '../../shared/confirm-modal/confirm-modal.component';
import { CepaHeaderComponent } from '../../shared/components/cepa-header/cepa-header.component';


@Component({
  selector: 'app-registro-empleado',
  templateUrl: './registro-empleado.page.html',
  styleUrls: ['./registro-empleado.page.scss'],
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
export class RegistroEmpleadoPage implements OnInit {
  registroForm!: FormGroup;
  fotoPreview: string | undefined;
  formEnviado = false;
  errorSupabase: string | undefined;


  cargando = false;

  constructor(private fb: FormBuilder, 
    private cdr: ChangeDetectorRef,
    private supabase: SupabaseService,
    private modalCtrl: ModalController,
    private toastCtrl: ToastController) 
    {
    addIcons({cameraOutline,
      camera,
      qrCodeOutline,
      personOutline,
      cardOutline,
      documentTextOutline,
      mailOutline,
      lockClosedOutline,
      briefcaseOutline});
  }

  ngOnInit() {
    this.registroForm = this.fb.group({
      nombres: ['', [Validators.required, Validators.pattern(/^[a-zA-ZÁÉÍÓÚáéíóúÑñ\s]+$/)]],
      apellidos: ['', [Validators.required, Validators.pattern(/^[a-zA-ZÁÉÍÓÚáéíóúÑñ\s]+$/)]],
      dni: ['', [Validators.required, Validators.pattern(/^[0-9]{7,8}$/)]],
      cuil: ['', [Validators.required, Validators.pattern(/^[0-9]{10,11}$/)]],
      email: ['', [Validators.required, Validators.email]],
      clave: ['', [Validators.required, Validators.minLength(6)]],
      perfil: ['', [Validators.required]],
      foto: ['', [Validators.required]] 
    });
  }

  async escanearDNI() {
    try {
      // 1. Verificamos e instalamos el módulo de Google Play 
      const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
      if (!available) {
        this.errorSupabase = 'Instalando módulo de escáner... aguarde.';
        this.cdr.detectChanges();
        await BarcodeScanner.installGoogleBarcodeScannerModule();
      }

      // 2. Pedimos permisos y validamos explicitamente
      const permissions = await BarcodeScanner.requestPermissions();
      if (permissions.camera !== 'granted' && permissions.camera !== 'limited') {
        throw new Error('Permiso de cámara denegado por el usuario.');
      }

      // Limpiamos mensajes previos antes de abrir la camara
      this.errorSupabase = undefined; 
      this.cdr.detectChanges();

      // 3. Ejecuto el escaner
      const result = await BarcodeScanner.scan();
      
      const rawData = result.barcodes[0].rawValue;
      if (!rawData) throw new Error('No se pudo leer el código');

      const partes = rawData.split('@');
      
      if (partes.length >= 5) {
        this.registroForm.patchValue({
          apellidos: partes[1].charAt(0) + partes[1].slice(1).toLowerCase(),
          nombres: partes[2].charAt(0) + partes[2].slice(1).toLowerCase(),
          dni: partes[4]
        });
        this.cdr.detectChanges();
      } else {
        throw new Error('Formato de DNI inválido');
      }
    } catch (error: any) {
      await Haptics.impact({ style: ImpactStyle.Heavy });
      
      // 4. Imprimimos el error directamente en el HTML para que sea imposible no verlo
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
        source: CameraSource.Prompt 
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
      componentProps: { mensaje: '¿Desea dar de alta a este empleado?' },
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
      // Retraso artificial de 1.5 segundos para mantener la experiencia visual
      await new Promise(resolve => setTimeout(resolve, 1500));

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
            foto_url: datosEmpleado.foto,
            rol: datosEmpleado.perfil.toUpperCase()
          }
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

      console.log('Empleado guardado exitosamente por el Trigger');
      
      this.registroForm.reset();
      this.formEnviado = false;
      this.fotoPreview = undefined;
      this.mostrarMensajeExito();

    } catch (error: any) {
      console.error('Error al guardar en Supabase:', error);
      this.errorSupabase = error?.message
        ? `No se pudo guardar: ${error.message}`
        : 'No se pudo guardar el empleado. Intente nuevamente.';
      // Vibración de feedback si la base de datos falla
      await Haptics.impact({ style: ImpactStyle.Heavy });
      alert('Fallo nativo: ' + JSON.stringify(error));
      console.error('Error escaner DNI:', error);
    } finally {
      // Oculto el spinner siempre al terminar, ya sea con éxito o error
      
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }
}