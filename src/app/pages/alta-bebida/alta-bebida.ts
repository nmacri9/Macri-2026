import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { ProductosService } from '../../services/productos.service';
import { Producto } from '../../interfaces/producto';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { 
    IonHeader, 
    IonToolbar, 
    IonTitle, 
    IonContent, 
    IonItem, 
    IonLabel, 
    IonInput, 
    IonButton,
    IonSpinner,
    IonIcon,
    IonTextarea
} from '@ionic/angular'

@Component({
    selector: 'app-alta-bebida',
    templateUrl: './alta-bebida.html',
    styleUrls: ['./alta-bebida.scss'],
    standalone: true,
    imports: [
        CommonModule,         
        ReactiveFormsModule,  
        IonHeader,
        IonToolbar,
        IonTitle,
        IonContent,
        IonItem,
        IonLabel,
        IonInput,
        IonButton,
        IonSpinner,
        IonIcon, 
        IonTextarea
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
        private fb: FormBuilder,
        private productosService: ProductosService
        ) {}

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
                quality: 80,
                allowEditing: false,
                resultType: CameraResultType.Uri,
                source: fuente === 'camera' ? CameraSource.Camera : CameraSource.Photos
            });

            if (image.webPath) {
                const response = await fetch(image.webPath);
                const blob = await response.blob();
                const file = new File([blob], `bebida_foto_${index + 1}.jpg`, { type: 'image/jpeg' });

                this.fotos[index] = file;
                this.previews[index] = image.webPath;
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

            // Llamada al servicio con la nueva BD de São Paulo
            await this.productosService.crearProductoConImagenes(nuevaBebida, fotosCompletas);

            this.mensajeExito = '¡Bebida registrada con éxito en la carta!';
            
            // Resetear Formulario
            this.formBebida.reset();
            this.fotos = [null, null, null];
            this.previews = [null, null, null];

        } catch (err: any) {
            await this.notificarError(err.message || 'Ocurrió un error al guardar la bebida.');
        } finally {
            this.cargando = false;
        }
        }

        private async notificarError(mensaje: string) {
        this.mensajeError = mensaje;
        // Pauta Excluyente: Vibración en errores
        await Haptics.impact({ style: ImpactStyle.Heavy });
        }
    }