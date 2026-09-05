import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  arrowForwardOutline,
  gridOutline,
  personCircleOutline,
  personAddOutline,
  restaurantOutline,
  wineOutline
} from 'ionicons/icons';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [RouterLink, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar],
})
export class HomePage {
  nombreUsuario = 'Usuario';
  rolUsuario = 'Rol no disponible';

  constructor(private authService: AuthService) {
    addIcons({
      arrowForwardOutline,
      gridOutline,
      personCircleOutline,
      personAddOutline,
      restaurantOutline,
      wineOutline
    });
  }

  ngOnInit() {
    this.cargarPerfil();
  }

  private async cargarPerfil() {
    try {
      const usuario = await this.authService.obtenerUsuarioActual();

      if (!usuario) {
        return;
      }

      this.nombreUsuario = usuario.email || 'Usuario';
      this.rolUsuario = this.formatearRol(usuario.user_metadata?.['rol']);

      const perfil = await this.authService.obtenerPerfil();

      if (!perfil) {
        return;
      }

      const nombreCompleto = [perfil.nombres, perfil.apellidos]
        .filter(Boolean)
        .join(' ');

      this.nombreUsuario = nombreCompleto || perfil.email || this.nombreUsuario;
      this.rolUsuario = this.formatearRol(perfil.rol);
    } catch (error) {
      console.error('No se pudo cargar el perfil del usuario:', error);
    }
  }

  private formatearRol(rol: string | null | undefined): string {
    const roles: Record<string, string> = {
      DUENO: 'Dueño',
      SUPERVISOR: 'Supervisor',
      COCINERO: 'Cocinero',
      CANTINERO: 'Cantinero',
      MOZO: 'Mozo',
      METRE: 'Metre',
      CLIENTE_REGISTRADO: 'Cliente registrado'
    };

    const rolNormalizado = String(rol ?? '')
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    return roles[rolNormalizado] || 'Rol no disponible';
  }
}
