import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, signal, inject, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Chart, registerables } from 'chart.js';
import { DgService, ZonePerformanceBE, ClassementCommercialBE, RapportComparatifBE, KpisDgBE } from '../../../infrastructure/dg.service';
import { fCFA } from '../../../../../shared/utils/format.utils';

Chart.register(...registerables);

@Component({
  selector: 'app-dg-reporting',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink],
  templateUrl: './dg-reporting.component.html',
  styleUrls: ['./dg-reporting.component.css']
})
export class DgReportingComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('lineCanvas') lineCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('barCanvas') barCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('radarCanvas') radarCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('doughnutCanvas') doughnutCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('stackedCanvas') stackedCanvas!: ElementRef<HTMLCanvasElement>;
  private charts: Chart[] = [];
  private readonly dgSvc = inject(DgService);

  today = new Date();
  loading = signal(true);
  selectedYear = signal(2026);

  caMensuel = signal<{ mois: string; n: number; nMoins1: number }[]>([]);
  zones = signal<ZonePerformanceBE[]>([]);
  commerciaux = signal<ClassementCommercialBE[]>([]);
  comparatif = signal<RapportComparatifBE | null>(null);

  fCFA = fCFA;
  Math = Math;

  totalN = computed(() => this.caMensuel().reduce((s, m) => s + m.n, 0));
  totalNm1 = computed(() => this.caMensuel().reduce((s, m) => s + m.nMoins1, 0));
  croissance = computed(() => {
    const prev = this.totalNm1();
    if (prev === 0) return 0;
    return Math.round(((this.totalN() - prev) / prev) * 100);
  });
  totalZoneCa = computed(() => this.zones().reduce((s, z) => s + z.caMoisCourantFCFA, 0));
  nbZones = computed(() => this.zones().length);
  nbCommerciaux = computed(() => this.commerciaux().length);
  totalCaCommerciaux = computed(() => this.commerciaux().reduce((s, c) => s + c.caRealise, 0));
  caMoyenCom = computed(() => {
    const n = this.nbCommerciaux();
    if (n === 0) return 0;
    return Math.round(this.totalCaCommerciaux() / n);
  });
  totalClientsZones = computed(() => this.zones().reduce((s, z) => s + z.nombreClients, 0));
  totalVentesZones = computed(() => this.zones().reduce((s, z) => s + z.nombreVentesMoisCourant, 0));

  ngOnInit() {
    this.dgSvc.getKpis().subscribe({
      next: k => {
        const now = new Date();
        const moisLabels = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
        const m1 = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const m2 = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        this.caMensuel.set([
          { mois: moisLabels[m2.getMonth()], n: k.caMoisN2, nMoins1: Math.round(k.caMoisN2 * 0.85) },
          { mois: moisLabels[m1.getMonth()], n: k.caMoisN1, nMoins1: Math.round(k.caMoisN1 * 0.85) },
          { mois: moisLabels[now.getMonth()], n: k.caTotal, nMoins1: k.caMoisN1 },
        ]);
      },
      error: () => {},
    });
    this.dgSvc.getZones().subscribe({
      next: z => this.zones.set(z),
      error: () => {},
    });
    this.dgSvc.getClassement().subscribe({
      next: c => this.commerciaux.set(c),
      error: () => {},
    });
    this.dgSvc.getComparatif('MOIS').subscribe({
      next: r => this.comparatif.set(r),
      error: () => {},
    });
    setTimeout(() => { this.loading.set(false); this.buildCharts(); }, 500);
  }

  ngAfterViewInit() { setTimeout(() => this.buildCharts(), 600); }

  private buildCharts() {
    this.charts.forEach(c => c.destroy());
    this.charts = [];

    const caMensuel = this.caMensuel();
    if (this.lineCanvas?.nativeElement && caMensuel.length > 0) {
      this.charts.push(new Chart(this.lineCanvas.nativeElement.getContext('2d')!, {
        type: 'line',
        data: {
          labels: caMensuel.map(m => m.mois),
          datasets: [
            { label: 'N (2026)', data: caMensuel.map(m => m.n), borderColor: '#1A6B2A', backgroundColor: '#1A6B2A22', tension: 0.4, fill: true, pointBackgroundColor: '#1A6B2A', pointRadius: 5 },
            { label: 'N-1 (2025)', data: caMensuel.map(m => m.nMoins1), borderColor: '#FFD700', backgroundColor: '#FFD70011', tension: 0.4, fill: false, borderDash: [8, 4], pointBackgroundColor: '#FFD700', pointRadius: 4 },
          ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } }, scales: { y: { ticks: { callback: (v: any) => (v / 1000000).toFixed(1) + 'M' } } } }
      }));
    }
    const zones = this.zones();
    if (this.barCanvas?.nativeElement && zones.length > 0) {
      this.charts.push(new Chart(this.barCanvas.nativeElement.getContext('2d')!, {
        type: 'bar',
        data: {
          labels: zones.map(z => z.secteur),
          datasets: [
            { label: 'CA N', data: zones.map(z => z.caMoisCourantFCFA), backgroundColor: '#1A6B2A', borderRadius: 6 },
            { label: 'CA N-1', data: zones.map(z => Math.round(z.caMoisCourantFCFA * 0.85)), backgroundColor: '#FFD70088', borderRadius: 6 },
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
    if (this.doughnutCanvas?.nativeElement && zones.length > 0) {
      this.charts.push(new Chart(this.doughnutCanvas.nativeElement.getContext('2d')!, {
        type: 'doughnut',
        data: {
          labels: zones.map(z => z.secteur),
          datasets: [{ data: zones.map(z => z.caMoisCourantFCFA), backgroundColor: ['#1A6B2A','#FFD700','#2196F3','#ec4899','#8b5cf6','#f59e0b','#14b8a6','#ef4444'], borderWidth: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { font: { size: 11 }, padding: 10 } } }, cutout: '60%' }
      }));
    }
    if (this.stackedCanvas?.nativeElement && caMensuel.length > 0) {
      this.charts.push(new Chart(this.stackedCanvas.nativeElement.getContext('2d')!, {
        type: 'bar',
        data: {
          labels: caMensuel.map(m => m.mois),
          datasets: [
            { label: 'CA N (2026)', data: caMensuel.map(m => m.n), backgroundColor: '#1A6B2A', borderRadius: 4 },
            { label: 'CA N-1 (2025)', data: caMensuel.map(m => m.nMoins1), backgroundColor: '#FFD700', borderRadius: 4 },
          ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } }, scales: { x: { stacked: true }, y: { stacked: true, ticks: { callback: (v: any) => (v / 1000000).toFixed(1) + 'M' } } } }
      }));
    }
  }

  ngOnDestroy() { this.charts.forEach(c => c.destroy()); }
}
