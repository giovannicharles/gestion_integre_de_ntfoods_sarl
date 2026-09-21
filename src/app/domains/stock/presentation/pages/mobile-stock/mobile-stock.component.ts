import {
  Component, OnInit, signal, inject, OnDestroy, AfterViewInit,
  ViewChild, ElementRef, ChangeDetectorRef
} from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, forkJoin, takeUntil, catchError, of } from 'rxjs';
import { Chart, registerables } from 'chart.js';
import { StockApiRepository } from '../../../infrastructure/repositories/stock-api.repository';
import { MobileStockSummary, MobileStockRotation, SlowStockCommercial, DotationRequest } from '../../../domain/models';

Chart.register(...registerables);

@Component({
  selector: 'app-mobile-stock',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DatePipe, DecimalPipe],
  templateUrl: './mobile-stock.component.html',
  styleUrls: ['./mobile-stock.component.css']
})
export class MobileStockComponent implements OnInit, AfterViewInit, OnDestroy {
  private d$ = new Subject<void>();
  private repo = inject(StockApiRepository);
  private cdr = inject(ChangeDetectorRef);

  @ViewChild('distributionCanvas') distributionCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('rotationCanvas') rotationCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('topProductsCanvas') topProductsCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('slowStockCanvas') slowStockCanvas!: ElementRef<HTMLCanvasElement>;
  private charts: Chart[] = [];

  loading = signal(true);
  error = signal('');
  summaries = signal<MobileStockSummary[]>([]);
  rotations = signal<MobileStockRotation[]>([]);
  slowStocks = signal<SlowStockCommercial[]>([]);
  activeTab = signal<'overview' | 'rotation' | 'slow'>('overview');
  selectedSummary = signal<MobileStockSummary | null>(null);
  detailTab = signal<'stock' | 'rotation' | 'history'>('stock');
  dotationHistory = signal<DotationRequest[]>([]);
  detailLoading = signal(false);
  search = signal('');
  chartsReady = signal(false);

  ngOnInit(): void {
    this.load();
  }

  ngAfterViewInit() {
    if (!this.loading()) this.buildCharts();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.chartsReady.set(false);
    forkJoin({
      s: this.repo.getMobileStockAll(),
      sl: this.repo.getSlowStockCommercials()
    }).pipe(takeUntil(this.d$)).subscribe({
      next: ({ s, sl }) => {
        this.summaries.set(s);
        this.slowStocks.set(sl);
        this.loadRotations(s);
      },
      error: () => {
        this.error.set('Erreur lors du chargement du stock mobile');
        this.loading.set(false);
      }
    });
  }

  private loadRotations(summaries: MobileStockSummary[]): void {
    if (summaries.length === 0) {
      this.rotations.set([]);
      this.loading.set(false);
      return;
    }
    const reqs = summaries.map(s => this.repo.getMobileStockRotation(s.commercialMatricule).pipe(
      catchError(() => of(null as MobileStockRotation | null))
    ));
    forkJoin(reqs).pipe(takeUntil(this.d$)).subscribe(rotations => {
      this.rotations.set(rotations.filter((r): r is MobileStockRotation => r !== null));
      this.loading.set(false);
      this.cdr.detectChanges();
      setTimeout(() => this.buildCharts(), 120);
    });
  }

  filteredSummaries() {
    const q = this.search().toLowerCase();
    return q
      ? this.summaries().filter(s => s.commercialMatricule.toLowerCase().includes(q))
      : this.summaries();
  }

  rotationFor(matricule: string) {
    return this.rotations().find(r => r.commercialMatricule === matricule);
  }

  slowFor(matricule: string) {
    return this.slowStocks().find(s => s.matricule === matricule);
  }

  openDetail(s: MobileStockSummary) {
    this.selectedSummary.set(s);
    this.detailTab.set('stock');
    this.dotationHistory.set([]);
    this.detailLoading.set(true);
    this.repo.getDotationsByCommercial(s.commercialMatricule).pipe(
      takeUntil(this.d$),
      catchError(() => of([]))
    ).subscribe(h => {
      this.dotationHistory.set(h);
      this.detailLoading.set(false);
    });
  }

  closeDetail() {
    this.selectedSummary.set(null);
  }

  getStatusClass(status: string) {
    const m: Record<string, string> = {
      PENDING: 'badge-warning', PAYMENT_VERIFIED: 'badge-primary',
      QUANTITY_VALIDATED: 'badge-secondary', APPROVED: 'badge-success',
      REJECTED: 'badge-danger', COMPLETED: 'badge-success',
      REVIEWED: 'badge-info'
    };
    return m[status] || 'badge-neutral';
  }

  getStatusLabel(status: string) {
    const m: Record<string, string> = {
      PENDING: 'Att. paiement', PAYMENT_VERIFIED: 'Paiement vérifié',
      QUANTITY_VALIDATED: 'Quantités validées', APPROVED: 'Approuvée',
      REJECTED: 'Rejetée', COMPLETED: 'Livrée',
      REVIEWED: 'Révisée'
    };
    return m[status] || status;
  }

  get totalStockValue() {
    return this.summaries().reduce((a, s) => a + (s.totalValue || 0), 0);
  }

  get totalItems() {
    return this.summaries().reduce((a, s) => a + (s.totalItems || 0), 0);
  }

  get totalOut() {
    return this.rotations().reduce((a, r) => a + (r.totalOut || 0), 0);
  }

  get totalIn() {
    return this.rotations().reduce((a, r) => a + (r.totalIn || 0), 0);
  }

  get avgStockPerCommercial() {
    const n = this.summaries().length;
    return n > 0 ? Math.round(this.totalItems / n) : 0;
  }

  fCFA(n: number) {
    return new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA';
  }

