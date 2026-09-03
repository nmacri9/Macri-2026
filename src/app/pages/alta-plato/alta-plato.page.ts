import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { IonContent, IonItem, IonInput, IonTextarea, IonButton, IonIcon, IonNote } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { cameraOutline, createOutline } from 'ionicons/icons';
import { Haptics, NotificationType } from '@capacitor/haptics';

interface FotoSlot {
  previewUrl: string | null;
}

@Component({
  selector: 'app-alta-plato',
  templateUrl: './alta-plato.page.html',
  styleUrls: ['./alta-plato.page.scss'],
  imports: [IonContent, IonItem, IonInput, IonTextarea, IonButton, IonIcon, IonNote, CommonModule, ReactiveFormsModule]
})
export class AltaPlatoPage {

  platoForm: FormGroup;

  fotos: FotoSlot[] = [
    { previewUrl: null },
    { previewUrl: null },
    { previewUrl: null }
  ];

  constructor(private fb: FormBuilder) {
    addIcons({ cameraOutline, createOutline });

    this.platoForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(30)]],
      descripcion: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(300)]],
      tiempoElaboracion: ['', [Validators.required, Validators.min(1), Validators.max(600), Validators.pattern(/^[0-9]+$/)]],
      precio: ['', [Validators.required, Validators.min(1), Validators.pattern(/^[0-9]+(\.[0-9]{1,2})?$/)]]
    });
  }

  seleccionarFoto(index: number) {
    console.log('Seleccionar foto en el slot', index);
  }

  async onSubmit() {
    if (this.platoForm.invalid) {
      this.platoForm.markAllAsTouched();
      await Haptics.notification({ type: NotificationType.Error });
      return;
    }

    // Acá va la lógica de Supabase en el próximo paso
    console.log('Formulario válido:', this.platoForm.value);
  }

  get nombre() { return this.platoForm.get('nombre')!; }
  get descripcion() { return this.platoForm.get('descripcion')!; }
  get tiempoElaboracion() { return this.platoForm.get('tiempoElaboracion')!; }
  get precio() { return this.platoForm.get('precio')!; }

}