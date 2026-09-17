import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { ProductosService } from '../../services/productos.service';
import { Producto } from '../../interfaces/producto';
import { CommonModule } from '@angular/common';
import { 
    IonContent, 
    IonItem, 
    IonInput, 
    IonButton,
    IonIcon,
    IonTextarea,
    ModalController
    } from '@ionic/angular';
    import { addIcons } from 'ionicons';
    import { cameraOutline, imagesOutline, wineOutline, documentTextOutline, timeOutline, cashOutline } from 'ionicons/icons';
    import { CepaSpinnerComponent } from '../../shared/components/cepa-spinner/cepa-spinner.component';
    import { CepaHeaderComponent } from '../../shared/components/cepa-header/cepa-header.component';
    import { ConfirmModalComponent } from '../../shared/confirm-modal/confirm-modal.component';

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
        CepaHeaderComponent
    ]
    })
    export class AltaBebidaPage implements OnInit {
    formBebida!: FormGroup;
    fotos: (File | null)[] = [null, null, null];
    previews: (string | null)[] = [null, null, null];
    cargando: boolean = false;
    mensajeError: string = '';
    mensajeExito: string = '';

    constructor(
        private cdr: ChangeDetectorRef,
        private fb: FormBuilder,
        private productosService: ProductosService,
        private modalCtrl: ModalController // 👈 3. Inyectar ModalController
    ) {
        addIcons({
        'camera-outline': cameraOutline,
        'images-outline': imagesOutline,
        'wine-outline': wineOutline,
        'document-text-outline': documentTextOutline,
        'time-outline': timeOutline,
        'cash-outline': cashOutline
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
            const file = new File([blob], `bebida_foto_${index + 1}.${image.format || 'jpg'}`, { type: `image/${image.format || 'jpeg'}` });

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

        // 1. Validaciones de formulario y fotos
        if (this.formBebida.invalid) {
        this.formBebida.markAllAsTouched();
        await this.notificarError('Por favor complete todos los campos requeridos con valores válidos.');
        return;
        }

        const fotosCompletas = this.fotos.filter(f => f !== null) as File[];
        if (fotosCompletas.length !== 3) {
        await this.notificarError('Debe ingresar obligatoriamente las 3 fotografías requeridas.');
        return;
        }

        // 2. Abrir Modal de Confirmación Global de tu compañero
        const modal = await this.modalCtrl.create({
        component: ConfirmModalComponent,
        componentProps: {
            mensaje: '¿Desea dar de alta esta nueva bebida en la carta?'
        },
        cssClass: 'modal-alerta'
        });

        await modal.present();

        // 3. Esperar la decisión del usuario (Confirmar = true, Cancelar = false)
        const { data: confirmado } = await modal.onDidDismiss();

        if (!confirmado) {
        return; // El usuario tocó Cancelar, no se guarda nada
        }

        // 4. Si confirmó, procedemos a guardar
        this.cargando = true;
        this.cdr.detectChanges();

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
        await Haptics.impact({ style: ImpactStyle.Heavy });
    }
}
