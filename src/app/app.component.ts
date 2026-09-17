import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { Platform } from '@ionic/angular';
import { PushNotifications } from '@capacitor/push-notifications';
import { SplashScreen } from '@capacitor/splash-screen'; 
import { FCM } from '@capacitor-community/fcm';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  standalone: true,
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  
  constructor(private platform: Platform) {
    this.initializeApp();
  }

  initializeApp() {
    this.platform.ready().then(async () => {
      if (this.platform.is('capacitor')) {
        this.configurarPushNotifications();
        
        await SplashScreen.hide(); 
      }
    });
  }

  async configurarPushNotifications() {
    try {
      // 1. Pedir permisos al usuario
      let permStatus = await PushNotifications.checkPermissions();
      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }
      
      // Si el usuario no dio permiso, cortamos acá
      if (permStatus.receive !== 'granted') {
        console.warn('El usuario denegó el permiso para notificaciones.');
        return;
      }

      // 2. Registrar el dispositivo con Google/Apple
      await PushNotifications.register();

      // 3. Escuchar el evento de registro exitoso para obtener el Token
      PushNotifications.addListener('registration', async (token) => {
        console.log('El dispositivo se registró con éxito. Token:', token.value);
        
        try {
          await FCM.subscribeTo({ topic: 'aprobacion_pendientes' });
          console.log('¡Suscrito al topic aprobacion_pendientes con éxito!');
        } catch (err) {
          console.error('Error al suscribir al topic:', err);
        }
      });

      PushNotifications.addListener('registrationError', (error: any) => {
        console.error('Error al registrar el dispositivo:', JSON.stringify(error));
      });

      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('¡Notificación recibida en primer plano!', notification);
        alert('Llegó la push: ' + notification.title); 
      });

    } catch (error) {
      console.error('Error general configurando las push:', error);
    }
  }
}