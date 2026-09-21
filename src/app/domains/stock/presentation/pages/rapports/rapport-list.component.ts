import { Component, OnInit, signal, inject, OnDestroy, AfterViewInit, ViewChild, ElementRef, computed } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, catchError, of, forkJoin } from 'rxjs';
import { Chart, registerables } from 'chart.js';
import { ReportUseCase } from '../../../application/use-cases/rapports/report.use-case';
import { AuthService } from '../../../../../core/auth/auth.service';
import { StockApiRepository, ReportData, GenerateReportRequest, StockLocationDto, CustomReportCriteriaDto } from '../../../infrastructure/repositories/stock-api.repository';
import { StockLevel, StockMovement, DashboardStatsResponse, Product } from '../../../domain/models';
import { IaService, MeetingReportResponse } from '../../../../../core/services/ia.service';

Chart.register(...registerables);

export interface DocumentTemplate {
  id: string;
  label: string;
  description: string;
  icon: string;
  color: string;
  action: () => void;
  needsPeriod?: boolean;
}

@Component({
  selector: 'app-rapport-list',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, DecimalPipe],
  templateUrl: './rapport-list.component.html',
  styleUrls: ['./rapport-list.component.css']
})
export class RapportListComponent implements OnInit, AfterViewInit, OnDestroy {
  private d$ = new Subject<void>();
  private uc = inject(ReportUseCase);
  private repo = inject(StockApiRepository);
  private auth = inject(AuthService);
  private iaService = inject(IaService);

  @ViewChild('rptMaterialChart') rptMaterialCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('rptAlertChart') rptAlertCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('rptWarehouseChart') rptWarehouseCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('rptMovementChart') rptMovementCanvas!: ElementRef<HTMLCanvasElement>;
  private materialChart?: Chart;
  private alertChart?: Chart;
  private warehouseChart?: Chart;
  private movementChart?: Chart;

  showAnalysis = signal(true);
  analysisView = signal<'material' | 'alerts' | 'warehouse' | 'movements'>('material');
  analysisViewLabel = computed(() => {
    const v = this.analysisView();
    if (v === 'material') return 'Répartition par type de matériel';
    if (v === 'alerts') return "Niveaux d'alerte";
    if (v === 'warehouse') return 'Stock par entrepôt';
    return 'Mouvements par type';
  });
  stockLevels = signal<StockLevel[]>([]);
  movements = signal<StockMovement[]>([]);
  dashboardStats = signal<DashboardStatsResponse | null>(null);
  analysisLoading = signal(false);

  // Computed distributions
  private materialTypeLabel(mt: string): string {
    const labels: Record<string, string> = {
      PRODUIT_FINI: 'Produit Fini',
      MATIERE_PREMIERE: 'Matière Première',
      CONSOMMABLE: 'Consommable',
      MATERIEL: 'Matériel'
    };
    return labels[mt] || mt || 'Autre';
  }

  materialAnalysis = computed(() => {
    const levels = this.stockLevels();
    const counts: Record<string, number> = {};
    const qtys: Record<string, number> = {};
    const values: Record<string, number> = {};
    levels.forEach(sl => {
      const rawMt = sl.materialType || sl.product?.materialType || 'Autre';
      const cat = this.materialTypeLabel(rawMt);
      counts[cat] = (counts[cat] || 0) + 1;
      qtys[cat] = (qtys[cat] || 0) + sl.quantity;
      values[cat] = (values[cat] || 0) + (sl.stockValue || 0);
    });
    return Object.entries(counts).map(([label, count]) => ({
      label, count, qty: qtys[label] || 0, value: values[label] || 0
    })).sort((a, b) => b.qty - a.qty);
  });

  alertDistribution = computed(() => {
    const levels = this.stockLevels();
    const counts: Record<string, number> = { CRITIQUE: 0, FAIBLE: 0, NORMAL: 0 };
    levels.forEach(sl => {
      const lvl = sl.alertLevel || 'NORMAL';
      counts[lvl] = (counts[lvl] || 0) + 1;
    });
    return [
      { label: 'Critique', value: counts['CRITIQUE'], color: '#C22B2B' },
      { label: 'Faible', value: counts['FAIBLE'], color: '#F6B60B' },
      { label: 'Normal', value: counts['NORMAL'], color: '#14532D' }
    ];
  });

  warehouseDistribution = computed(() => {
    const levels = this.stockLevels();
    const whMap = new Map<string, { qty: number; value: number; count: number }>();
    levels.forEach(sl => {
      const name = sl.warehouseName || 'Inconnu';
      const existing = whMap.get(name) || { qty: 0, value: 0, count: 0 };
      existing.qty += sl.quantity;
      existing.value += sl.stockValue || 0;
      existing.count++;
      whMap.set(name, existing);
    });
    return Array.from(whMap.entries()).map(([name, data]) => ({ name, ...data }));
  });

