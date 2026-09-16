import { SupabaseService } from '../../services/supabase.service';
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
import { PushNotifications } from '@capacitor/push-notifications';
import { FCM } from '@capacitor-community/fcm';
import { Platform } from '@ionic/angular';

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
    private cdr: ChangeDetectorRef,
    private supabase: SupabaseService,
    private platform: Platform
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

  async iniciarSesion() {
    this.formEnviado = true;
    if (this.loginForm.invalid) {
      this.errorMessage = 'Formato de correo o clave inválidos.';
      await Haptics.impact({ style: ImpactStyle.Heavy }); 
      return;
    }
    this.errorMessage = '';
    const { email, clave } = this.loginForm.value;

    try {
      this.isLoading = true; 
      this.cdr.detectChanges();
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      await this.authservice.login(email, clave);
      
      // --- PASO CORREGIDO: Llamar a las notificaciones si es Dueño/Supervisor ---
      const perfil = await this.authservice.obtenerPerfil();
      if (perfil && (perfil.rol === 'DUEÑO' || perfil.rol === 'SUPERVISOR')) {
        this.activarNotificacionesSeguro();
      }
      
      console.log('Login exitoso, redirigiendo a home...');
      this.router.navigate(['/home']); 
      
    } catch (error: any) {
      this.errorMessage = error instanceof CuentaClienteNoHabilitadaError
        ? error.message
        : 'Credenciales incorrectas o usuario no registrado.';
      await Haptics.impact({ style: ImpactStyle.Heavy }); 
      console.error('Error en login:', error);
      
    } finally {
      this.isLoading = false; 
      this.cdr.detectChanges();
    }
  }

async activarNotificacionesSeguro() {
  try {
    // Evita que explote si pruebas en la web de la PC
    if (!this.platform.is('capacitor')) return; 

    // 1. Pedir permisos
    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }
    if (permStatus.receive !== 'granted') return;

    // 2. EL PASO CLAVE: Registrar el dispositivo nativo
    await PushNotifications.register();

    // 3. Escuchar cuando el token esté listo y suscribir al canal
    PushNotifications.addListener('registration', async (token) => {
      console.log('Token FCM listo. Suscribiendo al canal...');
      try {
        await FCM.subscribeTo({ topic: 'aprobacion_pendientes' });
        console.log('¡Suscrito al topic de DUEÑOS desde el login!');
      } catch (err) {
        console.error('Error al suscribir al topic:', err);
      }
    });


    // 👇 --- AGREGÁ ESTO PARA CAZAR EL MENSAJE EN VIVO --- 👇
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      // Esto tira una alerta gigante en la pantalla del celu apenas entra el mensaje
      alert('LLEGÓ LA PUSH GATO: ' + notification.title);
    });

  } catch (error) {
    console.error('Error aislando las notificaciones:', error);
  }
}



}
