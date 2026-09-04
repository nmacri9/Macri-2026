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


@Component({
  selector: 'app-registro-empleado',
  templateUrl: './registro-empleado.page.html',
  styleUrls: ['./registro-empleado.page.scss'],
  standalone: true,
  imports: [IonContent, IonItem, IonInput, IonButton, IonIcon, IonSelect, IonSelectOption, CommonModule, ReactiveFormsModule,CepaSpinnerComponent]
})
export class RegistroEmpleadoPage implements OnInit {
  registroForm!: FormGroup;
  fotoPreview: string | undefined;
  formEnviado = false;
  errorSupabase: string | undefined;


  cargando = false;

  constructor(private fb: FormBuilder, private cdr: ChangeDetectorRef,private supabase: SupabaseService) {
    addIcons({cameraOutline,camera,qrCodeOutline,personOutline,cardOutline,documentTextOutline,mailOutline,lockClosedOutline,briefcaseOutline});
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
      await BarcodeScanner.requestPermissions();
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
    } catch (error) {
      await Haptics.impact({ style: ImpactStyle.Heavy });
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
      // Ahora sí vas a ver por qué falla si tocas el botón
      alert('Hubo un error al abrir la cámara: ' + error.message);
      console.error('Error cámara:', error);
    }
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

      // Guardamos la sesión actual (la del admin/dueño que está haciendo el
      // alta) porque signUp() más abajo va a autenticar el navegador como el
      // EMPLEADO NUEVO, reemplazando la sesión actual. La restauramos al final.
      const { data: sesionAdmin } = await this.supabase.getClient().auth.getSession();

      // 1. Crear el usuario en Supabase Auth (Tabla auth.users)
      // Requiere que "Confirm email" esté DESACTIVADO en Authentication > Settings,
      // si no, signUp no da sesión activa y el insert de abajo choca con RLS,
      // y además cuenta contra el rate limit de envío de mails.
      const { data: authData, error: authError } = await this.supabase.getClient().auth.signUp({
        email: datosEmpleado.email,
        password: datosEmpleado.clave,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('No se generó el ID de usuario en Auth.');

      // 2. Insertar el perfil en la tabla public.usuarios con el ID de Auth
      const { error: dbError } = await this.supabase.getClient()
        .from('usuarios')
        .insert([
          {
            id: authData.user.id,             
            nombres: datosEmpleado.nombres,
            apellidos: datosEmpleado.apellidos,
            dni: datosEmpleado.dni,
            cuil: datosEmpleado.cuil,
            email: datosEmpleado.email,
            rol: datosEmpleado.perfil.toUpperCase(), 
            foto_url: datosEmpleado.foto,     
            estado: 'ACTIVO'                  
          }
        ]);

      if (dbError) throw dbError;

      // Restauramos la sesión del admin para que no quede logueado como el
      // empleado que se acaba de crear.
      if (sesionAdmin.session) {
        await this.supabase.getClient().auth.setSession({
          access_token: sesionAdmin.session.access_token,
          refresh_token: sesionAdmin.session.refresh_token,
        });
      }

      console.log('Empleado guardado exitosamente en Supabase');
      
      // Limpieza del formulario tras guardar con éxito
      this.registroForm.reset();
      this.formEnviado = false;
      this.fotoPreview = undefined;

    } catch (error: any) {
      console.error('Error al guardar en Supabase:', error);
      // Ahora el error real se muestra en pantalla, no solo en la consola
      this.errorSupabase = error?.message
        ? `No se pudo guardar: ${error.message}`
        : 'No se pudo guardar el empleado. Intente nuevamente.';
      // Vibración de feedback si la base de datos falla
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } finally {
      // Oculto el spinner siempre al terminar, ya sea con éxito o error
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }
}