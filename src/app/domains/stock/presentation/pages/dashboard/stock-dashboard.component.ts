// â•â•â• FICHIER : src/app/domains/stock/presentation/pages/dashboard/stock-dashboard.component.ts â•â•â•
// REMPLACE : le fichier existant â€” Dashboard puissant, connectÃ© au backend, KPIs avancÃ©s
import {
  Component, OnInit, signal, inject, OnDestroy, AfterViewInit,
  ViewChild, ElementRef, ChangeDetectorRef, computed
} from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject, forkJoin, takeUntil, catchError, of } from 'rxjs';
import { Chart, registerables } from 'chart.js';

import { GetDashboardUseCase } from '../../../application/use-cases/dashboard/get-dashboard.use-case';
import { StockApiRepository } from '../../../infrastructure/repositories/stock-api.repository';
import { StockRulesDomainService } from '../../../domain/services/stock-rules.domain.service';
import { DotationUseCase } from '../../../application/use-cases/dotation/dotation.use-case';
import {
  DashboardStatsResponse, StockLevel, Receipt, StockMovement,
  ProductionBatch, InternalOrder, DotationRequest
} from '../../../domain/models';
import { IaService, AnalysisResponse, IaSuggestion } from '../../../../../core/services/ia.service';

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
  private readonly repo = inject(StockApiRepository);
  private readonly rules = inject(StockRulesDomainService);
  private readonly dotationUC = inject(DotationUseCase);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly iaService = inject(IaService);

  // Chart references
  @ViewChild('stockBarCanvas') stockBarCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('donutCanvas') donutCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('movementsCanvas') movementsCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('alertRadarCanvas') alertRadarCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('trendCanvas') trendCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('healthGaugeCanvas') healthGaugeCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('abcCanvas') abcCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('flowCanvas') flowCanvas!: ElementRef<HTMLCanvasElement>;

  private charts: Chart[] = [];

  loading = signal(true);
  error = signal('');
  skeletonItems = [1, 2, 3, 4, 5, 6];
  today = new Date();
  chartsReady = signal(false);
  selectedPeriod = signal<'today' | 'week' | 'month'>('today');
  autoRefresh = signal(false);
  private refreshTimer: any;

  stats = signal<DashboardStatsResponse | null>(null);
  alerts = signal<StockLevel[]>([]);
  receipts = signal<Receipt[]>([]);
  movements = signal<StockMovement[]>([]);
  stockLevels = signal<StockLevel[]>([]);
  batches = signal<ProductionBatch[]>([]);
  orders = signal<InternalOrder[]>([]);
  activeTab = signal<'receipts' | 'movements' | 'batches'>('receipts');

  // KPIs calculÃ©s
  totalValue = signal(0);
  avgStockByWarehouse = signal<{ name: string; value: number }[]>([]);
  topProducts = signal<StockLevel[]>([]);
  criticalCount = signal(0);
  lowCount = signal(0);
  surplusCount = signal(0);

  // â•â•â• INNOVATIONS â•â•â•
  // 1. Score de santÃ© stock (0-100)
  healthScore = signal(0);
  healthLabel = signal('â€”');
  healthColor = signal('var(--g)');
  healthBreakdown = signal<{ label: string; score: number; weight: number }[]>([]);

  // 2. Analyse ABC / Pareto
  abcData = signal<{ class: 'A' | 'B' | 'C'; count: number; value: number; pctValue: number; pctItems: number }[]>([]);

  // 3. PrÃ©dictions de rupture de stock
  stockOutPredictions = signal<{ productName: string; sku: string; currentQty: number; dailyConsumption: number; daysLeft: number; urgency: 'CRITICAL' | 'WARNING' | 'SAFE' }[]>([]);

  // 4. Pipeline dotation workflow
  dotationPipeline = signal<{ step: string; label: string; icon: string; count: number; color: string }[]>([]);
  totalDotations = signal(0);

  // 5. Flux de stock (Central â†’ Buffer â†’ Mobile)
  stockFlow = signal<{ from: string; to: string; value: number }[]>([]);

  // 6. Taux de rotation
  turnoverRates = signal<{ productName: string; sku: string; turnoverRate: number; daysOfCover: number }[]>([]);

  // 7. Inventaire produits — recherche, filtre, tri
  productSearch = signal('');
  warehouseFilter = signal('');
  alertFilter = signal('');
  productSort = signal<'value' | 'name' | 'qty' | 'alert'>('value');
  productSortDir = signal<'asc' | 'desc'>('desc');
  displayMode = signal<'table' | 'grid' | 'cards'>('table');
  invPage = signal(1);
  invPageSize = 12;

  paginatedProducts = computed(() => {
    const start = (this.invPage() - 1) * this.invPageSize;
    return this.filteredProducts().slice(start, start + this.invPageSize);
  });
  invTotalPages = computed(() => Math.max(1, Math.ceil(this.filteredProducts().length / this.invPageSize)));
  invPageRange = computed(() => Array.from({ length: this.invTotalPages() }, (_, i) => i + 1));

  setDisplayMode(mode: 'table' | 'grid' | 'cards') {
    this.displayMode.set(mode);
  }
  setInvPage(page: number) {
    this.invPage.set(page);
  }

  // 8. Insights IA (TantyAI — GPT-OSS via OpenRouter)
  iaConfigured = signal(false);
  iaInsight = signal<AnalysisResponse | null>(null);
  iaInsightLoading = signal(false);
  showIaInsight = signal(false);

  // 9. Conseils IA proactifs pour le gestionnaire de stock
  iaSuggestions = signal<IaSuggestion[]>([]);
  iaSuggestionsLoading = signal(false);
  private iaSuggestionsLoaded = false;

  ngOnInit() {
    this.loadAll();
    this.iaService.getStatus().pipe(
      takeUntil(this.destroy$),
      catchError(() => of({ configured: false, model: '', service: 'TantyAI' }))
    ).subscribe(s => this.iaConfigured.set(s.configured));
  }

  // ═══════════════════════════════════════════════════════════
  //  INNOVATION 8: Insights IA du dashboard (TantyAI)
  // ═══════════════════════════════════════════════════════════

  runIaInsight() {
    if (this.iaInsightLoading()) return;
    this.showIaInsight.set(true);
    this.iaInsightLoading.set(true);
    this.iaInsight.set(null);

    const levels = this.stockLevels();
    const stats = this.stats();
    const movs = this.movements();

    const stockData: Record<string, unknown> = {
      totalReferences: levels.length,
      valeurTotaleStock: this.totalValue(),
      alertesCritiques: this.criticalCount(),
      alertesFaibles: this.lowCount(),
      surplus: this.surplusCount(),
      scoreSante: this.healthScore(),
      mouvementsDuJour: stats?.todayMovements ?? 0,
      topProduits: this.topProducts().map(sl => ({
        produit: sl.productName || sl.productSku,
        quantite: sl.quantity,
        valeur: sl.stockValue,
        alerte: sl.alertLevel
      })),
      repartitionEntrepots: this.avgStockByWarehouse()
    };

    const movementData: Record<string, unknown> = {
      derniersMovements: movs.slice(0, 10).map(m => ({
        type: m.type, quantite: m.quantity, date: m.requestedAt || m.createdAt
      })),
      predictionsRupture: this.stockOutPredictions().map(p => ({
        produit: p.productName, joursRestants: p.daysLeft, urgence: p.urgency
      }))
    };

    this.iaService.analyze({
      analysisType: 'dashboard',
      domain: 'stock',
      period: this.selectedPeriod(),
      stockData,
      movementData
    }).pipe(
      takeUntil(this.destroy$),
      catchError(() => of(null))
    ).subscribe(resp => {
      this.iaInsightLoading.set(false);
      this.iaInsight.set(resp);
    });
  }

  closeIaInsight() {
    this.showIaInsight.set(false);
  }

  /** Conseils IA proactifs : chargés une seule fois après le 1er chargement des données */
  private loadIaSuggestions() {
    if (this.iaSuggestionsLoaded) return;
    this.iaSuggestionsLoaded = true;
    this.iaSuggestionsLoading.set(true);

    this.iaService.getSuggestions({
      domain: 'stock',
      role: 'gestionnaire de stock',
      maxSuggestions: 4,
      data: {
        alertesCritiques: this.criticalCount(),
        alertesFaibles: this.lowCount(),
        surplus: this.surplusCount(),
        scoreSante: this.healthScore(),
        valeurTotaleStock: this.totalValue(),
        totalReferences: this.stockLevels().length,
        predictionsRupture: this.stockOutPredictions().slice(0, 5).map(p => ({
          produit: p.productName, joursRestants: p.daysLeft, urgence: p.urgency
        })),
        tauxRotation: this.turnoverRates().slice(0, 5)
      }
    }).pipe(
      takeUntil(this.destroy$),
      catchError(() => of(null))
    ).subscribe(resp => {
      this.iaSuggestionsLoading.set(false);
      const suggestions = (resp?.suggestions ?? []).map(s => ({
        ...s,
        message: this.cleanSuggestionMessage(s.message),
        title: this.cleanSuggestionMessage(s.title) || s.title
      }));
      this.iaSuggestions.set(suggestions);
    });
  }

  refreshIaSuggestions() {
    this.iaSuggestionsLoaded = false;
    this.loadIaSuggestions();
  }

  getIaCategoryColor(category: string): string {
    const c = (category || '').toUpperCase();
    if (c === 'ALERTE') return 'var(--r)';
    if (c === 'REAPPRO') return 'var(--y-d)';
    if (c === 'ORGANISATION') return 'var(--b)';
    if (c === 'FORMATION') return 'var(--g-m)';
    return 'var(--g)';
  }

  getIaPriorityClass(priority: string): string {
    const p = (priority || '').toUpperCase();
    if (p === 'HIGH' || p === 'HAUTE' || p === 'CRITICAL') return 'badge-danger';
    if (p === 'MEDIUM' || p === 'MOYENNE') return 'badge-warning';
    return 'badge-success';
  }

  private cleanSuggestionMessage(text: string): string {
    if (!text) return '';
    let cleaned = text.trim();
    // Strip <think>...</think> blocks
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    // Strip markdown code fences
    if (cleaned.startsWith('```')) {
      const nl = cleaned.indexOf('\n');
      if (nl > 0) cleaned = cleaned.substring(nl + 1);
      if (cleaned.endsWith('```')) cleaned = cleaned.substring(0, cleaned.length - 3);
      cleaned = cleaned.trim();
    }
    // If the text looks like JSON, try to extract readable content
    if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
      try {
        const parsed = JSON.parse(cleaned);
        if (parsed.message && typeof parsed.message === 'string') return parsed.message;
        if (parsed.summary && typeof parsed.summary === 'string') return parsed.summary;
        if (Array.isArray(parsed.suggestions) && parsed.suggestions.length > 0) {
          return parsed.suggestions.map((s: any) => s.title || s.message || '').filter(Boolean).join(' • ');
        }
      } catch {
        // Not valid JSON, return as-is
      }
    }
    return cleaned;
  }

  setPeriod(period: 'today' | 'week' | 'month') {
    this.selectedPeriod.set(period);
    this.loadAll();
  }

  toggleAutoRefresh() {
    this.autoRefresh.set(!this.autoRefresh());
    if (this.autoRefresh()) {
      this.refreshTimer = setInterval(() => this.loadAll(), 30000);
    } else {
      clearInterval(this.refreshTimer);
    }
  }

  ngAfterViewInit() {
    if (!this.loading()) this.buildCharts();
  }

  loadAll() {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      stats: this.dashUC.getStats(),
      alerts: this.dashUC.getAlerts(),
      receipts: this.repo.getReceipts(),
      movs: this.repo.getMovements(),
      levels: this.repo.getStockLevels(),
      batches: this.repo.getBatches(),
      orders: this.repo.getOrders(),
      dotations: this.dotationUC.getAll(),
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: ({ stats, alerts, receipts, movs, levels, batches, orders, dotations }) => {
        this.stats.set(stats);
        this.alerts.set(alerts);
        this.receipts.set(receipts.slice(0, 8));
        this.movements.set(movs.slice(0, 10));
        this.stockLevels.set(levels);
        this.batches.set(batches);
        this.orders.set(orders);

        // KPIs calculÃ©s
        this.totalValue.set(stats.totalStockValue);
        this.criticalCount.set(levels.filter(sl => sl.alertLevel === 'CRITIQUE').length);
        this.lowCount.set(levels.filter(sl => sl.alertLevel === 'FAIBLE').length);
        this.surplusCount.set(levels.filter(sl => sl.alertLevel === 'SURPLUS').length);
        // Top 5 par valeur — agrégé par SKU pour éviter les doublons
        const topBySku = new Map<string, StockLevel>();
        for (const sl of levels) {
          const sku = sl.productSku || `id-${sl.id}`;
          const existing = topBySku.get(sku);
          if (existing) {
            existing.quantity = (existing.quantity || 0) + (sl.quantity || 0);
            existing.stockValue = (existing.stockValue || 0) + (sl.stockValue || 0);
          } else {
            topBySku.set(sku, { ...sl });
          }
        }
        this.topProducts.set([...topBySku.values()].sort((a, b) => (b.stockValue || 0) - (a.stockValue || 0)).slice(0, 5));

        // Valeur par entrepÃ´t
        const whMap = new Map<string, number>();
        levels.forEach(sl => {
          const name = sl.warehouseName || `EntrepÃ´t ${sl.warehouseId}`;
          whMap.set(name, (whMap.get(name) || 0) + (sl.stockValue || 0));
        });
        this.avgStockByWarehouse.set(Array.from(whMap.entries()).map(([name, value]) => ({ name, value })));

        // â•â•â• INNOVATIONS â•â•â•
        this.computeHealthScore(levels, stats);
        this.computeABCAnalysis(levels);
        this.computeStockOutPredictions(levels, movs);
        this.computeDotationPipeline(dotations);
        this.computeStockFlow(levels, movs);
        this.computeTurnoverRates(levels, movs);

        this.loading.set(false);
        this.cdr.detectChanges();
        setTimeout(() => this.buildCharts(), 120);
        this.loadIaSuggestions();
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set('Erreur de chargement du dashboard. VÃ©rifiez la connexion au serveur.');
      }
    });
  }

  buildCharts() {
    this.charts.forEach(c => c.destroy());
    this.charts = [];
    if (this.stockBarCanvas) this.buildStockBarChart();
    if (this.donutCanvas) this.buildDonutChart();
    if (this.movementsCanvas) this.buildMovementsChart();
    if (this.alertRadarCanvas) this.buildAlertRadarChart();
    if (this.trendCanvas) this.buildTrendChart();
    if (this.healthGaugeCanvas) this.buildHealthGaugeChart();
    if (this.abcCanvas) this.buildABCChart();
    if (this.flowCanvas) this.buildFlowChart();
    this.chartsReady.set(true);
  }

  /** Chart barres : Top 8 produits par valeur vs seuil */
  private buildStockBarChart() {
    const top = [...this.stockLevels()]
      .sort((a, b) => (b.stockValue || 0) - (a.stockValue || 0))
      .slice(0, 8);

    const labels = top.map(sl => (sl.productName || sl.productSku || '').substring(0, 18));
    const qty = top.map(sl => sl.quantity);
    const reorder = top.map(sl => sl.reorderPoint);
    const colors = top.map(sl =>
      sl.alertLevel === 'CRITIQUE' ? 'rgba(194,43,43,.85)' :
        sl.alertLevel === 'FAIBLE' ? 'rgba(216,67,21,.85)' :
          'rgba(20,83,45,.85)'
    );

    const ctx = this.stockBarCanvas.nativeElement.getContext('2d')!;
    this.charts.push(new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Stock actuel', data: qty, backgroundColor: colors, borderRadius: 6, borderSkipped: false },
          { label: 'Seuil rÃ©appro.', data: reorder, backgroundColor: 'rgba(246,182,11,.35)', borderColor: 'rgba(196,146,0,.8)', borderWidth: 2, borderRadius: 4, borderSkipped: false, type: 'bar' },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { font: { family: 'Poppins', size: 11, weight: 600 }, usePointStyle: true, padding: 14 } },
          tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${new Intl.NumberFormat('fr-CM').format(ctx.parsed.y ?? 0)}` } }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,.04)' }, ticks: { font: { family: 'Inter', size: 11 } } },
          x: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 10 }, maxRotation: 35 } }
        },
        animation: { duration: 1200, easing: 'easeOutQuart', delay: (ctx: any) => ctx.dataIndex * 80 }
      }
    }));
  }

  /** Donut : Valeur par entrepÃ´t */
  private buildDonutChart() {
    const whData = this.avgStockByWarehouse();
    const labels = whData.map(w => w.name);
    const values = whData.map(w => w.value);
    const palette = ['rgba(20,83,45,.85)', 'rgba(246,182,11,.85)', 'rgba(2,119,189,.85)', 'rgba(107,114,128,.6)', 'rgba(194,43,43,.7)'];

    const ctx = this.donutCanvas.nativeElement.getContext('2d')!;
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
        cutout: '65%',
        plugins: {
          legend: { position: 'bottom', labels: { font: { family: 'Inter', size: 10, weight: 500 }, padding: 10, usePointStyle: true } },
          tooltip: {
            callbacks: {
              label: ctx => {
                const total = (ctx.dataset.data as number[]).reduce((a, v) => a + v, 0);
                const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : '0';
                return ` ${ctx.label}: ${new Intl.NumberFormat('fr-CM').format(Math.round(ctx.parsed))} FCFA (${pct}%)`;
              }
            }
          }
        },
        animation: { duration: 1200, easing: 'easeOutQuart', animateRotate: true, animateScale: true }
      }
    }));
  }

  /** Barres horizontales : Mouvements par type */
  private buildMovementsChart() {
    const movs = this.movements();
    const entrees = movs.filter(m => m.type.startsWith('RECEPTION')).length;
    const sorties = movs.filter(m => m.type === 'SALE' || m.type === 'TRANSFER_BUFFER_TO_MOBILE').length;
    const ajust = movs.filter(m => m.type === 'ADJUSTMENT').length;
    const transfert = movs.filter(m => m.type === 'TRANSFER_CENTRAL_TO_BUFFER').length;
    const virement = movs.filter(m => m.type === 'TRANSFER_MOBILE_TO_CENTRAL').length;

    const ctx = this.movementsCanvas.nativeElement.getContext('2d')!;
    this.charts.push(new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['EntrÃ©es (Frns/Prod)', 'Sorties commerc.', 'Ajustements', 'Transferts tampon', 'Virements inter-comm.'],
        datasets: [{
          label: 'Mouvements',
          data: [entrees, sorties, ajust, transfert, virement],
          backgroundColor: ['rgba(20,83,45,.85)', 'rgba(194,43,43,.8)', 'rgba(107,114,128,.6)', 'rgba(246,182,11,.85)', 'rgba(2,119,189,.7)'],
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
          x: { beginAtZero: true, grid: { color: 'rgba(0,0,0,.04)' }, ticks: { font: { family: 'Inter', size: 11 } } },
          y: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 11 } } }
        },
        animation: { duration: 1000, easing: 'easeOutQuart', delay: (ctx: any) => ctx.dataIndex * 80 }
      }
    }));
  }

  /** Polar Area : Distribution des alertes */
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
        labels: ['Critiques', 'Faibles', 'Normaux', 'Surplus'],
        datasets: [{
          data: [critique, faible, normal, surplus],
          backgroundColor: ['rgba(194,43,43,.7)', 'rgba(216,67,21,.7)', 'rgba(20,83,45,.7)', 'rgba(2,119,189,.7)'],
          borderWidth: 2, borderColor: '#fff',
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { font: { family: 'Inter', size: 10, weight: 500 }, padding: 10 } },
          tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed.r} article(s)` } }
        },
        scales: { r: { grid: { color: 'rgba(0,0,0,.05)' }, ticks: { font: { family: 'Inter', size: 10 }, stepSize: 1 } } },
        animation: { duration: 1200, easing: 'easeOutQuart', animateRotate: true, animateScale: true }
      }
    }));
  }

  /** Ligne : Tendance mouvements (derniers 7 jours) */
  private buildTrendChart() {
    const movs = this.movements().slice(0, 14);
    // Grouper par date
    const dateMap = new Map<string, { entrees: number; sorties: number }>();
    movs.forEach(m => {
      const d = (m.requestedAt || m.createdAt || '').substring(0, 10);
      if (!d) return;
      const curr = dateMap.get(d) || { entrees: 0, sorties: 0 };
      if (this.isEntree(m.type)) curr.entrees += m.quantity;
      else curr.sorties += m.quantity;
      dateMap.set(d, curr);
    });
    const dates = Array.from(dateMap.keys()).slice(-7);
    const entrees = dates.map(d => dateMap.get(d)?.entrees || 0);
    const sorties = dates.map(d => dateMap.get(d)?.sorties || 0);
    const labels = dates.map(d => new Date(d).toLocaleDateString('fr-CM', { day: '2-digit', month: 'short' }));

    const ctx = this.trendCanvas.nativeElement.getContext('2d')!;
    this.charts.push(new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'EntrÃ©es', data: entrees, borderColor: 'rgba(20,83,45,1)', backgroundColor: 'rgba(20,83,45,.08)', fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: 'rgba(20,83,45,1)' },
          { label: 'Sorties', data: sorties, borderColor: 'rgba(194,43,43,1)', backgroundColor: 'rgba(194,43,43,.08)', fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: 'rgba(194,43,43,1)' },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { font: { family: 'Poppins', size: 11, weight: 600 }, usePointStyle: true, padding: 14 } }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,.04)' }, ticks: { font: { family: 'Inter', size: 11 } } },
          x: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 10 } } }
        },
        animation: { duration: 1200, easing: 'easeInOutCubic' }
      }
    }));
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // INNOVATION 1: Score de SantÃ© Stock (Gauge 0-100)
  // Composite: taux de couverture (40%), taux d'alertes (30%), taux de rotation (20%), diversitÃ© (10%)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  private computeHealthScore(levels: StockLevel[], stats: DashboardStatsResponse) {
    const total = levels.length || 1;
    const critical = levels.filter(sl => sl.alertLevel === 'CRITIQUE').length;
    const low = levels.filter(sl => sl.alertLevel === 'FAIBLE').length;
    const normal = levels.filter(sl => sl.alertLevel === 'NORMAL').length;

    // 1. Taux de couverture (pas critique/faible)
    const coverageScore = Math.round(((total - critical - low) / total) * 100);
    // 2. Taux d'alertes (inversÃ©: plus d'alertes = score bas)
    const alertScore = Math.round((1 - (critical * 2 + low) / (total * 2)) * 100);
    // 3. Taux de rotation (mouvements vs niveaux)
    const turnoverScore = Math.min(100, Math.round((stats.todayMovements / Math.max(total, 1)) * 100));
    // 4. DiversitÃ© (rÃ©partition Ã©quilibrÃ©e des niveaux)
    const diversityScore = Math.round((normal / total) * 100);

    const score = Math.round(
      coverageScore * 0.4 + alertScore * 0.3 + turnoverScore * 0.2 + diversityScore * 0.1
    );

    this.healthScore.set(score);
    this.healthLabel.set(score >= 80 ? 'Excellent' : score >= 60 ? 'Bon' : score >= 40 ? 'Moyen' : score >= 20 ? 'Faible' : 'Critique');
    this.healthColor.set(score >= 80 ? 'var(--g)' : score >= 60 ? 'var(--g-l)' : score >= 40 ? 'var(--y-d)' : score >= 20 ? 'var(--o)' : 'var(--r)');
    this.healthBreakdown.set([
      { label: 'Couverture stock', score: coverageScore, weight: 40 },
      { label: 'Niveau d\u2019alertes', score: alertScore, weight: 30 },
      { label: 'Dynamisme mouvements', score: turnoverScore, weight: 20 },
      { label: 'StabilitÃ© inventaire', score: diversityScore, weight: 10 },
    ]);
  }

  private buildHealthGaugeChart() {
    const score = this.healthScore();
    const ctx = this.healthGaugeCanvas.nativeElement.getContext('2d')!;
    this.charts.push(new Chart(ctx, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [score, 100 - score],
          backgroundColor: [this.healthColor(), 'rgba(0,0,0,.06)'],
          borderWidth: 0,
          circumference: 270,
          rotation: 225,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '78%',
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        animation: { duration: 1500, easing: 'easeOutQuart' }
      }
    }));
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // INNOVATION 2: Analyse ABC / Pareto (20/80)
  // Classe A: 80% de la valeur, Classe B: 15%, Classe C: 5%
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  private computeABCAnalysis(levels: StockLevel[]) {
    const sorted = [...levels].sort((a, b) => (b.stockValue || 0) - (a.stockValue || 0));
    const totalValue = sorted.reduce((sum, sl) => sum + (sl.stockValue || 0), 0) || 1;
    const totalItems = sorted.length || 1;

    let cumValue = 0;
    let classA: StockLevel[] = [], classB: StockLevel[] = [], classC: StockLevel[] = [];

    sorted.forEach(sl => {
      cumValue += (sl.stockValue || 0);
      const cumPct = cumValue / totalValue;
      if (cumPct <= 0.8) classA.push(sl);
      else if (cumPct <= 0.95) classB.push(sl);
      else classC.push(sl);
    });

    this.abcData.set([
      { class: 'A', count: classA.length, value: classA.reduce((s, sl) => s + (sl.stockValue || 0), 0), pctValue: Math.round((classA.reduce((s, sl) => s + (sl.stockValue || 0), 0) / totalValue) * 100), pctItems: Math.round((classA.length / totalItems) * 100) },
      { class: 'B', count: classB.length, value: classB.reduce((s, sl) => s + (sl.stockValue || 0), 0), pctValue: Math.round((classB.reduce((s, sl) => s + (sl.stockValue || 0), 0) / totalValue) * 100), pctItems: Math.round((classB.length / totalItems) * 100) },
      { class: 'C', count: classC.length, value: classC.reduce((s, sl) => s + (sl.stockValue || 0), 0), pctValue: Math.round((classC.reduce((s, sl) => s + (sl.stockValue || 0), 0) / totalValue) * 100), pctItems: Math.round((classC.length / totalItems) * 100) },
    ]);
  }

  private buildABCChart() {
    const data = this.abcData();
    const ctx = this.abcCanvas.nativeElement.getContext('2d')!;
    this.charts.push(new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Classe A (80% valeur)', 'Classe B (15% valeur)', 'Classe C (5% valeur)'],
        datasets: [
          { label: 'Nb articles', data: data.map(d => d.count), backgroundColor: ['rgba(20,83,45,.85)', 'rgba(246,182,11,.85)', 'rgba(107,114,128,.6)'], borderRadius: 6, yAxisID: 'y' },
          { label: '% valeur', data: data.map(d => d.pctValue), type: 'line', borderColor: 'rgba(2,119,189,1)', backgroundColor: 'rgba(2,119,189,.1)', tension: 0.3, yAxisID: 'y1', pointRadius: 5 },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { font: { family: 'Poppins', size: 11, weight: 600 }, usePointStyle: true, padding: 14 } },
          tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y}${ctx.dataset.label === '% valeur' ? '%' : ' articles'}` } }
        },
        scales: {
          y: { type: 'linear', position: 'left', beginAtZero: true, grid: { color: 'rgba(0,0,0,.04)' }, ticks: { font: { family: 'Inter', size: 11 } } },
          y1: { type: 'linear', position: 'right', beginAtZero: true, max: 100, grid: { display: false }, ticks: { font: { family: 'Inter', size: 11 }, callback: v => v + '%' } },
          x: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 10 } } }
        },
        animation: { duration: 1200, easing: 'easeOutQuart', delay: (ctx: any) => ctx.dataIndex * 80 }
      }
    }));
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // INNOVATION 3: PrÃ©dictions de rupture de stock
  // Calcule le taux de consommation moyen et estime les jours restants
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  private computeStockOutPredictions(levels: StockLevel[], movements: StockMovement[]) {
    // Calculer la consommation par produit sur les mouvements de sortie
    const consumptionMap = new Map<number, { totalQty: number; days: number }>();
    const now = new Date();
    movements.forEach(m => {
      if (m.type === 'SALE' || m.type === 'TRANSFER_BUFFER_TO_MOBILE') {
        const days = Math.max(1, Math.ceil((now.getTime() - new Date(m.requestedAt || m.createdAt || '').getTime()) / 86400000));
        const curr = consumptionMap.get(m.productId) || { totalQty: 0, days };
        curr.totalQty += m.quantity;
        if (days < curr.days) curr.days = days;
        consumptionMap.set(m.productId, curr);
      }
    });

    const predictions = levels
      .filter(sl => sl.quantity > 0 || sl.alertLevel === 'CRITIQUE')
      .map(sl => {
        const cons = consumptionMap.get(sl.productId);
        const dailyConsumption = cons ? cons.totalQty / Math.max(cons.days, 1) : 0;
        const daysLeft = dailyConsumption > 0 ? Math.floor(sl.quantity / dailyConsumption) : 999;
        const urgency: 'CRITICAL' | 'WARNING' | 'SAFE' = daysLeft <= 3 ? 'CRITICAL' : daysLeft <= 7 ? 'WARNING' : 'SAFE';
        return {
          productName: sl.productName || sl.productSku || `Produit ${sl.productId}`,
          sku: sl.productSku || '',
          currentQty: sl.quantity,
          dailyConsumption: Math.round(dailyConsumption * 10) / 10,
          daysLeft: daysLeft === 999 ? -1 : daysLeft,
          urgency,
        };
      })
      .filter(p => p.daysLeft >= 0 && p.daysLeft <= 30)
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 8);

    this.stockOutPredictions.set(predictions);
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // INNOVATION 4: Pipeline visuel du workflow dotation
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  private computeDotationPipeline(dotations: DotationRequest[]) {
    this.totalDotations.set(dotations.length);
    this.dotationPipeline.set([
      { step: 'PENDING', label: 'En attente', icon: 'fa-clock', count: dotations.filter(d => d.status === 'PENDING').length, color: 'var(--n500)' },
      { step: 'PAYMENT_VERIFIED', label: 'Paiement vÃrifiÃ', icon: 'fa-money-check-dollar', count: dotations.filter(d => d.status === 'PAYMENT_VERIFIED').length, color: 'var(--b)' },
      { step: 'QUANTITY_VALIDATED', label: 'QtÃs validÃes', icon: 'fa-clipboard-check', count: dotations.filter(d => d.status === 'QUANTITY_VALIDATED').length, color: 'var(--y-d)' },
      { step: 'APPROVED', label: 'ApprouvÃes', icon: 'fa-circle-check', count: dotations.filter(d => d.status === 'APPROVED').length, color: 'var(--g)' },
      { step: 'COMPLETED', label: 'LivrÃes', icon: 'fa-truck-fast', count: dotations.filter(d => d.status === 'COMPLETED').length, color: 'var(--g-l)' },
    ]);
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // INNOVATION 5: Flux de stock (Central â†’ Buffer â†’ Mobile)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  private computeStockFlow(levels: StockLevel[], movements: StockMovement[]) {
    // Valeur par type d'entrepÃ´t
    const centralValue = levels.filter(sl => sl.warehouseType === 'CENTRAL' || (sl.warehouseName || '').includes('Central')).reduce((s, sl) => s + (sl.stockValue || 0), 0);
    const bufferValue = levels.filter(sl => sl.warehouseType === 'BUFFER' || (sl.warehouseName || '').includes('Tampon') || (sl.warehouseName || '').includes('Buffer')).reduce((s, sl) => s + (sl.stockValue || 0), 0);
    const mobileValue = levels.filter(sl => sl.warehouseType === 'MOBILE' || (sl.warehouseName || '').includes('Mobile') || (sl.warehouseName || '').includes('Commercial')).reduce((s, sl) => s + (sl.stockValue || 0), 0);

    // Mouvements de transfert
    const centralToBuffer = movements.filter(m => m.type === 'TRANSFER_CENTRAL_TO_BUFFER').reduce((s, m) => s + m.quantity, 0);
    const bufferToMobile = movements.filter(m => m.type === 'TRANSFER_BUFFER_TO_MOBILE').reduce((s, m) => s + m.quantity, 0);
    const supplierToCentral = movements.filter(m => m.type === 'RECEPTION_CONSOMMABLE' || m.type === 'RECEPTION_RAW_MATERIAL' || m.type === 'RECEPTION_MATERIEL').reduce((s, m) => s + m.quantity, 0);
    const productionToCentral = movements.filter(m => m.type === 'RECEPTION_PRODUCTION').reduce((s, m) => s + m.quantity, 0);

    this.stockFlow.set([
      { from: 'Fournisseurs', to: 'Stock Central', value: supplierToCentral },
      { from: 'Production', to: 'Stock Central', value: productionToCentral },
      { from: 'Stock Central', to: 'Stock Tampon', value: centralToBuffer },
      { from: 'Stock Tampon', to: 'Stock Mobile', value: bufferToMobile },
    ]);
  }

  private buildFlowChart() {
    const flow = this.stockFlow();
    const ctx = this.flowCanvas.nativeElement.getContext('2d')!;
    this.charts.push(new Chart(ctx, {
      type: 'bar',
      data: {
        labels: flow.map(f => `${f.from} â†’ ${f.to}`),
        datasets: [{
          label: 'QuantitÃ© transfÃ©rÃ©e',
          data: flow.map(f => f.value),
          backgroundColor: ['rgba(2,119,189,.8)', 'rgba(20,83,45,.8)', 'rgba(246,182,11,.8)', 'rgba(194,43,43,.7)'],
          borderRadius: 8, borderSkipped: false,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.x} unitÃ©s transfÃ©rÃ©es` } }
        },
        scales: {
          x: { beginAtZero: true, grid: { color: 'rgba(0,0,0,.04)' }, ticks: { font: { family: 'Inter', size: 11 } } },
          y: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 10 } } }
        },
        animation: { duration: 1000, easing: 'easeOutQuart', delay: (ctx: any) => ctx.dataIndex * 60 }
      }
    }));
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // INNOVATION 6: Taux de rotation stock
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  private computeTurnoverRates(levels: StockLevel[], movements: StockMovement[]) {
    // Calculer sorties par produit
    const exitMap = new Map<number, number>();
    movements.forEach(m => {
      if (m.type === 'SALE' || m.type === 'TRANSFER_BUFFER_TO_MOBILE') {
        exitMap.set(m.productId, (exitMap.get(m.productId) || 0) + m.quantity);
      }
    });

    const rates = levels
      .map(sl => {
        const exits = exitMap.get(sl.productId) || 0;
        const avgStock = sl.quantity;
        const turnoverRate = avgStock > 0 ? exits / avgStock : 0;
        const daysOfCover = exits > 0 ? Math.round((avgStock / exits) * 30) : 999;
        return {
          productName: sl.productName || sl.productSku || `Produit ${sl.productId}`,
          sku: sl.productSku || '',
          turnoverRate: Math.round(turnoverRate * 100) / 100,
          daysOfCover: daysOfCover === 999 ? -1 : daysOfCover,
        };
      })
      .filter(r => r.turnoverRate > 0)
      .sort((a, b) => b.turnoverRate - a.turnoverRate)
      .slice(0, 6);

    this.turnoverRates.set(rates);
  }

  // ── Helpers ───────────────────────────────────────────────
  getTopLevels() { return [...this.stockLevels()].sort((a, b) => (b.stockValue || 0) - (a.stockValue || 0)).slice(0, 6); }
  getPct(sl: StockLevel) { return Math.min(100, Math.round((sl.quantity / (sl.reorderPoint * 6 || 1)) * 100)); }
  getColor(sl: StockLevel): string {
    if (sl.alertLevel === 'CRITIQUE') return 'var(--r)';
    if (sl.alertLevel === 'FAIBLE') return 'var(--o)';
    return 'var(--g)';
  }
  getBgColor(sl: StockLevel): string {
    if (sl.alertLevel === 'CRITIQUE') return 'var(--r-gh)';
    if (sl.alertLevel === 'FAIBLE') return 'var(--o-gh)';
    return 'var(--g-gh)';
  }
  getBarGradient(sl: StockLevel): string {
    const c = this.getColor(sl);
    return `linear-gradient(90deg, ${c}, ${c})`;
  }

  // â”€â”€ Inventaire produits : filtre, tri, recherche â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  filteredProducts(): StockLevel[] {
    let list = [...this.stockLevels()];
    const search = this.productSearch().toLowerCase().trim();
    if (search) {
      list = list.filter(sl =>
        (sl.productName || '').toLowerCase().includes(search) ||
        (sl.productSku || '').toLowerCase().includes(search)
      );
    }
    if (this.warehouseFilter()) {
      list = list.filter(sl => sl.warehouseName === this.warehouseFilter());
    }
    if (this.alertFilter()) {
      list = list.filter(sl => sl.alertLevel === this.alertFilter());
    }
    const dir = this.productSortDir() === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      switch (this.productSort()) {
        case 'name': return ((a.productName || '') > (b.productName || '') ? 1 : -1) * dir;
        case 'qty': return ((a.quantity || 0) - (b.quantity || 0)) * dir;
        case 'alert': return ((a.alertLevel || '') > (b.alertLevel || '') ? 1 : -1) * dir;
        default: return ((a.stockValue || 0) - (b.stockValue || 0)) * dir;
      }
    });
    return list;
  }

  onProductSearch(e: Event) {
    this.productSearch.set((e.target as HTMLInputElement).value);
  }
  onWarehouseFilter(e: Event) {
    this.warehouseFilter.set((e.target as HTMLSelectElement).value);
  }
  onAlertFilter(e: Event) {
    this.alertFilter.set((e.target as HTMLSelectElement).value);
  }
  toggleProductSort() {
    const sorts: ('value' | 'name' | 'qty' | 'alert')[] = ['value', 'name', 'qty', 'alert'];
    const idx = sorts.indexOf(this.productSort());
    const next = sorts[(idx + 1) % sorts.length];
    if (next === this.productSort()) {
      this.productSortDir.set(this.productSortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.productSort.set(next);
      this.productSortDir.set('desc');
    }
  }
  productSortLabel(): string {
    const labels: Record<string, string> = { value: 'Valeur', name: 'Nom', qty: 'QuantitÃ©', alert: 'Statut' };
    return labels[this.productSort()] + (this.productSortDir() === 'asc' ? ' â†‘' : ' â†“');
  }
  clearFilters() {
    this.productSearch.set('');
    this.warehouseFilter.set('');
    this.alertFilter.set('');
    this.invPage.set(1);
  }
  absDiff(a: number, b: number): number {
    return Math.abs(a - b);
  }
  getPendingBatches() { return this.batches().filter(b => b.status === 'DECLARED_BY_PRODUCTION'); }
  getCriticalItems() { return this.stockLevels().filter(sl => sl.alertLevel === 'CRITIQUE').slice(0, 5); }
  getLowItems() { return this.stockLevels().filter(sl => sl.alertLevel === 'FAIBLE').slice(0, 5); }
  getCriticalClass(sl: StockLevel) {
    const pct = this.getPct(sl);
    if (pct < 20) return 'critical-high';
    if (pct < 40) return 'critical-medium';
    return 'critical-low';
  }

  getRStatutLabel(s: string) { const m: Record<string, string> = { PENDING_FIRST_VALIDATION: 'Att. val. 1', PENDING_SECOND_VALIDATION: 'Att. val. 2', VALIDATED: 'ValidÃ©', REJECTED: 'RejetÃ©' }; return m[s] || s; }
  getRStatutClass(s: string) { const m: Record<string, string> = { PENDING_FIRST_VALIDATION: 'badge-warning', PENDING_SECOND_VALIDATION: 'badge-primary', VALIDATED: 'badge-success', REJECTED: 'badge-danger' }; return m[s] || 'badge-neutral'; }
  getWShort(name?: string) { if (!name) return 'â€”'; if (name.includes('PremiÃ¨res') || name.includes('premiÃ¨res')) return 'MP'; if (name.includes('Consomm') || name.includes('consomm')) return 'Cons.'; if (name.includes('Finis') || name.includes('finis')) return 'PF'; if (name.includes('Tampon') || name.includes('tampon')) return 'Tamp.'; return name.substring(0, 6); }
  getWBadge(name?: string) { if (!name) return 'badge-neutral'; if (name.includes('PremiÃ¨res') || name.includes('premiÃ¨res')) return 'badge-primary'; if (name.includes('Consomm') || name.includes('consomm')) return 'badge-secondary'; if (name.includes('Finis') || name.includes('finis')) return 'badge-success'; if (name.includes('Tampon') || name.includes('tampon')) return 'badge-info'; return 'badge-neutral'; }
  getBStatutLabel(s: string) { const m: Record<string, string> = { DECLARED_BY_PRODUCTION: 'DÃ©clarÃ© â€” Att. validation', VALIDATED_BY_STOCK: 'ValidÃ© â€” Stock mis Ã  jour', REJECTED: 'RejetÃ©' }; return m[s] || s; }
  getBStatutClass(s: string) { return s === 'VALIDATED_BY_STOCK' ? 'badge-success' : s === 'REJECTED' ? 'badge-danger' : 'badge-warning'; }
  isEntree(t: string) { return t.startsWith('RECEPTION') || t === 'TRANSFER_MOBILE_TO_CENTRAL'; }
  getMIcon(t: string) { const m: Record<string, string> = { RECEPTION_PRODUCTION: 'fa-industry', RECEPTION_CONSOMMABLE: 'fa-arrow-circle-down', RECEPTION_RAW_MATERIAL: 'fa-arrow-circle-down', RECEPTION_MATERIEL: 'fa-arrow-circle-down', TRANSFER_CENTRAL_TO_BUFFER: 'fa-boxes-stacked', TRANSFER_BUFFER_TO_MOBILE: 'fa-truck', TRANSFER_MOBILE_TO_CENTRAL: 'fa-arrow-rotate-left', SALE: 'fa-cash-register', ADJUSTMENT: 'fa-sliders', LOSS: 'fa-triangle-exclamation', EXPIRATION: 'fa-calendar-xmark' }; return m[t] || 'fa-circle'; }
  getMColor(t: string) { const m: Record<string, string> = { RECEPTION_PRODUCTION: 'mc-y', RECEPTION_CONSOMMABLE: 'mc-g', RECEPTION_RAW_MATERIAL: 'mc-g', RECEPTION_MATERIEL: 'mc-g', TRANSFER_CENTRAL_TO_BUFFER: 'mc-y', TRANSFER_BUFFER_TO_MOBILE: 'mc-o', TRANSFER_MOBILE_TO_CENTRAL: 'mc-g', SALE: 'mc-o', ADJUSTMENT: 'mc-n', LOSS: 'mc-r', EXPIRATION: 'mc-r' }; return m[t] || 'mc-n'; }
  getMLabel(t: string) { const m: Record<string, string> = { RECEPTION_PRODUCTION: 'Entrée production', RECEPTION_CONSOMMABLE: 'Réception consommable', RECEPTION_RAW_MATERIAL: 'Réception MP', RECEPTION_MATERIEL: 'Réception matériel', TRANSFER_CENTRAL_TO_BUFFER: 'Transfert central→tampon', TRANSFER_BUFFER_TO_MOBILE: 'Dotation (tampon→mobile)', TRANSFER_MOBILE_TO_CENTRAL: 'Retour mobile→central', SALE: 'Vente', ADJUSTMENT: 'Ajustement', LOSS: 'Perte/Casse', EXPIRATION: 'Expiration' }; return m[t] || t; }
  formatCFA(n: number) { return new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA'; }
  getNAlertClass(n: string) { const m: Record<string, string> = { CRITIQUE: 'badge-danger', FAIBLE: 'badge-warning', NORMAL: 'badge-success', SURPLUS: 'badge-secondary' }; return m[n] || 'badge-neutral'; }

  getPackagingLabel(packagingType?: string): string {
    if (!packagingType) return '';
    return this.rules.getConditioningLabel(packagingType.toUpperCase());
  }

  getMouvementValue(m: StockMovement): number {
    return (m.quantity || 0) * ((m.product?.unitPriceAmount) || 0);
  }

  ngOnDestroy() {
    this.charts.forEach(c => c.destroy());
    clearInterval(this.refreshTimer);
    this.destroy$.next();
    this.destroy$.complete();
  }
}
