import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent, IonItem, IonIcon, IonInput, IonButton } from '@ionic/angular';

import { SupabaseService } from '../../services/supabase.service';
import { FotosPerfilService } from '../../services/fotos-perfil.service';

@Component({
  selector: 'app-registro-anonimo',
  templateUrl: './registro-anonimo.page.html',
  styleUrls: ['./registro-anonimo.page.scss'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent, IonItem, IonIcon, IonInput, IonButton]
})
export class RegistroAnonimoPage {
  anonimoForm: FormGroup;
  fotoBase64: string | null = null;
  isLoading = false;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private supabase: SupabaseService,
    private fotosPerfilService: FotosPerfilService
  ) {
    this.anonimoForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(2)]]
    });
  }

  async tomarFoto() {
    try {
      const image = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt 
      });
      
    } catch (error: any) {
      alert('Hubo un error al abrir la cámara: ' + error.message);
    }
  }


  async registrarAnonimo() {
    if (this.anonimoForm.invalid || !this.fotoBase64) return;

    this.isLoading = true;
    const nombre = this.anonimoForm.value.nombre;

    // 1. Generamos credenciales falsas pero únicas
    const timestamp = Date.now();
    const emailFalso = `anonimo_${timestamp}@cepa.com`;
    const claveFalsa = 'CepaAnonimo123!';

    try {
      // 2. Registramos la sesión en Supabase Auth (inicia sesión automáticamente)
      const { data, error } = await this.supabase.getClient().auth.signUp({
        email: emailFalso,
        password: claveFalsa
      });

      if (error) throw error;

      if (data.user) {
        // 3. Subimos la foto usando tu servicio existente
        const fotoSubida = await this.fotosPerfilService.subir(
          this.supabase.getClient(),
          data.user.id,
          this.fotoBase64
        );

        // 4. Lo insertamos en tu tabla 'usuarios' con estado ACTIVO
        const { error: errorInsert } = await this.supabase.getClient()
          .from('usuarios')
          .insert({
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