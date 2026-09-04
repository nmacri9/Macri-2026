import { Component, Input } from '@angular/core'; 
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-cepa-spinner',
  templateUrl: './cepa-spinner.component.html',
  styleUrls: ['./cepa-spinner.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class CepaSpinnerComponent {
  
  
  @Input() texto: string = 'Cargando...';

  constructor() {}
}