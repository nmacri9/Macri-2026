import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
    IonHeader, 
    IonToolbar, 
    IonTitle, 
    IonButtons, 
    IonBackButton 
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { arrowBackOutline } from 'ionicons/icons';

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
        IonBackButton
    ]
    })
    export class CepaHeaderComponent {
    @Input() titulo: string = '';
    @Input() defaultHref: string = '/home';

    constructor() {
        addIcons({
        'arrow-back-outline': arrowBackOutline
        });
    }
}