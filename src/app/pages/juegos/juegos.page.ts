import { ChangeDetectorRef, Component, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { arrowBackOutline, trophyOutline, refreshOutline } from 'ionicons/icons';
import { SupabaseService } from '../../services/supabase.service';
import { MesasService } from '../../services/mesas.service';
import bancoPreguntas from './preguntas.json';

type Juego = 'ahorcado' | 'memoria' | 'verdadero-falso';
type Pregunta = { texto: string; respuesta: boolean };

@Component({
  selector: 'app-juegos',
  standalone: true,
  imports: [RouterLink, IonContent, IonIcon],
  templateUrl: './juegos.page.html',
  styleUrls: ['./juegos.page.scss']
})
export class JuegosPage implements OnDestroy {
  juegoActivo: Juego | null = null;
  descuento = 0;
  intentados: Juego[] = [];
  primerIntentoConPremio = false;
  resultado = '';
  error = '';
  cargando = true;
  disponible = false;
  premiosDisponibles = false;
  procesando = false;
  terminado = false;
  resultadoPendiente: number | null = null;
  private claveIntentos = '';
  private asignacionId: number | null = null;

  readonly juegos: { id: Juego; titulo: string; descripcion: string; premio: number; dificultad: string }[] = [
    { id: 'ahorcado', titulo: 'Ahorcado', descripcion: 'Descubrí la palabra antes de 6 errores.', premio: 20, dificultad: 'Difícil' },
    { id: 'memoria', titulo: 'Memoria', descripcion: 'Encontrá las 6 parejas en 18 movimientos.', premio: 15, dificultad: 'Intermedio' },
    { id: 'verdadero-falso', titulo: 'Verdadero o falso', descripcion: 'Acertá al menos 3 de 5 preguntas.', premio: 10, dificultad: 'Fácil' }
  ];

  readonly abecedario = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('');
  private readonly palabras = ['EMPANADA', 'MILANESA', 'RAVIOLES', 'LIMONADA', 'CHOCOLATE'];
  private palabra = '';
  mascara = '';
  letras = '';
  errores = 0;

  readonly nombresCartas: Record<string, { corto: string; largo: string }> = {
    vino: { corto: 'V', largo: 'Vino' }, hamburguesa: { corto: 'H', largo: 'Hamburguesa' },
    pizza: { corto: 'P', largo: 'Pizza' }, postre: { corto: 'D', largo: 'Postre' },
    cafe: { corto: 'C', largo: 'Café' }, empanada: { corto: 'E', largo: 'Empanada' }
  };
  cartas: { id: number; simbolo: string; visible: boolean; encontrada: boolean }[] = [];
  seleccionadas: number[] = [];
  movimientos = 0;
  private timerMemoria: ReturnType<typeof setTimeout> | null = null;

  preguntas: Pregunta[] = [];
  preguntaActual = 0;
  aciertos = 0;
  respuestaAnterior: string | null = null;

  constructor(
    private supabase: SupabaseService,
    private mesas: MesasService,
    private cdr: ChangeDetectorRef
  ) {
    addIcons({ arrowBackOutline, trophyOutline, refreshOutline });
  }

  ionViewWillEnter() { void this.cargarPremio(); }

  ngOnDestroy() {
    if (this.timerMemoria) clearTimeout(this.timerMemoria);
  }

  async cargarPremio() {
    this.cargando = true;
    this.disponible = false;
    this.premiosDisponibles = false;
    this.error = '';
    try {
      const db = this.supabase.getClient();
      const { data: authData, error: authError } = await db.auth.getUser();
      if (authError || !authData.user) throw new Error('Iniciá sesión para jugar.');
      const clienteId = await this.mesas.obtenerClienteId(authData.user.id);
      if (clienteId === null) throw new Error('No se encontró tu perfil de cliente.');
      const { data, error } = await db.from('asignaciones')
        .select('id')
        .eq('cliente_id', clienteId).eq('estado', 'asignado')
        .is('fecha_finalizacion', null).not('mesa_id', 'is', null)
        .order('fecha_asignacion', { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Necesitás una mesa asignada para jugar.');
      this.asignacionId = data.id;
      const premio = await db.from('asignaciones').select('descuento_obtenido').eq('id', data.id).maybeSingle();
      this.premiosDisponibles = !premio.error && !!premio.data;
      this.descuento = premio.data?.descuento_obtenido ?? 0;
      this.claveIntentos = `cepa-juegos-v2:${authData.user.id}:${data.id}`;
      const guardados = JSON.parse(localStorage.getItem(this.claveIntentos) || '[]');
      this.intentados = Array.isArray(guardados)
        ? guardados.filter((valor): valor is Juego => this.juegos.some(juego => juego.id === valor)) : [];
      this.disponible = true;
    } catch {
      this.error = 'No pudimos cargar tus juegos. Volvé a intentar.';
    } finally {
      this.cargando = false;
      this.cdr.markForCheck();
    }
  }

  elegirJuego(juego: Juego) {
    if (!this.disponible || this.procesando) return;
    this.error = '';
    this.primerIntentoConPremio = this.puedeGanarDescuento(juego);
    this.juegoActivo = juego;
    this.terminado = false;
    this.resultado = '';
    this.resultadoPendiente = null;
    this.respuestaAnterior = null;
    if (juego === 'ahorcado') this.iniciarAhorcado();
    if (juego === 'memoria') this.iniciarMemoria();
    if (juego === 'verdadero-falso') {
      this.preguntas = this.elegirPreguntas();
      this.preguntaActual = 0;
      this.aciertos = 0;
    }
  }

  private elegirPreguntas(): Pregunta[] {
    const mezcladas = [...bancoPreguntas];
    for (let i = mezcladas.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [mezcladas[i], mezcladas[j]] = [mezcladas[j], mezcladas[i]];
    }
    return mezcladas.slice(0, 5);
  }

  private registrarIntento() {
    if (!this.primerIntentoConPremio || !this.juegoActivo) return;
    const siguientes = [...this.intentados, this.juegoActivo];
    localStorage.setItem(this.claveIntentos, JSON.stringify(siguientes));
    this.intentados = siguientes;
  }

  volverAJuegos() {
    if (this.procesando || this.resultadoPendiente !== null) return;
    if (this.timerMemoria) clearTimeout(this.timerMemoria);
    this.juegoActivo = null;
    this.resultado = '';
    this.primerIntentoConPremio = false;
  }

  puedeGanarDescuento(juego: Juego) {
    return this.premiosDisponibles && this.descuento === 0 && !this.intentados.includes(juego);
  }

  private iniciarAhorcado() {
    this.palabra = this.palabras[Math.floor(Math.random() * this.palabras.length)];
    this.letras = '';
    this.errores = 0;
    this.actualizarMascara();
  }

  private actualizarMascara() {
    this.mascara = [...this.palabra].map(letra => this.letras.includes(letra) ? letra : '·').join('');
  }

  adivinar(letra: string) {
    if (this.terminado || this.letras.includes(letra)) return;
    this.letras += letra;
    if (!this.palabra.includes(letra)) this.errores++;
    this.actualizarMascara();
    if (this.mascara === this.palabra) void this.finalizar(true);
    else if (this.errores >= 6) {
      this.mascara = this.palabra;
      void this.finalizar(false);
    }
  }

  private iniciarMemoria() {
    const simbolos = Object.keys(this.nombresCartas);
    const mazo = [...simbolos, ...simbolos];
    for (let i = mazo.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [mazo[i], mazo[j]] = [mazo[j], mazo[i]];
    }
    this.cartas = mazo.map((simbolo, id) => ({ id, simbolo, visible: false, encontrada: false }));
    this.seleccionadas = [];
    this.movimientos = 0;
  }

  girarCarta(id: number) {
    const carta = this.cartas[id];
    if (this.procesando || this.terminado || carta.encontrada || carta.visible) return;
    carta.visible = true;
    this.seleccionadas.push(id);
    if (this.seleccionadas.length !== 2) return;
    this.movimientos++;
    const [primera, segunda] = this.seleccionadas.map(indice => this.cartas[indice]);
    if (primera.simbolo === segunda.simbolo) {
      primera.encontrada = true;
      segunda.encontrada = true;
      this.seleccionadas = [];
      if (this.cartas.every(item => item.encontrada)) void this.finalizar(true);
      else if (this.movimientos >= 18) void this.finalizar(false);
    } else {
      this.procesando = true;
      this.timerMemoria = setTimeout(() => {
        primera.visible = false;
        segunda.visible = false;
        this.seleccionadas = [];
        this.procesando = false;
        if (this.movimientos >= 18) void this.finalizar(false);
        this.cdr.markForCheck();
      }, 900);
    }
  }

  responder(respuesta: boolean) {
    if (this.terminado) return;
    const correcta = this.preguntas[this.preguntaActual].respuesta === respuesta;
    if (correcta) this.aciertos++;
    this.respuestaAnterior = correcta ? '¡Bien!' : 'No era esa.';
    this.preguntaActual++;
    if (this.preguntaActual === this.preguntas.length) void this.finalizar(this.aciertos >= 3);
  }

  private async finalizar(gano: boolean) {
    if (this.terminado || !this.juegoActivo) return;
    this.terminado = true;
    if (gano && this.primerIntentoConPremio) {
      this.resultadoPendiente = this.juegos.find(juego => juego.id === this.juegoActivo)!.premio;
      await this.guardarResultado();
    } else if (gano) {
      this.resultado = '¡Ganaste! Esta partida era por diversión; solo la primera partida de cada juego puede dar premio.';
      this.cdr.markForCheck();
    } else {
      this.registrarIntento();
      this.resultado = 'Esta vez no ganaste. Podés probar otro juego por su descuento o seguir jugando por diversión.';
      this.cdr.markForCheck();
    }
  }

  async guardarResultado() {
    if (this.resultadoPendiente === null || this.procesando) return;
    this.procesando = true;
    this.error = '';
    try {
      const { data, error } = await this.supabase.getClient().rpc('guardar_descuento_cepa', {
        p_porcentaje: this.resultadoPendiente
      });
      if (error) throw error;
      if (!this.asignacionId || typeof data !== 'number' || data <= 0) {
        throw new Error('Supabase no confirmó el descuento.');
      }
      const verificacion = await this.supabase.getClient().from('asignaciones')
        .select('descuento_obtenido').eq('id', this.asignacionId).maybeSingle();
      if (verificacion.error || verificacion.data?.descuento_obtenido !== data) {
        throw verificacion.error ?? new Error(`El descuento no figura en la asignación ${this.asignacionId}.`);
      }
      this.descuento = data;
      this.registrarIntento();
      this.resultado = `¡Ganaste! Tu descuento en esta visita es ${this.descuento}%.`;
      this.resultadoPendiente = null;
    } catch (error) {
      console.error('Error al guardar el descuento:', error);
      const detalle = error as { code?: string; message?: string };
      this.error = detalle.code === 'PGRST202' || detalle.message?.includes('guardar_descuento_cepa')
        ? 'Falta habilitar el guardado de descuentos en Supabase. Podés reintentar sin salir de esta partida.'
        : detalle.message?.startsWith('El descuento no figura')
          ? `${detalle.message} Podés reintentar sin salir de esta partida.`
        : 'No se pudo guardar el descuento. Podés reintentar sin salir de esta partida.';
    } finally {
      this.procesando = false;
      this.cdr.markForCheck();
    }
  }
}
