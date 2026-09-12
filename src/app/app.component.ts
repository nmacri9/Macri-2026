import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { Platform } from '@ionic/angular';
import { PushNotifications } from '@capacitor/push-notifications';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  constructor(private platform: Platform) {
    this.initializeApp();
  }


initializeApp() {
    this.platform.ready().then(() => {
      // Chequeamos que estemos en un dispositivo físico (Android/iOS) y no en la web
      if (this.platform.is('capacitor')) {
        this.configurarPushNotifications();
      }
    });
  }

  async configurarPushNotifications() {
    // 1. Pedir permisos
    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    // 2. Si el usuario acepta, registramos el dispositivo
    if (permStatus.receive === 'granted') {
      await PushNotifications.register();
    }

    // 3. Escuchar el evento de registro exitoso para obtener el Token
    PushNotifications.addListener('registration', (token) => {
      console.log('El dispositivo se registró con éxito. Token:', token.value);
      // Acá normalmente enviarías este token a tu backend para guardarlo en la base de datos
    });

    // 4. Escuchar si hubo algún error en el registro
    PushNotifications.addListener('registrationError', (error: any) => {
      console.error('Error al registrar el dispositivo:', JSON.stringify(error));
    });
  }
}