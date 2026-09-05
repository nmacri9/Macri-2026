import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
    IonHeader, 
    IonToolbar, 
    IonTitle, 
    IonButtons, 
    IonMenuButton 
} from '@ionic/angular';

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
    IonMenuButton
    ]
})
export class CepaHeaderComponent {
    @Input() titulo: string = 'CEPA';
}