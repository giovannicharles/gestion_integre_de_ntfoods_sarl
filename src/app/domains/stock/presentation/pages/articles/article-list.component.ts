import { Component, OnInit, signal, computed, inject, AfterViewInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chart, registerables } from 'chart.js';
import { ApiService } from '../../../../../core/http/api.service';
import { AuthService } from '../../../../../core/auth/auth.service';

Chart.register(...registerables);

interface StockLocation {
  id: string;
  name: string;
  type: string;
}

interface StockItem {
  id: number;
  locationId: string;
  productId: number | null;
  productSku: string;
  productName: string;
  productUnit: string;
  productCategory: string;
  materialType: string;
  productLineName: string;
  brandName: string;
  packagingType: string;
  quantity: number;
  quantityPerCarton: number;
  cartons: number;
  unitWeight: number;
  volume: string | null;
  cartonsPerAssortiment: number | null;
  reorderPoint: number;
  safetyStock: number;
  lastUpdated: string | null;
  lastUpdatedBy: string | null;
}

type SortKey = 'productSku' | 'productName' | 'quantity' | 'unitWeight' | 'lastUpdated';
type SortDir = 'asc' | 'desc';
type AlertLevel = 'CRITIQUE' | 'FAIBLE' | 'NORMAL';

@Component({
  selector: 'app-article-list',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe],
  templateUrl: './article-list.component.html',
  styleUrls: ['./article-list.component.css']
})
export class ArticleListComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  @ViewChild('invMaterialChart') invMaterialCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('invQtyChart') invQtyCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('invPackagingChart') invPackagingCanvas!: ElementRef<HTMLCanvasElement>;
  private materialChart?: Chart;
  private qtyChart?: Chart;
  private packagingChart?: Chart;

  showStats = signal(true);
  chartView = signal<'material' | 'quantity' | 'packaging'>('material');

  items = signal<StockItem[]>([]);
  filtered = signal<StockItem[]>([]);
  locations = signal<StockLocation[]>([]);
  selectedLocationId = signal('');
  loading = signal(true);
  showForm = signal(false);
  saving = signal(false);
  search = signal('');
  toastMsg = signal('');
  toastType = signal<'success' | 'error'>('success');

  sortKey = signal<SortKey>('productSku');
  sortDir = signal<SortDir>('asc');
  filterPackaging = signal('ALL');

  showAdjustModal = signal(false);
  adjustItem = signal<StockItem | null>(null);
  adjustAmount = signal(0);
  adjustMode = signal<'add' | 'subtract'>('add');
  adjustNote = signal('');

  showEditModal = signal(false);
  editItem = signal<StockItem | null>(null);
  editQuantity = signal(0);
  editQtyPerCarton = signal(1);
  editUnitWeight = signal(1);
  editVolume = signal('');
  editPackagingType = signal('UNIT');

  showDetailModal = signal(false);
  detailItem = signal<StockItem | null>(null);

  Math = Math;

  newItem: any = {
    locationId: '',
    productId: '',
    productSku: '',
    packagingType: 'UNIT',
    quantity: 0,
    quantityPerCarton: 1,
    unitWeight: 1,
    volume: '',
    cartonsPerAssortiment: '',
    updatedBy: 'system'
  };

  ngOnInit(): void {
    this.newItem.updatedBy = this.auth.getCurrentUser()?.matricule || 'system';
    this.loadLocations();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.buildCharts(), 300);
  }

  ngOnDestroy(): void {
    this.materialChart?.destroy();
    this.qtyChart?.destroy();
    this.packagingChart?.destroy();
  }

  loadLocations(): void {
    this.api.get<StockLocation[]>('stock/locations').subscribe({
      next: (data) => {
        this.locations.set(data || []);
        if (data && data.length > 0) {
          this.selectedLocationId.set(data[0].id);
          this.loadItems();
        } else {
          this.loading.set(false);
        }
      },
      error: () => {
        this.loading.set(false);
        this.showToast('Erreur chargement emplacements', 'error');
      }
    });
  }

  loadItems(): void {
    const locId = this.selectedLocationId();
    if (!locId) return;
    this.loading.set(true);
    this.api.get<StockItem[]>(`stock/items/location/${locId}`).subscribe({
      next: (data) => {
        this.items.set(data || []);
        this.applyFilters();
        this.loading.set(false);
        setTimeout(() => this.buildCharts(), 100);
      },
      error: () => {
        this.loading.set(false);
        this.showToast('Erreur chargement articles', 'error');
      }
    });
  }

  // ── Chart data computations ──
  materialDist = computed(() => {
    const items = this.items();
    const counts: Record<string, number> = {};
    items.forEach(i => {
      const t = i.materialType || 'PRODUIT_FINI';
      counts[t] = (counts[t] || 0) + 1;
    });
    return [
      { label: 'Produits Finis', value: counts['PRODUIT_FINI'] || 0, color: '#1A6B2A' },
      { label: 'Matières Premières', value: counts['MATIERE_PREMIERE'] || 0, color: '#EA580C' },
      { label: 'Consommables', value: counts['CONSOMMABLE'] || 0, color: '#2563EB' }
    ].filter(d => d.value > 0);
  });

  qtyByMaterial = computed(() => {
    const items = this.items();
    const sums: Record<string, number> = {};
    items.forEach(i => {
      const t = i.materialType || 'PRODUIT_FINI';
      sums[t] = (sums[t] || 0) + Number(i.quantity || 0);
    });
    return [
      { label: 'Produits Finis', value: sums['PRODUIT_FINI'] || 0, color: '#1A6B2A' },
      { label: 'Matières Premières', value: sums['MATIERE_PREMIERE'] || 0, color: '#EA580C' },
      { label: 'Consommables', value: sums['CONSOMMABLE'] || 0, color: '#2563EB' }
    ].filter(d => d.value > 0);
  });

  packagingDist = computed(() => {
    const items = this.items();
    const counts: Record<string, number> = {};
    items.forEach(i => {
      const p = i.packagingType || 'Non défini';
      counts[p] = (counts[p] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  });

  topQtyProducts = computed(() => {
    const items = this.items();
    return [...items]
      .sort((a, b) => Number(b.quantity || 0) - Number(a.quantity || 0))
      .slice(0, 10)
      .map(i => ({ label: i.productName || i.productSku, value: Number(i.quantity || 0) }));
  });

  private buildCharts(): void {
    if (!this.showStats()) return;
    this.buildMaterialChart();
    this.buildQtyChart();
    this.buildPackagingChart();
  }

  private buildMaterialChart(): void {
    if (this.materialChart) { this.materialChart.destroy(); this.materialChart = undefined; }
    if (!this.invMaterialCanvas?.nativeElement) return;
    const dist = this.materialDist();
    this.materialChart = new Chart(this.invMaterialCanvas.nativeElement.getContext('2d')!, {
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

  private buildQtyChart(): void {
    if (this.qtyChart) { this.qtyChart.destroy(); this.qtyChart = undefined; }
    if (!this.invQtyCanvas?.nativeElement) return;
    const dist = this.qtyByMaterial();
    this.qtyChart = new Chart(this.invQtyCanvas.nativeElement.getContext('2d')!, {
      type: 'bar',
      data: {
        labels: dist.map(d => d.label),
        datasets: [{ label: 'Quantité', data: dist.map(d => d.value), backgroundColor: dist.map(d => d.color + 'BB'), borderWidth: 0, borderRadius: 6 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { font: { size: 11, family: 'Inter' } } },
          y: { beginAtZero: true, ticks: { font: { size: 11, family: 'Inter' } } }
        }
      }
    });
  }

  private buildPackagingChart(): void {
    if (this.packagingChart) { this.packagingChart.destroy(); this.packagingChart = undefined; }
    if (!this.invPackagingCanvas?.nativeElement) return;
    const dist = this.packagingDist();
    const colors = ['#1A6B2A', '#EA580C', '#2563EB', '#7c3aed', '#0891b2', '#dc2626'];
    this.packagingChart = new Chart(this.invPackagingCanvas.nativeElement.getContext('2d')!, {
      type: 'bar',
      data: {
        labels: dist.map(d => d.label),
        datasets: [{ label: 'Articles', data: dist.map(d => d.value), backgroundColor: dist.map((_, i) => colors[i % colors.length] + 'BB'), borderWidth: 0, borderRadius: 6 }]
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, ticks: { font: { size: 11, family: 'Inter' }, stepSize: 1 } },
          y: { ticks: { font: { size: 11, family: 'Inter' } } }
        }
      }
    });
  }

  toggleStats(): void {
    this.showStats.update(v => !v);
    if (this.showStats()) {
      setTimeout(() => this.buildCharts(), 100);
    }
  }

  setChartView(view: 'material' | 'quantity' | 'packaging'): void {
    this.chartView.set(view);
    setTimeout(() => this.buildCharts(), 50);
  }

  onLocationChange(): void {
    this.loadItems();
  }

  applyFilters(): void {
    const q = this.search().toLowerCase().trim();
    const pkg = this.filterPackaging();
    let r = this.items();

    if (q) {
      r = r.filter(i =>
        (i.productSku || '').toLowerCase().includes(q) ||
        (i.productName || '').toLowerCase().includes(q) ||
        (i.brandName || '').toLowerCase().includes(q) ||
        (i.productCategory || '').toLowerCase().includes(q)
      );
    }
    if (pkg !== 'ALL') {
      r = r.filter(i => i.packagingType === pkg);
    }

    const sk = this.sortKey();
    const sd = this.sortDir();
    r = [...r].sort((a, b) => {
      let va = a[sk] as any;
      let vb = b[sk] as any;
      if (sk === 'lastUpdated') {
        va = va ? new Date(va).getTime() : 0;
        vb = vb ? new Date(vb).getTime() : 0;
      }
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return sd === 'asc' ? -1 : 1;
      if (va > vb) return sd === 'asc' ? 1 : -1;
      return 0;
    });

    this.filtered.set(r);
  }

  onSearch(): void {
    this.applyFilters();
  }

  onFilterPackaging(): void {
    this.applyFilters();
  }

  sortBy(key: SortKey): void {
    if (this.sortKey() === key) {
      this.sortDir.update(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortKey.set(key);
      this.sortDir.set('asc');
    }
    this.applyFilters();
  }

  sortIcon(key: SortKey): string {
    if (this.sortKey() !== key) return 'fa-sort';
    return this.sortDir() === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }

  toggleForm(): void {
    this.showForm.update(v => !v);
  }

  createItem(): void {
    if (!this.newItem.productSku || this.newItem.quantity < 0) {
      this.showToast('SKU requis et quantité valide', 'error');
      return;
    }
    this.newItem.locationId = this.selectedLocationId();
    this.saving.set(true);
    this.api.post('stock/items', this.newItem).subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.resetForm();
        this.loadItems();
        this.showToast('Article créé avec succès', 'success');
      },
      error: () => {
        this.saving.set(false);
        this.showToast('Erreur lors de la création', 'error');
      }
    });
  }

  openAdjustModal(item: StockItem, mode: 'add' | 'subtract'): void {
    this.adjustItem.set(item);
    this.adjustMode.set(mode);
    this.adjustAmount.set(10);
    this.adjustNote.set('');
    this.showAdjustModal.set(true);
  }

  closeAdjustModal(): void {
    this.showAdjustModal.set(false);
    this.adjustItem.set(null);
  }

  confirmAdjust(): void {
    const item = this.adjustItem();
    const amount = this.adjustAmount();
    if (!item || amount <= 0) {
      this.showToast('Quantité invalide', 'error');
      return;
    }
    const user = this.auth.getCurrentUser()?.matricule || 'system';
    const url = this.adjustMode() === 'add'
      ? `stock/items/location/${this.selectedLocationId()}/sku/${item.productSku}/add`
      : `stock/items/location/${this.selectedLocationId()}/sku/${item.productSku}/subtract`;
    const body = this.adjustMode() === 'add'
      ? { quantityToAdd: amount, updatedBy: user }
      : { quantityToSubtract: amount, updatedBy: user };

    this.saving.set(true);
    this.api.post(url, body).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeAdjustModal();
        this.loadItems();
        this.showToast(`${this.adjustMode() === 'add' ? '+' : '-'}${amount} ${item.productSku}`, 'success');
      },
      error: () => {
        this.saving.set(false);
        this.showToast('Erreur lors de l\'ajustement', 'error');
      }
    });
  }

  openEditModal(item: StockItem): void {
    this.editItem.set(item);
    this.editQuantity.set(item.quantity);
    this.editQtyPerCarton.set(item.quantityPerCarton);
    this.editUnitWeight.set(item.unitWeight);
    this.editVolume.set(item.volume || '');
    this.editPackagingType.set(item.packagingType);
    this.showEditModal.set(true);
  }

  closeEditModal(): void {
    this.showEditModal.set(false);
    this.editItem.set(null);
  }

  saveEdit(): void {
    const item = this.editItem();
    if (!item) return;
    this.saving.set(true);
    this.api.post('stock/items', {
      locationId: this.selectedLocationId(),
      productId: item.productId,
      productSku: item.productSku,
      packagingType: this.editPackagingType(),
      quantity: this.editQuantity(),
      quantityPerCarton: this.editQtyPerCarton(),
      unitWeight: this.editUnitWeight(),
      volume: this.editVolume(),
      cartonsPerAssortiment: item.cartonsPerAssortiment || '',
      updatedBy: this.auth.getCurrentUser()?.matricule || 'system'
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeEditModal();
        this.loadItems();
        this.showToast('Article modifié avec succès', 'success');
      },
      error: () => {
        this.saving.set(false);
        this.showToast('Erreur lors de la modification', 'error');
      }
    });
  }

  openDetailModal(item: StockItem): void {
    this.detailItem.set(item);
    this.showDetailModal.set(true);
  }

  closeDetailModal(): void {
    this.showDetailModal.set(false);
    this.detailItem.set(null);
  }

  editFromDetail(item: StockItem): void {
    this.closeDetailModal();
    this.openEditModal(item);
  }

  computeAlert(item: StockItem): AlertLevel {
    const qty = Number(item.quantity || 0);
    const safety = Number(item.safetyStock || 0);
    const reorder = Number(item.reorderPoint || 0);
    if (safety > 0 && qty <= safety) return 'CRITIQUE';
    if (reorder > 0 && qty <= reorder) return 'FAIBLE';
    return 'NORMAL';
  }

  alertClass(level: AlertLevel): string {
    if (level === 'CRITIQUE') return 'badge-danger';
    if (level === 'FAIBLE') return 'badge-warning';
    return 'badge-success';
  }

  packagingLabel(pkg: string): string {
    const m: Record<string, string> = {
      UNIT: 'Unité',
      CARTON: 'Carton',
      ASSORTIMENT: 'Assortiment'
    };
    return m[pkg] || pkg;
  }

  formatDate(date: string | null): string {
    if (!date) return '—';
    const d = new Date(date);
    return d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  resetForm(): void {
    this.newItem = {
      locationId: this.selectedLocationId(),
      productId: '',
      productSku: '',
      packagingType: 'UNIT',
      quantity: 0,
      quantityPerCarton: 1,
      unitWeight: 1,
      volume: '',
      cartonsPerAssortiment: '',
      updatedBy: this.auth.getCurrentUser()?.matricule || 'system'
    };
  }

  get totalQuantity(): number {
    return this.items().reduce((s, i) => s + Number(i.quantity || 0), 0);
  }

  get totalCartons(): number {
    return this.items().reduce((s, i) => s + Math.ceil(Number(i.quantity || 0) / Math.max(1, Number(i.quantityPerCarton || 1))), 0);
  }

  get totalWeight(): number {
    return this.items().reduce((s, i) => s + (Number(i.quantity || 0) * Number(i.unitWeight || 0)), 0);
  }

  get criticalCount(): number {
    return this.items().filter(i => this.computeAlert(i) === 'CRITIQUE').length;
  }

  get lowCount(): number {
    return this.items().filter(i => this.computeAlert(i) === 'FAIBLE').length;
  }

  get normalCount(): number {
    return this.items().filter(i => this.computeAlert(i) === 'NORMAL').length;
  }

  getLocationName(id: string): string {
    return this.locations().find(l => l.id === id)?.name || '—';
  }

  getLocationTypeLabel(type: string): string {
    const m: Record<string, string> = {
      STOCK_CENTRAL: 'Stock Central',
      STOCK_BUFFER: 'Stock Tampon',
      STOCK_MOBILE: 'Stock Mobile',
      MAGASIN: 'Magasin'
    };
    return m[type] || type;
  }

  getLocationTypeClass(type: string): string {
    const m: Record<string, string> = {
      STOCK_CENTRAL: 'badge-central',
      STOCK_BUFFER: 'badge-buffer',
      STOCK_MOBILE: 'badge-mobile',
      MAGASIN: 'badge-magasin'
    };
    return m[type] || 'badge-neutral';
  }

  selectedLocationType(): string {
    const loc = this.locations().find(l => l.id === this.selectedLocationId());
    return loc?.type || '';
  }

  private showToast(msg: string, type: 'success' | 'error'): void {
    this.toastMsg.set(msg);
    this.toastType.set(type);
    setTimeout(() => this.toastMsg.set(''), 4000);
  }
}
