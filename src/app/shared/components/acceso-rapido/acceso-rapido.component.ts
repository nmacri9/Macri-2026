import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  IonButton, IonModal, IonHeader, IonToolbar, IonTitle, 
  IonContent, IonList, IonItem, IonAvatar, IonLabel, IonButtons, IonIcon 
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { flashOutline } from 'ionicons/icons';

@Component({
  selector: 'app-acceso-rapido',
  templateUrl: './acceso-rapido.component.html',
  styleUrls: ['./acceso-rapido.component.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    IonButton, IonModal, IonHeader, IonToolbar, IonTitle, 
    IonContent, IonList, IonItem, IonAvatar, IonLabel, IonButtons, IonIcon
  ]
})
export class AccesoRapidoComponent {
  @Output() perfilSeleccionado = new EventEmitter<any>();
  isModalOpen = false;

  perfiles = [
    { rol: 'Dueño', email: 'dueno@cepa.com', clave: '123456', foto: 'assets/perfiles/Dueño.png' },
    { rol: 'Supervisor', email: 'supervisor@cepa.com', clave: '123456', foto: 'assets/perfiles/Supervisor.png' },
    { rol: 'Metre', email: 'metre@cepa.com', clave: '123456', foto: 'assets/perfiles/Metre.png' },
    { rol: 'Mozo', email: 'mozo@cepa.com', clave: '123456', foto: 'assets/perfiles/mozo.png' },
    { rol: 'Cocinero', email: 'cocinero@cepa.com', clave: '123456', foto: 'assets/perfiles/cocinero.png' },
    { rol: 'Cantinero', email: 'cantinero@cepa.com', clave: '123456', foto: 'assets/perfiles/cantinero.png'},
    { rol: 'Cliente Registrado', email: 'cliente@cepa.com', clave: '123456', foto: 'assets/perfiles/cliente.png' },
    { rol: 'Anónimo', email: '', clave: '', foto: 'assets/perfiles/anonimo.png' }
  ];

  constructor() {
    addIcons({ flashOutline });
  }

  setOpen(isOpen: boolean) {
    this.isModalOpen = isOpen;
  }

  seleccionar(perfil: any) {
    this.perfilSeleccionado.emit(perfil);
    this.setOpen(false);
  }
}