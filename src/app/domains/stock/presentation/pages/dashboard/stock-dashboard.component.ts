import {
  Component, OnInit, signal, inject, OnDestroy, AfterViewInit,
  ViewChild, ElementRef, ChangeDetectorRef
} from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { Chart, registerables } from 'chart.js';

import { GetDashboardUseCase } from '../../../application/use-cases/dashboard/get-dashboard.use-case';
import { StockMockRepository } from '../../../infrastructure/repositories/stock-mock.repository';
import { StockRulesDomainService } from '../../../domain/services/stock-rules.domain.service';
import {
  DashboardStatsResponse, StockLevel, Receipt, StockMovement,
  ProductionBatch, InternalOrder
} from '../../../domain/models/stock.models';

Chart.register(...registerables);

@Component({
  selector: 'app-stock-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, DecimalPipe],
  templateUrl: './stock-dashboard.component.html',
  styleUrls: ['./stock-dashboard.component.css']
})
export class StockDashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private readonly dashUC = inject(GetDashboardUseCase);
  private readonly repo = inject(StockMockRepository);
  private readonly rules = inject(StockRulesDomainService);
  private readonly cdr = inject(ChangeDetectorRef);

  // Chart references
  @ViewChild('stockBarCanvas') stockBarCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('donutCanvas') donutCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('movementsCanvas') movementsCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('alertRadarCanvas') alertRadarCanvas!: ElementRef<HTMLCanvasElement>;

  private charts: Chart[] = [];

  loading = signal(true);
  skeletonItems = [1, 2, 3, 4];
  today = new Date();
  chartsReady = signal(false);
  selectedPeriod = signal<'today' | 'week' | 'month'>('today');

  stats = signal<DashboardStatsResponse | null>(null);
  alerts = signal<StockLevel[]>([]);
  receipts = signal<Receipt[]>([]);
  movements = signal<StockMovement[]>([]);
  stockLevels = signal<StockLevel[]>([]);
  batches = signal<ProductionBatch[]>([]);
  orders = signal<InternalOrder[]>([]);
  activeTab = signal<'receipts' | 'movements' | 'batches'>('receipts');

  ngOnInit() { this.loadAll(); }

  setPeriod(period: 'today' | 'week' | 'month') {
    this.selectedPeriod.set(period);
    this.loadAll();
  }

  ngAfterViewInit() {
    if (!this.loading()) this.buildCharts();
  }

  loadAll() {
    this.loading.set(true);
    forkJoin({
      stats: this.dashUC.getStats(),
      alerts: this.dashUC.getAlerts(),
      receipts: this.repo.getReceipts(),
      movs: this.repo.getMovements(),
      levels: this.repo.getStockLevels(),
      batches: this.repo.getBatches(),
      orders: this.repo.getOrders(),
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: ({ stats, alerts, receipts, movs, levels, batches, orders }) => {
        this.stats.set(stats);
        this.alerts.set(alerts);
        this.receipts.set(receipts.slice(0, 6));
        this.movements.set(movs.slice(0, 8));
        this.stockLevels.set(levels);
        this.batches.set(batches);
        this.orders.set(orders);
        this.loading.set(false);
        this.cdr.detectChanges();
        setTimeout(() => this.buildCharts(), 100);
      },
      error: () => this.loading.set(false)
    });
  }

  buildCharts() {
    this.charts.forEach(c => c.destroy());
    this.charts = [];
    if (this.stockBarCanvas) this.buildStockBarChart();
    if (this.donutCanvas) this.buildDonutChart();
    if (this.movementsCanvas) this.buildMovementsChart();
    if (this.alertRadarCanvas) this.buildAlertRadarChart();
    this.chartsReady.set(true);
  }

  private buildStockBarChart() {
    const top = [...this.stockLevels()]
      .sort((a, b) => (b.stockValue || 0) - (a.stockValue || 0))
      .slice(0, 8);

    const labels = top.map(sl => (sl.productName || sl.productSku || '').substring(0, 16));
    const qty = top.map(sl => sl.quantity);
    const reorder = top.map(sl => sl.reorderPoint);
    const colors = top.map(sl =>
      sl.alertLevel === 'CRITIQUE' ? 'rgba(198,40,40,.85)' :
        sl.alertLevel === 'FAIBLE' ? 'rgba(230,81,0,.85)' :
          'rgba(26,107,42,.85)'
    );

    const ctx = this.stockBarCanvas.nativeElement.getContext('2d')!;
    this.charts.push(new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Stock actuel', data: qty, backgroundColor: colors, borderRadius: 6, borderSkipped: false },
          { label: 'Seuil réappro.', data: reorder, backgroundColor: 'rgba(255,215,0,.3)', borderColor: '#C8A800', borderWidth: 2, borderRadius: 4, borderSkipped: false, type: 'bar' },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { font: { family: 'DM Sans', size: 12 }, usePointStyle: true } },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.dataset.label}: ${new Intl.NumberFormat('fr-CM').format((ctx.parsed.y ?? 0))}`
            }
          }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,.05)' }, ticks: { font: { family: 'DM Sans', size: 11 } } },
          x: { grid: { display: false }, ticks: { font: { family: 'DM Sans', size: 10 }, maxRotation: 35 } }
        }
      }
    }));
  }

  private buildDonutChart() {
    const w1 = this.stockLevels().filter(sl => sl.warehouseId === 1).length;
    const w2 = this.stockLevels().filter(sl => sl.warehouseId === 2).length;
    const w3 = this.stockLevels().filter(sl => sl.warehouseId === 3).length;
    const w4 = this.stockLevels().filter(sl => sl.warehouseId === 4).length;

    const v1 = this.stockLevels().filter(sl => sl.warehouseId === 1).reduce((a, sl) => a + (sl.stockValue || 0), 0);
    const v2 = this.stockLevels().filter(sl => sl.warehouseId === 2).reduce((a, sl) => a + (sl.stockValue || 0), 0);
    const v3 = this.stockLevels().filter(sl => sl.warehouseId === 3).reduce((a, sl) => a + (sl.stockValue || 0), 0);

    const ctx = this.donutCanvas.nativeElement.getContext('2d')!;
    this.charts.push(new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Matières Premières', 'Consommables', 'Produits Finis', 'Tampon'],
        datasets: [{
          data: [v1, v2, v3, 0],
          backgroundColor: ['rgba(26,107,42,.85)', 'rgba(200,168,0,.85)', 'rgba(2,119,189,.85)', 'rgba(107,114,128,.5)'],
          borderWidth: 3, borderColor: '#fff', hoverOffset: 8,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: { position: 'bottom', labels: { font: { family: 'DM Sans', size: 11 }, padding: 12, usePointStyle: true } },
          tooltip: {
            callbacks: {
              label: ctx => {
                const total = (ctx.dataset.data as number[]).reduce((a, v) => a + v, 0);
                const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : '0';
                return ` ${ctx.label}: ${new Intl.NumberFormat('fr-CM').format(Math.round(ctx.parsed))} FCFA (${pct}%)`;
              }
            }
          }
        }
      }
    }));
  }

  private buildMovementsChart() {
    const movs = this.movements();
    const entrees = movs.filter(m => m.type === 'ENTRY_FROM_SUPPLIER' || m.type === 'ENTRY_FROM_PRODUCTION').length;
    const sorties = movs.filter(m => m.type === 'EXIT_TO_COMMERCIAL').length;
    const ajust = movs.filter(m => m.type === 'ADJUSTMENT').length;
    const transfert = movs.filter(m => m.type === 'TRANSFER').length;

    const ctx = this.movementsCanvas.nativeElement.getContext('2d')!;
    this.charts.push(new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Entrées Fournisseur/Prod.', 'Sorties Commercial', 'Ajustements', 'Transferts Tampon'],
        datasets: [{
          label: 'Mouvements',
          data: [entrees, sorties, ajust, transfert],
          backgroundColor: ['rgba(26,107,42,.85)', 'rgba(2,119,189,.85)', 'rgba(107,114,128,.7)', 'rgba(0,121,107,.8)'],
          borderRadius: 8, borderSkipped: false,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.x} mouvement(s)` } }
        },
        scales: {
          x: { beginAtZero: true, grid: { color: 'rgba(0,0,0,.05)' }, ticks: { font: { family: 'DM Sans', size: 11 } } },
          y: { grid: { display: false }, ticks: { font: { family: 'DM Sans', size: 11 } } }
        }
      }
    }));
  }

  private buildAlertRadarChart() {
    const levels = this.stockLevels();
    const critique = levels.filter(sl => sl.alertLevel === 'CRITIQUE').length;
    const faible = levels.filter(sl => sl.alertLevel === 'FAIBLE').length;
    const normal = levels.filter(sl => sl.alertLevel === 'NORMAL').length;
    const surplus = levels.filter(sl => sl.alertLevel === 'SURPLUS').length;

    const ctx = this.alertRadarCanvas.nativeElement.getContext('2d')!;
    this.charts.push(new Chart(ctx, {
      type: 'polarArea',
      data: {
        labels: ['🔴 Critiques', '🟠 Faibles', '🟢 Normaux', '🔵 Surplus'],
        datasets: [{
          data: [critique, faible, normal, surplus],
          backgroundColor: ['rgba(198,40,40,.7)', 'rgba(230,81,0,.7)', 'rgba(46,125,50,.7)', 'rgba(2,119,189,.7)'],
          borderWidth: 2, borderColor: '#fff',
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { font: { family: 'DM Sans', size: 11 }, padding: 10 } },
          tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed.r} article(s)` } }
        },
        scales: { r: { grid: { color: 'rgba(0,0,0,.06)' }, ticks: { font: { family: 'DM Sans', size: 10 }, stepSize: 1 } } }
      }
    }));
  }

  // ── Helpers ───────────────────────────────────────────────
  getTopLevels() { return [...this.stockLevels()].sort((a, b) => (b.stockValue || 0) - (a.stockValue || 0)).slice(0, 6); }
  getPct(sl: StockLevel) { return Math.min(100, Math.round((sl.quantity / (sl.reorderPoint * 6 || 1)) * 100)); }
  getColor(sl: StockLevel): string {
    if (sl.alertLevel === 'CRITIQUE') return '#C62828';
    if (sl.alertLevel === 'FAIBLE') return '#E65100';
    return '#2E7D32';
  }
  getPendingBatches() { return this.batches().filter(b => b.status === 'DECLARED_BY_PRODUCTION'); }
  getCriticalItems() { return this.stockLevels().filter(sl => sl.alertLevel === 'CRITIQUE').slice(0, 5); }
  getCriticalClass(sl: StockLevel) {
    const pct = this.getPct(sl);
    if (pct < 20) return 'critical-high';
    if (pct < 40) return 'critical-medium';
    return 'critical-low';
  }

  getSessionLabel(s?: string) { const m: Record<string, string> = { OPEN: 'Ouverte', PENDING_CASH: 'Att. Caissière', PENDING_ACCOUNTANT: 'Att. Comptable', CLOSED: 'Clôturée' }; return m[s || ''] || s || '—'; }

  getRStatutLabel(s: string) { const m: Record<string, string> = { PENDING_FIRST_VALIDATION: 'Att. val. 1', PENDING_SECOND_VALIDATION: 'Att. val. 2', VALIDATED: 'Validé', REJECTED: 'Rejeté' }; return m[s] || s; }
  getRStatutClass(s: string) { const m: Record<string, string> = { PENDING_FIRST_VALIDATION: 'badge-warning', PENDING_SECOND_VALIDATION: 'badge-info', VALIDATED: 'badge-success', REJECTED: 'badge-danger' }; return m[s] || 'badge-neutral'; }
  getWShort(name?: string) { if (!name) return '—'; if (name.includes('Premières')) return 'MP'; if (name.includes('Consomm')) return 'Cons.'; if (name.includes('Finis')) return 'PF'; return name.substring(0, 5); }
  getWBadge(name?: string) { if (!name) return 'badge-neutral'; if (name.includes('Premières')) return 'badge-primary'; if (name.includes('Consomm')) return 'badge-secondary'; if (name.includes('Finis')) return 'badge-info'; return 'badge-neutral'; }
  getBStatutLabel(s: string) { const m: Record<string, string> = { DECLARED_BY_PRODUCTION: 'Déclaré — Att. validation', VALIDATED_BY_STOCK: 'Validé — Stock mis à jour', REJECTED: 'Rejeté' }; return m[s] || s; }
  getBStatutClass(s: string) { return s === 'VALIDATED_BY_STOCK' ? 'badge-success' : s === 'REJECTED' ? 'badge-danger' : 'badge-warning'; }
  isEntree(t: string) { return t === 'ENTRY_FROM_SUPPLIER' || t === 'ENTRY_FROM_PRODUCTION'; }
  getMIcon(t: string) { const m: Record<string, string> = { ENTRY_FROM_SUPPLIER: 'fa-arrow-circle-down', ENTRY_FROM_PRODUCTION: 'fa-industry', EXIT_TO_COMMERCIAL: 'fa-truck', TRANSFER: 'fa-boxes-stacked', ADJUSTMENT: 'fa-sliders', VIREMENT_BETWEEN_COMMERCIAL: 'fa-right-left' }; return m[t] || 'fa-circle'; }
  getMColor(t: string) { const m: Record<string, string> = { ENTRY_FROM_SUPPLIER: 'mc-g', ENTRY_FROM_PRODUCTION: 'mc-t', EXIT_TO_COMMERCIAL: 'mc-b', TRANSFER: 'mc-t', ADJUSTMENT: 'mc-n', VIREMENT_BETWEEN_COMMERCIAL: 'mc-p' }; return m[t] || 'mc-n'; }
  getMLabel(t: string) { const m: Record<string, string> = { ENTRY_FROM_SUPPLIER: 'Entrée fournisseur', ENTRY_FROM_PRODUCTION: 'Entrée production', EXIT_TO_COMMERCIAL: 'Sortie commercial', TRANSFER: 'Transfert tampon', ADJUSTMENT: 'Ajustement', VIREMENT_BETWEEN_COMMERCIAL: 'Virement inter-comm.' }; return m[t] || t; }
  formatCFA(n: number) { return new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA'; }
  getNAlertClass(n: string) { const m: Record<string, string> = { CRITIQUE: 'badge-danger', FAIBLE: 'badge-warning', NORMAL: 'badge-success', SURPLUS: 'badge-info' }; return m[n] || 'badge-neutral'; }

  ngOnDestroy() { this.charts.forEach(c => c.destroy()); this.destroy$.next(); this.destroy$.complete(); }
}
