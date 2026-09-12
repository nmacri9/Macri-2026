import { Component, Input } from '@angular/core';
import { ModalController, IonButton } from '@ionic/angular';

@Component({
  selector: 'app-confirm-modal',
  templateUrl: './confirm-modal.component.html',
  styleUrls: ['./confirm-modal.component.scss'], 
  standalone: true,
  imports: [IonButton] 
})
export class ConfirmModalComponent {
  @Input() mensaje: string = '¿Desea confirmar?';

  constructor(private modalCtrl: ModalController) {}

  responder(confirmado: boolean) {
    this.modalCtrl.dismiss(confirmado);
  }
}