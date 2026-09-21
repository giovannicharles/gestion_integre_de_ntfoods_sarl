import {
  Component, OnInit, signal, inject, OnDestroy, AfterViewInit,
  ViewChild, ElementRef, ChangeDetectorRef, computed
} from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { of } from 'rxjs';
import { Chart, registerables } from 'chart.js';

import { StockApiRepository } from '../../../infrastructure/repositories/stock-api.repository';
import {
  DashboardStatsResponse, StockLevel, StockMovement, DotationRequest,
  ProductionBatch, InternalOrder, Receipt, StockAlertEntity, Product
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
  @ViewChild('doughnutCanvas') doughnutCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('topProductsCanvas') topProductsCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('trendLineCanvas') trendLineCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('radarCanvas') radarCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('abcCanvas') abcCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('sectorProductionCanvas') sectorProductionCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('sectorReceptionCanvas') sectorReceptionCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('sectorAlertsCanvas') sectorAlertsCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('sectorOrdersCanvas') sectorOrdersCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('sectorMovementsCanvas') sectorMovementsCanvas!: ElementRef<HTMLCanvasElement>;
  private charts: Chart[] = [];

  loading = signal(true);
  error = signal('');

  stats = signal<DashboardStatsResponse | null>(null);
  stockLevels = signal<StockLevel[]>([]);
  movements = signal<StockMovement[]>([]);
  dotations = signal<DotationRequest[]>([]);
  batches = signal<ProductionBatch[]>([]);
  orders = signal<InternalOrder[]>([]);
  receipts = signal<Receipt[]>([]);
  alerts = signal<StockAlertEntity[]>([]);

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
  stockAging = signal<{ productName: string; sku: string; avgAgeDays: number; oldestAgeDays: number; qty: number; riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'; unit?: string; stockValue?: number; shelfLifeDays?: number }[]>([]);
  reorderSuggestions = signal<{ productName: string; sku: string; currentQty: number; suggestedQty: number; dailyConsumption: number; urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM'; reason: string }[]>([]);
  executiveSummary = signal<{ icon: string; text: string; tone: 'positive' | 'warning' | 'negative' | 'info' }[]>([]);
  velocityMatrix = signal<{ productName: string; sku: string; velocity: 'FAST' | 'NORMAL' | 'SLOW' | 'DEAD'; monthlyQty: number; trend: 'UP' | 'STABLE' | 'DOWN' }[]>([]);
  warehouseCapacity = signal<{ name: string; used: number; capacity: number; pct: number; status: 'OK' | 'WARNING' | 'CRITICAL' }[]>([]);
  demandForecast = signal<{ productName: string; sku: string; currentQty: number; forecast30d: number; confidence: number; trend: 'UP' | 'STABLE' | 'DOWN' }[]>([]);
  currency = signal<'FCFA' | 'EUR' | 'USD'>('FCFA');
  currencyRates = signal({ FCFA: 1, EUR: 0.00152, USD: 0.00165 });
  availableYears = signal<number[]>([new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2]);

  // ── NEW: ABC/Pareto Analysis ──
  abcAnalysis = signal<{ sku: string; name: string; value: number; cumPct: number; class: 'A' | 'B' | 'C' }[]>([]);

  // ── NEW: Stock Distribution by category ──
  stockDistribution = signal<{ label: string; value: number; qty: number; color: string }[]>([]);

  // ── NEW: Top Products by Value ──
  topProductsByValue = signal<{ name: string; sku: string; value: number; qty: number; alertLevel?: string; unit?: string }[]>([]);

  // ── NEW: Dotation Analysis ──
  dotationByCommercial = signal<{ commercial: string; count: number; totalQty: number; pending: number }[]>([]);
  dotationByStatus = signal<{ status: string; count: number; color: string }[]>([]);

  // ── NEW: Radar Metrics (multi-dimensional) ──
  radarMetrics = signal<{ label: string; value: number; max: number }[]>([]);

  // ── Per-sector statistics ──
  sectorProductionStats = signal<{ label: string; count: number; color: string }[]>([]);
  sectorReceptionStats = signal<{ label: string; count: number; color: string }[]>([]);
  sectorAlertStats = signal<{ label: string; count: number; color: string }[]>([]);
  sectorOrderStats = signal<{ label: string; count: number; color: string }[]>([]);
  sectorMovementStats = signal<{ label: string; count: number; color: string }[]>([]);

  // ── NEW: Print mode ──
  printing = signal(false);

  // ── NEW: Computed totals (grouped by unit to avoid wrong cross-unit summation) ──
  totalStockValue = computed(() => this.stockLevels().reduce((s, sl) => s + (sl.stockValue || 0), 0));
  totalStockQtyByUnit = computed(() => {
    const map = new Map<string, number>();
    this.stockLevels().forEach(sl => {
      const unit = sl.productUnit || sl.product?.unit || 'UNITE';
      map.set(unit, (map.get(unit) || 0) + sl.quantity);
    });
    return Array.from(map.entries()).map(([unit, qty]) => ({ unit, qty })).sort((a, b) => b.qty - a.qty);
  });
  totalStockQty = computed(() => this.totalStockQtyByUnit().reduce((s, u) => s + u.qty, 0));
  totalEntries = computed(() => this.monthlyEvolution().reduce((s, d) => s + d.entries, 0));
  totalExits = computed(() => this.monthlyEvolution().reduce((s, d) => s + d.exits, 0));

  // ── NEW: Stock aging distribution buckets ──
  stockAgingBuckets = signal<{ label: string; count: number; color: string; pct: number }[]>([]);

  // ── NEW: Impressive stock statistics ──
  stockConcentration = signal<{ label: string; value: number; pct: number; color: string }[]>([]);
  stockTurnoverScore = signal<number>(0);
  stockRiskMatrix = signal<{ label: string; low: number; medium: number; high: number }[]>([]);
  stockFinancialHealth = signal<{ label: string; value: number; max: number; color: string }[]>([]);
  topDepreciationRisk = signal<{ productName: string; sku: string; qty: number; ageDays: number; potentialLoss: number }[]>([]);

  // ── NEW: Display mode ──
  displayMode = signal<'table' | 'grid' | 'cards'>('table');

  // ── NEW: Pagination state per table ──
  pageSize = 8;
  agingPage = signal(1);
  reorderPage = signal(1);
  abcPage = signal(1);
  forecastPage = signal(1);
  velocityPage = signal(1);
  dotationPage = signal(1);

  // ── NEW: Paginated computed slices ──
  paginatedAging = computed(() => {
    const start = (this.agingPage() - 1) * this.pageSize;
    return this.stockAging().slice(start, start + this.pageSize);
  });
  paginatedReorder = computed(() => {
    const start = (this.reorderPage() - 1) * this.pageSize;
    return this.reorderSuggestions().slice(start, start + this.pageSize);
  });
  paginatedABC = computed(() => {
    const start = (this.abcPage() - 1) * this.pageSize;
    return this.abcAnalysis().slice(start, start + this.pageSize);
  });
  paginatedForecast = computed(() => {
    const start = (this.forecastPage() - 1) * this.pageSize;
    return this.demandForecast().slice(start, start + this.pageSize);
  });
  paginatedVelocity = computed(() => {
    const start = (this.velocityPage() - 1) * this.pageSize;
    return this.velocityMatrix().slice(start, start + this.pageSize);
  });
  paginatedDotation = computed(() => {
    const start = (this.dotationPage() - 1) * this.pageSize;
    return this.dotationByCommercial().slice(start, start + this.pageSize);
  });

  totalPages = (total: number) => Math.max(1, Math.ceil(total / this.pageSize));
  pageRange = (total: number) => {
    const tp = this.totalPages(total);
    return Array.from({ length: tp }, (_, i) => i + 1);
  };
  setPage = (signal: any, page: number) => signal.set(page);


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
      dotations: this.repo.getDotations(),
      batches: this.repo.getBatches(),
      orders: this.repo.getOrders(),
      receipts: this.repo.getReceipts(),
      alerts: this.repo.getBackendAlerts(),
      products: this.repo.getProducts().pipe(catchError(() => of([] as Product[])))
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: ({ stats, levels, movements, dotations, batches, orders, receipts, alerts, products }) => {
        const productMap = new Map<number, Product>();
        products.forEach(p => productMap.set(p.id, p));
        const enriched = levels.map(sl => {
          const p = productMap.get(sl.productId);
          return {
            ...sl,
            product: p || sl.product,
            productName: sl.productName || p?.designation || p?.sku || sl.productSku || '—',
            productSku: sl.productSku || p?.sku || '—',
            materialType: sl.materialType || p?.materialType || 'Autre',
            productUnit: sl.productUnit || p?.unit || '—',
            unitPrice: sl.unitPrice || p?.unitPriceAmount || 0,
            stockValue: sl.stockValue || ((p?.unitPriceAmount || 0) * sl.quantity),
          } as StockLevel;
        });
        this.stats.set(stats);
        this.stockLevels.set(enriched);
        this.movements.set(movements);
        this.dotations.set(dotations);
        this.batches.set(batches);
        this.orders.set(orders);
        this.receipts.set(receipts);
        this.alerts.set(alerts);

        this.animateKPIs(stats);
        this.computeStockAging(enriched, movements);
        this.computeReorderSuggestions(enriched, movements);
        this.computeExecutiveSummary(enriched, dotations, stats);
        this.computeVelocityMatrix(enriched, movements);
        this.computeWarehouseCapacity(enriched);
        this.computeDemandForecast(enriched, movements);
        this.computeStatKPIs(stats, movements, enriched, dotations);
        this.computeMonthlyEvolution(movements);
        this.computeQuarterlyData(movements);
        this.computeABCAnalysis(enriched);
        this.computeStockDistribution(enriched);
        this.computeTopProducts(enriched);
        this.computeDotationAnalysis(dotations);
        this.computeRadarMetrics(enriched, movements, stats);
        this.computeSectorProductionStats(batches);
        this.computeSectorReceptionStats(receipts);
        this.computeSectorAlertStats(alerts);
        this.computeSectorOrderStats(orders);
        this.computeSectorMovementStats(movements);
        this.computeStockConcentration(enriched);
        this.computeStockTurnoverScore(enriched, movements);
        this.computeStockRiskMatrix(enriched);
        this.computeStockFinancialHealth(enriched, stats);

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

  // ── Stock Aging Analysis (enhanced with buckets, per-unit, depreciation risk) ──
  private computeStockAging(levels: StockLevel[], movements: StockMovement[]) {
    const now = Date.now();
    const aging = levels.map(sl => {
      const productMoves = movements.filter(m => m.product?.sku === sl.productSku);
      const entryMoves = productMoves
        .filter(m => m.type.startsWith('RECEPTION'))
        .sort((a, b) => new Date(b.requestedAt || b.createdAt || '').getTime() - new Date(a.requestedAt || a.createdAt || '').getTime());
      const lastEntry = entryMoves[0];
      const firstEntry = entryMoves[entryMoves.length - 1];
      const avgAge = lastEntry
        ? Math.floor((now - new Date(lastEntry.requestedAt || lastEntry.createdAt || '').getTime()) / 86400000)
        : 45;
      const oldestAge = firstEntry
        ? Math.floor((now - new Date(firstEntry.requestedAt || firstEntry.createdAt || '').getTime()) / 86400000)
        : 90;
      // Enhanced risk: consider product shelf life (lead time + safety stock days as proxy)
      const shelfLifeDays = (sl.product?.leadTimeDays || 14) + (sl.product?.safetyStockDays || 30);
      const riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' =
        avgAge > shelfLifeDays * 2 ? 'HIGH' : avgAge > shelfLifeDays ? 'MEDIUM' : 'LOW';
      return {
        productName: sl.productName || '',
        sku: sl.productSku || '',
        avgAgeDays: avgAge,
        oldestAgeDays: oldestAge,
        qty: sl.quantity,
        riskLevel,
        unit: sl.productUnit || sl.product?.unit || '',
        stockValue: sl.stockValue || 0,
        shelfLifeDays
      };
    }).sort((a, b) => b.avgAgeDays - a.avgAgeDays);
    this.stockAging.set(aging.slice(0, 12));

    // Age distribution buckets
    const buckets = [
      { label: '0-7 jours', min: 0, max: 7, color: '#16a34a' },
      { label: '8-15 jours', min: 8, max: 15, color: '#0891b2' },
      { label: '16-30 jours', min: 16, max: 30, color: '#2563EB' },
      { label: '31-60 jours', min: 31, max: 60, color: '#f59e0b' },
      { label: '61-90 jours', min: 61, max: 90, color: '#EA580C' },
      { label: '90+ jours', min: 91, max: Infinity, color: '#dc2626' }
    ];
    const total = aging.length || 1;
    this.stockAgingBuckets.set(buckets.map(b => {
      const count = aging.filter(a => a.avgAgeDays >= b.min && a.avgAgeDays <= b.max).length;
      return { label: b.label, count, color: b.color, pct: Math.round((count / total) * 100) };
    }));

    // Top depreciation risk (oldest stock with highest value)
    this.topDepreciationRisk.set(
      aging
        .filter(a => a.riskLevel !== 'LOW' && a.stockValue > 0)
        .map(a => ({
          productName: a.productName,
          sku: a.sku,
          qty: a.qty,
          ageDays: a.avgAgeDays,
          potentialLoss: Math.round(a.stockValue * (a.riskLevel === 'HIGH' ? 0.15 : 0.05))
        }))
        .sort((a, b) => b.potentialLoss - a.potentialLoss)
        .slice(0, 6)
    );
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

  // ── ABC/Pareto Analysis ────────────────────────────────────
  private computeABCAnalysis(levels: StockLevel[]) {
    const sorted = levels
      .map(sl => ({ sku: sl.productSku || '', name: sl.productName || '', value: sl.stockValue || 0 }))
      .sort((a, b) => b.value - a.value);
    const totalValue = sorted.reduce((s, p) => s + p.value, 0) || 1;
    let cumValue = 0;
    const result = sorted.map(p => {
      cumValue += p.value;
      const cumPct = (cumValue / totalValue) * 100;
      const cls: 'A' | 'B' | 'C' = cumPct <= 80 ? 'A' : cumPct <= 95 ? 'B' : 'C';
      return { ...p, cumPct: Math.round(cumPct * 10) / 10, class: cls };
    });
    this.abcAnalysis.set(result);
  }

  // ── Stock Distribution by material type ────────────────────
  private computeStockDistribution(levels: StockLevel[]) {
    const colors = ['#1A6B2A', '#EA580C', '#2563EB', '#7c3aed', '#0891b2', '#dc2626', '#f59e0b'];
    const map = new Map<string, { value: number; qty: number }>();
    levels.forEach(sl => {
      const cat = this.materialTypeLabel(sl.materialType || sl.product?.materialType || 'Autre');
      const existing = map.get(cat) || { value: 0, qty: 0 };
      existing.value += sl.stockValue || 0;
      existing.qty += sl.quantity;
      map.set(cat, existing);
    });
    const result = Array.from(map.entries()).map(([label, data], i) => ({
      label, value: data.value, qty: data.qty, color: colors[i % colors.length]
    })).sort((a, b) => b.value - a.value);
    this.stockDistribution.set(result);
  }

  // ── Top Products by Value (with alert level for color coding) ──
  private computeTopProducts(levels: StockLevel[]) {
    const bySku = new Map<string, { name: string; sku: string; value: number; qty: number; alertLevel: string; unit: string }>();
    for (const sl of levels) {
      const sku = sl.productSku || sl.productName || `id-${sl.id}`;
      const existing = bySku.get(sku);
      if (existing) {
        existing.qty += sl.quantity;
        existing.value += sl.stockValue || 0;
      } else {
        bySku.set(sku, {
          name: sl.productName || sl.productSku || 'N/A',
          sku: sl.productSku || '',
          value: sl.stockValue || 0,
          qty: sl.quantity,
          alertLevel: sl.alertLevel || 'NORMAL',
          unit: sl.packagingType || sl.productUnit || sl.product?.unit || ''
        });
      }
    }
    const top = Array.from(bySku.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
    this.topProductsByValue.set(top);
  }

  // ── Dotation Analysis ──────────────────────────────────────
  private computeDotationAnalysis(dotations: DotationRequest[]) {
    const statusColors: Record<string, string> = {
      PENDING: '#f59e0b', PAYMENT_VERIFIED: '#2563EB', QUANTITY_VALIDATED: '#0891b2',
      REVIEWED: '#7c3aed', APPROVED: '#1A6B2A', DELIVERED: '#16a34a',
      CANCELLED: '#dc2626', REJECTED: '#dc2626'
    };
    const statusMap = new Map<string, number>();
    dotations.forEach(d => {
      const s = d.status || 'UNKNOWN';
      statusMap.set(s, (statusMap.get(s) || 0) + 1);
    });
    this.dotationByStatus.set(Array.from(statusMap.entries()).map(([status, count]) => ({
      status, count, color: statusColors[status] || '#6b7280'
    })));

    const commercialMap = new Map<string, { count: number; totalQty: number; pending: number }>();
    dotations.forEach(d => {
      const name = d.commercialName || 'Inconnu';
      const existing = commercialMap.get(name) || { count: 0, totalQty: 0, pending: 0 };
      existing.count++;
      existing.totalQty += d.items?.reduce((s, i) => s + (i.requestedQuantity || 0), 0) || 0;
      if (['PENDING', 'PAYMENT_VERIFIED', 'QUANTITY_VALIDATED', 'REVIEWED'].includes(d.status)) {
        existing.pending++;
      }
      commercialMap.set(name, existing);
    });
    this.dotationByCommercial.set(
      Array.from(commercialMap.entries())
        .map(([commercial, data]) => ({ commercial, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
    );
  }

  // ── Radar Metrics (multi-dimensional performance) ──────────
  private computeRadarMetrics(levels: StockLevel[], movements: StockMovement[], stats: DashboardStatsResponse) {
    const totalValue = levels.reduce((s, sl) => s + (sl.stockValue || 0), 0) || 1;
    const totalQty = levels.reduce((s, sl) => s + sl.quantity, 0) || 1;
    const criticalPct = (stats.criticalAlerts / Math.max(levels.length, 1)) * 100;
    const fastProducts = this.velocityMatrix().filter(v => v.velocity === 'FAST').length;
    const velocityScore = (fastProducts / Math.max(levels.length, 1)) * 100;
    const turnoverRate = Math.min(100, (this.totalExits() / Math.max(totalQty, 1)) * 100);
    const healthScore = 100 - criticalPct;
    const valueEfficiency = Math.min(100, (totalValue / 10000000) * 100);

    this.radarMetrics.set([
      { label: 'Santé Stock', value: Math.round(healthScore), max: 100 },
      { label: 'Vélocité', value: Math.round(velocityScore), max: 100 },
      { label: 'Rotation', value: Math.round(turnoverRate), max: 100 },
      { label: 'Valeur', value: Math.round(valueEfficiency), max: 100 },
      { label: 'Dispo.', value: Math.round(100 - criticalPct), max: 100 },
      { label: 'Diversité', value: Math.min(100, Math.round(stats.totalStockLevels / 5)), max: 100 },
    ]);
  }

  // ── Charts ─────────────────────────────────────────────────
  private buildCharts() {
    this.charts.forEach(c => c.destroy());
    this.charts = [];
    setTimeout(() => {
      this.buildEvolutionChart();
      this.buildQuarterlyChart();
      this.buildDoughnutChart();
      this.buildTopProductsChart();
      this.buildTrendLineChart();
      this.buildRadarChart();
      this.buildABCChart();
      this.buildSectorProductionChart();
      this.buildSectorReceptionChart();
      this.buildSectorAlertsChart();
      this.buildSectorOrdersChart();
      this.buildSectorMovementsChart();
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
        animation: { duration: 1000, easing: 'easeOutQuart' },
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
        animation: { duration: 1000, easing: 'easeOutQuart' },
        plugins: { legend: { position: 'top' } },
        scales: { y: { beginAtZero: true } }
      }
    }));
  }

  private buildDoughnutChart() {
    if (!this.doughnutCanvas) return;
    const data = this.stockDistribution();
    const ctx = this.doughnutCanvas.nativeElement.getContext('2d');
    if (!ctx) return;
    this.charts.push(new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: data.map(d => d.label),
        datasets: [{
          data: data.map(d => d.value),
          backgroundColor: data.map(d => d.color),
          borderWidth: 0,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { font: { size: 11, family: 'Inter' }, padding: 10 } },
          tooltip: {
            callbacks: {
              label: (ctx: any) => {
                const item = data[ctx.dataIndex];
                return `${item.label}: ${this.formatCFA(item.value)} (${item.qty} unités)`;
              }
            }
          }
        },
        cutout: '62%',
        animation: { duration: 1200, easing: 'easeOutQuart', animateRotate: true, animateScale: true }
      }
    }));
  }

  private buildTopProductsChart() {
    if (!this.topProductsCanvas) return;
    const data = this.topProductsByValue().slice(0, 8);
    const ctx = this.topProductsCanvas.nativeElement.getContext('2d');
    if (!ctx) return;
    // Color coding: Red = Critique, Orange = Faible, Green = Normal
    const alertColors: Record<string, string> = {
      CRITIQUE: 'rgba(220,38,38,.85)',
      FAIBLE: 'rgba(234,88,12,.85)',
      NORMAL: 'rgba(26,107,42,.85)',
      SURPLUS: 'rgba(37,99,235,.85)'
    };
    this.charts.push(new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(d => d.name.length > 22 ? d.name.substring(0, 20) + '…' : d.name),
        datasets: [{
          label: 'Valeur stock',
          data: data.map(d => d.value),
          backgroundColor: data.map(d => alertColors[d.alertLevel || 'NORMAL'] || alertColors['NORMAL']),
          borderWidth: 0, borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 1200, easing: 'easeOutQuart', delay: (ctx: any) => ctx.dataIndex * 80 },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx: any) => {
                const item = data[ctx.dataIndex];
                return [
                  `Valeur: ${this.formatCFA(ctx.raw)}`,
                  `Quantité: ${item.qty} ${item.unit}`,
                  `Statut: ${item.alertLevel}`
                ];
              }
            }
          }
        },
        scales: {
          x: { beginAtZero: true, ticks: { font: { size: 10, family: 'Inter' } } },
          y: { ticks: { font: { size: 10, family: 'Inter' } } }
        }
      }
    }));
  }

  private buildTrendLineChart() {
    if (!this.trendLineCanvas) return;
    const data = this.monthlyEvolution();
    const ctx = this.trendLineCanvas.nativeElement.getContext('2d');
    if (!ctx) return;
    let cumEntries = 0, cumExits = 0;
    const cumData = data.map(d => {
      cumEntries += d.entries;
      cumExits += d.exits;
      return { month: d.month, cumEntries, cumExits, net: cumEntries - cumExits };
    });
    this.charts.push(new Chart(ctx, {
      type: 'line',
      data: {
        labels: cumData.map(d => d.month),
        datasets: [
          {
            label: 'Entrées cumulées', data: cumData.map(d => d.cumEntries),
            borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,.1)',
            fill: true, tension: 0.3, borderWidth: 2, pointRadius: 3
          },
          {
            label: 'Sorties cumulées', data: cumData.map(d => d.cumExits),
            borderColor: '#ea580c', backgroundColor: 'rgba(234,88,12,.1)',
            fill: true, tension: 0.3, borderWidth: 2, pointRadius: 3
          },
          {
            label: 'Net cumulé', data: cumData.map(d => d.net),
            borderColor: '#2563EB', backgroundColor: 'transparent',
            borderDash: [5, 5], tension: 0.3, borderWidth: 2, pointRadius: 2
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { font: { size: 11, family: 'Inter' } } } },
        scales: { y: { beginAtZero: true, ticks: { font: { size: 11, family: 'Inter' } } } },
        animation: { duration: 1200, easing: 'easeInOutCubic' }
      }
    }));
  }

  private buildRadarChart() {
    if (!this.radarCanvas) return;
    const data = this.radarMetrics();
    const ctx = this.radarCanvas.nativeElement.getContext('2d');
    if (!ctx) return;
    this.charts.push(new Chart(ctx, {
      type: 'radar',
      data: {
        labels: data.map(d => d.label),
        datasets: [{
          label: 'Performance',
          data: data.map(d => d.value),
          backgroundColor: 'rgba(26,107,42,.2)',
          borderColor: '#1A6B2A',
          borderWidth: 2,
          pointBackgroundColor: '#1A6B2A',
          pointRadius: 4
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          r: {
            beginAtZero: true, max: 100,
            ticks: { font: { size: 9, family: 'Inter' }, backdropColor: 'transparent' },
            grid: { color: 'rgba(0,0,0,.08)' },
            angleLines: { color: 'rgba(0,0,0,.08)' },
            pointLabels: { font: { size: 11, family: 'Inter', weight: 'bold' } }
          }
        },
        animation: { duration: 1200, easing: 'easeInOutCubic' }
      }
    }));
  }

  private buildABCChart() {
    if (!this.abcCanvas) return;
    const data = this.abcAnalysis().slice(0, 15);
    const ctx = this.abcCanvas.nativeElement.getContext('2d');
    if (!ctx) return;
    this.charts.push(new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(d => d.sku || d.name.substring(0, 10)),
        datasets: [{
          label: 'Valeur',
          data: data.map(d => d.value),
          backgroundColor: data.map(d => d.class === 'A' ? '#1A6B2ABB' : d.class === 'B' ? '#f59e0bBB' : '#dc2626BB'),
          borderWidth: 0, borderRadius: 4
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx: any) => `Classe ${data[ctx.dataIndex].class} — ${this.formatCFA(ctx.raw)}` } }
        },
        scales: {
          x: { ticks: { font: { size: 8, family: 'Inter' }, maxRotation: 45 } },
          y: { beginAtZero: true, ticks: { font: { size: 10, family: 'Inter' } } }
        },
        animation: { duration: 1000, easing: 'easeOutQuart', delay: (ctx: any) => ctx.dataIndex * 60 }
      }
    }));
  }

  // ── Per-sector statistics computations ─────────────────────
  private computeSectorProductionStats(batches: ProductionBatch[]) {
    const statusColors: Record<string, string> = {
      DECLARED_BY_PRODUCTION: '#f59e0b',
      VALIDATED_BY_STOCK: '#1A6B2A',
      REJECTED: '#dc2626'
    };
    const statusLabels: Record<string, string> = {
      DECLARED_BY_PRODUCTION: 'Déclarés',
      VALIDATED_BY_STOCK: 'Validés',
      REJECTED: 'Rejetés'
    };
    const map = new Map<string, number>();
    batches.forEach(b => {
      const s = b.status || 'UNKNOWN';
      map.set(s, (map.get(s) || 0) + 1);
    });
    this.sectorProductionStats.set(Array.from(map.entries()).map(([status, count]) => ({
      label: statusLabels[status] || status,
      count,
      color: statusColors[status] || '#6b7280'
    })));
  }

  private computeSectorReceptionStats(receipts: Receipt[]) {
    const statusColors: Record<string, string> = {
      PENDING: '#f59e0b', FIRST_VALIDATED: '#2563EB', VALIDATED: '#1A6B2A',
      REJECTED: '#dc2626', CANCELLED: '#6b7280'
    };
    const statusLabels: Record<string, string> = {
      PENDING: 'En attente', FIRST_VALIDATED: '1ère validation', VALIDATED: 'Validées',
      REJECTED: 'Rejetées', CANCELLED: 'Annulées'
    };
    const map = new Map<string, number>();
    receipts.forEach(r => {
      const s = r.status || 'UNKNOWN';
      map.set(s, (map.get(s) || 0) + 1);
    });
    this.sectorReceptionStats.set(Array.from(map.entries()).map(([status, count]) => ({
      label: statusLabels[status] || status,
      count,
      color: statusColors[status] || '#6b7280'
    })));
  }

  private computeSectorAlertStats(alerts: StockAlertEntity[]) {
    const typeColors: Record<string, string> = {
      LOW_STOCK: '#f59e0b', CRITICAL_STOCK: '#dc2626', BUFFER_INSUFFICIENT: '#ea580c',
      EXPIRED: '#7c3aed', NEAR_EXPIRY: '#8b5cf6', SLOW_ROTATION: '#0891b2',
      ANOMALY: '#6b7280'
    };
    const typeLabels: Record<string, string> = {
      LOW_STOCK: 'Stock bas', CRITICAL_STOCK: 'Stock critique', BUFFER_INSUFFICIENT: 'Tampon insuffisant',
      EXPIRED: 'Expiré', NEAR_EXPIRY: 'Péremption proche', SLOW_ROTATION: 'Rotation lente',
      ANOMALY: 'Anomalie'
    };
    const map = new Map<string, number>();
    alerts.forEach(a => {
      const t = a.type || 'UNKNOWN';
      map.set(t, (map.get(t) || 0) + 1);
    });
    this.sectorAlertStats.set(Array.from(map.entries()).map(([type, count]) => ({
      label: typeLabels[type] || type,
      count,
      color: typeColors[type] || '#6b7280'
    })));
  }

  private computeSectorOrderStats(orders: InternalOrder[]) {
    const statusColors: Record<string, string> = {
      PENDING: '#f59e0b', APPROVED: '#1A6B2A', DELIVERED: '#16a34a',
      CANCELLED: '#dc2626'
    };
    const statusLabels: Record<string, string> = {
      PENDING: 'En attente', APPROVED: 'Approuvées', DELIVERED: 'Livrées',
      CANCELLED: 'Annulées'
    };
    const map = new Map<string, number>();
    orders.forEach(o => {
      const s = o.status || 'UNKNOWN';
      map.set(s, (map.get(s) || 0) + 1);
    });
    this.sectorOrderStats.set(Array.from(map.entries()).map(([status, count]) => ({
      label: statusLabels[status] || status,
      count,
      color: statusColors[status] || '#6b7280'
    })));
  }

  private computeSectorMovementStats(movements: StockMovement[]) {
    const typeColors: Record<string, string> = {
      RECEPTION_MP: '#1A6B2A', RECEPTION_PF: '#16a34a', SALE: '#ea580c',
      TRANSFER_BUFFER_TO_MOBILE: '#2563EB', TRANSFER_CENTRAL_TO_BUFFER: '#7c3aed',
      ADJUSTMENT: '#f59e0b', DOTATION: '#0891b2'
    };
    const typeLabels: Record<string, string> = {
      RECEPTION_MP: 'Réception MP', RECEPTION_PF: 'Réception PF', SALE: 'Vente',
      TRANSFER_BUFFER_TO_MOBILE: 'Transfert Tampon→Mobile', TRANSFER_CENTRAL_TO_BUFFER: 'Transfert Central→Tampon',
      ADJUSTMENT: 'Ajustement', DOTATION: 'Dotation'
    };
    const map = new Map<string, number>();
    movements.forEach(m => {
      const t = m.type || 'UNKNOWN';
      map.set(t, (map.get(t) || 0) + 1);
    });
    this.sectorMovementStats.set(Array.from(map.entries()).map(([type, count]) => ({
      label: typeLabels[type] || type,
      count,
      color: typeColors[type] || '#6b7280'
    })).sort((a, b) => b.count - a.count));
  }

  // ── Per-sector charts ──────────────────────────────────────
  private buildSectorProductionChart() {
    if (!this.sectorProductionCanvas) return;
    const data = this.sectorProductionStats();
    const ctx = this.sectorProductionCanvas.nativeElement.getContext('2d');
    if (!ctx) return;
    this.charts.push(new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: data.map(d => d.label),
        datasets: [{ data: data.map(d => d.count), backgroundColor: data.map(d => d.color), borderWidth: 0, borderRadius: 6 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 11, family: 'Inter' }, padding: 8 } },
          tooltip: { callbacks: { label: (c: any) => `${data[c.dataIndex].label}: ${c.raw} lot(s)` } }
        }, cutout: '60%',
        animation: { duration: 1000, easing: 'easeOutQuart', animateRotate: true, animateScale: true }
      }
    }));
  }

  private buildSectorReceptionChart() {
    if (!this.sectorReceptionCanvas) return;
    const data = this.sectorReceptionStats();
    const ctx = this.sectorReceptionCanvas.nativeElement.getContext('2d');
    if (!ctx) return;
    this.charts.push(new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(d => d.label),
        datasets: [{ label: 'Réceptions', data: data.map(d => d.count), backgroundColor: data.map(d => d.color + 'BB'), borderWidth: 0, borderRadius: 6 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { font: { size: 11, family: 'Inter' } } }, x: { ticks: { font: { size: 10, family: 'Inter' } } } },
        animation: { duration: 1000, easing: 'easeOutQuart', delay: (ctx: any) => ctx.dataIndex * 50 }
      }
    }));
  }

  private buildSectorAlertsChart() {
    if (!this.sectorAlertsCanvas) return;
    const data = this.sectorAlertStats();
    const ctx = this.sectorAlertsCanvas.nativeElement.getContext('2d');
    if (!ctx) return;
    this.charts.push(new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(d => d.label),
        datasets: [{ label: 'Alertes', data: data.map(d => d.count), backgroundColor: data.map(d => d.color + 'BB'), borderWidth: 0, borderRadius: 6 }]
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, ticks: { font: { size: 10, family: 'Inter' } } }, y: { ticks: { font: { size: 10, family: 'Inter' } } } },
        animation: { duration: 1000, easing: 'easeOutQuart', delay: (ctx: any) => ctx.dataIndex * 50 }
      }
    }));
  }

  private buildSectorOrdersChart() {
    if (!this.sectorOrdersCanvas) return;
    const data = this.sectorOrderStats();
    const ctx = this.sectorOrdersCanvas.nativeElement.getContext('2d');
    if (!ctx) return;
    this.charts.push(new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: data.map(d => d.label),
        datasets: [{ data: data.map(d => d.count), backgroundColor: data.map(d => d.color), borderWidth: 0, borderRadius: 6 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 11, family: 'Inter' }, padding: 8 } },
          tooltip: { callbacks: { label: (c: any) => `${data[c.dataIndex].label}: ${c.raw} commande(s)` } }
        }, cutout: '60%',
        animation: { duration: 1000, easing: 'easeOutQuart', animateRotate: true, animateScale: true }
      }
    }));
  }

  private buildSectorMovementsChart() {
    if (!this.sectorMovementsCanvas) return;
    const data = this.sectorMovementStats();
    const ctx = this.sectorMovementsCanvas.nativeElement.getContext('2d');
    if (!ctx) return;
    this.charts.push(new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(d => d.label.length > 20 ? d.label.substring(0, 18) + '…' : d.label),
        datasets: [{ label: 'Mouvements', data: data.map(d => d.count), backgroundColor: data.map(d => d.color + 'BB'), borderWidth: 0, borderRadius: 6 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { font: { size: 11, family: 'Inter' } } }, x: { ticks: { font: { size: 9, family: 'Inter' }, maxRotation: 45 } } },
        animation: { duration: 1000, easing: 'easeOutQuart', delay: (ctx: any) => ctx.dataIndex * 50 }
      }
    }));
  }

  // ── Impressive Stat: Stock Concentration (top products share of total value) ──
  private computeStockConcentration(levels: StockLevel[]) {
    const totalValue = levels.reduce((s, sl) => s + (sl.stockValue || 0), 0) || 1;
    const sorted = [...levels].sort((a, b) => (b.stockValue || 0) - (a.stockValue || 0));
    const top5 = sorted.slice(0, 5).reduce((s, sl) => s + (sl.stockValue || 0), 0);
    const top10 = sorted.slice(0, 10).reduce((s, sl) => s + (sl.stockValue || 0), 0);
    const top20 = sorted.slice(0, 20).reduce((s, sl) => s + (sl.stockValue || 0), 0);
    const rest = totalValue - top20;
    const colors = ['#1A6B2A', '#16a34a', '#0891b2', '#6b7280'];
    this.stockConcentration.set([
      { label: 'Top 5 produits', value: top5, pct: Math.round((top5 / totalValue) * 100), color: colors[0] },
      { label: 'Top 10 produits', value: top10, pct: Math.round((top10 / totalValue) * 100), color: colors[1] },
      { label: 'Top 20 produits', value: top20, pct: Math.round((top20 / totalValue) * 100), color: colors[2] },
      { label: 'Reste du stock', value: rest, pct: Math.round((rest / totalValue) * 100), color: colors[3] }
    ]);
  }

  // ── Impressive Stat: Stock Turnover Score (0-100) ──
  private computeStockTurnoverScore(levels: StockLevel[], movements: StockMovement[]) {
    const now = Date.now();
    const totalExits = movements
      .filter(m => (m.type === 'SALE' || m.type === 'TRANSFER_BUFFER_TO_MOBILE') &&
        now - new Date(m.requestedAt || m.createdAt || '').getTime() < 30 * 86400000)
      .reduce((s, m) => s + m.quantity, 0);
    const totalStock = levels.reduce((s, sl) => s + sl.quantity, 0) || 1;
    const turnoverRatio = totalExits / totalStock;
    const score = Math.min(100, Math.round(turnoverRatio * 100));
    this.stockTurnoverScore.set(score);
  }

  // ── Impressive Stat: Risk Matrix by warehouse ──
  private computeStockRiskMatrix(levels: StockLevel[]) {
    const warehouses = new Map<string, { low: number; medium: number; high: number }>();
    levels.forEach(sl => {
      const wh = sl.warehouseName || 'Inconnu';
      const curr = warehouses.get(wh) || { low: 0, medium: 0, high: 0 };
      const aging = this.stockAging().find(a => a.sku === sl.productSku);
      if (aging) {
        if (aging.riskLevel === 'HIGH') curr.high++;
        else if (aging.riskLevel === 'MEDIUM') curr.medium++;
        else curr.low++;
      } else {
        curr.low++;
      }
      warehouses.set(wh, curr);
    });
    this.stockRiskMatrix.set(
      Array.from(warehouses.entries())
        .map(([label, data]) => ({ label, ...data }))
        .sort((a, b) => (b.high + b.medium) - (a.high + a.medium))
        .slice(0, 8)
    );
  }

  // ── Impressive Stat: Financial Health Indicators ──
  private computeStockFinancialHealth(levels: StockLevel[], stats: DashboardStatsResponse) {
    const totalValue = levels.reduce((s, sl) => s + (sl.stockValue || 0), 0);
    const criticalValue = levels.filter(sl => sl.alertLevel === 'CRITIQUE').reduce((s, sl) => s + (sl.stockValue || 0), 0);
    const surplusValue = levels.filter(sl => sl.alertLevel === 'SURPLUS').reduce((s, sl) => s + (sl.stockValue || 0), 0);
    const normalValue = levels.filter(sl => sl.alertLevel === 'NORMAL').reduce((s, sl) => s + (sl.stockValue || 0), 0);
    const lowValue = levels.filter(sl => sl.alertLevel === 'FAIBLE').reduce((s, sl) => s + (sl.stockValue || 0), 0);
    this.stockFinancialHealth.set([
      { label: 'Stock sain', value: normalValue, max: totalValue || 1, color: '#1A6B2A' },
      { label: 'Stock faible', value: lowValue, max: totalValue || 1, color: '#EA580C' },
      { label: 'Stock critique', value: criticalValue, max: totalValue || 1, color: '#dc2626' },
      { label: 'Stock surplus', value: surplusValue, max: totalValue || 1, color: '#2563EB' }
    ]);
  }

  // ── Template helpers for Math operations ──
  roundPct(value: number, max: number): number {
    return Math.round((value / max) * 100);
  }
  bucketHeight(count: number): number {
    return Math.max(4, count * 8);
  }
  setDisplayMode(mode: 'table' | 'grid' | 'cards') {
    this.displayMode.set(mode);
  }

  private materialTypeLabel(mt: string): string {
    const labels: Record<string, string> = {
      PRODUIT_FINI: 'Produit Fini',
      MATIERE_PREMIERE: 'Matière Première',
      CONSOMMABLE: 'Consommable',
      MATERIEL: 'Matériel'
    };
    return labels[mt] || mt || 'Autre';
  }

  printPage() {
    this.printing.set(true);
    setTimeout(() => {
      window.print();
      this.printing.set(false);
    }, 300);
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
