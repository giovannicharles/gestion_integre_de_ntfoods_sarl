import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, signal, inject, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Chart, registerables } from 'chart.js';
import { DgService, ZonePerformanceBE, ClassementCommercialBE, RapportComparatifBE } from '../../../infrastructure/dg.service';
import { fCFA } from '../../../../../shared/utils/format.utils';

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
  private charts: Chart[] = [];
  private readonly dgSvc = inject(DgService);

  today = new Date();
  loading = signal(true);
  selectedYear = signal(2026);

  zones = signal<ZonePerformanceBE[]>([]);
  commerciaux = signal<ClassementCommercialBE[]>([]);
  comparatifMois = signal<RapportComparatifBE | null>(null);
  comparatifAnnee = signal<RapportComparatifBE | null>(null);

  fCFA = fCFA;
  Math = Math;

  ngOnInit() {
    this.dgSvc.getZones().subscribe({
      next: z => this.zones.set(z),
      error: () => {},
    });
    this.dgSvc.getClassement().subscribe({
      next: c => this.commerciaux.set(c),
      error: () => {},
    });
    this.dgSvc.getComparatif('MOIS').subscribe({
      next: r => this.comparatifMois.set(r),
      error: () => {},
    });
    this.dgSvc.getComparatif('ANNEE').subscribe({
      next: r => this.comparatifAnnee.set(r),
      error: () => {},
    });
    setTimeout(() => { this.loading.set(false); this.buildCharts(); }, 500);
  }

  ngAfterViewInit() { setTimeout(() => this.buildCharts(), 600); }

  private buildCharts() {
    this.charts.forEach(c => c.destroy());
    this.charts = [];

    // Pas de série mensuelle N vs N-1 : /dg/comparatif ne renvoie qu'une
    // tranche actuelle/précédente à la fois (mois précédent, pas année
    // précédente) — aucune donnée réelle pour un historique 12 mois par an.
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
}