  movementTypeDist = computed(() => {
    const moves = this.movements();
    const typeMap = new Map<string, number>();
    moves.forEach(m => {
      const type = m.type || 'Autre';
      typeMap.set(type, (typeMap.get(type) || 0) + m.quantity);
    });
    return Array.from(typeMap.entries())
      .map(([type, qty]) => ({ type, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 8);
  });

  topStockProducts = computed(() => {
    const bySku = new Map<string, { name: string; sku: string; qty: number; value: number }>();
    for (const sl of this.stockLevels()) {
      const sku = sl.productSku || sl.productName || `id-${sl.id}`;
      const existing = bySku.get(sku);
      if (existing) {
        existing.qty += sl.quantity;
        existing.value += sl.stockValue || 0;
      } else {
        bySku.set(sku, {
          name: sl.productName || sl.productSku || 'N/A',
          sku: sl.productSku || '',
          qty: sl.quantity,
          value: sl.stockValue || 0
        });
      }
    }
    return Array.from(bySku.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);
  });

  totalStockValue = computed(() => this.stockLevels().reduce((s, sl) => s + (sl.stockValue || 0), 0));
  totalStockQty = computed(() => this.stockLevels().reduce((s, sl) => s + sl.quantity, 0));

  reports = signal<ReportData[]>([]);
  loading = signal(true);
  error = signal('');
  viewMode = signal<'all' | 'mine'>('mine');
  showForm = signal(false);
  generating = signal(false);
  selectedReport = signal<ReportData | null>(null);
  toastMsg = signal('');
  toastType = signal<'success' | 'error'>('success');
  search = signal('');
  filterType = signal('ALL');
  sortBy = signal<'date' | 'type'>('date');

  today = new Date().toISOString().split('T')[0];
  docPeriodStart = signal<string>(this.today);
  docPeriodEnd = signal<string>(this.today);

  // ── Export integration ──
  locations = signal<StockLocationDto[]>([]);
  selectedLocationId = signal('');
  excelLocationType = signal('STOCK_CENTRAL');
  ntFoodsMotif = signal('Production');
  ntFoodsNom = signal('');
  ntFoodsVille = signal('');
  ntFoodsZone = signal('');
  ntFoodsColis = signal<number | null>(null);
  showExports = signal(false);
  showNtFoodsForm = signal(false);

  // ── Custom Report Builder ──
  showCustomReport = signal(false);
  customGenerating = signal(false);
  customReport = signal<ReportData | null>(null);
  customFilters = {
    locationTypes: ['STOCK_CENTRAL', 'STOCK_BUFFER', 'STOCK_MOBILE'] as string[],
    materialTypes: [] as string[],
    alertLevels: [] as string[],
    productSku: '',
    minQuantity: null as number | null,
    maxQuantity: null as number | null,
    minValue: null as number | null,
    maxValue: null as number | null,
    format: 'PDF' as string
  };

  // IA Meeting Report state
  showMeetingForm = signal(false);
  meetingGenerating = signal(false);
  meetingResult = signal<MeetingReportResponse | null>(null);
  iaConfigured = signal(false);
  iaModel = signal('');
  meetingForm = {
    title: '',
    date: new Date().toISOString().split('T')[0],
    location: '',
    participants: '',
    agenda: '',
    notes: '',
    decisions: '',
    actionItems: ''
  };

  reportTypes = [
    { value: 'STOCK_CENTRAL_STATUS', label: 'État du stock central', icon: 'fa-building-circle-check', category: 'stock' },
    { value: 'STOCK_BUFFER_STATUS', label: 'État du magasin tampon', icon: 'fa-warehouse', category: 'stock' },
    { value: 'STOCK_MOVEMENTS', label: 'Mouvements de stock', icon: 'fa-right-left', category: 'stock' },
    { value: 'STOCK_MOBILE_STATUS', label: 'État du stock mobile', icon: 'fa-truck-field', category: 'stock' },
    { value: 'STOCK_ROTATION', label: 'Rotation du stock', icon: 'fa-rotate', category: 'stock' },
    { value: 'STOCK_VALUATION', label: 'Valorisation du stock', icon: 'fa-coins', category: 'stock' },
    { value: 'COMMERCIAL_PERFORMANCE', label: 'Performance commerciale', icon: 'fa-chart-line', category: 'commercial' },
    { value: 'DOTATIONS_VS_SALES', label: 'Dotations vs ventes', icon: 'fa-scale-balanced', category: 'commercial' },
    { value: 'INVENTORY', label: 'Rapport d\'inventaire', icon: 'fa-clipboard-list', category: 'stock' },
    { value: 'STOCK_VALUATION_FINANCIAL', label: 'Valorisation financière', icon: 'fa-money-bill-trend-up', category: 'finance' },
    { value: 'STOCK_COSTS', label: 'Coûts de stockage', icon: 'fa-file-invoice-dollar', category: 'finance' },
    { value: 'PRODUCTION_VS_CONSUMPTION', label: 'Production vs consommation', icon: 'fa-industry', category: 'production' },
    { value: 'PRODUCTION_YIELD', label: 'Rendement production', icon: 'fa-gauge-high', category: 'production' },
  ];

  documentTemplates: DocumentTemplate[] = [];

  newReport: GenerateReportRequest = {
    type: 'STOCK_CENTRAL_STATUS',
    periodStart: '',
    periodEnd: '',
    generatedBy: 'system',
    format: 'PDF'
  };

  constructor() {
    this.documentTemplates = [
      {
        id: 'ntfoods', label: 'Fiche Info Produits TANTY', description: 'Grille vierge codes + quantités pour terrain',
        icon: 'fa-file-pdf', color: 'var(--g)', action: () => this.showNtFoodsForm.set(true), needsPeriod: false
      },
      {
        id: 'stock-central', label: 'Fiche Stock Central', description: 'Stock central avec sorties par produit',
        icon: 'fa-building-circle-check', color: 'var(--b)', action: () => this.downloadStockFiche('central'), needsPeriod: false
      },
      {
        id: 'stock-buffer', label: 'Fiche Stock Tampon', description: 'Stock tampon / magasin PF',
        icon: 'fa-warehouse', color: 'var(--y)', action: () => this.downloadStockFiche('buffer'), needsPeriod: false
      },
      {
        id: 'sorties', label: 'Synthèse Sorties', description: 'Quantités sorties par produit sur période',
        icon: 'fa-arrow-right-from-bracket', color: 'var(--o)', action: () => this.downloadSorties(), needsPeriod: true
      },
      {
        id: 'entrees', label: 'Synthèse Entrées', description: 'Entrées stock par période et par type',
        icon: 'fa-arrow-right-to-bracket', color: 'var(--s)', action: () => this.downloadEntrees(), needsPeriod: true
      },
      {
        id: 'globale', label: 'Synthèse Globale', description: 'Entrées, sorties et stock par produit',
        icon: 'fa-globe', color: 'var(--p)', action: () => this.downloadGlobale(), needsPeriod: true
      },
      {
        id: 'movements-pdf', label: 'Rapport Mouvements PDF', description: 'Liste détaillée des mouvements',
        icon: 'fa-right-left', color: 'var(--t)', action: () => this.downloadMovementsPdf(), needsPeriod: false
      },
      {
        id: 'movements-excel', label: 'Rapport Mouvements Excel', description: 'Export Excel des mouvements',
        icon: 'fa-file-excel', color: 'var(--g-m)', action: () => this.downloadMovementsExcel(), needsPeriod: false
      },
      {
        id: 'valorisation-central', label: 'Valorisation Stock Central', description: 'Poids et conditionnement par produit',
        icon: 'fa-scale-weight', color: 'var(--g)', action: () => this.downloadValorisation('central'), needsPeriod: false
      },
      {
        id: 'valorisation-buffer', label: 'Valorisation Stock Tampon', description: 'Poids et conditionnement du tampon',
        icon: 'fa-scale-weight', color: 'var(--b)', action: () => this.downloadValorisation('buffer'), needsPeriod: false
      },
      {
        id: 'alertes-central', label: 'Rapport d\'Alertes', description: 'Produits sous seuil de réappro',
        icon: 'fa-triangle-exclamation', color: 'var(--r)', action: () => this.downloadAlertes('central'), needsPeriod: false
      },
      {
        id: 'inventaire-central', label: 'Inventaire Complet', description: 'Tous les champs: cartons, poids, volume, seuils',
        icon: 'fa-clipboard-list', color: 'var(--n800)', action: () => this.downloadInventaire('central'), needsPeriod: false
      },
      {
        id: 'rotation-central', label: 'Rotation du Stock', description: 'Entrées, sorties et taux de rotation',
        icon: 'fa-rotate', color: 'var(--p)', action: () => this.downloadRotation('central'), needsPeriod: true
      },
      {
        id: 'receptions', label: 'Rapport Réceptions', description: 'Réceptions par produit avec écarts',
        icon: 'fa-truck-ramp-box', color: 'var(--b)', action: () => this.downloadReceptions(), needsPeriod: true
      },
      {
        id: 'dotations', label: 'Rapport Dotations', description: 'Dotations par commercial et par produit',
        icon: 'fa-hand-holding-dollar', color: 'var(--g)', action: () => this.downloadDotations(), needsPeriod: true
      },
      {
        id: 'reappro', label: 'Réappro. Tampon', description: 'État du tampon et transferts depuis le central',
        icon: 'fa-arrows-rotate', color: 'var(--o)', action: () => this.downloadReappro(), needsPeriod: false
      },
      {
        id: 'transferts-central', label: 'Rapport Transferts', description: 'Transferts internes par produit',
        icon: 'fa-right-left', color: 'var(--t)', action: () => this.downloadTransferts('central'), needsPeriod: true
      },
      {
        id: 'hebdo-central', label: 'Fiche Hebdomadaire', description: 'KPIs, graphique sorties, entrées/sorties/stock, alertes',
        icon: 'fa-calendar-week', color: 'var(--b)', action: () => this.downloadHebdo('central'), needsPeriod: true
      },
      {
        id: 'hebdo-buffer', label: 'Fiche Hebdo Tampon', description: 'Rapport hebdomadaire du stock tampon',
        icon: 'fa-calendar-week', color: 'var(--y)', action: () => this.downloadHebdo('buffer'), needsPeriod: true
      },
      {
        id: 'auto-weekly', label: 'Rapport Auto (Hebdo)', description: 'Génère et sauvegarde un rapport hebdomadaire automatique',
        icon: 'fa-clock-rotate-left', color: 'var(--g)', action: () => this.triggerAutoReport('weekly'), needsPeriod: true
      },
      {
        id: 'auto-daily', label: 'Rapport Auto (Quotidien)', description: 'Génère et sauvegarde un rapport quotidien automatique',
        icon: 'fa-clock', color: 'var(--o)', action: () => this.triggerAutoReport('daily'), needsPeriod: true
      }
    ];
  }

  ngOnInit(): void {
    this.loadReports();
    this.loadAnalysisData();
    this.loadLocations();
    this.checkIaStatus();
  }

  private loadLocations(): void {
    this.repo.getLocations().pipe(takeUntil(this.d$)).subscribe({
      next: (data) => {
        this.locations.set(data || []);
        if (data && data.length > 0) this.selectedLocationId.set(data[0].id);
      },
      error: () => this.showToast('Erreur chargement emplacements', 'error')
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.buildCharts(), 500);
  }

  ngOnDestroy(): void {
    this.d$.next();
    this.d$.complete();
    this.materialChart?.destroy();
    this.alertChart?.destroy();
    this.warehouseChart?.destroy();
    this.movementChart?.destroy();
  }

  private loadAnalysisData(): void {
    this.analysisLoading.set(true);
    forkJoin({
      levels: this.repo.getStockLevels(),
      movements: this.repo.getMovements(),
      stats: this.repo.getDashboard(),
      products: this.repo.getProducts().pipe(catchError(() => of([] as Product[])))
    }).pipe(takeUntil(this.d$)).subscribe({
      next: ({ levels, movements, stats, products }) => {
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
            quantityPerCarton: sl.quantityPerCarton || p?.quantityPerCarton || 1,
            packagingType: sl.packagingType || p?.packagingType || '—',
          } as StockLevel;
        });
        this.stockLevels.set(enriched);
        this.movements.set(movements);
        this.dashboardStats.set(stats);
        this.analysisLoading.set(false);
        setTimeout(() => this.buildCharts(), 100);
      },
      error: () => {
        this.analysisLoading.set(false);
        this.showToast('Erreur chargement données d\'analyse', 'error');
      }
    });
  }

