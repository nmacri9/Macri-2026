import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms'; 
import { Router } from '@angular/router';
import { IonContent, IonItem, IonInput, IonButton, IonIcon, IonText } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { mailOutline, lockClosedOutline, personOutline, cafeOutline, shieldOutline } from 'ionicons/icons';
import { Haptics, ImpactStyle } from '@capacitor/haptics'; // Requisito de vibracion
import { AuthService } from '../../services/auth.service';
import { CepaSpinnerComponent } from '../../shared/components/cepa-spinner/cepa-spinner.component';


@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  // IMPORTANTE: Agrego ReactiveFormsModule aca para que funcione el formulario
  imports: [IonContent, IonItem, IonInput, IonButton, IonIcon, IonText, CommonModule, ReactiveFormsModule, CepaSpinnerComponent]
})
export class LoginPage implements OnInit {
  loginForm!: FormGroup;
  isLoading = false;
  errorMessage = '';
  formEnviado = false;

  // Array para los botones de ingreso rapido
  perfilesRapidos = [
    { rol: 'Dueño', email: 'dueno@cepa.com', clave: '123456' },
    { rol: 'Supervisor', email: 'supervisor@cepa.com', clave: '123456' },
    { rol: 'Metre', email: 'metre@cepa.com', clave: '123456' },
    { rol: 'Mozo', email: 'mozo@cepa.com', clave: '123456' },
    { rol: 'Cocinero', email: 'cocinero@cepa.com', clave: '123456' },
    { rol: 'Cantinero', email: 'cantinero@cepa.com', clave: '123456' },
    { rol: 'Cliente Reg.', email: 'cliente@cepa.com', clave: '123456' },
    { rol: 'Anónimo', email: '', clave: '' }
  ];

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
    console.log('Enviando a BD:', email, clave);
    
    try {
      this.isLoading = true; // Activa el spinner visual
      this.cdr.detectChanges();
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      const usuarioLogueado = await this.authservice.login(email, clave); 
      
      // Si pasa la línea anterior sin errores, el login fue exitoso
      console.log('Ingreso exitoso:', usuarioLogueado);
      this.router.navigate(['/home']); // Jaled debe definir esta ruta
      
    } catch (error: any) {
      // Entra acá si el servicio devuelve un error (ej. clave incorrecta)
      this.errorMessage = 'Credenciales incorrectas o usuario no registrado.';
      await Haptics.impact({ style: ImpactStyle.Heavy }); // Vibración exigida
      console.error('Error en login:', error);
      
    } finally {
      this.isLoading = false; // Apaga el spinner sin importar si falló o acertó
      this.cdr.detectChanges();
    }
  }
}