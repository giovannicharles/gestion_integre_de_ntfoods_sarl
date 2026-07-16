import { Component, OnInit, signal, inject, OnDestroy, AfterViewInit, ViewChild, ElementRef, computed } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, catchError, of, forkJoin } from 'rxjs';
import { Chart, registerables } from 'chart.js';
import { ReportUseCase } from '../../../application/use-cases/rapports/report.use-case';
import { AuthService } from '../../../../../core/auth/auth.service';
import { StockApiRepository, ReportData, GenerateReportRequest } from '../../../infrastructure/repositories/stock-api.repository';
import { StockLevel, StockMovement, DashboardStatsResponse } from '../../../domain/models';

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
  stockLevels = signal<StockLevel[]>([]);
  movements = signal<StockMovement[]>([]);
  dashboardStats = signal<DashboardStatsResponse | null>(null);
  analysisLoading = signal(false);

  // Computed distributions
  materialAnalysis = computed(() => {
    const levels = this.stockLevels();
    const counts: Record<string, number> = {};
    const qtys: Record<string, number> = {};
    const values: Record<string, number> = {};
    levels.forEach(sl => {
      const cat = sl.warehouseType || sl.product?.category || 'Autre';
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
      { label: 'Critique', value: counts['CRITIQUE'], color: '#dc2626' },
      { label: 'Faible', value: counts['FAIBLE'], color: '#ea580c' },
      { label: 'Normal', value: counts['NORMAL'], color: '#1A6B2A' }
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
    return [...this.stockLevels()]
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10)
      .map(sl => ({ name: sl.productName || sl.productSku || 'N/A', qty: sl.quantity, value: sl.stockValue || 0 }));
  });

  totalStockValue = computed(() => this.stockLevels().reduce((s, sl) => s + (sl.stockValue || 0), 0));
  totalStockQty = computed(() => this.stockLevels().reduce((s, sl) => s + sl.quantity, 0));

  reports = signal<ReportData[]>([]);
  loading = signal(true);
  error = signal('');
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

  reportTypes = [
    { value: 'STOCK_CENTRAL_STATUS', label: 'État du stock central', icon: 'fa-building-circle-check', category: 'stock' },
    { value: 'STOCK_BUFFER_STATUS', label: 'État du magasin tampon', icon: 'fa-warehouse', category: 'stock' },
    { value: 'STOCK_MOVEMENTS', label: 'Mouvements de stock', icon: 'fa-right-left', category: 'stock' },
    { value: 'COMMERCIAL_PERFORMANCE', label: 'Performance commerciale', icon: 'fa-chart-line', category: 'commercial' },
    { value: 'DOTATIONS_VS_SALES', label: 'Dotations vs ventes', icon: 'fa-scale-balanced', category: 'commercial' },
    { value: 'INVENTORY', label: 'Rapport d\'inventaire', icon: 'fa-clipboard-list', category: 'stock' },
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
        icon: 'fa-file-pdf', color: 'var(--g)', action: () => this.downloadNTFoods(), needsPeriod: false
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
        icon: 'fa-file-excel', color: '#1D6F42', action: () => this.downloadMovementsExcel(), needsPeriod: false
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
        icon: 'fa-triangle-exclamation', color: '#dc2626', action: () => this.downloadAlertes('central'), needsPeriod: false
      },
      {
        id: 'inventaire-central', label: 'Inventaire Complet', description: 'Tous les champs: cartons, poids, volume, seuils',
        icon: 'fa-clipboard-list', color: 'var(--n800)', action: () => this.downloadInventaire('central'), needsPeriod: false
      },
      {
        id: 'rotation-central', label: 'Rotation du Stock', description: 'Entrées, sorties et taux de rotation',
        icon: 'fa-rotate', color: 'var(--p)', action: () => this.downloadRotation('central'), needsPeriod: true
      }
    ];
  }

  ngOnInit(): void {
    this.loadReports();
    this.loadAnalysisData();
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
      stats: this.repo.getDashboard()
    }).pipe(takeUntil(this.d$)).subscribe({
      next: ({ levels, movements, stats }) => {
        this.stockLevels.set(levels);
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
    const colors = ['#1A6B2A', '#EA580C', '#2563EB', '#7c3aed', '#0891b2', '#dc2626'];
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
        datasets: [{ label: 'Quantité', data: dist.map(d => d.qty), backgroundColor: 'rgba(26,107,42,.7)', borderWidth: 0, borderRadius: 6 }]
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
    const colors = ['#1A6B2A', '#EA580C', '#2563EB', '#7c3aed', '#0891b2', '#dc2626', '#f59e0b', '#8b5cf6'];
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

    this.uc.getByUser(generatedBy).pipe(
      takeUntil(this.d$),
      catchError(() => of([] as ReportData[]))
    ).subscribe(r => {
      this.reports.set(r);
      this.loading.set(false);
    });
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
    return found ? (found.category === 'stock' ? 'var(--g)' : 'var(--b)') : 'var(--n500)';
  }

  downloadReport(report: ReportData): void {
    this.showToast(`Téléchargement ${report.format} du rapport ${report.title || this.getReportTypeLabel(report.type)}`, 'success');
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

  downloadNTFoods(): void { this.downloadBlob(this.repo.exportFicheSyntheseNTFoods('Terrain'), `fiche_infos_produits_tanty_${this.today}.pdf`); }
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

  showToast(msg: string, type: 'success' | 'error'): void {
    this.toastMsg.set(msg);
    this.toastType.set(type);
    setTimeout(() => this.toastMsg.set(''), 4000);
  }
}
