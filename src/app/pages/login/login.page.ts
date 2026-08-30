import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonContent, IonItem, IonInput, IonButton, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { mailOutline, lockClosedOutline, personOutline, cafeOutline, shieldOutline } from 'ionicons/icons';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  imports: [IonContent, IonItem, IonInput, IonButton, IonIcon, CommonModule]
})
export class LoginPage {

  constructor() {
    addIcons({ mailOutline, lockClosedOutline, personOutline, cafeOutline, shieldOutline });
  }

}