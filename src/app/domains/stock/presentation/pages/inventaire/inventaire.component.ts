import { Component, OnInit, signal, computed, inject, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { Chart, registerables } from 'chart.js';
import { StockLevelUseCase } from '../../../application/use-cases/inventaire/stock-level.use-case';
import { StockApiRepository, StockLocationDto } from '../../../infrastructure/repositories/stock-api.repository';
import { AuthService } from '../../../../../core/auth/auth.service';
import { StockLevel, Warehouse } from '../../../domain/models';
Chart.register(...registerables);

interface InventoryItem {
  id: number;
  productSku: string;
  productName: string;
  quantity: number;
  reorderPoint: number;
  safetyStock: number;
  unit: string;
  locationId: string;
  locationName: string;
  locationType: string;
  alertLevel: string;
  stockValue: number;
  unitPrice: number;
  materialType: string;
  productLineName: string;
  brandName: string;
  lastUpdated?: string;
}

interface GammeStat {
  name: string;
  count: number;
  totalQty: number;
  criticalCount: number;
  lowCount: number;
}

@Component({
  selector: 'app-inventaire',
  standalone: true,
  imports: [CommonModule, DecimalPipe, FormsModule, RouterLink],
  templateUrl: './inventaire.component.html',
  styleUrls: ['./inventaire.component.css']
})
export class InventaireComponent implements OnInit, AfterViewInit, OnDestroy {
  private d$ = new Subject<void>();
  private uc = inject(StockLevelUseCase);
  private repo = inject(StockApiRepository);
  private auth = inject(AuthService);

  @ViewChild('valueCanvas') valueCanvas!: ElementRef<HTMLCanvasElement>;
  private chart: Chart | null = null;

  loading = signal(true);
  allItems = signal<InventoryItem[]>([]);
  filtered = signal<InventoryItem[]>([]);
  paginated = signal<InventoryItem[]>([]);

  // Filtres
  search = '';
  filterType = signal<'ALL' | 'CENTRAL' | 'BUFFER' | 'MOBILE'>('ALL');
  filterAlert = signal<'ALL' | 'CRITIQUE' | 'FAIBLE' | 'NORMAL'>('ALL');
  filterMaterial = signal<'ALL' | 'PRODUIT_FINI' | 'MATIERE_PREMIERE' | 'CONSOMMABLE'>('ALL');
  filterGamme = signal<string>('ALL');
  sortBy = signal<'name' | 'qty' | 'value' | 'alert'>('name');
  sortDir = signal<'asc' | 'desc'>('asc');

  // Locations
  centralLocations = signal<StockLocationDto[]>([]);
  bufferLocations = signal<StockLocationDto[]>([]);
  mobileLocations = signal<StockLocationDto[]>([]);

  // Vue
  viewMode = signal<'table' | 'cards'>('table');

  // Pagination
  ps = 12; cp = signal(1); totalPages = signal(1);
  get pages() { return Array.from({ length: this.totalPages() }, (_, i) => i + 1); }

  // Toast
  toastMsg = signal(''); toastType = signal<'success' | 'error'>('success');

  // Modal ajustement
  showAjust = signal(false);
  ajustItem = signal<InventoryItem | null>(null);
  ajustQty = 0; ajustMotif = ''; ajustSaving = signal(false);

  // Modal transfert
  showTransfer = signal(false);
  transferItem = signal<InventoryItem | null>(null);
  transferQty = 0; transferSaving = signal(false);

  // Détail
  selectedItem = signal<InventoryItem | null>(null);

  isDG = signal(false);
  Math = Math;

  // Computed counts per type
  centralCount = computed(() => this.allItems().filter(i => i.locationType === 'CENTRAL').length);
  bufferCount = computed(() => this.allItems().filter(i => i.locationType === 'BUFFER').length);
  mobileCount = computed(() => this.allItems().filter(i => i.locationType === 'MOBILE').length);

  // Computed counts per material type
  produitFiniCount = computed(() => this.allItems().filter(i => i.materialType === 'PRODUIT_FINI').length);
  matierePremiereCount = computed(() => this.allItems().filter(i => i.materialType === 'MATIERE_PREMIERE').length);
  consommableCount = computed(() => this.allItems().filter(i => i.materialType === 'CONSOMMABLE').length);

  // Stats par gamme (product line)
  gammes = computed<GammeStat[]>(() => {
    const map = new Map<string, GammeStat>();
    this.allItems().forEach(item => {
      const name = item.productLineName || item.materialType || 'Autres';
      const existing = map.get(name) || { name, count: 0, totalQty: 0, criticalCount: 0, lowCount: 0 };
      existing.count++;
      existing.totalQty += item.quantity;
      if (item.alertLevel === 'CRITIQUE') existing.criticalCount++;
      if (item.alertLevel === 'FAIBLE') existing.lowCount++;
      map.set(name, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.totalQty - a.totalQty);
  });

  // Liste des gammes pour le filtre
  gammeOptions = computed(() => {
    const set = new Set<string>();
    this.allItems().forEach(i => { if (i.productLineName) set.add(i.productLineName); });
    return Array.from(set).sort();
  });

  ngOnInit() {
    this.isDG.set(this.auth.hasRole('DIRECTEUR_GENERAL') || this.auth.hasRole('GESTIONNAIRE_STOCK') || this.auth.hasRole('ADMIN'));
    this.loadData();
  }

  ngAfterViewInit() { if (!this.loading()) this.buildChart(); }
  ngOnDestroy() { this.chart?.destroy(); this.d$.next(); this.d$.complete(); }

  loadData() {
    this.loading.set(true);
    forkJoin({
      levels: this.uc.getAll(),
      items: this.uc.getAllStockItems(),
      central: this.repo.getStockLocationsByType('STOCK_CENTRAL'),
      buffer: this.repo.getStockLocationsByType('STOCK_BUFFER'),
      mobile: this.repo.getStockLocationsByType('STOCK_MOBILE')
    }).pipe(takeUntil(this.d$)).subscribe({
      next: ({ levels, items, central, buffer, mobile }) => {
        this.centralLocations.set(central);
        this.bufferLocations.set(buffer);
        this.mobileLocations.set(mobile);

        // Construire une map des stock levels pour enrichir les items
        const levelMap = new Map<number, StockLevel>();
        levels.forEach(l => levelMap.set(l.id, l));

        // Mapper les stock items
        const mapped: InventoryItem[] = (items as any[]).map((raw: any) => {
          const locId = raw.locationId || '';
          const locType = this.getLocationType(locId, central, buffer, mobile);
          const locName = this.getLocationName(locId, central, buffer, mobile);
          const qty = Number(raw.quantity || 0);
          const reorder = Number(raw.reorderPoint || 0);
          const safety = Number(raw.safetyStock || 0);
          const unitPrice = Number(raw.unitPriceAmount || 0);
          const materialType = raw.materialType || 'PRODUIT_FINI';
          return {
            id: raw.id,
            productSku: raw.productSku || raw.sku || '',
            productName: raw.productName || raw.designation || raw.productSku || 'Produit',
            quantity: qty,
            reorderPoint: reorder,
            safetyStock: safety,
            unit: this.formatUnit(raw.packagingType || raw.productUnit || raw.unit),
            locationId: locId,
            locationName: locName,
            locationType: locType,
            alertLevel: this.computeAlert(qty, reorder, safety),
            stockValue: qty * unitPrice,
            unitPrice,
            materialType,
            productLineName: raw.productLineName || '',
            brandName: raw.brandName || '',
            lastUpdated: raw.lastUpdated
          };
        });

        // Si pas d'items depuis /all, utiliser les stock levels
        if (mapped.length === 0 && levels.length > 0) {
          levels.forEach(sl => {
            mapped.push({
              id: sl.id,
              productSku: sl.productSku || '',
              productName: sl.productName || 'Produit',
              quantity: Number(sl.quantity || 0),
              reorderPoint: Number(sl.reorderPoint || 0),
              safetyStock: 0,
              unit: this.formatUnit(sl.packagingType || sl.productUnit),
              locationId: '',
              locationName: sl.warehouseName || '',
              locationType: (sl.warehouseType || '').toUpperCase().includes('CENTRAL') ? 'CENTRAL' :
                            (sl.warehouseType || '').toUpperCase().includes('BUFFER') ? 'BUFFER' : 'MOBILE',
              alertLevel: sl.alertLevel || 'NORMAL',
              stockValue: sl.stockValue || 0,
              unitPrice: sl.unitPrice || 0,
              materialType: 'PRODUIT_FINI',
              productLineName: '',
              brandName: ''
            });
          });
        }

        this.allItems.set(mapped);
        this.applyFilters();
        this.loading.set(false);
        setTimeout(() => this.buildChart(), 100);
      },
      error: () => {
        this.loading.set(false);
        this.showToast('Erreur lors du chargement de l\'inventaire', 'error');
      }
    });
  }

  private formatUnit(unit: string | undefined | null): string {
    if (!unit) return 'unité';
    const u = unit.trim().toLowerCase();
    const labels: Record<string, string> = {
      'sachet': 'sachet',
      'seau': 'seau',
      'etui': 'étui',
      'bouteille': 'bouteille',
      'doypack': 'doypack',
      'boite': 'boîte',
      'carton': 'carton',
      'unite': 'unité',
      'kg': 'kg',
      'g': 'g',
      'l': 'L',
    };
    return labels[u] || u;
  }

  private getLocationType(locId: string, central: StockLocationDto[], buffer: StockLocationDto[], mobile: StockLocationDto[]): string {
    if (central.some(l => l.id === locId)) return 'CENTRAL';
    if (buffer.some(l => l.id === locId)) return 'BUFFER';
    if (mobile.some(l => l.id === locId)) return 'MOBILE';
    return 'UNKNOWN';
  }

  private getLocationName(locId: string, central: StockLocationDto[], buffer: StockLocationDto[], mobile: StockLocationDto[]): string {
    const all = [...central, ...buffer, ...mobile];
    const found = all.find(l => l.id === locId);
    return found?.name || 'Inconnu';
  }

  private computeAlert(qty: number, reorder: number, safety: number): string {
    if (safety > 0 && qty <= safety) return 'CRITIQUE';
    if (reorder > 0 && qty <= reorder) return 'FAIBLE';
    return 'NORMAL';
  }

  applyFilters() {
    let r = this.allItems();

    // Filtre par type d'emplacement
    const ft = this.filterType();
    if (ft !== 'ALL') r = r.filter(i => i.locationType === ft);

    // Filtre par type de produit (matière)
    const fm = this.filterMaterial();
    if (fm !== 'ALL') r = r.filter(i => i.materialType === fm);

    // Filtre par gamme
    const fg = this.filterGamme();
    if (fg !== 'ALL') r = r.filter(i => (i.productLineName || i.materialType || 'Autres') === fg);

    // Filtre par niveau d'alerte
    const fa = this.filterAlert();
    if (fa !== 'ALL') r = r.filter(i => i.alertLevel === fa);

    // Recherche
    if (this.search) {
      const q = this.search.toLowerCase();
      r = r.filter(i =>
        i.productName.toLowerCase().includes(q) ||
        i.productSku.toLowerCase().includes(q)
      );
    }

    // Tri
    const sb = this.sortBy();
    const dir = this.sortDir() === 'asc' ? 1 : -1;
    r = [...r].sort((a, b) => {
      if (sb === 'name') return a.productName.localeCompare(b.productName) * dir;
      if (sb === 'qty') return (a.quantity - b.quantity) * dir;
      if (sb === 'value') return (a.stockValue - b.stockValue) * dir;
      if (sb === 'alert') {
        const order: Record<string, number> = { CRITIQUE: 0, FAIBLE: 1, NORMAL: 2 };
        return ((order[a.alertLevel] ?? 3) - (order[b.alertLevel] ?? 3)) * dir;
      }
      return 0;
    });

    this.filtered.set(r);
    this.cp.set(1);
    this.totalPages.set(Math.ceil(r.length / this.ps) || 1);
    this.goTo(1);
    setTimeout(() => this.buildChart(), 50);
  }

  setSort(col: 'name' | 'qty' | 'value' | 'alert') {
    if (this.sortBy() === col) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortBy.set(col);
      this.sortDir.set('asc');
    }
    this.applyFilters();
  }

  goTo(p: number) {
    const n = Math.max(1, Math.min(p, this.totalPages()));
    this.cp.set(n);
    const s = (n - 1) * this.ps;
    this.paginated.set(this.filtered().slice(s, s + this.ps));
  }

  // ── Stats ──
  get totalValue(): number { return this.filtered().reduce((a, i) => a + i.stockValue, 0); }
  get totalQty(): number { return this.filtered().reduce((a, i) => a + i.quantity, 0); }
  get criticalCount(): number { return this.filtered().filter(i => i.alertLevel === 'CRITIQUE').length; }
  get lowCount(): number { return this.filtered().filter(i => i.alertLevel === 'FAIBLE').length; }
  get normalCount(): number { return this.filtered().filter(i => i.alertLevel === 'NORMAL').length; }

  // ── Chart ──
  buildChart() {
    if (!this.valueCanvas) return;
    this.chart?.destroy();
    const top = [...this.filtered()].sort((a, b) => b.stockValue - a.stockValue).slice(0, 8);
    const ctx = this.valueCanvas.nativeElement.getContext('2d')!;

    const dataLabelPlugin = {
      id: 'dataLabels',
      afterDatasetsDraw(chart: any) {
        const { ctx } = chart;
        ctx.save();
        chart.data.datasets[0].data.forEach((value: number, index: number) => {
          const meta = chart.getDatasetMeta(0);
          const bar = meta.data[index];
          if (!bar) return;
          ctx.font = '600 11px Inter, sans-serif';
          ctx.fillStyle = '#374151';
          ctx.textAlign = 'center';
          const text = new Intl.NumberFormat('fr-CM', { notation: 'compact' }).format(Math.round(value));
          ctx.fillText(text, bar.x, bar.y - 6);
        });
        ctx.restore();
      }
    };

    this.chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: top.map(i => (i.productName || i.productSku).substring(0, 14)),
        datasets: [{
          label: 'Valeur stock (FCFA)',
          data: top.map(i => i.stockValue),
          backgroundColor: top.map(i => i.alertLevel === 'CRITIQUE' ? 'rgba(198,40,40,.8)' : i.alertLevel === 'FAIBLE' ? 'rgba(230,81,0,.8)' : 'rgba(26,107,42,.8)'),
          borderRadius: 6, borderSkipped: false
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        layout: { padding: { top: 20 } },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: c => ` ${new Intl.NumberFormat('fr-CM').format(Math.round(c.parsed.y ?? 0))} FCFA` } }
        },
        scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,.04)' }, ticks: { font: { family: 'DM Sans', size: 11 }, callback: v => new Intl.NumberFormat('fr-CM', { notation: 'compact' }).format(+v) } }, x: { grid: { display: false }, ticks: { font: { family: 'DM Sans', size: 10 }, maxRotation: 30 } } }
      },
      plugins: [dataLabelPlugin]
    });
  }

  // ── Helpers ──
  getColor(level: string): string {
    if (level === 'CRITIQUE') return '#C62828';
    if (level === 'FAIBLE') return '#E65100';
    return '#2E7D32';
  }

  getNClass(n: string): string {
    const m: Record<string, string> = { CRITIQUE: 'badge-danger', FAIBLE: 'badge-warning', NORMAL: 'badge-success', SURPLUS: 'badge-secondary' };
    return m[n] || 'badge-neutral';
  }

  getPct(item: InventoryItem): number {
    const rp = Number(item.reorderPoint || 1);
    return Math.min(100, Math.round((item.quantity / (rp * 6)) * 100));
  }

  fCFA(n: number): string { return new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA'; }

  mathMin(a: number, b: number) { return Math.min(a, b); }

  getTypeIcon(type: string): string {
    const m: Record<string, string> = { CENTRAL: 'fa-warehouse', BUFFER: 'fa-layer-group', MOBILE: 'fa-truck', UNKNOWN: 'fa-box' };
    return m[type] || 'fa-box';
  }

  getTypeLabel(type: string): string {
    const m: Record<string, string> = { CENTRAL: 'Central', BUFFER: 'Tampon', MOBILE: 'Mobile', UNKNOWN: 'Autre' };
    return m[type] || 'Autre';
  }

  getMaterialLabel(mt: string): string {
    const m: Record<string, string> = { PRODUIT_FINI: 'Produit Fini', MATIERE_PREMIERE: 'Matière Première', CONSOMMABLE: 'Consommable' };
    return m[mt] || mt;
  }

  getMaterialIcon(mt: string): string {
    const m: Record<string, string> = { PRODUIT_FINI: 'fa-box', MATIERE_PREMIERE: 'fa-sack-wheat', CONSOMMABLE: 'fa-box-open' };
    return m[mt] || 'fa-box';
  }

  getMaterialClass(mt: string): string {
    const m: Record<string, string> = { PRODUIT_FINI: 'mat-fini', MATIERE_PREMIERE: 'mat-mp', CONSOMMABLE: 'mat-cons' };
    return m[mt] || 'mat-fini';
  }

  // ── Ajustement ──
  openAjust(item: InventoryItem) {
    this.ajustItem.set(item);
    this.ajustQty = item.quantity;
    this.ajustMotif = '';
    this.showAjust.set(true);
  }

  closeAjust() { this.showAjust.set(false); this.ajustItem.set(null); }

  sauverAjust() {
    const item = this.ajustItem();
    if (!item || !this.ajustMotif || this.ajustSaving()) return;
    this.ajustSaving.set(true);
    const user = this.auth.getCurrentUser();
    const requestedBy = user?.matricule || 'system';
    this.uc.adjust(item.id, this.ajustQty, this.ajustMotif, requestedBy)
      .pipe(takeUntil(this.d$)).subscribe({
        next: () => {
          this.ajustSaving.set(false);
          this.closeAjust();
          this.showToast(`Ajustement enregistré pour ${item.productName}. Mouvement ADJUSTMENT créé.`, 'success');
          this.loadData();
        },
        error: () => {
          this.ajustSaving.set(false);
          this.showToast('Erreur lors de l\'ajustement', 'error');
        }
      });
  }

  // ── Transfert central → tampon ──
  openTransfer(item: InventoryItem) {
    if (item.locationType !== 'CENTRAL') return;
    this.transferItem.set(item);
    this.transferQty = Math.max(0, item.reorderPoint - item.quantity);
    if (this.transferQty === 0) this.transferQty = 10;
    this.showTransfer.set(true);
  }

  closeTransfer() { this.showTransfer.set(false); this.transferItem.set(null); }

  sauverTransfer() {
    const item = this.transferItem();
    if (!item || this.transferQty <= 0 || this.transferSaving()) return;
    if (this.transferQty > item.quantity) {
      this.showToast(`Stock central insuffisant: ${item.quantity} ${item.unit} disponibles`, 'error');
      return;
    }
    this.transferSaving.set(true);
    const userId = this.auth.getCurrentUser()?.matricule || 'system';
    this.uc.replenishBuffer(item.productSku, this.transferQty, userId, `Transfert central → tampon - ${item.productName} (${item.productSku})`)
      .pipe(takeUntil(this.d$)).subscribe({
        next: () => {
          this.transferSaving.set(false);
          this.closeTransfer();
          this.showToast(`Transfert de ${this.transferQty} ${item.unit} vers le tampon effectué.`, 'success');
          this.loadData();
        },
        error: (err) => {
          this.transferSaving.set(false);
          const msg = err?.error?.message || 'Erreur lors du transfert';
          this.showToast(msg, 'error');
        }
      });
  }

  // ── Export CSV ──
  exportCSV() {
    const rows = this.filtered();
    const header = ['SKU', 'Produit', 'Emplacement', 'Type', 'Quantite', 'Unite', 'Seuil Reappro', 'Stock Securite', 'Niveau', 'Valeur FCFA'];
    const csv = [
      header.join(';'),
      ...rows.map(i => [
        i.productSku, i.productName, i.locationName, i.locationType,
        i.quantity, i.unit, i.reorderPoint, i.safetyStock,
        i.alertLevel, Math.round(i.stockValue)
      ].join(';'))
    ].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `inventaire_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    this.showToast('Export CSV téléchargé', 'success');
  }

  // ── Toast ──
  showToast(msg: string, type: 'success' | 'error') {
    this.toastMsg.set(msg);
    this.toastType.set(type);
    setTimeout(() => this.toastMsg.set(''), 4000);
  }
}