  private buildCharts(): void {
    if (!this.showAnalysis()) return;
    this.buildMaterialChart();
    this.buildAlertChart();
    this.buildWarehouseChart();
    this.buildMovementChart();
  }

  private buildMaterialChart(): void {
    if (this.materialChart) { this.materialChart.destroy(); this.materialChart = undefined; }
    if (!this.rptMaterialCanvas?.nativeElement) return;
    const dist = this.materialAnalysis();
    const colors = ['#14532D', '#F6B60B', '#0277BD', '#1E7A42', '#D84315', '#C22B2B'];
    this.materialChart = new Chart(this.rptMaterialCanvas.nativeElement.getContext('2d')!, {
      type: 'bar',
      data: {
        labels: dist.map(d => d.label),
        datasets: [
          { label: 'Quantité', data: dist.map(d => d.qty), backgroundColor: colors.map(c => c + 'BB'), borderWidth: 0, borderRadius: 6 },
          { label: 'Nb produits', data: dist.map(d => d.count), backgroundColor: colors.map(c => c + '55'), borderWidth: 0, borderRadius: 6 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { font: { size: 11, family: 'Inter' } } } },
        scales: {
          x: { ticks: { font: { size: 11, family: 'Inter' } } },
          y: { beginAtZero: true, ticks: { font: { size: 11, family: 'Inter' } } }
        }
      }
    });
  }

