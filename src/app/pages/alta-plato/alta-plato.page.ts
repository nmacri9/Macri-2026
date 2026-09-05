import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { ProductosService } from '../../services/productos.service';
import { Producto } from '../../interfaces/producto';
import {
  IonContent,
  IonItem,
  IonInput,
  IonButton,
  IonIcon,
  IonTextarea
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { cameraOutline, imagesOutline, restaurantOutline, documentTextOutline, timeOutline, cashOutline } from 'ionicons/icons';
import { CepaSpinnerComponent } from '../../shared/components/cepa-spinner/cepa-spinner.component';
import { CepaHeaderComponent } from '../../shared/components/cepa-header/cepa-header.component';

@Component({
  selector: 'app-alta-plato',
  templateUrl: './alta-plato.page.html',
  styleUrls: ['./alta-plato.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonContent,
    IonItem,
    IonInput,
    IonTextarea,
    IonButton,
    IonIcon,
    CepaSpinnerComponent,
    CepaHeaderComponent
  ]
})
export class AltaPlatoPage implements OnInit {
  platoForm!: FormGroup;

  fotos: (File | null)[] = [null, null, null];
  previews: (string | null)[] = [null, null, null];
  cargando: boolean = false;
  mensajeError: string = '';
  mensajeExito: string = '';

  constructor(
    private fb: FormBuilder,
    private productosService: ProductosService,
    private cdr: ChangeDetectorRef
  ) {
    addIcons({
      'camera-outline': cameraOutline,
      'images-outline': imagesOutline,
      'restaurant-outline': restaurantOutline,
      'document-text-outline': documentTextOutline,
      'time-outline': timeOutline,
      'cash-outline': cashOutline
    });
  }

  ngOnInit() {
    this.platoForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(2)]],
      descripcion: ['', [Validators.required, Validators.minLength(5)]],
      tiempo_elaboracion: ['', [Validators.required, Validators.min(1)]],
      precio: ['', [Validators.required, Validators.min(1)]]
    });
  }

  async seleccionarFoto(index: number, fuente: 'camera' | 'photos') {
    try {
      const image = await Camera.getPhoto({
        quality: 60,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source: fuente === 'camera' ? CameraSource.Camera : CameraSource.Photos
      });

      if (image.base64String) {
        const byteCharacters = atob(image.base64String);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: `image/${image.format || 'jpeg'}` });
        const file = new File([blob], `plato_foto_${index + 1}.${image.format || 'jpg'}`, { type: `image/${image.format || 'jpeg'}` });

        this.fotos[index] = file;
        this.previews[index] = `data:image/${image.format || 'jpeg'};base64,${image.base64String}`;
        this.cdr.detectChanges();
      }
    } catch (error) {
      console.log('Selección cancelada o fallo cámara', error);
    }
  }

  async guardar() {
    this.mensajeError = '';
    this.mensajeExito = '';

    if (this.platoForm.invalid) {
      this.platoForm.markAllAsTouched();
      await this.notificarError('Por favor complete todos los campos requeridos con valores válidos.');
      return;
    }

    const fotosCompletas = this.fotos.filter(f => f !== null) as File[];
    if (fotosCompletas.length !== 3) {
      await this.notificarError('Debe ingresar obligatoriamente las 3 fotografías requeridas.');
      return;
    }

    this.cargando = true;
    this.cdr.detectChanges();

    try {
      const nuevoPlato: Producto = {
        nombre: this.platoForm.value.nombre,
        descripcion: this.platoForm.value.descripcion,
        tipo: 'PLATO',
        precio: Number(this.platoForm.value.precio),
        tiempo_elaboracion: Number(this.platoForm.value.tiempo_elaboracion),
        activo: true
      };

      await this.productosService.crearProductoConImagenes(nuevoPlato, fotosCompletas);

      this.mensajeExito = '¡Plato registrado con éxito en el menú!';

      this.platoForm.reset();
      this.fotos = [null, null, null];
      this.previews = [null, null, null];

    } catch (err: any) {
      await this.notificarError(err.message || 'Ocurrió un error al guardar el plato.');
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  private async notificarError(mensaje: string) {
    this.mensajeError = mensaje;
    await Haptics.impact({ style: ImpactStyle.Heavy });
  }
}