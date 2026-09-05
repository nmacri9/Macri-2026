import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonInput,
  IonItem,
  IonNote,
  IonSelect,
  IonSelectOption
} from '@ionic/angular';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Haptics, NotificationType } from '@capacitor/haptics';
import { addIcons } from 'ionicons';
import { cameraOutline, closeOutline, gridOutline, peopleOutline, listOutline } from 'ionicons/icons';
import { SupabaseService } from '../../services/supabase.service';

type TipoMesa = 'VIP' | 'ESTANDAR' | 'MOVILIDAD_REDUCIDA';
type DisponibilidadMesa = 'VACIA' | 'OCUPADA' | 'RESERVADA';

interface Mesa {
  id?: number;
  numero: number;
  comensales: number;
  tipo: TipoMesa;
  disponibilidad: DisponibilidadMesa;
  foto: string;
}

@Component({
  selector: 'app-alta-mesa',
  templateUrl: './alta-mesa.page.html',
  styleUrls: ['./alta-mesa.page.scss'],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonButton,
    IonContent,
    IonIcon,
    IonInput,
    IonItem,
    IonNote,
    IonSelect,
    IonSelectOption
  ]
})
export class AltaMesaPage implements OnInit {
  mesaForm: FormGroup;
  mesas: Mesa[] = [];
  guardando = false;
  cargandoMesas = false;
  formEnviado = false;
  errorGeneral = '';
  fotoPreview: string | null = null;

  constructor(
    private fb: FormBuilder,
    private supabaseService: SupabaseService
  ) {
    addIcons({ cameraOutline, closeOutline, gridOutline, peopleOutline, listOutline });

    this.mesaForm = this.fb.group({
      numero: ['', [Validators.required, Validators.pattern(/^[0-9]+$/)]],
      comensales: ['', [Validators.required, Validators.pattern(/^[0-9]+$/)]],
      tipo: ['', Validators.required],
      disponibilidad: ['VACIA', Validators.required]
    });
  }

  ngOnInit() {
    this.cargarMesas();
  }

  async seleccionarFoto() {
    try {
      const imagen = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        promptLabelHeader: 'Foto de la mesa',
        promptLabelPicture: 'Tomar foto'
      });

