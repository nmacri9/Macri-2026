import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { ProductosService } from '../../services/productos.service';
import { Producto } from '../../interfaces/producto';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { 
    IonContent, 
    IonItem, 
    IonInput, 
    IonButton,
    IonIcon,
    IonTextarea,
} from '@ionic/angular'
import { addIcons } from 'ionicons';
import { cameraOutline, imagesOutline, wineOutline, documentTextOutline, timeOutline, cashOutline, beerOutline } from 'ionicons/icons';
import { CepaSpinnerComponent } from '../../shared/components/cepa-spinner/cepa-spinner.component'; // Ajustá la ruta según la estructura exacta de tu proyecto
import { CepaHeaderComponent } from '../../shared/components/cepa-header/cepa-header.component';

@Component({
    selector: 'app-alta-bebida',
    templateUrl: './alta-bebida.html',
    styleUrls: ['./alta-bebida.scss'],
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
    CepaHeaderComponent,
    ]
})
    export class AltaBebidaPage implements OnInit {
        formBebida!: FormGroup;
        // Guardamos 3 espacios para fotos
        fotos: (File | null)[] = [null, null, null];
        previews: (string | null)[] = [null, null, null];
        cargando: boolean = false;
        mensajeError: string = '';
        mensajeExito: string = '';

        constructor(
        private cdr: ChangeDetectorRef,
        private fb: FormBuilder,
        private productosService: ProductosService
        ) {
        addIcons({
        'camera-outline': cameraOutline,
        'images-outline': imagesOutline,
        'wine-outline': wineOutline,
        'document-text-outline': documentTextOutline,
        'time-outline': timeOutline,
        'cash-outline': cashOutline,
        'beer-outline': beerOutline
        });
    }

        ngOnInit() {
        this.formBebida = this.fb.group({
            nombre: ['', [Validators.required, Validators.minLength(2)]],
            descripcion: ['', [Validators.required, Validators.minLength(5)]],
            tiempo_elaboracion: ['', [Validators.required, Validators.min(1)]],
            precio: ['', [Validators.required, Validators.min(1)]]
        });
        }

        // Capturar o elegir imagen para un contenedor específico (0, 1 o 2)
        async seleccionarFoto(index: number, fuente: 'camera' | 'photos') {
        try {
            const image = await Camera.getPhoto({
            quality: 60,
            allowEditing: false,
            resultType: CameraResultType.Base64, // <-- Cambiamos a Base64
            source: fuente === 'camera' ? CameraSource.Camera : CameraSource.Photos
            });

            if (image.base64String) {
            // Convertir Base64 a File directamente (100% compatible Web y Mobile)
            const byteCharacters = atob(image.base64String);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: `image/${image.format || 'jpeg'}` });
            const file = new File([blob], `bebida_foto_${index + 1}.${image.format || 'jpg'}`, { type: `image/${image.format || 'jpeg'}` });

            this.fotos[index] = file;
            this.previews[index] = `data:image/${image.format || 'jpeg'};base64,${image.base64String}`;
            }
        } catch (error) {
            console.log('Selección cancelada o fallo cámara', error);
        }
        }

        async guardar() {
        this.mensajeError = '';
        this.mensajeExito = '';

        // Validar Formulario
        if (this.formBebida.invalid) {
            this.formBebida.markAllAsTouched();
            await this.notificarError('Por favor complete todos los campos requeridos con valores válidos.');
            return;
        }

        // Validar exactamente 3 fotos cargadas (Punto 3 Excluyente)
        const fotosCompletas = this.fotos.filter(f => f !== null) as File[];
        if (fotosCompletas.length !== 3) {
            await this.notificarError('Debe ingresar obligatoriamente las 3 fotografías requeridas.');
            return;
        }

        this.cargando = true;

        try {
            const nuevaBebida: Producto = {
                nombre: this.formBebida.value.nombre,
                descripcion: this.formBebida.value.descripcion,
                tipo: 'BEBIDA',
                precio: Number(this.formBebida.value.precio),
                tiempo_elaboracion: Number(this.formBebida.value.tiempo_elaboracion),
                activo: true
            };

            
            await this.productosService.crearProductoConImagenes(nuevaBebida, fotosCompletas);

            this.mensajeExito = '¡Bebida registrada con éxito en la carta!';
            
            // Resetear Formulario
            this.formBebida.reset();
            this.formBebida.markAsPristine();
            this.formBebida.markAsUntouched();

            this.fotos = [null, null, null];
            this.previews = [null, null, null];

        } catch (err: any) {
            await this.notificarError(err.message || 'Ocurrió un error al guardar la bebida.');
        } finally {
            this.cargando = false;
            this.cdr.detectChanges();
        }
        }

        private async notificarError(mensaje: string) {
        this.mensajeError = mensaje;
        // Pauta Excluyente: Vibración en errores
        await Haptics.impact({ style: ImpactStyle.Heavy });
        }
    }