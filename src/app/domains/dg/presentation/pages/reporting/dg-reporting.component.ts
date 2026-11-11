import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, signal, inject, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Chart, registerables } from 'chart.js';
import { DgService, ZonePerformanceBE, ClassementCommercialBE, RapportComparatifBE, MoisCaBE, ConcentrationClientsBE, PerformanceGammeBE } from '../../../infrastructure/dg.service';
import { fCFA } from '../../../../../shared/utils/format.utils';
import { ToastService } from '../../../../../core/services/toast.service';

Chart.register(...registerables);

@Component({
  selector: 'app-dg-reporting',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './dg-reporting.component.html',
  styleUrls: ['./dg-reporting.component.css']
})
export class DgReportingComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('barCanvas') barCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('radarCanvas') radarCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('historiqueCanvas') historiqueCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('gammesCanvas') gammesCanvas?: ElementRef<HTMLCanvasElement>;
  private charts: Chart[] = [];
  private readonly dgSvc = inject(DgService);
  private readonly toast = inject(ToastService);

  today = new Date();
  loading = signal(true);
  /** Portée du graphique d'historique CA (6/12/24 mois), remplace un ancien selectedYear jamais
   * câblé à rien (2026-11-08). */
  historiqueMois = signal<6 | 12 | 24>(12);

  zones = signal<ZonePerformanceBE[]>([]);
  commerciaux = signal<ClassementCommercialBE[]>([]);
  comparatifMois = signal<RapportComparatifBE | null>(null);
  comparatifAnnee = signal<RapportComparatifBE | null>(null);
  /** 2026-11-01 (demande explicite du porteur, fonctionnalités utiles à un DG sur toute
   * l'activité) : historique réel, remplace le bandeau qui admettait son absence. */
  historiqueCa = signal<MoisCaBE[]>([]);
  /** 2026-11-01 (demande explicite du porteur), motif « Top clients + risque de concentration »,
   * validé par la pratique courante des tableaux de bord de direction. */
  concentrationClients = signal<ConcentrationClientsBE | null>(null);
  /** 2026-11-08 (demande explicite : reporting DG « plus détaillé »), réutilise /rp/dashboard. */
  performanceGammes = signal<PerformanceGammeBE[]>([]);

  fCFA = fCFA;
  Math = Math;

  exportingClassement = signal(false);
  exportingZones = signal(false);
  exportingHistorique = signal(false);
  exportingComparatif = signal(false);

  ngOnInit() {
    this.dgSvc.getZones().subscribe({
      next: z => this.zones.set(z),
      error: () => this.toast.error('Impossible de charger les zones'),
    });
    this.dgSvc.getClassement().subscribe({
      next: c => this.commerciaux.set(c),
      error: () => this.toast.error('Impossible de charger le classement'),
    });
    this.dgSvc.getComparatif('MOIS').subscribe({
      next: r => this.comparatifMois.set(r),
      error: () => this.toast.error('Impossible de charger le comparatif du mois'),
    });
    this.dgSvc.getComparatif('ANNEE').subscribe({
      next: r => this.comparatifAnnee.set(r),
      error: () => this.toast.error("Impossible de charger le comparatif de l'année"),
    });
    this.chargerHistorique();
    this.dgSvc.getConcentrationClients(10).subscribe({
      next: c => this.concentrationClients.set(c),
      error: () => this.toast.error('Impossible de charger la concentration clients'),
    });
    this.dgSvc.getPerformanceGammes().subscribe({
      next: g => { this.performanceGammes.set(g); this.buildCharts(); },
      error: () => this.toast.error('Impossible de charger la répartition par gamme'),
    });
    setTimeout(() => { this.loading.set(false); this.buildCharts(); }, 500);
  }

  chargerHistorique() {
    this.dgSvc.getHistoriqueCaMensuel(this.historiqueMois()).subscribe({
      next: h => { this.historiqueCa.set(h); this.buildCharts(); },
      error: () => this.toast.error("Impossible de charger l'historique du CA"),
    });
  }

  changerHistoriqueMois(mois: 6 | 12 | 24) {
    if (this.historiqueMois() === mois) return;
    this.historiqueMois.set(mois);
    this.chargerHistorique();
  }

  ngAfterViewInit() { setTimeout(() => this.buildCharts(), 600); }

  private buildCharts() {
    this.charts.forEach(c => c.destroy());
    this.charts = [];

    const historique = this.historiqueCa();
    if (this.historiqueCanvas?.nativeElement && historique.length > 0) {
      this.charts.push(new Chart(this.historiqueCanvas.nativeElement.getContext('2d')!, {
        type: 'bar',
        data: {
          labels: historique.map(m => m.libelleCourt),
          datasets: [
            { label: 'CA mensuel', data: historique.map(m => m.caFCFA), backgroundColor: '#1A6B2A', borderRadius: 6 },
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { ticks: { callback: (v: any) => (v / 1000000).toFixed(1) + 'M' } } }
        }
      }));
    }

    const zones = this.zones();
    if (this.barCanvas?.nativeElement && zones.length > 0) {
      this.charts.push(new Chart(this.barCanvas.nativeElement.getContext('2d')!, {
        type: 'bar',
        data: {
          labels: zones.map(z => z.secteur),
          datasets: [
            { label: 'CA du mois en cours', data: zones.map(z => z.caMoisCourantFCFA), backgroundColor: '#1A6B2A', borderRadius: 6 },
          ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } }, scales: { y: { ticks: { callback: (v: any) => (v / 1000000).toFixed(1) + 'M' } } } }
      }));
    }
    const gammes = this.performanceGammes();
    if (this.gammesCanvas?.nativeElement && gammes.length > 0) {
      const palette = ['#14532D', '#F6B60B', '#2A9D5F', '#C22B2B', '#C49200', '#6D4C41'];
      this.charts.push(new Chart(this.gammesCanvas.nativeElement.getContext('2d')!, {
        type: 'doughnut',
        data: {
          labels: gammes.map(g => g.gamme),
          datasets: [{ data: gammes.map(g => g.ca), backgroundColor: gammes.map((_, i) => palette[i % palette.length]) }]
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '62%',
          plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } }
        }
      }));
    }

    const commerciaux = this.commerciaux();
    if (this.radarCanvas?.nativeElement && commerciaux.length > 0) {
      this.charts.push(new Chart(this.radarCanvas.nativeElement.getContext('2d')!, {
        type: 'radar',
        data: {
          labels: commerciaux.map(c => c.nomComplet.split(' ')[1] ?? c.nomComplet),
          datasets: [
            { label: 'CA Réalisé (FCFA)', data: commerciaux.map(c => c.caRealise), backgroundColor: '#1A6B2A33', borderColor: '#1A6B2A', pointBackgroundColor: '#1A6B2A' },
          ]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { r: { min: 0, max: 120, ticks: { stepSize: 20 } } } }
      }));
    }
  }

  ngOnDestroy() { this.charts.forEach(c => c.destroy()); }

  // 2026-11-01 : les boutons « Exporter PDF »/« Exporter Excel » n'appelaient rien jusqu'ici
  // (signalé par le porteur, « je veux que le module DG soit complet et fonctionnel »).
  exporterClassement(format: 'pdf' | 'xlsx'): void {
    if (this.exportingClassement()) return;
    this.exportingClassement.set(true);
    this.dgSvc.exporterClassement(format).subscribe({
      next: (blob) => {
        this.exportingClassement.set(false);
        this.downloadFile(blob, `classement-commercial.${format}`);
      },
      error: () => { this.exportingClassement.set(false); this.toast.error('Export du classement impossible'); },
    });
  }

  exporterZones(format: 'pdf' | 'xlsx'): void {
    if (this.exportingZones()) return;
    this.exportingZones.set(true);
    this.dgSvc.exporterZones(format).subscribe({
      next: (blob) => {
        this.exportingZones.set(false);
        this.downloadFile(blob, `performance-zones.${format}`);
      },
      error: () => { this.exportingZones.set(false); this.toast.error('Export des zones impossible'); },
    });
  }

  exporterHistorique(format: 'pdf' | 'xlsx'): void {
    if (this.exportingHistorique()) return;
    this.exportingHistorique.set(true);
    this.dgSvc.exporterHistoriqueCa(format).subscribe({
      next: (blob) => {
        this.exportingHistorique.set(false);
        this.downloadFile(blob, `historique-ca-mensuel.${format}`);
      },
      error: () => { this.exportingHistorique.set(false); this.toast.error("Export de l'historique impossible"); },
    });
  }

  /** Exporte le comparatif actuellement affiché à l'écran (période "MOIS", voir comparatifMois). */
  exporterComparatif(format: 'pdf' | 'xlsx'): void {
    if (this.exportingComparatif()) return;
    this.exportingComparatif.set(true);
    this.dgSvc.exporterComparatif(format, 'MOIS').subscribe({
      next: (blob) => {
        this.exportingComparatif.set(false);
        this.downloadFile(blob, `comparatif-mois.${format}`);
      },
      error: () => { this.exportingComparatif.set(false); this.toast.error('Export du comparatif impossible'); },
    });
  }

  tauxAtteinteGamme(g: PerformanceGammeBE): number {
    if (!g.objectif || g.objectif <= 0) return 0;
    return Math.round((g.ca / g.objectif) * 100);
  }

  private downloadFile(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }
}