      this.fotoPreview = imagen.dataUrl ?? null;
      this.errorGeneral = '';
    } catch (error) {
      console.log('Captura de foto cancelada o fallida:', error);
    }
  }

  quitarFoto(event: Event) {
    event.stopPropagation();
    this.fotoPreview = null;
  }

  async guardar() {
    this.formEnviado = true;
    this.errorGeneral = '';

    if (this.mesaForm.invalid || !this.fotoPreview) {
      this.mesaForm.markAllAsTouched();
      if (!this.fotoPreview) {
        this.errorGeneral = 'La foto de la mesa es obligatoria.';
      }
      await Haptics.notification({ type: NotificationType.Error });
      return;
    }

    const numero = Number(this.mesaForm.value.numero);
    const supabase = this.supabaseService.getClient();

    this.guardando = true;

    try {
      const { data: mesaExistente, error: errorBusqueda } = await supabase
        .from('Mesa')
        .select('id')
        .eq('numero_mesa', numero)
        .limit(1);

      if (errorBusqueda) throw errorBusqueda;

      if (mesaExistente && mesaExistente.length > 0) {
        this.errorGeneral = 'Ya existe una mesa con ese número.';
        await Haptics.notification({ type: NotificationType.Error });
        return;
      }

      const fotoFile = this.dataUrlAFile(this.fotoPreview, `mesa-${numero}.jpg`);
      const rutaFoto = `mesa/mesa-${numero}-${Date.now()}.jpg`;
      const { error: errorUpload } = await supabase.storage
        .from('productos')
        .upload(rutaFoto, fotoFile);

      if (errorUpload) throw errorUpload;

      const { data: fotoData } = supabase.storage
        .from('productos')
        .getPublicUrl(rutaFoto);

      const { data: mesaCreada, error: errorInsert } = await supabase
        .from('Mesa')
        .insert({
          numero_mesa: numero,
          tipo_mesa: this.mesaForm.value.tipo,
          capacidad: Number(this.mesaForm.value.comensales),
          foto_url: fotoData.publicUrl,
          disponibilidad: this.normalizarDisponibilidad(this.mesaForm.value.disponibilidad)
        })
        .select('id, numero_mesa, tipo_mesa, capacidad, foto_url, disponibilidad')
        .single();

      if (errorInsert) throw errorInsert;

      this.mesas = [
        ...this.mesas,
        this.mapearMesa(mesaCreada)
      ].sort((a, b) => a.numero - b.numero);

      await Haptics.notification({ type: NotificationType.Success });
      this.mesaForm.reset({ disponibilidad: 'VACIA' });
      this.fotoPreview = null;
      this.formEnviado = false;
    } catch (error) {
      console.error('Error al guardar la mesa:', error);
      this.errorGeneral = 'Ocurrió un error al guardar la mesa. Verificá la conexión e intentá de nuevo.';
      await Haptics.notification({ type: NotificationType.Error });
    } finally {
      this.guardando = false;
    }
  }

  async cargarMesas() {
    this.cargandoMesas = true;
    const supabase = this.supabaseService.getClient();

    try {
      const { data, error } = await supabase
        .from('Mesa')
        .select('id, numero_mesa, tipo_mesa, capacidad, foto_url, disponibilidad')
        .order('numero_mesa', { ascending: true });

      if (error) throw error;
      this.mesas = (data ?? []).map(mesa => this.mapearMesa(mesa));
    } catch (error) {
      console.error('Error al cargar las mesas:', error);
      this.errorGeneral = 'No se pudieron cargar las mesas registradas.';
    } finally {
      this.cargandoMesas = false;
    }
  }

  async cambiarDisponibilidad(mesa: Mesa, disponibilidad: DisponibilidadMesa) {
    if (!this.esDisponibilidadValida(disponibilidad) || mesa.id == null) {
      return;
    }

    const disponibilidadAnterior = mesa.disponibilidad;
    mesa.disponibilidad = disponibilidad;

    try {
      const { error } = await this.supabaseService.getClient()
        .from('Mesa')
        .update({ disponibilidad })
        .eq('id', mesa.id);

      if (error) throw error;

      await Haptics.notification({ type: NotificationType.Success });
    } catch (error) {
      console.error('Error al actualizar la disponibilidad:', error);
      mesa.disponibilidad = disponibilidadAnterior;
      this.errorGeneral = 'No se pudo actualizar la disponibilidad de la mesa.';
      await Haptics.notification({ type: NotificationType.Error });
    }
  }

  get numero() { return this.mesaForm.get('numero')!; }
  get comensales() { return this.mesaForm.get('comensales')!; }
  get tipo() { return this.mesaForm.get('tipo')!; }
  get disponibilidad() { return this.mesaForm.get('disponibilidad')!; }

  private mapearMesa(mesa: any): Mesa {
    return {
      id: mesa.id,
      numero: mesa.numero_mesa,
      comensales: mesa.capacidad ?? 0,
      tipo: mesa.tipo_mesa,
      disponibilidad: this.normalizarDisponibilidad(mesa.disponibilidad),
      foto: mesa.foto_url
    };
  }

  private esDisponibilidadValida(value: any): value is DisponibilidadMesa {
    return value === 'VACIA' || value === 'OCUPADA' || value === 'RESERVADA';
  }

  private normalizarDisponibilidad(value: any): DisponibilidadMesa {
    return this.esDisponibilidadValida(value) ? value : 'VACIA';
  }

  private dataUrlAFile(dataUrl: string, nombreArchivo: string): File {
    const partes = dataUrl.split(',');
    const mimeMatch = partes[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const binario = atob(partes[1]);
    const bytes = new Uint8Array(binario.length);

    for (let i = 0; i < binario.length; i++) {
      bytes[i] = binario.charCodeAt(i);
    }

    return new File([bytes], nombreArchivo, { type: mime });
  }
}
