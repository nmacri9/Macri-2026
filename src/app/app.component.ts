import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { Platform } from '@ionic/angular';
import { PushNotifications } from '@capacitor/push-notifications';
import { SplashScreen } from '@capacitor/splash-screen'; 
import { Router } from '@angular/router';
import { ChatPushService } from './services/chat-push.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  standalone: true,
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  
  constructor(private platform: Platform, private chatPush: ChatPushService, private router: Router) {
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

      await PushNotifications.addListener('registration', () => {
        this.chatPush.activar();
      });

      await PushNotifications.addListener('registrationError', (error: any) => {
        console.error('Error al registrar el dispositivo:', JSON.stringify(error));
      });

      await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('¡Notificación recibida en primer plano!', notification);
      });

      await PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
        if (notification.data?.ruta === '/chat-cliente') void this.router.navigate(['/chat-cliente']);
      });
      if (this.platform.is('android')) {
        await PushNotifications.createChannel({ id: 'default', name: 'Avisos de Cepa', importance: 5, sound: 'default' });
      }
      // Registrar después de instalar listeners para no perder el token inicial.
      await PushNotifications.register();

    } catch (error) {
      // ESTE CATCH FALTABA
      console.error('Error general configurando las push:', error);
    }
  } 
}
