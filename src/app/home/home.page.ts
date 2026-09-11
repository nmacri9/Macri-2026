import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonHeader, IonIcon, IonPopover, IonTitle, IonToolbar, NavController, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  arrowForwardOutline,
  gridOutline,
  logOutOutline,
  peopleOutline,
  personCircleOutline,
  personAddOutline,
  restaurantOutline,
  wineOutline
} from 'ionicons/icons';
import { AuthService } from '../services/auth.service';
import { ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [RouterLink, IonContent, IonHeader, IonIcon, IonPopover, IonTitle, IonToolbar],
})
export class HomePage {
  nombreUsuario = 'Usuario';
  fotoUsuario: string | null = null;
  menuPerfilAbierto = false;
  cerrandoSesion = false;
  puedeGestionarClientes = false;

  constructor(private cdr: ChangeDetectorRef, private authService: AuthService,
    private navController: NavController, private toastController: ToastController) {
    addIcons({
      arrowForwardOutline,
      gridOutline,
      logOutOutline,
      peopleOutline,
      personCircleOutline,
      personAddOutline,
      restaurantOutline,
      wineOutline
    });
  }

  ngOnInit() {
    this.cargarPerfil();
  }

  async cerrarSesion(menu: IonPopover) {
    if (this.cerrandoSesion) return;
    this.cerrandoSesion = true;
    try {
      await this.authService.logout();
      await menu.dismiss();
      await this.navController.navigateRoot('/login', { replaceUrl: true });
    } catch (error) {
      console.error('No se pudo cerrar la sesión:', error);
      const toast = await this.toastController.create({
        message: 'No se pudo cerrar la sesión. Intentá nuevamente.',
        duration: 4000,
        position: 'bottom'
      });
      await toast.present();
    } finally {
      this.cerrandoSesion = false;
      this.cdr.markForCheck();
    }
  }

  private async cargarPerfil() {
    try {
      const usuario = await this.authService.obtenerUsuarioActual();

      if (!usuario) {
        return;
      }

      this.nombreUsuario = usuario.email || 'Usuario';
      this.fotoUsuario = usuario.user_metadata?.['foto_url'] || null;

      this.cdr.detectChanges();

      const perfil = await this.authService.obtenerPerfil();

      if (!perfil) {
        return;
      }

      const nombreCompleto = [perfil.nombres, perfil.apellidos]
        .filter(Boolean)
        .join(' ');

      this.nombreUsuario = nombreCompleto || perfil.email || this.nombreUsuario;
      this.fotoUsuario = perfil.foto_url || this.fotoUsuario;
      const rol = String(perfil.rol ?? '').trim().toUpperCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      this.puedeGestionarClientes = perfil.estado === 'ACTIVO' && ['DUENO', 'SUPERVISOR'].includes(rol);
      this.cdr.detectChanges();

    } catch (error) {
      console.error('No se pudo cargar el perfil del usuario:', error);
    }
  }

}