  // ── CHARTS ──────────────────────────────────────────────

  private buildCharts() {
    this.charts.forEach(c => c.destroy());
    this.charts = [];
    if (this.distributionCanvas) this.buildDistributionChart();
    if (this.rotationCanvas) this.buildRotationChart();
    if (this.topProductsCanvas) this.buildTopProductsChart();
    if (this.slowStockCanvas) this.buildSlowStockChart();
    this.chartsReady.set(true);
  }

  /** Doughnut: Stock total par commercial */
  private buildDistributionChart() {
    const data = this.summaries().slice(0, 10);
    const labels = data.map(s => s.commercialMatricule);
    const values = data.map(s => s.totalItems || 0);
    const palette = [
      'rgba(20,83,45,.85)', 'rgba(2,119,189,.85)', 'rgba(246,182,11,.85)',
      'rgba(124,58,237,.8)', 'rgba(194,43,43,.75)', 'rgba(21,128,61,.8)',
      'rgba(30,64,175,.8)', 'rgba(217,119,6,.8)', 'rgba(107,114,128,.7)',
      'rgba(190,24,93,.75)'
    ];

    const ctx = this.distributionCanvas.nativeElement.getContext('2d')!;
    this.charts.push(new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: palette.slice(0, labels.length),
          borderWidth: 3, borderColor: '#fff', hoverOffset: 8,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        cutout: '60%',
        plugins: {
          legend: { position: 'bottom', labels: { font: { family: 'Inter', size: 10, weight: 500 }, padding: 10, usePointStyle: true } },
          tooltip: { callbacks: { label: (ctx: any) => {
            const total = (ctx.dataset.data as number[]).reduce((a, v) => a + v, 0);
            const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : '0';
            return ` ${ctx.label}: ${ctx.parsed} articles (${pct}%)`;
          }}}
        }
      }
    }));
  }

  /** Bar chart: Entrées vs Sorties par commercial */
  private buildRotationChart() {
    const data = this.summaries().slice(0, 10);
    const labels = data.map(s => s.commercialMatricule);
    const entrees = data.map(s => this.rotationFor(s.commercialMatricule)?.totalIn || 0);
    const sorties = data.map(s => this.rotationFor(s.commercialMatricule)?.totalOut || 0);

    const ctx = this.rotationCanvas.nativeElement.getContext('2d')!;
    this.charts.push(new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Entrées (dotations)', data: entrees, backgroundColor: 'rgba(20,83,45,.85)', borderRadius: 6, borderSkipped: false },
          { label: 'Sorties (ventes)', data: sorties, backgroundColor: 'rgba(194,43,43,.8)', borderRadius: 6, borderSkipped: false },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { font: { family: 'Poppins', size: 11, weight: 600 }, usePointStyle: true, padding: 14 } },
          tooltip: { callbacks: { label: (ctx: any) => ` ${ctx.dataset.label}: ${new Intl.NumberFormat('fr-CM').format(ctx.parsed.y ?? 0)}` } }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,.04)' }, ticks: { font: { family: 'Inter', size: 11 } } },
          x: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 10 }, maxRotation: 35 } }
        }
      }
    }));
  }

  /** Horizontal bar: Top produits en stock mobile (tous commerciaux confondus) */
  private buildTopProductsChart() {
    const productMap = new Map<string, number>();
    this.summaries().forEach(s => {
      (s.stockItems || []).forEach((item: any) => {
        const sku = item.productSku || '—';
        productMap.set(sku, (productMap.get(sku) || 0) + (item.quantity || 0));
      });
    });
    const sorted = Array.from(productMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    const labels = sorted.map(([sku]) => sku);
    const values = sorted.map(([, qty]) => qty);
    const colors = values.map((_, i) =>
      i < 3 ? 'rgba(20,83,45,.85)' : i < 6 ? 'rgba(246,182,11,.85)' : 'rgba(2,119,189,.7)'
    );

    const ctx = this.topProductsCanvas.nativeElement.getContext('2d')!;
    this.charts.push(new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{ label: 'Quantité', data: values, backgroundColor: colors, borderRadius: 6, borderSkipped: false }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx: any) => ` ${ctx.parsed.x} unités` } }
        },
        scales: {
          x: { beginAtZero: true, grid: { color: 'rgba(0,0,0,.04)' }, ticks: { font: { family: 'Inter', size: 11 } } },
          y: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 10 } } }
        }
      }
    }));
  }

  /** Bar: Stock dormant — ventes par commercial (les plus faibles) */
  private buildSlowStockChart() {
    const data = this.slowStocks().slice(0, 10);
    if (data.length === 0) return;
    const labels = data.map(s => s.matricule);
    const sales = data.map(s => s.totalSales || 0);
    const stock = data.map(s => s.totalStock || 0);

    const ctx = this.slowStockCanvas.nativeElement.getContext('2d')!;
    this.charts.push(new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Ventes (30j)', data: sales, backgroundColor: 'rgba(194,43,43,.7)', borderRadius: 6, borderSkipped: false },
          { label: 'Stock actuel', data: stock, backgroundColor: 'rgba(246,182,11,.85)', borderRadius: 6, borderSkipped: false },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { font: { family: 'Poppins', size: 11, weight: 600 }, usePointStyle: true, padding: 14 } },
          tooltip: { callbacks: { label: (ctx: any) => ` ${ctx.dataset.label}: ${new Intl.NumberFormat('fr-CM').format(ctx.parsed.y ?? 0)}` } }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,.04)' }, ticks: { font: { family: 'Inter', size: 11 } } },
          x: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 10 }, maxRotation: 35 } }
        }
      }
    }));
  }

  ngOnDestroy(): void {
    this.charts.forEach(c => c.destroy());
    this.d$.next();
    this.d$.complete();
  }
}
