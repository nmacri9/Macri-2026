import { Component, OnDestroy, ViewChild, computed, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonBackButton, IonButtons, IonContent, IonFooter, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { arrowDownOutline, arrowUndoOutline, chatbubblesOutline, closeOutline, sendOutline } from 'ionicons/icons';
import { ChatMensaje, ChatParticipante, combinarMensajes } from '../../interfaces/chat-mensaje';
import { CHAT_PAGINA, ChatService, EstadoChat, MesaChatNoAsignadaError } from '../../services/chat.service';

@Component({
  selector: 'app-chat-cliente',
  templateUrl: './chat-cliente.page.html',
  styleUrls: ['./chat-cliente.page.scss'],
  imports: [DatePipe, FormsModule, IonBackButton, IonButtons, IonContent,
    IonFooter, IonHeader, IonIcon, IonTitle, IonToolbar]
})
export class ChatClientePage implements OnDestroy {
  @ViewChild(IonContent) contenido?: IonContent;
  readonly participante = signal<ChatParticipante | null>(null);
  readonly mensajes = signal<ChatMensaje[]>([]);
  readonly estado = signal<EstadoChat>('conectando');
  readonly cargando = signal(true);
  readonly enviando = signal(false);
  readonly cargandoAnteriores = signal(false);
  readonly hayAnteriores = signal(false);
  readonly error = signal('');
  readonly errorEnvio = signal('');
  readonly avisosPendientes = signal<string[]>([]);
  readonly reintentandoAvisos = signal(false);
  readonly respuesta = signal<ChatMensaje | null>(null);
  readonly nuevos = signal(0);
  readonly numeroMesa = signal<number | null>(null);
  readonly mesaValida = computed(() => {
    const numero = this.numeroMesa();
    return numero !== null && Number.isInteger(numero) && numero >= 1 && numero <= 9999;
  });
  readonly puedeEscribir = computed(() => {
    const persona = this.participante();
    return !!persona && (persona.rol === 'MOZO' || this.mesaValida());
  });
  borrador = '';
  private desconectar?: () => void;
  private ciclo = 0;
  private cercaDelFinal = true;
  private pendiente?: { id: string; texto: string; respuestaA: string | null; numeroMesa: number | null };
  private ultimoUsuario: string | null = null;
  private sincronizadoHasta?: ChatMensaje;
  private sincronizacion: Promise<void> = Promise.resolve();

  constructor(private chat: ChatService) {
    addIcons({ arrowDownOutline, arrowUndoOutline, chatbubblesOutline, closeOutline, sendOutline });
  }

  ionViewWillEnter() { void this.iniciar(); }
  ionViewDidLeave() { this.cerrar(); }
  ngOnDestroy() { this.cerrar(); }

  async iniciar() {
    this.cerrar();
    const ciclo = this.ciclo;
    this.cargando.set(true);
    this.error.set('');
    this.errorEnvio.set('');
    this.mensajes.set([]);
    this.participante.set(null);
    this.respuesta.set(null);
    this.nuevos.set(0);
    this.hayAnteriores.set(false);
    this.cercaDelFinal = true;
    try {
      const participante = await this.chat.participante();
      if (ciclo !== this.ciclo) return;
      if (this.ultimoUsuario !== participante.id) {
        this.borrador = '';
        this.numeroMesa.set(null);
        this.pendiente = undefined;
        this.avisosPendientes.set([]);
        this.ultimoUsuario = participante.id;
      }
      this.participante.set(participante);
      this.numeroMesa.set(participante.numero_mesa);
      this.desconectar = this.chat.conectar(mensaje => {
        if (ciclo !== this.ciclo) return;
        const yaExiste = this.mensajes().some(item => item.id === mensaje.id);
        this.mensajes.update(actuales => combinarMensajes(actuales, [mensaje]));
        if (this.cercaDelFinal) this.irAlFinal();
        else if (!yaExiste) this.nuevos.update(cantidad => cantidad + 1);
      }, estado => {
        if (ciclo !== this.ciclo) return;
        this.estado.set(estado);
        // Tras cada reconexión se recuperan también los mensajes perdidos.
        if (estado === 'conectado') void this.actualizar(ciclo);
      });
      await this.actualizar(ciclo);
    } catch (error) {
      if (ciclo !== this.ciclo) return;
      console.error('No se pudo abrir el chat:', error);
      const codigo = (error as { code?: string })?.code;
      this.error.set(error instanceof MesaChatNoAsignadaError ? error.message
        : codigo === 'PGRST202' || codigo === 'PGRST205' || codigo === '42P01'
        ? 'El chat todavía no está habilitado. Avisá al personal del restaurante.'
        : codigo === '42501'
          ? 'Tu usuario no está habilitado para entrar al chat. Iniciá sesión como cliente habilitado o mozo activo.'
          : 'No se pudo abrir la sala. Intentá nuevamente.');
    } finally {
      if (ciclo === this.ciclo) this.cargando.set(false);
    }
  }

  private actualizar(ciclo: number): Promise<void> {
    // Serializa carga inicial y confirmación de suscripción para cubrir el intervalo entre ambas.
    this.sincronizacion = this.sincronizacion.then(() => this.sincronizar(ciclo));
    return this.sincronizacion;
  }

  private async sincronizar(ciclo: number) {
    if (ciclo !== this.ciclo) return;
    try {
      if (!this.sincronizadoHasta) {
        const historial = await this.chat.historial();
        if (ciclo !== this.ciclo) return;
        this.mensajes.update(actuales => combinarMensajes(actuales, historial));
        this.hayAnteriores.set(historial.length === CHAT_PAGINA);
        this.sincronizadoHasta = historial[0];
      } else {
        // Si hubo más de una página durante el corte, recuperar todas sin dejar huecos.
        let seguir = true;
        while (seguir && this.sincronizadoHasta) {
          const pendientes = await this.chat.posteriores(this.sincronizadoHasta);
          if (ciclo !== this.ciclo) return;
          const ids = new Set(this.mensajes().map(mensaje => mensaje.id));
          if (!this.cercaDelFinal) this.nuevos.update(total => total + pendientes.filter(mensaje => !ids.has(mensaje.id)).length);
          this.mensajes.update(actuales => combinarMensajes(actuales, pendientes));
          if (pendientes.length) this.sincronizadoHasta = pendientes[pendientes.length - 1];
          seguir = pendientes.length === CHAT_PAGINA;
        }
      }
      this.error.set('');
      if (this.cercaDelFinal) this.irAlFinal();
    } catch (error) {
      if (ciclo !== this.ciclo) return;
      console.error('No se pudo cargar el historial:', error);
      this.error.set('No pudimos cargar los mensajes. Tocá Reintentar.');
    }
  }

  async cargarAnteriores() {
    const primero = this.mensajes()[0];
    if (!primero || this.cargandoAnteriores()) return;
    const ciclo = this.ciclo;
    this.cargandoAnteriores.set(true);
    try {
      const scroll = await this.contenido?.getScrollElement();
      const altura = scroll?.scrollHeight ?? 0;
      const posicion = scroll?.scrollTop ?? 0;
      const anteriores = await this.chat.historial(primero);
      if (ciclo !== this.ciclo) return;
      this.mensajes.update(actuales => combinarMensajes(actuales, anteriores));
      this.hayAnteriores.set(anteriores.length === CHAT_PAGINA);
      this.error.set('');
      setTimeout(() => {
        if (scroll && ciclo === this.ciclo) scroll.scrollTop = posicion + scroll.scrollHeight - altura;
      });
    } catch (error) {
      if (ciclo === this.ciclo) this.error.set('No pudimos cargar los mensajes anteriores. Tocá Reintentar.');
    } finally {
      if (ciclo === this.ciclo) this.cargandoAnteriores.set(false);
    }
  }

  async enviar() {
    const texto = this.borrador.trim();
    if (!texto || this.enviando() || !this.puedeEscribir()) return;
    const ciclo = this.ciclo;
    const respuestaA = this.respuesta()?.id ?? null;
    const numeroMesa = this.participante()?.rol === 'MOZO' ? null : this.numeroMesa();
    if (!this.pendiente || this.pendiente.texto !== texto || this.pendiente.respuestaA !== respuestaA
      || this.pendiente.numeroMesa !== numeroMesa) {
      this.pendiente = { id: crypto.randomUUID(), texto, respuestaA, numeroMesa };
    }
    this.enviando.set(true);
    this.errorEnvio.set('');
    try {
      const mensaje = await this.chat.enviar(this.pendiente.id, texto, respuestaA, numeroMesa);
      const aviso = this.notificar(mensaje.id, ciclo);
      if (ciclo !== this.ciclo) { await aviso; return; }
      this.mensajes.update(actuales => combinarMensajes(actuales, [mensaje]));
      this.borrador = '';
      this.respuesta.set(null);
      this.pendiente = undefined;
      this.irAlFinal();
      await aviso;
    } catch (error) {
      if (ciclo !== this.ciclo) return;
      console.error('No se pudo enviar el mensaje:', error);
      this.errorEnvio.set(error instanceof MesaChatNoAsignadaError ? error.message
        : 'No se confirmó el envío. Tu mensaje sigue acá; podés volver a enviarlo.');
    } finally {
      if (ciclo === this.ciclo) this.enviando.set(false);
    }
  }

  responder(mensaje: ChatMensaje) {
    if (!this.enviando()) this.respuesta.set(mensaje);
  }

  private async notificar(id: string, ciclo: number) {
    try {
      await this.chat.notificar(id);
      if (ciclo === this.ciclo) this.avisosPendientes.update(ids => ids.filter(item => item !== id));
    } catch (error) {
      console.error('Mensaje guardado, pero falló la notificación:', error);
      if (ciclo === this.ciclo) this.avisosPendientes.update(ids => [...new Set([...ids, id])]);
    }
  }

  async reintentarAvisos() {
    if (this.reintentandoAvisos()) return;
    const ciclo = this.ciclo;
    this.reintentandoAvisos.set(true);
    try {
      for (const id of this.avisosPendientes()) {
        if (ciclo !== this.ciclo) return;
        await this.notificar(id, ciclo);
      }
    } finally {
      if (ciclo === this.ciclo) this.reintentandoAvisos.set(false);
    }
  }

  async alDesplazar() {
    const scroll = await this.contenido?.getScrollElement();
    if (!scroll) return;
    this.cercaDelFinal = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 120;
    if (this.cercaDelFinal) this.nuevos.set(0);
  }

  irAlFinal() {
    this.nuevos.set(0);
    this.cercaDelFinal = true;
    const ciclo = this.ciclo;
    setTimeout(() => {
      if (ciclo === this.ciclo) void this.contenido?.scrollToBottom(0);
    });
  }

  nuevoDia(indice: number): boolean {
    const mensajes = this.mensajes();
    return indice === 0 || new Date(mensajes[indice].creado_en).toDateString()
      !== new Date(mensajes[indice - 1].creado_en).toDateString();
  }

  private cerrar() {
    this.ciclo++;
    this.desconectar?.();
    this.desconectar = undefined;
    this.sincronizadoHasta = undefined;
    this.sincronizacion = Promise.resolve();
    this.enviando.set(false);
    this.reintentandoAvisos.set(false);
    this.cargandoAnteriores.set(false);
    this.estado.set('desconectado');
  }
}
