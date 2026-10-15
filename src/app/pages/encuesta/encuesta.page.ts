import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  IonContent, IonButton, IonIcon, IonRange, IonRadioGroup, IonRadio,
  IonSelect, IonSelectOption, IonCheckbox, IonToggle, IonTextarea,
  ToastController, ModalController
} from '@ionic/angular';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { addIcons } from 'ionicons';
import {
  starOutline, happyOutline, timeOutline, sparklesOutline,
  chatboxEllipsesOutline, checkmarkCircleOutline, barChartOutline, lockClosedOutline
} from 'ionicons/icons';

import { SupabaseService } from '../../services/supabase.service';
import { AuthService } from '../../services/auth.service';
import { CepaHeaderComponent } from '../../shared/components/cepa-header/cepa-header.component';
import { CepaSpinnerComponent } from '../../shared/components/cepa-spinner/cepa-spinner.component';
import { ConfirmModalComponent } from '../../shared/confirm-modal/confirm-modal.component';

@Component({
  selector: 'app-encuesta',
  templateUrl: './encuesta.page.html',
  styleUrls: ['./encuesta.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink,
    IonContent, IonButton, IonIcon, IonRange, IonRadioGroup, IonRadio,
    IonSelect, IonSelectOption, IonCheckbox, IonToggle, IonTextarea,
    CepaHeaderComponent, CepaSpinnerComponent
  ]
})
export class EncuestaPage implements OnInit {
  cargando = true;
  textoSpinner = 'Verificando estadía...';

  usuarioId: string | null = null;
  pedidoActivoId: string | null = null;
  yaRespondio = false;
  sinPedidoRecibido = false;

  // cinco Controles distintos
  // 1. Range (1 a 10)
  calidadComida: number = 8;
  // 2. Radio Group
  atencionMozo: string = '';
  // 3. Select
  tiempoEspera: string = '';
  // 4. Checkboxes multiples
  aspectos = [
    { nombre: 'Sabor', seleccionado: false },
    { nombre: 'Limpieza', seleccionado: false },
    { nombre: 'Ambiente', seleccionado: false },
    { nombre: 'Precios', seleccionado: false }
  ];
  // 5. Toggle + Textarea
  recomendaria: boolean = true;
  comentario: string = '';

  constructor(
    private supabase: SupabaseService,
    private authService: AuthService,
    private toastCtrl: ToastController,
    private modalCtrl: ModalController,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    addIcons({
      starOutline, happyOutline, timeOutline, sparklesOutline,
      chatboxEllipsesOutline, checkmarkCircleOutline, barChartOutline, lockClosedOutline
    });
  }

  async ngOnInit() {
    await this.verificarEstadoEncuesta();
  }

  async verificarEstadoEncuesta() {
    this.cargando = true;
    this.cdr.detectChanges();

    try {
      const user = await this.authService.obtenerUsuarioActual();
      if (!user) throw new Error('Sesión no encontrada');
      this.usuarioId = user.id;

      //  busco el ultimo pedido de la estadia actual del cliente
      const { data: pedido, error: errPedido } = await this.supabase.getClient()
        .from('pedidos')
        .select('id, estado')
        .eq('cliente_id', this.usuarioId)
        .in('estado', ['recibido', 'entregado', 'cuenta_solicitada'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (errPedido) throw errPedido;

      if (!pedido) {
        this.sinPedidoRecibido = true;
        return;
      }

      this.pedidoActivoId = pedido.id;

      // verifico si ya completo la encuesta en esta estadía (1 por pedido_id)
      const { data: encuestaExistente, error: errEncuesta } = await this.supabase.getClient()
        .from('encuestas')
        .select('id')
        .eq('pedido_id', this.pedidoActivoId)
        .maybeSingle();

      if (errEncuesta) throw errEncuesta;

      this.yaRespondio = !!encuestaExistente;
    } catch (error) {
      console.error('Error verificando encuesta:', error);
      await this.mostrarError('No pudimos verificar el estado de tu encuesta.');
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  async validarYConfirmar() {
    const aspectosElegidos = this.aspectos.filter(a => a.seleccionado).map(a => a.nombre);

    if (!this.atencionMozo) {
      return this.mostrarError('Seleccioná cómo fue la atención del mozo.');
    }
    if (!this.tiempoEspera) {
      return this.mostrarError('Seleccioná qué te pareció el tiempo de espera.');
    }
    if (aspectosElegidos.length === 0) {
      return this.mostrarError('Marcá al menos un aspecto destacado del local.');
    }
    if (!this.comentario || this.comentario.trim().length < 5) {
      return this.mostrarError('Escribí un breve comentario (mínimo 5 caracteres).');
    }

    const modal = await this.modalCtrl.create({
      component: ConfirmModalComponent,
      componentProps: {
        mensaje: '¿Confirmás el envío de tu encuesta? Solo podés enviarla una vez por estadía.'
      },
      cssClass: 'modal-transparente'
    });

    await modal.present();
    const { data } = await modal.onDidDismiss();

    if (data === true) {
      await this.enviarEncuesta(aspectosElegidos);
    }
  }

  async enviarEncuesta(aspectosElegidos: string[]) {
    this.textoSpinner = 'Guardando tu opinión...';
    this.cargando = true;
    this.cdr.detectChanges();

    try {
      const { error } = await this.supabase.getClient()
        .from('encuestas')
        .insert({
          pedido_id: this.pedidoActivoId,
          cliente_id: this.usuarioId,
          calidad_comida: this.calidadComida,
          atencion_mozo: this.atencionMozo,
          tiempo_espera: this.tiempoEspera,
          aspectos_destacados: aspectosElegidos,
          recomendaria: this.recomendaria,
          comentario: this.comentario.trim()
        });

      if (error) {
        if (error.code === '23505') {
          this.yaRespondio = true;
          throw new Error('Ya registraste una encuesta en esta estadía.');
        }
        throw error;
      }

      const toast = await this.toastCtrl.create({
        message: '¡Muchas gracias por tu opinión!',
        duration: 3000,
        color: 'success',
        position: 'bottom'
      });
      await toast.present();

      this.yaRespondio = true;
      this.router.navigate(['/graficos-encuestas']);
    } catch (error: any) {
      console.error('Error al guardar encuesta:', error);
      await this.mostrarError(error.message || 'No se pudo guardar la encuesta.');
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  private async mostrarError(mensaje: string) {
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch {}

    const toast = await this.toastCtrl.create({
      message: mensaje,
      duration: 3500,
      color: 'danger',
      position: 'bottom'
    });
    await toast.present();
  }

selectOptions = {
    cssClass: 'cepa-select-overlay'
  };

toggleAtencion(valor: string) {
    if (this.atencionMozo === valor) {
      this.atencionMozo = ''; // Si toca la misma opcion, se deselecciona
    } else {
      this.atencionMozo = valor;
    }
  }


}