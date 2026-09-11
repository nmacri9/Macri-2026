import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms'; 
import { Router, RouterLink } from '@angular/router';
import { IonContent, IonItem, IonInput, IonButton, IonIcon, IonText } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { mailOutline, lockClosedOutline, personOutline, cafeOutline, shieldOutline } from 'ionicons/icons';
import { Haptics, ImpactStyle } from '@capacitor/haptics'; // Requisito de vibracion
import { AuthService, CuentaClienteNoHabilitadaError } from '../../services/auth.service';
import { CepaSpinnerComponent } from '../../shared/components/cepa-spinner/cepa-spinner.component';
import { AccesoRapidoComponent } from '../../shared/components/acceso-rapido/acceso-rapido.component';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  // IMPORTANTE: Agrego ReactiveFormsModule aca para que funcione el formulario
  imports: [RouterLink, IonContent, IonItem, IonInput, IonButton, IonIcon, IonText, CommonModule, ReactiveFormsModule, CepaSpinnerComponent, AccesoRapidoComponent]
})
export class LoginPage implements OnInit {
  loginForm!: FormGroup;
  isLoading = false;
  errorMessage = '';
  formEnviado = false;


  constructor(
    private fb: FormBuilder, 
    private router: Router,
    private authservice: AuthService,
    private cdr: ChangeDetectorRef
  ) {
    addIcons({ mailOutline, lockClosedOutline, personOutline, cafeOutline, shieldOutline });
  }

  ngOnInit() {
    // Inicialización de validaciones estrictas
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      clave: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  // Funcion que se llama al tocar un botón de acceso rápido
  cargarPerfil(perfil: any) {
    if (perfil.rol === 'Anónimo') {
      console.log('Navegando a registro anónimo...');
      this.router.navigate(['/registro-anonimo']);
      return;
    }
    
  
    this.loginForm.patchValue({
      email: perfil.email,
      clave: perfil.clave
    });
  }

  // Funcion que se ejecuta al darle al boton principal de "Ingresar"
  async iniciarSesion() {
    this.formEnviado = true;

    if (this.loginForm.invalid) {
      this.errorMessage = 'Formato de correo o clave inválidos.';
      await Haptics.impact({ style: ImpactStyle.Heavy }); // Hace vibrar el celular
      // this.loginForm.markAllAsTouched();
      return;
    }

    this.errorMessage = '';
    const { email, clave } = this.loginForm.value;
    
    try {
      this.isLoading = true; // Activa el spinner visual
      this.cdr.detectChanges();
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      await this.authservice.login(email, clave);
      
      // Si pasa la línea anterior sin errores, el login fue exitoso
      this.router.navigate(['/home']); // Jaled debe definir esta ruta
      
    } catch (error: any) {
      // Entra acá si el servicio devuelve un error (ej. clave incorrecta)
      this.errorMessage = error instanceof CuentaClienteNoHabilitadaError
        ? error.message
        : 'Credenciales incorrectas o usuario no registrado.';
      await Haptics.impact({ style: ImpactStyle.Heavy }); // Vibración exigida
      console.error('Error en login:', error);
      
    } finally {
      this.isLoading = false; // Apaga el spinner sin importar si falló o acertó
      this.cdr.detectChanges();
    }
  }
}
