import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IonContent, IonItem, IonInput, IonButton, IonIcon, IonSelect, IonSelectOption } from '@ionic/angular';
import { cameraOutline, qrCodeOutline } from 'ionicons/icons';
import { addIcons } from 'ionicons';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';

@Component({
  selector: 'app-registro-empleado',
  templateUrl: './registro-empleado.page.html',
  styleUrls: ['./registro-empleado.page.scss'],
  standalone: true,
  imports: [IonContent, IonItem, IonInput, IonButton, IonIcon, IonSelect, IonSelectOption, CommonModule, ReactiveFormsModule]
})
export class RegistroEmpleadoPage implements OnInit {
  registroForm!: FormGroup;
  fotoPreview: string | undefined;
  formEnviado = false;

  constructor(private fb: FormBuilder, private cdr: ChangeDetectorRef) {
    addIcons({ cameraOutline, qrCodeOutline });
  }

  ngOnInit() {
    this.registroForm = this.fb.group({
      nombres: ['', [Validators.required, Validators.pattern(/^[a-zA-ZÁÉÍÓÚáéíóúÑñ\s]+$/)]],
      apellidos: ['', [Validators.required, Validators.pattern(/^[a-zA-ZÁÉÍÓÚáéíóúÑñ\s]+$/)]],
      dni: ['', [Validators.required, Validators.pattern(/^[0-9]{7,8}$/)]],
      cuil: ['', [Validators.required, Validators.pattern(/^[0-9]{10,11}$/)]],
      email: ['', [Validators.required, Validators.email]],
      clave: ['', [Validators.required, Validators.minLength(6)]],
      perfil: ['', [Validators.required]],
      foto: ['', [Validators.required]] 
    });
  }

  async escanearDNI() {
    try {
      await BarcodeScanner.requestPermissions();
      const result = await BarcodeScanner.scan();
      
      const rawData = result.barcodes[0].rawValue;
      if (!rawData) throw new Error('No se pudo leer el código');

      const partes = rawData.split('@');
      
      if (partes.length >= 5) {
        this.registroForm.patchValue({
          apellidos: partes[1].charAt(0) + partes[1].slice(1).toLowerCase(),
          nombres: partes[2].charAt(0) + partes[2].slice(1).toLowerCase(),
          dni: partes[4]
        });
        this.cdr.detectChanges();
      } else {
        throw new Error('Formato de DNI inválido');
      }
    } catch (error) {
      await Haptics.impact({ style: ImpactStyle.Heavy });
      console.error('Error escaner DNI:', error);
    }
  }

  async tomarFoto() {
    try {
      const image = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        // CUMPLE EXIGENCIA: Solo cámara, bloquea la galería de fotos
        source: CameraSource.Camera 
      });

      this.fotoPreview = image.dataUrl;
      this.registroForm.patchValue({ foto: this.fotoPreview });
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error cámara:', error);
    }
  }

  async registrar() {
    this.formEnviado = true;

    if (this.registroForm.invalid) {
      await Haptics.impact({ style: ImpactStyle.Heavy });
      return;
    }

    console.log('Datos listos para enviar a Supabase:', this.registroForm.value);
  }
}