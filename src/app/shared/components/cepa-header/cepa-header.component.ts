import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
    IonHeader, 
    IonToolbar, 
    IonTitle, 
    IonButtons, 
    IonMenuButton, 
    IonIcon,
    IonButton
} from '@ionic/angular';
import { AuthService } from '../../../services/auth.service';
import { addIcons } from 'ionicons';
import { menuOutline, logOutOutline } from 'ionicons/icons';
import { Router } from '@angular/router';

@Component({
    selector: 'app-cepa-header',
    templateUrl: './cepa-header.component.html',
    styleUrls: ['./cepa-header.component.scss'],
    standalone: true,
    imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonMenuButton,
    IonIcon,
    IonButton
]
})
export class CepaHeaderComponent {
    @Input() titulo: string = 'CEPA';

        constructor(
        private authService: AuthService,
        private router: Router
    ) {
        addIcons({ 
        'menu-outline': menuOutline,
        'log-out-outline': logOutOutline 
        });
    }

    async cerrarSesion() {
        try {
        // Llamada al método de tu AuthService
        await this.authService.logout(); 
        // Redirección a la pantalla de login
        this.router.navigateByUrl('/login', { replaceUrl: true });
        } catch (error) {
        console.error('Error al cerrar sesión:', error);
        }
    }
}
