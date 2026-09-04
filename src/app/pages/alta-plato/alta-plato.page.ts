import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { IonContent, IonItem, IonInput, IonTextarea, IonButton, IonIcon, IonNote } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { cameraOutline, closeOutline } from 'ionicons/icons';
import { Haptics, NotificationType } from '@capacitor/haptics';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { SupabaseService } from '../../services/supabase.service';
import { Router } from '@angular/router';

interface FotoSlot {
  previewUrl: string | null;
  file: File | null;
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
    { previewUrl: null, file: null },
    { previewUrl: null, file: null },
    { previewUrl: null, file: null }
  ];

  guardando = false;
  errorGeneral: string | null = null;

  constructor(
    private fb: FormBuilder,
    private supabaseService: SupabaseService,
    private router: Router
  ) {
    addIcons({ cameraOutline, closeOutline });

    this.platoForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(30)]],
      descripcion: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(300)]],
      tiempoElaboracion: ['', [Validators.required, Validators.min(1), Validators.max(600), Validators.pattern(/^[0-9]+$/)]],
      precio: ['', [Validators.required, Validators.min(1), Validators.pattern(/^[0-9]+(\.[0-9]{1,2})?$/)]]
    });
  }

  async seleccionarFoto(index: number) {
    try {
      const imagen = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt,
        promptLabelHeader: 'Foto del plato',
        promptLabelPhoto: 'Elegir de galería',
        promptLabelPicture: 'Tomar foto'
      });

      if (imagen.dataUrl) {
        const file = this.dataUrlAFile(imagen.dataUrl, `foto-plato-${index}.jpg`);
        this.fotos[index] = { previewUrl: imagen.dataUrl, file };
      }
    } catch (error) {
      console.log('Selección de foto cancelada o error:', error);
    }
  }

  quitarFoto(index: number, event: Event) {
    event.stopPropagation();
    this.fotos[index] = { previewUrl: null, file: null };
  }

  private dataUrlAFile(dataUrl: string, nombreArchivo: string): File {
    const partes = dataUrl.split(',');
    const mimeMatch = partes[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const binario = atob(partes[1]);
    let n = binario.length;
    const bytes = new Uint8Array(n);
    while (n--) {
      bytes[n] = binario.charCodeAt(n);
    }
    return new File([bytes], nombreArchivo, { type: mime });
  }

  async onSubmit() {
    this.errorGeneral = null;

    if (this.platoForm.invalid) {
      this.platoForm.markAllAsTouched();
      await Haptics.notification({ type: NotificationType.Error });
      return;
    }

    const fotosCompletas = this.fotos.every(f => f.file !== null);
    if (!fotosCompletas) {
      this.errorGeneral = 'Debés cargar las 3 fotos del plato.';
      await Haptics.notification({ type: NotificationType.Error });
      return;
    }

    this.guardando = true;
    const supabase = this.supabaseService.getClient();

    try {
      const nombreValor = this.nombre.value.trim();

      // 1. Verificar que no exista ya un plato con ese nombre
      const { data: existente, error: errorBusqueda } = await supabase
        .from('productos')
        .select('id')
        .eq('nombre', nombreValor)
        .eq('tipo', 'PLATO')
        .maybeSingle();

      if (errorBusqueda) throw errorBusqueda;

      if (existente) {
        this.errorGeneral = 'Ya existe un plato con ese nombre en el menú.';
        await Haptics.notification({ type: NotificationType.Error });
        this.guardando = false;
        return;
      }

      // 2. Subir las 3 fotos y juntar sus URLs públicas
      const urls: string[] = [];
      for (let i = 0; i < this.fotos.length; i++) {
        const file = this.fotos[i].file!;
        const path = `plato/${nombreValor.replace(/\s+/g, '-')}-${i + 1}-${Date.now()}.jpg`;

        const { error: errorUpload } = await supabase.storage
          .from('productos')
          .upload(path, file);

        if (errorUpload) throw errorUpload;

        const { data: urlData } = supabase.storage
          .from('productos')
          .getPublicUrl(path);

        urls.push(urlData.publicUrl);
      }

      // 3. Insertar el producto con el array de imágenes ya incluido
      const { error: errorInsert } = await supabase
        .from('productos')
        .insert({
          nombre: nombreValor,
          descripcion: this.descripcion.value.trim(),
          tipo: 'PLATO',
          precio: parseFloat(this.precio.value),
          tiempo_elaboracion: parseInt(this.tiempoElaboracion.value, 10),
          imagenes: urls
        });

      if (errorInsert) throw errorInsert;

      await Haptics.notification({ type: NotificationType.Success });
      this.router.navigate(['/home']);

    } catch (error: any) {
      console.error('Error al guardar el plato:', error);
      this.errorGeneral = 'Ocurrió un error al guardar el plato. Intentá de nuevo.';
      await Haptics.notification({ type: NotificationType.Error });
    } finally {
      this.guardando = false;
    }
  }

  get nombre() { return this.platoForm.get('nombre')!; }
  get descripcion() { return this.platoForm.get('descripcion')!; }
  get tiempoElaboracion() { return this.platoForm.get('tiempoElaboracion')!; }
  get precio() { return this.platoForm.get('precio')!; }

}