import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonContent, IonButton, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  pieChartOutline, barChartOutline, trendingUpOutline,
  arrowBackOutline, arrowForwardOutline
} from 'ionicons/icons';
import { Chart, registerables } from 'chart.js';

import { SupabaseService } from '../../services/supabase.service';
import { CepaHeaderComponent } from '../../shared/components/cepa-header/cepa-header.component';
import { CepaSpinnerComponent } from '../../shared/components/cepa-spinner/cepa-spinner.component';

Chart.register(...registerables);

@Component({
  selector: 'app-graficos-encuestas',
  templateUrl: './graficos-encuestas.page.html',
  styleUrls: ['./graficos-encuestas.page.scss'],
  standalone: true,
  imports: [
    CommonModule, IonContent, IonButton, IonIcon,
    CepaHeaderComponent, CepaSpinnerComponent
  ]
})
export class GraficosEncuestasPage implements OnInit, AfterViewInit {
  @ViewChild('chartCanvas') chartCanvas?: ElementRef<HTMLCanvasElement>;

  cargando = true;
  encuestas: any[] = [];
  chartInstance: Chart | null = null;

  // controla que pantalla individual se muestra (0: Torta, 1: Barra, 2: Lineal)
  pantallaActual = 0;

  // metricas resumen 
  totalEncuestas = 0;
  promedioComida = '0.0';
  porcentajeRecomienda = 0;

  constructor(
    private supabase: SupabaseService,
    private cdr: ChangeDetectorRef
  ) {
    addIcons({
      pieChartOutline, barChartOutline, trendingUpOutline,
      arrowBackOutline, arrowForwardOutline
    });
  }

  async ngOnInit() {
    await this.cargarDatosEncuestas();
  }

  ngAfterViewInit() {
    if (!this.cargando) {
      this.renderizarGraficoActual();
    }
  }

  async cargarDatosEncuestas() {
    this.cargando = true;
    try {
      const { data, error } = await this.supabase.getClient()
        .from('encuestas')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;

      this.encuestas = data || [];
      this.calcularMetricasResumen();
    } catch (error) {
      console.error('Error cargando encuestas:', error);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
      setTimeout(() => this.renderizarGraficoActual(), 50);
    }
  }

  calcularMetricasResumen() {
    this.totalEncuestas = this.encuestas.length;
    if (this.totalEncuestas === 0) return;

    const sumaCalidad = this.encuestas.reduce((acc, e) => acc + Number(e.calidad_comida || 0), 0);
    this.promedioComida = (sumaCalidad / this.totalEncuestas).toFixed(1);

    const recomiendan = this.encuestas.filter(e => e.recomendaria === true).length;
    this.porcentajeRecomienda = Math.round((recomiendan / this.totalEncuestas) * 100);
  }

  cambiarPantalla(indice: number) {
    if (indice < 0 || indice > 2) return;
    this.pantallaActual = indice;
    this.cdr.detectChanges();
    setTimeout(() => this.renderizarGraficoActual(), 30);
  }

  renderizarGraficoActual() {
    if (!this.chartCanvas?.nativeElement) return;

    if (this.chartInstance) {
      this.chartInstance.destroy();
    }

    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const colorTexto = '#E6D5C3';
    const colorGrilla = 'rgba(200, 178, 158, 0.18)';

    // PANTALLA 0: GRÁFICO DE TORTA (Atencion del Mozo)
    if (this.pantallaActual === 0) {
      const categorias = ['Excelente', 'Buena', 'Regular', 'Mala'];
      const conteo = categorias.map(cat =>
        this.encuestas.filter(e => e.atencion_mozo === cat).length
      );

      this.chartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
          labels: categorias,
          datasets: [{
            data: conteo,
            backgroundColor: ['#418756', '#C8B29E', '#D99B26', '#A83232'],
            borderColor: '#132A20',
            borderWidth: 3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: colorTexto, font: { size: 14, weight: 'bold' }, padding: 16 }
            }
          }
        }
      });
    }

    // PANTALLA 1: GRAFICO DE BARRAS (Aspectos Destacados)
    else if (this.pantallaActual === 1) {
      const etiquetas = ['Sabor', 'Limpieza', 'Ambiente', 'Precios'];
      const conteo = etiquetas.map(etiqueta =>
        this.encuestas.filter(e =>
          Array.isArray(e.aspectos_destacados) && e.aspectos_destacados.includes(etiqueta)
        ).length
      );

      this.chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: etiquetas,
          datasets: [{
            label: 'Votos de clientes',
            data: conteo,
            backgroundColor: ['#418756', '#5A9E6F', '#C8B29E', '#D99B26'],
            borderRadius: 8
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: { ticks: { color: colorTexto, font: { size: 13, weight: 'bold' } }, grid: { display: false } },
            y: { beginAtZero: true, ticks: { stepSize: 1, color: colorTexto }, grid: { color: colorGrilla } }
          }
        }
      });
    }

    // PANTALLA 2: GRAFICO LINEAL (Evolucion de Calificacion de la Comida)
    else if (this.pantallaActual === 2) {
      const ultimas = this.encuestas.slice(-10);
      const labels = ultimas.map((e, idx) => {
        const fecha = new Date(e.created_at);
        return `${fecha.getDate()}/${fecha.getMonth() + 1}`;
      });
      const puntajes = ultimas.map(e => Number(e.calidad_comida || 0));

      this.chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Puntaje Gastronómico (1-10)',
            data: puntajes,
            borderColor: '#418756',
            backgroundColor: 'rgba(65, 135, 86, 0.25)',
            pointBackgroundColor: '#E6D5C3',
            pointRadius: 6,
            tension: 0.35,
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              labels: { color: colorTexto, font: { size: 13, weight: 'bold' } }
            }
          },
          scales: {
            x: { ticks: { color: colorTexto }, grid: { color: colorGrilla } },
            y: { min: 1, max: 10, ticks: { stepSize: 1, color: colorTexto }, grid: { color: colorGrilla } }
          }
        }
      });
    }
  }
}