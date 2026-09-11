import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalController, IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonIcon } from '@ionic/angular';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { addIcons } from 'ionicons';
import { checkmarkCircleOutline, closeCircleOutline } from 'ionicons/icons';
import { ConfirmModalComponent } from '../../shared/confirm-modal/confirm-modal.component'; 
import { CepaSpinnerComponent } from '../../shared/components/cepa-spinner/cepa-spinner.component';

@Component({
  selector: 'app-clientes-pendientes',
  templateUrl: './clientes-pendientes.page.html',
  styleUrls: ['./clientes-pendientes.page.scss'],
  standalone: true,
  imports: [
    CommonModule, 
    IonHeader, 
    IonToolbar, 
    IonTitle, 
    IonContent, 
    IonButton, 
    IonIcon, 
    CepaSpinnerComponent
  ]
})
export class ClientesPendientesPage implements OnInit {
  cargando = false;
  
  clientesPendientes = [
    { id: '1', nombres: 'Juan Carlos', apellidos: 'Pérez', foto: 'https://i.pravatar.cc/150?u=juan' },
    { id: '2', nombres: 'María Laura', apellidos: 'Gómez', foto: 'https://i.pravatar.cc/150?u=maria' },
    { id: '3', nombres: 'Carlos Alberto', apellidos: 'Rodríguez', foto: 'https://i.pravatar.cc/150?u=carlos' },
    { id: '4', nombres: 'Ana', apellidos: 'Martínez', foto: 'https://i.pravatar.cc/150?u=ana' }
  ];

  constructor(
    private cdr: ChangeDetectorRef,
    private modalCtrl: ModalController // 3. Lo inyectamos en el constructor
  ) {
    addIcons({ checkmarkCircleOutline, closeCircleOutline });
  }

  ngOnInit() {
    // Acá el Integrante 4 tiene que llamar a su función para traer datos
  }

  // --- FUNCIÓN INTERMEDIA PARA EL MODAL ---
  async pedirConfirmacion(mensaje: string): Promise<boolean> {
    const modal = await this.modalCtrl.create({
      component: ConfirmModalComponent,
      componentProps: { mensaje },
      cssClass: 'modal-confirmacion' 
    });

    await modal.present();

    
    const { data } = await modal.onWillDismiss(); 
    return data === true;
  }

  // --- ACCIONES ACTUALIZADAS ---
  async aceptarCliente(id: string, nombre: string) {
    // 4. Pausamos la ejecución hasta que el usuario decida
    const confirmado = await this.pedirConfirmacion(`¿Desea ACEPTAR al cliente ${nombre}?`);
    
    if (!confirmado) return; // Si tocó cancelar, cortamos acá

    this.cargando = true;
    this.cdr.detectChanges();

    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await Haptics.impact({ style: ImpactStyle.Light });
      this.removerClienteDeLista(id);
    } catch (error) {
      await Haptics.impact({ style: ImpactStyle.Heavy });
      console.error('Error al aceptar:', error);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  async rechazarCliente(id: string, nombre: string) {
    const confirmado = await this.pedirConfirmacion(`¿Está seguro que desea RECHAZAR a ${nombre}?`);
    
    if (!confirmado) return;

    this.cargando = true;
    this.cdr.detectChanges();

    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await Haptics.impact({ style: ImpactStyle.Medium });
      this.removerClienteDeLista(id);
    } catch (error) {
      await Haptics.impact({ style: ImpactStyle.Heavy }); 
      console.error('Error al rechazar:', error);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  private removerClienteDeLista(id: string) {
    this.clientesPendientes = this.clientesPendientes.filter(c => c.id !== id);
  }
}
