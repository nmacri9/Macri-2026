import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalController, IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonIcon, IonButtons, IonBackButton } from '@ionic/angular';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { addIcons } from 'ionicons';
import { checkmarkCircleOutline, closeCircleOutline, personCircleOutline, refreshOutline } from 'ionicons/icons';
import { ConfirmModalComponent } from '../../shared/confirm-modal/confirm-modal.component';
import { CepaSpinnerComponent } from '../../shared/components/cepa-spinner/cepa-spinner.component';
import { ClientePendiente, ClientesService, ResolucionCliente } from '../../services/clientes.service';

@Component({
  selector: 'app-clientes-pendientes',
  templateUrl: './clientes-pendientes.page.html',
  styleUrls: ['./clientes-pendientes.page.scss'],
  standalone: true,
  imports: [CommonModule, IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonIcon,
    IonButtons, IonBackButton, CepaSpinnerComponent]
})
export class ClientesPendientesPage {
  cargando = false;
  procesandoId: number | null = null;
  errorMensaje = '';
  mensajeExito = '';
  clientesPendientes: ClientePendiente[] = [];

  constructor(
    private cdr: ChangeDetectorRef,
    private modalCtrl: ModalController,
    private clientesService: ClientesService
  ) {
    addIcons({ checkmarkCircleOutline, closeCircleOutline, personCircleOutline, refreshOutline });
  }

  ionViewWillEnter() {
    return this.cargarClientes();
  }

  async cargarClientes() {
    if (this.cargando || this.procesandoId !== null) return;
    this.cargando = true;
    this.errorMensaje = '';
    this.mensajeExito = '';
    this.cdr.markForCheck();
    try {
      this.clientesPendientes = await this.clientesService.listarPendientes();
    } catch {
      this.errorMensaje = 'No se pudieron cargar los clientes pendientes. Intentá actualizar la lista.';
    } finally {
      this.cargando = false;
      this.cdr.markForCheck();
    }
  }

  async pedirConfirmacion(mensaje: string): Promise<boolean> {
    const modal = await this.modalCtrl.create({
      component: ConfirmModalComponent,
      componentProps: { mensaje },
      cssClass: 'modal-alerta'
    });
    await modal.present();
    const { data } = await modal.onDidDismiss();
    return data === true;
  }

  aceptarCliente(id: number, nombre: string) {
    return this.resolverCliente(id, nombre, 'APROBADO');
  }

  rechazarCliente(id: number, nombre: string) {
    return this.resolverCliente(id, nombre, 'RECHAZADO');
  }

  private async resolverCliente(id: number, nombre: string, estado: ResolucionCliente) {
    if (this.cargando || this.procesandoId !== null) return;
    this.procesandoId = id;
    this.errorMensaje = '';
    this.mensajeExito = '';
    this.cdr.markForCheck();
    try {
      const accion = estado === 'APROBADO' ? 'aprobar' : 'rechazar';
      if (!await this.pedirConfirmacion(`¿Querés ${accion} la solicitud de ${nombre}?`)) return;
      await this.clientesService.resolver(id, estado);
      this.clientesPendientes = this.clientesPendientes.filter(cliente => cliente.id !== id);
      this.mensajeExito = estado === 'APROBADO' ? 'Cliente aprobado.' : 'Cliente rechazado.';
      // Un fallo de vibración no debe presentarse como un fallo de guardado.
      await Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
    } catch {
      this.errorMensaje = 'No se pudo actualizar la solicitud. Actualizá la lista: puede haber sido resuelta por otra persona o tu sesión puede haber vencido.';
    } finally {
      this.procesandoId = null;
      this.cdr.markForCheck();
    }
  }
}
