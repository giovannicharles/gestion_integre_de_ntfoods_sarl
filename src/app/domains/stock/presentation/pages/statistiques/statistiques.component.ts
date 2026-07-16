import {
  Component, OnInit, signal, inject, OnDestroy, AfterViewInit,
  ViewChild, ElementRef, ChangeDetectorRef
} from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { Chart, registerables } from 'chart.js';

import { StockApiRepository } from '../../../infrastructure/repositories/stock-api.repository';
import {
  DashboardStatsResponse, StockLevel, StockMovement, DotationRequest
} from '../../../domain/models';

Chart.register(...registerables);

@Component({
  selector: 'app-statistiques',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, DecimalPipe],
  templateUrl: './statistiques.component.html',
  styleUrls: ['./statistiques.component.css']
})
export class StatistiquesComponent implements OnInit, AfterViewInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private readonly repo = inject(StockApiRepository);
  private readonly cdr = inject(ChangeDetectorRef);

  @ViewChild('evolutionCanvas') evolutionCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('quarterlyCanvas') quarterlyCanvas!: ElementRef<HTMLCanvasElement>;
  private charts: Chart[] = [];

  loading = signal(true);
  error = signal('');

  stats = signal<DashboardStatsResponse | null>(null);
  stockLevels = signal<StockLevel[]>([]);
  movements = signal<StockMovement[]>([]);
  dotations = signal<DotationRequest[]>([]);

  // Stats & Reports signals
  statYear = signal(new Date().getFullYear());
  statPeriod = signal<'monthly' | 'quarterly'>('monthly');
  statMonth = signal(new Date().getMonth() + 1);
  statQuarter = signal(Math.ceil((new Date().getMonth() + 1) / 3));
  statKPIs = signal<{ label: string; value: number; unit: string; icon: string; color: string }[]>([]);
  monthlyEvolution = signal<{ month: string; entries: number; exits: number; net: number; value: number }[]>([]);
  quarterlyData = signal<{ quarter: string; entries: number; exits: number; net: number; value: number }[]>([]);
  toast = signal('');
  toastType = signal<'success' | 'error'>('success');

  // Advanced innovations signals
  animatedStats = signal<DashboardStatsResponse | null>(null);
  stockAging = signal<{ productName: string; sku: string; avgAgeDays: number; oldestAgeDays: number; qty: number; riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' }[]>([]);
  reorderSuggestions = signal<{ productName: string; sku: string; currentQty: number; suggestedQty: number; dailyConsumption: number; urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM'; reason: string }[]>([]);
  executiveSummary = signal<{ icon: string; text: string; tone: 'positive' | 'warning' | 'negative' | 'info' }[]>([]);
  velocityMatrix = signal<{ productName: string; sku: string; velocity: 'FAST' | 'NORMAL' | 'SLOW' | 'DEAD'; monthlyQty: number; trend: 'UP' | 'STABLE' | 'DOWN' }[]>([]);
  warehouseCapacity = signal<{ name: string; used: number; capacity: number; pct: number; status: 'OK' | 'WARNING' | 'CRITICAL' }[]>([]);
  demandForecast = signal<{ productName: string; sku: string; currentQty: number; forecast30d: number; confidence: number; trend: 'UP' | 'STABLE' | 'DOWN' }[]>([]);
  currency = signal<'FCFA' | 'EUR' | 'USD'>('FCFA');
  currencyRates = signal({ FCFA: 1, EUR: 0.00152, USD: 0.00165 });
  availableYears = signal<number[]>([new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2]);


  ngOnInit() {
    this.loadAll();
  }

  ngAfterViewInit() {
    if (!this.loading()) this.buildCharts();
  }

  ngOnDestroy() {
    this.charts.forEach(c => c.destroy());
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadAll() {
    this.loading.set(true);
    this.error.set('');

    forkJoin({
      stats: this.repo.getDashboard(),
      levels: this.repo.getStockLevels(),
      movements: this.repo.getMovements(),
      dotations: this.repo.getDotations()
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: ({ stats, levels, movements, dotations }) => {
        this.stats.set(stats);
        this.stockLevels.set(levels);
        this.movements.set(movements);
        this.dotations.set(dotations);

        this.animateKPIs(stats);
        this.computeStockAging(levels, movements);
        this.computeReorderSuggestions(levels, movements);
        this.computeExecutiveSummary(levels, dotations, stats);
        this.computeVelocityMatrix(levels, movements);
        this.computeWarehouseCapacity(levels);
        this.computeDemandForecast(levels, movements);
        this.computeStatKPIs(stats, movements, levels, dotations);
        this.computeMonthlyEvolution(movements);
        this.computeQuarterlyData(movements);

        this.loading.set(false);
        setTimeout(() => this.buildCharts(), 100);
        this.cdr.detectChanges();
      },
      error: err => {
        this.error.set(err.message || 'Erreur lors du chargement des statistiques');
        this.loading.set(false);
      }
    });
  }

  // ── Animated KPI counters ──────────────────────────────────
  private animateKPIs(stats: DashboardStatsResponse) {
    const start: DashboardStatsResponse = {
      ...stats,
      totalStockValue: 0, todayMovements: 0, pendingReceipts: 0,
      pendingBatches: 0, criticalAlerts: 0, totalStockLevels: 0
    };
    this.animatedStats.set(start);
    const duration = 1200;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      this.animatedStats.set({
        ...stats,
        totalStockValue: Math.round(stats.totalStockValue * eased),
        todayMovements: Math.round(stats.todayMovements * eased),
        pendingReceipts: Math.round(stats.pendingReceipts * eased),
        pendingBatches: Math.round(stats.pendingBatches * eased),
        criticalAlerts: Math.round(stats.criticalAlerts * eased),
        totalStockLevels: Math.round(stats.totalStockLevels * eased)
      });
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  // ── Stock Aging Analysis ───────────────────────────────────
  private computeStockAging(levels: StockLevel[], movements: StockMovement[]) {
    const now = Date.now();
    const aging = levels.map(sl => {
      const productMoves = movements.filter(m => m.product?.sku === sl.productSku);
      const lastEntry = productMoves
        .filter(m => m.type.startsWith('RECEPTION'))
        .sort((a, b) => new Date(b.requestedAt || b.createdAt || '').getTime() - new Date(a.requestedAt || a.createdAt || '').getTime())[0];
      const avgAge = lastEntry
        ? Math.floor((now - new Date(lastEntry.requestedAt || lastEntry.createdAt || '').getTime()) / 86400000)
        : 90;
      const oldestAge = lastEntry
        ? Math.floor((now - new Date(lastEntry.requestedAt || lastEntry.createdAt || '').getTime()) / 86400000)
        : 180;
      const riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = avgAge > 60 ? 'HIGH' : avgAge > 30 ? 'MEDIUM' : 'LOW';
      return {
        productName: sl.productName || '',
        sku: sl.productSku || '',
        avgAgeDays: avgAge,
        oldestAgeDays: oldestAge,
        qty: sl.quantity,
        riskLevel
      };
    }).sort((a, b) => b.avgAgeDays - a.avgAgeDays).slice(0, 10);
    this.stockAging.set(aging);
  }

  // ── Smart Reorder Recommendations ──────────────────────────
  private computeReorderSuggestions(levels: StockLevel[], movements: StockMovement[]) {
    const now = Date.now();
    const suggestions = levels
      .filter(sl => sl.quantity <= (sl.reorderPoint || 0) * 1.5)
      .map(sl => {
        const recentMoves = movements.filter(m =>
          m.product?.sku === sl.productSku &&
          m.type === 'SALE' &&
          now - new Date(m.requestedAt || m.createdAt || '').getTime() < 30 * 86400000
        );
        const dailyConsumption = recentMoves.reduce((s, m) => s + m.quantity, 0) / 30;
        const suggestedQty = Math.max(Math.ceil(dailyConsumption * 45), sl.reorderPoint * 3);
        const urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' =
          sl.quantity <= sl.reorderPoint ? 'CRITICAL' :
          sl.quantity <= sl.reorderPoint * 1.2 ? 'HIGH' : 'MEDIUM';
        const reason = sl.quantity <= sl.reorderPoint
          ? 'Stock en dessous du seuil de réapprovisionnement'
          : 'Stock proche du seuil de réapprovisionnement';
        return {
          productName: sl.productName || '',
          sku: sl.productSku || '',
          currentQty: sl.quantity,
          suggestedQty,
          dailyConsumption: Math.round(dailyConsumption * 10) / 10,
          urgency,
          reason
        };
      }).sort((a, b) => {
        const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };
        return order[a.urgency] - order[b.urgency];
      });
    this.reorderSuggestions.set(suggestions.slice(0, 8));
  }

  // ── Executive Summary ──────────────────────────────────────
  private computeExecutiveSummary(levels: StockLevel[], dotations: DotationRequest[], stats: DashboardStatsResponse) {
    const summary: { icon: string; text: string; tone: 'positive' | 'warning' | 'negative' | 'info' }[] = [];
    const totalValue = levels.reduce((s, sl) => s + (sl.stockValue || 0), 0);
    const criticalCount = levels.filter(sl => sl.alertLevel === 'CRITIQUE').length;
    const lowCount = levels.filter(sl => sl.alertLevel === 'FAIBLE').length;
    const pendingDotations = dotations.filter(d => d.status === 'PENDING' || d.status === 'PAYMENT_VERIFIED' || d.status === 'QUANTITY_VALIDATED').length;

    summary.push({ icon: 'fa-coins', text: `Valeur totale du stock: ${this.formatCFA(totalValue)}`, tone: 'info' });
    if (criticalCount > 0) {
      summary.push({ icon: 'fa-triangle-exclamation', text: `${criticalCount} produit(s) en stock critique`, tone: 'negative' });
    } else {
      summary.push({ icon: 'fa-check-circle', text: 'Aucun produit en stock critique', tone: 'positive' });
    }
    if (lowCount > 0) {
      summary.push({ icon: 'fa-exclamation-circle', text: `${lowCount} produit(s) en stock faible`, tone: 'warning' });
    }
    if (pendingDotations > 0) {
      summary.push({ icon: 'fa-clock', text: `${pendingDotations} dotation(s) en attente de validation`, tone: 'warning' });
    }
    summary.push({ icon: 'fa-boxes-stacked', text: `${stats.totalStockLevels} références en stock`, tone: 'info' });
    summary.push({ icon: 'fa-arrows-up-down', text: `${stats.todayMovements} mouvement(s) aujourd'hui`, tone: 'info' });

    this.executiveSummary.set(summary);
  }

  // ── Velocity Matrix ────────────────────────────────────────
  private computeVelocityMatrix(levels: StockLevel[], movements: StockMovement[]) {
    const now = Date.now();
    const matrix = levels.map(sl => {
      const recentMoves = movements.filter(m =>
        m.product?.sku === sl.productSku &&
        now - new Date(m.requestedAt || m.createdAt || '').getTime() < 30 * 86400000
      );
      const monthlyQty = recentMoves.reduce((s, m) => s + m.quantity, 0);
      const velocity: 'FAST' | 'NORMAL' | 'SLOW' | 'DEAD' =
        monthlyQty > 100 ? 'FAST' :
        monthlyQty > 20 ? 'NORMAL' :
        monthlyQty > 0 ? 'SLOW' : 'DEAD';
      const olderMoves = movements.filter(m =>
        m.product?.sku === sl.productSku &&
        now - new Date(m.requestedAt || m.createdAt || '').getTime() >= 30 * 86400000 &&
        now - new Date(m.requestedAt || m.createdAt || '').getTime() < 60 * 86400000
      );
      const olderQty = olderMoves.reduce((s, m) => s + m.quantity, 0);
      const trend: 'UP' | 'STABLE' | 'DOWN' =
        monthlyQty > olderQty * 1.15 ? 'UP' :
        monthlyQty < olderQty * 0.85 ? 'DOWN' : 'STABLE';
      return {
        productName: sl.productName || '',
        sku: sl.productSku || '',
        velocity,
        monthlyQty,
        trend
      };
    }).sort((a, b) => b.monthlyQty - a.monthlyQty);
    this.velocityMatrix.set(matrix);
  }

  // ── Warehouse Capacity ─────────────────────────────────────
  private computeWarehouseCapacity(levels: StockLevel[]) {
    const warehouses = new Map<string, number>();
    levels.forEach(sl => {
      const name = sl.warehouseName || 'Inconnu';
      warehouses.set(name, (warehouses.get(name) || 0) + sl.quantity);
    });
    const capacities = new Map<string, number>([
      ['Premières matières', 50000],
      ['Consommables', 20000],
      ['Produits finis', 30000],
      ['Tampon', 15000]
    ]);
    const result = Array.from(warehouses.entries()).map(([name, used]) => {
      const capacity = capacities.get(name) || used * 2;
      const pct = Math.round((used / capacity) * 100);
      const status: 'OK' | 'WARNING' | 'CRITICAL' = pct > 90 ? 'CRITICAL' : pct > 75 ? 'WARNING' : 'OK';
      return { name, used, capacity, pct, status };
    });
    this.warehouseCapacity.set(result);
  }

  // ── Demand Forecast ────────────────────────────────────────
  private computeDemandForecast(levels: StockLevel[], movements: StockMovement[]) {
    const now = Date.now();
    const forecast = levels.map(sl => {
      const last30 = movements.filter(m =>
        m.product?.sku === sl.productSku &&
        m.type === 'SALE' &&
        now - new Date(m.requestedAt || m.createdAt || '').getTime() < 30 * 86400000
      );
      const last60 = movements.filter(m =>
        m.product?.sku === sl.productSku &&
        m.type === 'SALE' &&
        now - new Date(m.requestedAt || m.createdAt || '').getTime() < 60 * 86400000
      );
      const qty30 = last30.reduce((s, m) => s + m.quantity, 0);
      const qty60 = last60.reduce((s, m) => s + m.quantity, 0);
      const forecast30d = Math.round(qty30 * 1.1);
      const confidence = Math.min(100, Math.round((qty30 / Math.max(qty60 - qty30, 1)) * 50));
      const trend: 'UP' | 'STABLE' | 'DOWN' =
        qty30 > (qty60 - qty30) * 1.15 ? 'UP' :
        qty30 < (qty60 - qty30) * 0.85 ? 'DOWN' : 'STABLE';
      return {
        productName: sl.productName || '',
        sku: sl.productSku || '',
        currentQty: sl.quantity,
        forecast30d,
        confidence,
        trend
      };
    }).filter(f => f.forecast30d > 0).sort((a, b) => b.forecast30d - a.forecast30d).slice(0, 8);
    this.demandForecast.set(forecast);
  }

  // ── Statistics KPIs ─────────────────────────────────────────
  private computeStatKPIs(stats: DashboardStatsResponse, movements: StockMovement[], levels: StockLevel[], dotations: DotationRequest[]) {
    const year = this.statYear();
    const yearMovements = movements.filter(m => new Date(m.requestedAt || m.createdAt || '').getFullYear() === year);
    const totalEntries = yearMovements.filter(m => m.type.startsWith('RECEPTION')).reduce((s, m) => s + m.quantity, 0);
    const totalExits = yearMovements.filter(m => m.type === 'SALE' || m.type === 'TRANSFER_BUFFER_TO_MOBILE').reduce((s, m) => s + m.quantity, 0);
    const avgValue = levels.length > 0 ? levels.reduce((s, sl) => s + (sl.stockValue || 0), 0) / levels.length : 0;
    const yearDotations = dotations.filter(d => d.requestedAt ? new Date(d.requestedAt).getFullYear() === year : false);

    this.statKPIs.set([
      { label: 'Entrées (année)', value: totalEntries, unit: 'unités', icon: 'fa-arrow-down', color: '#16a34a' },
      { label: 'Sorties (année)', value: totalExits, unit: 'unités', icon: 'fa-arrow-up', color: '#ea580c' },
      { label: 'Valeur moyenne / produit', value: Math.round(avgValue), unit: 'FCFA', icon: 'fa-coins', color: '#2563eb' },
      { label: 'Dotations (année)', value: yearDotations.length, unit: 'demandes', icon: 'fa-truck', color: '#7c3aed' },
      { label: 'Produits suivis', value: stats.totalStockLevels, unit: 'réfs', icon: 'fa-boxes-stacked', color: '#0891b2' },
      { label: 'Alertes critiques', value: stats.criticalAlerts, unit: 'produits', icon: 'fa-triangle-exclamation', color: '#dc2626' }
    ]);
  }

  // ── Monthly Evolution ──────────────────────────────────────
  private computeMonthlyEvolution(movements: StockMovement[]) {
    const year = this.statYear();
    const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    const data: { month: string; entries: number; exits: number; net: number; value: number }[] = [];

    for (let m = 0; m < 12; m++) {
      const monthMovements = movements.filter(mv => {
        const d = new Date(mv.requestedAt || mv.createdAt || '');
        return d.getFullYear() === year && d.getMonth() === m;
      });
      const entries = monthMovements.filter(mv => mv.type.startsWith('RECEPTION')).reduce((s, mv) => s + mv.quantity, 0);
      const exits = monthMovements.filter(mv => mv.type === 'SALE' || mv.type === 'TRANSFER_BUFFER_TO_MOBILE').reduce((s, mv) => s + mv.quantity, 0);
      const value = monthMovements.reduce((s, mv) => s + (mv.quantity * (mv.product?.unitPriceAmount || 0)), 0);
      data.push({ month: monthNames[m], entries, exits, net: entries - exits, value });
    }
    this.monthlyEvolution.set(data);
  }

  // ── Quarterly Data ─────────────────────────────────────────
  private computeQuarterlyData(movements: StockMovement[]) {
    const year = this.statYear();
    const data: { quarter: string; entries: number; exits: number; net: number; value: number }[] = [];

    for (let q = 1; q <= 4; q++) {
      const qMovements = movements.filter(mv => {
        const d = new Date(mv.requestedAt || mv.createdAt || '');
        return d.getFullYear() === year && Math.ceil((d.getMonth() + 1) / 3) === q;
      });
      const entries = qMovements.filter(mv => mv.type.startsWith('RECEPTION')).reduce((s, mv) => s + mv.quantity, 0);
      const exits = qMovements.filter(mv => mv.type === 'SALE' || mv.type === 'TRANSFER_BUFFER_TO_MOBILE').reduce((s, mv) => s + mv.quantity, 0);
      const value = qMovements.reduce((s, mv) => s + (mv.quantity * (mv.product?.unitPriceAmount || 0)), 0);
      data.push({ quarter: `T${q}`, entries, exits, net: entries - exits, value });
    }
    this.quarterlyData.set(data);
  }

  // ── Charts ─────────────────────────────────────────────────
  private buildCharts() {
    this.charts.forEach(c => c.destroy());
    this.charts = [];
    setTimeout(() => {
      this.buildEvolutionChart();
      this.buildQuarterlyChart();
      this.cdr.detectChanges();
    }, 50);
  }

  private buildEvolutionChart() {
    if (!this.evolutionCanvas) return;
    const data = this.monthlyEvolution();
    const ctx = this.evolutionCanvas.nativeElement.getContext('2d');
    if (!ctx) return;
    this.charts.push(new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(d => d.month),
        datasets: [
          { label: 'Entrées', data: data.map(d => d.entries), backgroundColor: '#16a34a99' },
          { label: 'Sorties', data: data.map(d => d.exits), backgroundColor: '#ea580c99' }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'top' } },
        scales: { y: { beginAtZero: true } }
      }
    }));
  }

  private buildQuarterlyChart() {
    if (!this.quarterlyCanvas) return;
    const data = this.quarterlyData();
    const ctx = this.quarterlyCanvas.nativeElement.getContext('2d');
    if (!ctx) return;
    this.charts.push(new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(d => d.quarter),
        datasets: [
          { label: 'Entrées', data: data.map(d => d.entries), backgroundColor: '#2563eb99' },
          { label: 'Sorties', data: data.map(d => d.exits), backgroundColor: '#dc262699' }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'top' } },
        scales: { y: { beginAtZero: true } }
      }
    }));
  }

  showToast(msg: string, type: 'success' | 'error' = 'success') {
    this.toast.set(msg);
    this.toastType.set(type);
    setTimeout(() => this.toast.set(''), 4000);
  }

  // ── Stat Controls ──────────────────────────────────────────
  setStatYear(year: number) {
    this.statYear.set(year);
    this.computeStatKPIs(this.stats()!, this.movements(), this.stockLevels(), this.dotations());
    this.computeMonthlyEvolution(this.movements());
    this.computeQuarterlyData(this.movements());
    this.buildCharts();
  }

  setPeriod(period: 'monthly' | 'quarterly') {
    this.statPeriod.set(period);
  }

  setStatMonth(month: number) {
    this.statMonth.set(month);
  }

  setStatQuarter(q: number) {
    this.statQuarter.set(q);
  }

  // ── Helpers ────────────────────────────────────────────────
  formatCFA(n: number) { return new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA'; }

  getUrgencyClass(u: string): string {
    return u === 'CRITICAL' ? 'badge-danger' : u === 'HIGH' ? 'badge-warning' : 'badge-info';
  }

  getUrgencyLabel(u: string): string {
    return u === 'CRITICAL' ? 'Critique' : u === 'HIGH' ? 'Élevée' : 'Moyenne';
  }

  getRiskClass(r: string): string {
    return r === 'HIGH' ? 'badge-danger' : r === 'MEDIUM' ? 'badge-warning' : 'badge-success';
  }

  getRiskLabel(r: string): string {
    return r === 'HIGH' ? 'Élevé' : r === 'MEDIUM' ? 'Moyen' : 'Faible';
  }

  getVelocityClass(v: string): string {
    const m: Record<string, string> = { FAST: 'badge-success', NORMAL: 'badge-info', SLOW: 'badge-warning', DEAD: 'badge-danger' };
    return m[v] || 'badge-neutral';
  }

  getVelocityLabel(v: string): string {
    const m: Record<string, string> = { FAST: 'Rapide', NORMAL: 'Normal', SLOW: 'Lent', DEAD: 'Inactif' };
    return m[v] || v;
  }

  getTrendIcon(t: string): string {
    return t === 'UP' ? 'fa-arrow-trend-up' : t === 'DOWN' ? 'fa-arrow-trend-down' : 'fa-minus';
  }

  getTrendColor(t: string): string {
    return t === 'UP' ? '#16a34a' : t === 'DOWN' ? '#dc2626' : '#6b7280';
  }

  getCapacityStatusClass(s: string): string {
    return s === 'CRITICAL' ? 'badge-danger' : s === 'WARNING' ? 'badge-warning' : 'badge-success';
  }

  getCapacityStatusLabel(s: string): string {
    return s === 'CRITICAL' ? 'Critique' : s === 'WARNING' ? 'Attention' : 'OK';
  }

  getToneClass(tone: string): string {
    return `tone-${tone}`;
  }

  convertCurrency(amount: number): number {
    const rate = this.currencyRates()[this.currency()];
    return Math.round(amount * rate);
  }

  formatCurrency(n: number): string {
    if (this.currency() === 'FCFA') return this.formatCFA(n);
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: this.currency() }).format(this.convertCurrency(n));
  }
}
