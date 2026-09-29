import { Component, Input, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
    IonHeader, IonToolbar, IonTitle, IonButtons, 
    IonBackButton, IonIcon, IonPopover 
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { arrowBackOutline, personCircleOutline, logOutOutline } from 'ionicons/icons';
import { AuthService } from '../../../services/auth.service';
import { Router } from '@angular/router';

@Component({
    selector: 'app-cepa-header',
    templateUrl: './cepa-header.component.html',
    styleUrls: ['./cepa-header.component.scss'],
    standalone: true,
    imports: [
    CommonModule, IonHeader, IonToolbar, IonTitle, 
    IonButtons, IonBackButton, IonIcon, IonPopover
    ]
})
export class CepaHeaderComponent implements OnInit {
    @Input() titulo: string = 'Cepa';
    @Input() defaultHref: string = '/home';
    @Input() mostrarVolver: boolean = true;

    nombreUsuario: string = '';
    rolUsuario: string = '';
    fotoUsuario: string | null = null;
    cerrandoSesion = false;

    constructor(
        private authService: AuthService,
        private router: Router,
        private cdr: ChangeDetectorRef
    ) {
        addIcons({ arrowBackOutline, personCircleOutline, logOutOutline });
    }

    ngOnInit() {
        this.cargarUsuario();
    }

    // Se ejecuta cada vez que la página que contiene el header se vuelve activa
    async cargarUsuario() {
        try {
        const perfil = await this.authService.obtenerPerfil();
        if (perfil) {
            const nombreCompleto = [perfil.nombres, perfil.apellidos].filter(Boolean).join(' ');
            this.nombreUsuario = nombreCompleto || perfil.email || 'Usuario';
            
            const rolRaw = String(perfil.rol ?? '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            this.rolUsuario = rolRaw.replace('_', ' ');

            // 1. Asignar foto de base de datos o metadata
            this.fotoUsuario = perfil.foto_url || null;

            // 2. Si no tiene foto subida, usar el mismo Fallback local del Home
            if (!this.fotoUsuario) {
            const fotosPorDefecto: Record<string, string> = {
                'DUENO': 'assets/perfiles/Dueño.png',
                'SUPERVISOR': 'assets/perfiles/Supervisor.png',
                'METRE': 'assets/perfiles/Metre.png',
                'MOZO': 'assets/perfiles/mozo.png',
                'COCINERO': 'assets/perfiles/cocinero.png',
                'CANTINERO': 'assets/perfiles/cantinero.png',
                'CLIENTE_REGISTRADO': 'assets/perfiles/cliente.png',
                'CLIENTE_ANONIMO': 'assets/perfiles/anonimo.png'
            };
            this.fotoUsuario = fotosPorDefecto[rolRaw] || null;
            }
        }
        } catch (e) {
        console.error('Error cargando datos de usuario en header:', e);
        } finally {
        this.cdr.detectChanges();
        }
    }

    async cerrarSesion(popover: any) {
        this.cerrandoSesion = true;
        try {
        await popover.dismiss();
        await this.authService.logout();
        this.router.navigate(['/login'], { replaceUrl: true });
        } finally {
        this.cerrandoSesion = false;
        }
    }
}