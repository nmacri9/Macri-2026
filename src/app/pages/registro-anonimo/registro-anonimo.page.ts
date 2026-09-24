import { Component, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { IonContent, IonItem, IonIcon, IonInput, IonButton, Platform, ModalController, IonHeader, IonToolbar, IonButtons, IonModal } from '@ionic/angular';
import { CepaHeaderComponent } from '../../shared/components/cepa-header/cepa-header.component';
import { SupabaseService } from '../../services/supabase.service';
import { FotosPerfilService } from '../../services/fotos-perfil.service';
import { addIcons } from 'ionicons';
import { closeOutline, personOutline, cameraOutline } from 'ionicons/icons';
import { ConfirmModalComponent } from '../../shared/confirm-modal/confirm-modal.component';



@Component({
  selector: 'app-registro-anonimo',
  templateUrl: './registro-anonimo.page.html',
  styleUrls: ['./registro-anonimo.page.scss'],
  standalone: true,
  imports: [CommonModule, 
    ReactiveFormsModule,   
    IonContent, 
    IonItem, 
    IonIcon, 
    IonInput, 
    IonButton,
    CepaHeaderComponent,
    IonHeader, IonToolbar, IonButtons, IonModal
  ]
})
export class RegistroAnonimoPage {
  @ViewChild('fileInput', { static: false }) fileInput?: ElementRef;

  anonimoForm: FormGroup;
  fotoBase64: string | null = null;
  isLoading = false;
  modalAbierta = false;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private supabase: SupabaseService,
    private fotosPerfilService: FotosPerfilService,
    private platform: Platform,
    private cdr: ChangeDetectorRef,
    private modalCtrl: ModalController
  ) {
    addIcons({personOutline,cameraOutline,closeOutline});
    this.anonimoForm = this.fb.group({
      nombre: ['', 
        [Validators.required, 
        Validators.minLength(2),
        Validators.pattern(/^[a-zA-ZÁÉÍÓÚáéíóúÑñ\s]+$/)
      ]]
    });
  }

abrirModal() {
    if (this.fotoBase64) {
      this.modalAbierta = true;
    }
  }

  cerrarModal() {
    this.modalAbierta = false;
  }

  async confirmarAlta() {
    if (this.anonimoForm.invalid || !this.fotoBase64) return;

    const modal = await this.modalCtrl.create({
      component: ConfirmModalComponent,
      componentProps: { mensaje: '¿Desea ingresar al local como cliente anónimo?' },
      cssClass: 'modal-alerta'
    });

    await modal.present();

    const { data } = await modal.onDidDismiss();
    // Si el usuario toca "Confirmar", data es true y disparamos el registro
    if (data) {
      this.registrarAnonimo();
    }
  }


  async tomarFoto() {
    if (this.platform.is('capacitor')) {
      try {
        const image = await Camera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Prompt
        });
        this.fotoBase64 = image.dataUrl ?? null;
      } catch (error) {
        console.log('El usuario canceló la foto', error);
      }
    } else {
      // Disparamos el input nativo en la PC
      this.fileInput?.nativeElement.click();
    }
  }

  // Capturamos el archivo de la PC
  onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        this.fotoBase64 = reader.result as string; 
        this.cdr.detectChanges();
      };
      reader.readAsDataURL(file);
    }
  }

  


  async registrarAnonimo() {
    if (this.anonimoForm.invalid || !this.fotoBase64) return;

    this.isLoading = true;
    const nombre = this.anonimoForm.value.nombre;

    // 1. Generamos credenciales falsas pero unicas
    const timestamp = Date.now();
    const emailFalso = `anonimo_${timestamp}@cepa.com`;
    const claveFalsa = 'CepaAnonimo123!';

    try {
      // 2. Registramos la sesión en Supabase Auth (inicia sesion automáticamente)
      const { data, error } = await this.supabase.getClient().auth.signUp({
        email: emailFalso,
        password: claveFalsa
      });

      if (error) throw error;

      if (data.user) {
        // 3. Subo la foto usando el servicio existente
        const fotoSubida = await this.fotosPerfilService.subir(
          this.supabase.getClient(),
          data.user.id,
          this.fotoBase64
        );

        // 4. Lo inserto en la tabla 'usuarios' con estado ACTIVO
        const { error: errorInsert } = await this.supabase.getClient()
          .from('usuarios')
          .upsert({
            id: data.user.id,
            nombres: nombre,
            apellidos: '', // El anónimo no tiene apellido
            email: emailFalso,
            foto_url: fotoSubida.url,
            rol: 'CLIENTE_ANONIMO',
            estado: 'ACTIVO' // Pasa derecho sin aprobación
          });

        if (errorInsert) throw errorInsert;

        // 5. Redirigimos al Home
        console.log('Cliente anónimo registrado con éxito');
        this.router.navigate(['/home']);
      }
    } catch (error: any) {
      console.error('Error al registrar anónimo:', error);
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } finally {
      this.isLoading = false;
    }
  }
}