  private buildAlertChart(): void {
    if (this.alertChart) { this.alertChart.destroy(); this.alertChart = undefined; }
    if (!this.rptAlertCanvas?.nativeElement) return;
    const dist = this.alertDistribution();
    this.alertChart = new Chart(this.rptAlertCanvas.nativeElement.getContext('2d')!, {
      type: 'doughnut',
      data: {
        labels: dist.map(d => d.label),
        datasets: [{ data: dist.map(d => d.value), backgroundColor: dist.map(d => d.color), borderWidth: 0 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { padding: 12, font: { size: 11, family: 'Inter' } } } },
        cutout: '60%'
      }
    });
  }

  private buildWarehouseChart(): void {
    if (this.warehouseChart) { this.warehouseChart.destroy(); this.warehouseChart = undefined; }
    if (!this.rptWarehouseCanvas?.nativeElement) return;
    const dist = this.warehouseDistribution();
    this.warehouseChart = new Chart(this.rptWarehouseCanvas.nativeElement.getContext('2d')!, {
      type: 'bar',
      data: {
        labels: dist.map(d => d.name),
        datasets: [{ label: 'Quantité', data: dist.map(d => d.qty), backgroundColor: 'rgba(20,83,45,.7)', borderWidth: 0, borderRadius: 6 }]
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, ticks: { font: { size: 11, family: 'Inter' } } },
          y: { ticks: { font: { size: 11, family: 'Inter' } } }
        }
      }
    });
  }

  private buildMovementChart(): void {
    if (this.movementChart) { this.movementChart.destroy(); this.movementChart = undefined; }
    if (!this.rptMovementCanvas?.nativeElement) return;
    const dist = this.movementTypeDist();
    const colors = ['#14532D', '#F6B60B', '#0277BD', '#1E7A42', '#D84315', '#C22B2B', '#FFC845', '#2A9D5F'];
    this.movementChart = new Chart(this.rptMovementCanvas.nativeElement.getContext('2d')!, {
      type: 'bar',
      data: {
        labels: dist.map(d => d.type),
        datasets: [{ label: 'Quantité', data: dist.map(d => d.qty), backgroundColor: dist.map((_, i) => colors[i % colors.length] + 'BB'), borderWidth: 0, borderRadius: 6 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { font: { size: 10, family: 'Inter' }, maxRotation: 45 } },
          y: { beginAtZero: true, ticks: { font: { size: 11, family: 'Inter' } } }
        }
      }
    });
  }

  toggleAnalysis(): void {
    this.showAnalysis.update(v => !v);
    if (this.showAnalysis()) {
      setTimeout(() => this.buildCharts(), 100);
    }
  }

  toggleExports(): void {
    this.showExports.update(v => !v);
  }

  setAnalysisView(view: 'material' | 'alerts' | 'warehouse' | 'movements'): void {
    this.analysisView.set(view);
    setTimeout(() => this.buildCharts(), 50);
  }

  formatCFA(n: number): string { return new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA'; }

  loadReports(): void {
    this.loading.set(true);
    this.error.set('');
    const user = this.auth.getCurrentUser();
    const generatedBy = user?.matricule || 'system';

    const obs$ = this.viewMode() === 'all'
      ? this.uc.getAll()
      : this.uc.getByUser(generatedBy);

    obs$.pipe(
      takeUntil(this.d$),
      catchError(() => of([] as ReportData[]))
    ).subscribe(r => {
      this.reports.set(r);
      this.loading.set(false);
    });
  }

  setViewMode(mode: 'all' | 'mine'): void {
    this.viewMode.set(mode);
    this.loadReports();
  }

  filteredReports() {
    let list = this.reports();
    const q = this.search().toLowerCase();
    if (q) {
      list = list.filter(r =>
        (r.title || '').toLowerCase().includes(q) ||
        (r.type || '').toLowerCase().includes(q) ||
        (r.generatedBy || '').toLowerCase().includes(q)
      );
    }
    if (this.filterType() !== 'ALL') {
      list = list.filter(r => r.type === this.filterType());
    }
    if (this.sortBy() === 'date') {
      list = [...list].sort((a, b) => new Date(b.periodStart || 0).getTime() - new Date(a.periodStart || 0).getTime());
    } else {
      list = [...list].sort((a, b) => a.type.localeCompare(b.type));
    }
    return list;
  }

  toggleForm(): void {
    this.showForm.update(v => !v);
  }

  generateReport(): void {
    if (!this.newReport.periodStart || !this.newReport.periodEnd) {
      this.showToast('Veuillez sélectionner les dates de période', 'error');
      return;
    }

    const user = this.auth.getCurrentUser();
    const payload: GenerateReportRequest = {
      type: this.newReport.type,
      periodStart: this.newReport.periodStart + 'T00:00:00',
      periodEnd: this.newReport.periodEnd + 'T23:59:59',
      generatedBy: user?.matricule || 'system',
      format: this.newReport.format
    };

    this.generating.set(true);
    this.uc.generate(payload).pipe(takeUntil(this.d$)).subscribe({
      next: () => {
        this.generating.set(false);
        this.showForm.set(false);
        this.showToast('Rapport généré avec succès', 'success');
        this.loadReports();
      },
      error: () => {
        this.generating.set(false);
        this.showToast('Erreur lors de la génération du rapport', 'error');
      }
    });
  }

  deleteReport(id: number, event: Event): void {
    event.stopPropagation();
    this.uc.delete(id).pipe(takeUntil(this.d$)).subscribe({
      next: () => {
        this.showToast('Rapport supprimé', 'success');
        this.loadReports();
      },
      error: () => this.showToast('Erreur lors de la suppression', 'error')
    });
  }

  getReportTypeLabel(type: string): string {
    const found = this.reportTypes.find(t => t.value === type);
    return found ? found.label : type;
  }

  getReportIcon(type: string): string {
    const found = this.reportTypes.find(t => t.value === type);
    return found ? found.icon : 'fa-file';
  }

  getReportColor(type: string): string {
    const found = this.reportTypes.find(t => t.value === type);
    if (!found) return 'var(--n500)';
    if (found.category === 'stock') return 'var(--g)';
    if (found.category === 'commercial') return 'var(--b)';
    if (found.category === 'finance') return '#7c3aed';
    if (found.category === 'production') return 'var(--o)';
    return 'var(--n500)';
  }

  downloadReport(report: ReportData): void {
    const filename = (report.title || this.getReportTypeLabel(report.type))
      .replaceAll(/[^a-zA-Z0-9_-]/g, '_') + '.pdf';
    this.downloadBlob(this.repo.downloadReportFile(report.id), filename);
  }

  openDetail(report: ReportData): void {
    this.selectedReport.set(report);
  }

  closeDetail(): void {
    this.selectedReport.set(null);
  }

  private toISODateTime(date: string, endOfDay = false): string {
    return endOfDay ? `${date}T23:59:59` : `${date}T00:00:00`;
  }

  private downloadBlob(obs$: ReturnType<StockApiRepository['exportFicheSyntheseNTFoods']>, filename: string): void {
    obs$.pipe(takeUntil(this.d$)).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.showToast('Document généré et téléchargé', 'success');
      },
      error: () => this.showToast('Erreur lors du téléchargement', 'error')
    });
  }

  downloadNTFoods(): void {
    this.downloadBlob(
      this.repo.exportFicheSyntheseNTFoods(this.ntFoodsMotif(), this.ntFoodsNom() || undefined, this.ntFoodsVille() || undefined, this.ntFoodsZone() || undefined, this.ntFoodsColis() ?? undefined),
      `fiche_infos_produits_tanty_${this.ntFoodsMotif().toLowerCase()}_${this.today}.pdf`
    );
  }
  downloadStockFiche(locationType: string): void { this.downloadBlob(this.repo.exportFicheSyntheseStock(locationType), `fiche_synthese_stock_${locationType}_${this.today}.pdf`); }
  downloadSorties(): void { this.downloadBlob(this.repo.exportFicheSyntheseSorties(this.toISODateTime(this.docPeriodStart()), this.toISODateTime(this.docPeriodEnd(), true)), `fiche_synthese_sorties_${this.docPeriodStart()}_${this.docPeriodEnd()}.pdf`); }
  downloadEntrees(): void { this.downloadBlob(this.repo.exportFicheSyntheseEntrees(this.toISODateTime(this.docPeriodStart()), this.toISODateTime(this.docPeriodEnd(), true)), `fiche_synthese_entrees_${this.docPeriodStart()}_${this.docPeriodEnd()}.pdf`); }
  downloadGlobale(): void { this.downloadBlob(this.repo.exportFicheSyntheseGlobale(this.toISODateTime(this.docPeriodStart()), this.toISODateTime(this.docPeriodEnd(), true)), `fiche_synthese_globale_${this.docPeriodStart()}_${this.docPeriodEnd()}.pdf`); }
  downloadMovementsPdf(): void { this.downloadBlob(this.repo.exportStockMovements('pdf'), `rapport_mouvements_${this.today}.pdf`); }
  downloadMovementsExcel(): void { this.downloadBlob(this.repo.exportStockMovements('excel'), `rapport_mouvements_${this.today}.xlsx`); }
  downloadValorisation(locationType: string): void { this.downloadBlob(this.repo.exportRapportValorisation(locationType), `rapport_valorisation_${locationType}_${this.today}.pdf`); }
  downloadAlertes(locationType: string): void { this.downloadBlob(this.repo.exportRapportAlertes(locationType), `rapport_alertes_${locationType}_${this.today}.pdf`); }
  downloadInventaire(locationType: string): void { this.downloadBlob(this.repo.exportInventaireComplet(locationType), `inventaire_complet_${locationType}_${this.today}.pdf`); }
  downloadRotation(locationType: string): void { this.downloadBlob(this.repo.exportRapportRotation(locationType, this.toISODateTime(this.docPeriodStart()), this.toISODateTime(this.docPeriodEnd(), true)), `rapport_rotation_${locationType}_${this.docPeriodStart()}_${this.docPeriodEnd()}.pdf`); }
  downloadReceptions(): void { this.downloadBlob(this.repo.exportRapportReceptions(this.toISODateTime(this.docPeriodStart()), this.toISODateTime(this.docPeriodEnd(), true)), `rapport_receptions_${this.docPeriodStart()}_${this.docPeriodEnd()}.pdf`); }
  downloadDotations(): void { this.downloadBlob(this.repo.exportRapportDotations(this.toISODateTime(this.docPeriodStart()), this.toISODateTime(this.docPeriodEnd(), true)), `rapport_dotations_${this.docPeriodStart()}_${this.docPeriodEnd()}.pdf`); }
  downloadReappro(): void { this.downloadBlob(this.repo.exportRapportReapprovisionnement(), `rapport_reapprovisionnement_tampon_${this.today}.pdf`); }
  downloadTransferts(locationType: string): void { this.downloadBlob(this.repo.exportRapportTransferts(locationType, this.toISODateTime(this.docPeriodStart()), this.toISODateTime(this.docPeriodEnd(), true)), `rapport_transferts_${locationType}_${this.docPeriodStart()}_${this.docPeriodEnd()}.pdf`); }
  downloadHebdo(locationType: string): void { this.downloadBlob(this.repo.exportFicheHebdomadaire(locationType, this.toISODateTime(this.docPeriodStart()), this.toISODateTime(this.docPeriodEnd(), true)), `fiche_hebdomadaire_${locationType}_${this.docPeriodStart()}_${this.docPeriodEnd()}.pdf`); }

  triggerAutoReport(mode: 'weekly' | 'daily'): void {
    const locType = this.excelLocationType();
    const ps = this.toISODateTime(this.docPeriodStart());
    const pe = this.toISODateTime(this.docPeriodEnd(), true);
    const obs$ = mode === 'weekly'
      ? this.repo.triggerAutoWeekly(locType, ps, pe)
      : this.repo.triggerAutoDaily(locType, ps, pe);
    this.generating.set(true);
    obs$.pipe(takeUntil(this.d$)).subscribe({
      next: (res: any) => {
        this.generating.set(false);
        this.showToast(`Rapport ${mode === 'weekly' ? 'hebdomadaire' : 'quotidien'} généré et sauvegardé (id: ${res?.id ?? '—'})`, 'success');
        this.loadReports();
      },
      error: () => {
        this.generating.set(false);
        this.showToast(`Erreur lors de la génération du rapport ${mode}`, 'error');
      }
    });
  }

  // ── Quick exports (CSV/Excel/PDF by location) ──
  exportItemsByLocation(format: string): void {
    const locId = this.selectedLocationId();
    if (!locId) { this.showToast('Sélectionnez un emplacement', 'error'); return; }
    const ext = format === 'excel' ? 'xlsx' : format;
    this.downloadBlob(this.repo.exportStockItems(locId, format), `stock_items_${locId}.${ext}`);
  }

  exportMovementsCsv(): void {
    this.downloadBlob(this.repo.exportStockMovements('csv'), `stock_movements_${this.today}.csv`);
  }

  // ── Excel with charts ──
  downloadExcelChart(type: string): void {
    const locType = this.excelLocationType();
    switch (type) {
      case 'items':
        this.downloadBlob(this.repo.exportExcelItems(locType), `stock_items_${locType.toLowerCase()}_${this.today}.xlsx`);
        break;
      case 'movements':
        this.downloadBlob(this.repo.exportExcelMovements(), `stock_movements_${this.today}.xlsx`);
        break;
      case 'valorisation':
        this.downloadBlob(this.repo.exportExcelValorisation(locType), `valorisation_${locType.toLowerCase()}_${this.today}.xlsx`);
        break;
      case 'global':
        this.downloadBlob(this.repo.exportExcelGlobal(locType, this.toISODateTime(this.docPeriodStart()), this.toISODateTime(this.docPeriodEnd(), true)), `rapport_global_${locType.toLowerCase()}_${this.today}.xlsx`);
        break;
    }
  }

  onLocationChange(value: string): void { this.selectedLocationId.set(value); }

  toggleCustomReport(): void {
    this.showCustomReport.update(v => !v);
    if (!this.showCustomReport()) this.customReport.set(null);
  }

  toggleLocationType(type: string): void {
    const idx = this.customFilters.locationTypes.indexOf(type);
    if (idx >= 0) this.customFilters.locationTypes.splice(idx, 1);
    else this.customFilters.locationTypes.push(type);
  }

  toggleMaterialType(type: string): void {
    const idx = this.customFilters.materialTypes.indexOf(type);
    if (idx >= 0) this.customFilters.materialTypes.splice(idx, 1);
    else this.customFilters.materialTypes.push(type);
  }

  toggleAlertLevel(level: string): void {
    const idx = this.customFilters.alertLevels.indexOf(level);
    if (idx >= 0) this.customFilters.alertLevels.splice(idx, 1);
    else this.customFilters.alertLevels.push(level);
  }

  generateCustomReport(): void {
    this.customGenerating.set(true);
    this.customReport.set(null);
    const user = this.auth.getCurrentUser();
    const criteria: CustomReportCriteriaDto = {
      locationTypes: this.customFilters.locationTypes.length > 0 ? this.customFilters.locationTypes : undefined,
      materialTypes: this.customFilters.materialTypes.length > 0 ? this.customFilters.materialTypes : undefined,
      alertLevels: this.customFilters.alertLevels.length > 0 ? this.customFilters.alertLevels : undefined,
      productSku: this.customFilters.productSku || undefined,
      minQuantity: this.customFilters.minQuantity ?? undefined,
      maxQuantity: this.customFilters.maxQuantity ?? undefined,
      minValue: this.customFilters.minValue ?? undefined,
      maxValue: this.customFilters.maxValue ?? undefined,
      generatedBy: user?.matricule || 'system',
      format: this.customFilters.format
    };
    this.repo.generateCustomReport(criteria).pipe(takeUntil(this.d$)).subscribe({
      next: (report) => {
        this.customGenerating.set(false);
        this.customReport.set(report);
        this.showToast('Rapport personnalisé généré', 'success');
        this.loadReports();
      },
      error: () => {
        this.customGenerating.set(false);
        this.showToast('Erreur lors de la génération du rapport', 'error');
      }
    });
  }

  downloadCustomReport(): void {
    const report = this.customReport();
    if (!report) return;
    this.downloadReport(report);
  }

  showToast(msg: string, type: 'success' | 'error'): void {
    this.toastMsg.set(msg);
    this.toastType.set(type);
    setTimeout(() => this.toastMsg.set(''), 4000);
  }

  // ═══════════════════════════════════════════════════════════
  //  IA Meeting Report
  // ═══════════════════════════════════════════════════════════

  private checkIaStatus(): void {
    this.iaService.getStatus().pipe(
      catchError(() => of({ configured: false, model: '', service: 'TantyAI' }))
    ).subscribe(s => {
      this.iaConfigured.set(s.configured);
      this.iaModel.set(s.model);
    });
  }

  toggleMeetingForm(): void {
    this.showMeetingForm.update(v => !v);
    if (!this.showMeetingForm()) {
      this.meetingResult.set(null);
    }
  }

  generateMeetingReport(): void {
    if (!this.meetingForm.title.trim()) {
      this.showToast('Veuillez saisir un titre', 'error');
      return;
    }
    this.meetingGenerating.set(true);
    this.meetingResult.set(null);

    const participants = this.meetingForm.participants
      .split(',').map(p => p.trim()).filter(p => p.length > 0);

    this.iaService.generateMeetingReport({
      title: this.meetingForm.title,
      date: this.meetingForm.date,
      location: this.meetingForm.location,
      participants,
      agenda: this.meetingForm.agenda,
      notes: this.meetingForm.notes,
      decisions: this.meetingForm.decisions,
      actionItems: this.meetingForm.actionItems
    }).pipe(takeUntil(this.d$)).subscribe({
      next: (resp) => {
        this.meetingResult.set(resp);
        this.meetingGenerating.set(false);
        this.showToast('Compte-rendu généré', 'success');
      },
      error: () => {
        this.meetingGenerating.set(false);
        this.showToast('Erreur lors de la génération du compte-rendu IA', 'error');
      }
    });
  }

  copyMeetingReport(): void {
    const content = this.meetingResult()?.formattedReport || '';
    navigator.clipboard.writeText(content).then(() => {
      this.showToast('Compte-rendu copié dans le presse-papiers', 'success');
    }).catch(() => {
      this.showToast('Impossible de copier', 'error');
    });
  }

  downloadMeetingReport(): void {
    const content = this.meetingResult()?.formattedReport || '';
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compte_rendu_${this.meetingForm.title.replace(/\s+/g, '_').toLowerCase()}_${this.meetingForm.date}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    this.showToast('Compte-rendu téléchargé (Markdown)', 'success');
  }

  downloadMeetingReportPdf(): void {
    const participants = this.meetingForm.participants
      .split(',').map(p => p.trim()).filter(p => p.length > 0);
    this.iaService.exportMeetingReportPdf({
      title: this.meetingForm.title,
      date: this.meetingForm.date,
      location: this.meetingForm.location,
      participants,
      agenda: this.meetingForm.agenda,
      notes: this.meetingForm.notes,
      decisions: this.meetingForm.decisions,
      actionItems: this.meetingForm.actionItems
    }).pipe(takeUntil(this.d$)).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `compte_rendu_${this.meetingForm.title.replace(/\s+/g, '_').toLowerCase()}_${this.meetingForm.date}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.showToast('Compte-rendu PDF téléchargé', 'success');
      },
      error: () => this.showToast('Erreur lors de la génération du PDF', 'error')
    });
  }

  downloadMeetingReportWord(): void {
    const content = this.meetingResult()?.formattedReport || '';
    const header = `<!DOCTYPE html><html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Compte-rendu</title></head><body style='font-family:Calibri,sans-serif;font-size:11pt;line-height:1.6'>`;
    const body = content.split('\n').map((line: string) => {
      const t = line.trim();
      if (t.startsWith('# ')) return `<h1 style='color:#14532D;font-size:16pt'>${t.substring(2)}</h1>`;
      if (t.startsWith('## ')) return `<h2 style='color:#1E7A42;font-size:13pt'>${t.substring(3)}</h2>`;
      if (t.startsWith('### ')) return `<h3 style='color:#1F2937;font-size:12pt'>${t.substring(4)}</h3>`;
      if (t.startsWith('- ') || t.startsWith('* ')) return `<p style='margin-left:20px'>• ${t.substring(2)}</p>`;
      if (t === '') return '<br/>';
      return `<p>${t}</p>`;
    }).join('\n');
    const footer = `</body></html>`;
    const blob = new Blob(['\ufeff', header + body + footer], { type: 'application/msword;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compte_rendu_${this.meetingForm.title.replace(/\s+/g, '_').toLowerCase()}_${this.meetingForm.date}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    this.showToast('Compte-rendu Word téléchargé', 'success');
  }

  resetMeetingForm(): void {
    this.meetingForm = {
      title: '', date: new Date().toISOString().split('T')[0],
      location: '', participants: '', agenda: '', notes: '', decisions: '', actionItems: ''
    };
    this.meetingResult.set(null);
  }
}
