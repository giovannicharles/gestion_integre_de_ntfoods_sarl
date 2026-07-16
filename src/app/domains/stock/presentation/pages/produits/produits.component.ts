import { Component, OnInit, signal, computed, inject, OnDestroy, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { Chart, registerables } from 'chart.js';
import { ProductService } from '../../../application/services/product.service';
import { PriceType } from '../../../domain/models/product.models';

Chart.register(...registerables);

@Component({
  selector: 'app-produits',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe],
  templateUrl: './produits.component.html',
  styleUrls: ['./produits.component.css']
})
export class ProduitsComponent implements OnInit, AfterViewInit, OnDestroy {
  private d$ = new Subject<void>();
  private svc = inject(ProductService);

  @ViewChild('materialChart') materialChartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('categoryChart') categoryChartCanvas!: ElementRef<HTMLCanvasElement>;
  private materialChart?: Chart;
  private categoryChart?: Chart;

  activeTab = signal<'lines' | 'variants' | 'products' | 'prices'>('products');
  showStats = signal(true);
  loading = signal(true);
  toastMsg = signal('');
  toastType = signal<'success' | 'error'>('success');

  // Data
  brands = signal<any[]>([]);
  lines = signal<any[]>([]);
  variants = signal<any[]>([]);
  products = signal<any[]>([]);
  stats = signal<any>({});
  brandMap = new Map<number, string>();
  lineMap = new Map<number, string>();

  // Filters
  searchProduct = '';
  filterMaterial = signal<string>('ALL');
  filterBrandId = signal<number | null>(null);
  filterLineId = signal<number | null>(null);

  // Filtered computed
  filteredProducts = computed(() => {
    let r = this.products();
    const fm = this.filterMaterial();
    if (fm !== 'ALL') r = r.filter(p => (p.materialType || 'PRODUIT_FINI') === fm);
    if (this.searchProduct) {
      const q = this.searchProduct.toLowerCase();
      r = r.filter(p => (p.sku || '').toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q));
    }
    return r;
  });

  filteredLines = computed(() => {
    const fb = this.filterBrandId();
    if (fb === null) return this.lines();
    return this.lines().filter(l => l.brandId === fb);
  });

  filteredVariants = computed(() => {
    const fl = this.filterLineId();
    if (fl === null) return this.variants();
    return this.variants().filter(v => v.productLineId === fl);
  });

  // Modal state
  showModal = signal(false);
  modalMode = signal<'create' | 'edit'>('create');
  modalEntity = signal<'line' | 'variant' | 'product' | 'price'>('line');
  editingId = signal<number | null>(null);

  // Form fields
  formName = '';
  formCode = '';
  formActive = true;
  formBrandId: number | null = null;
  formLineId: number | null = null;
  formSku = '';
  formBarcode = '';
  formCategory = '';
  formUnit = 'unite';
  formUnitPrice = 0;
  formLeadTime = 0;
  formSafetyStock = 0;
  formPackagingType = '';
  formQtyPerCarton: number | null = null;
  formUnitWeight: number | null = null;
  formVolume = '';
  formCartonsPerAssort: number | null = null;
  formMaterialType = 'PRODUIT_FINI';
  formVariantId: number | null = null;

  // Price form
  priceProductId: number | null = null;
  priceType = 'DISTRIBUTOR';
  priceAmount = 0;
  priceCurrency = 'XAF';
  priceMinQty = 0;
  priceActive = true;
  priceEditingId: number | null = null;

  // Price modal for viewing/editing prices of a product
  showPriceModal = signal(false);
  priceModalProduct = signal<any>(null);
  productPrices = signal<any[]>([]);

  // Stats computed
  productCount = computed(() => this.products().length);
  lineCount = computed(() => this.lines().length);
  variantCount = computed(() => this.variants().length);
  activeProductCount = computed(() => this.products().filter(p => p.active).length);
  inactiveProductCount = computed(() => this.products().filter(p => !p.active).length);

  // Material type distribution
  materialDistribution = computed(() => {
    const prods = this.products();
    const counts: Record<string, number> = {};
    prods.forEach(p => {
      const type = p.materialType || 'PRODUIT_FINI';
      counts[type] = (counts[type] || 0) + 1;
    });
    return this.materialTypes.map(mt => ({
      label: mt.label,
      value: counts[mt.value] || 0,
      color: mt.color,
      icon: mt.icon
    }));
  });

  // Category distribution (top 8)
  categoryDistribution = computed(() => {
    const prods = this.products();
    const counts: Record<string, number> = {};
    prods.forEach(p => {
      const cat = p.category || 'Non classé';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  });

  // Packaging distribution
  packagingDistribution = computed(() => {
    const prods = this.products();
    const counts: Record<string, number> = {};
    prods.forEach(p => {
      const pkg = p.packagingType || 'Non défini';
      counts[pkg] = (counts[pkg] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  });

  // Price stats
  avgPrice = computed(() => {
    const prods = this.products();
    if (prods.length === 0) return 0;
    return prods.reduce((sum, p) => sum + Number(p.unitPriceAmount || 0), 0) / prods.length;
  });

  maxPrice = computed(() => {
    const prods = this.products();
    if (prods.length === 0) return 0;
    return Math.max(...prods.map(p => Number(p.unitPriceAmount || 0)));
  });

  minPrice = computed(() => {
    const prods = this.products();
    if (prods.length === 0) return 0;
    return Math.min(...prods.map(p => Number(p.unitPriceAmount || 0)));
  });

  // Weight stats
  avgWeight = computed(() => {
    const prods = this.products().filter(p => p.unitWeight != null);
    if (prods.length === 0) return 0;
    return prods.reduce((sum, p) => sum + Number(p.unitWeight || 0), 0) / prods.length;
  });

  Math = Math;

  priceTypes = [
    { value: 'DISTRIBUTOR', label: 'Distributeur (≥100 cartons)' },
    { value: 'WHOLESALE', label: 'Grossiste (≥25 cartons)' },
    { value: 'RETAIL', label: 'Détail (<25 cartons)' },
    { value: 'DETAIL', label: 'Unité (détail)' }
  ];

  materialTypes = [
    { value: 'PRODUIT_FINI', label: 'Produit Fini', icon: 'fa-box', color: 'var(--b-d)' },
    { value: 'MATIERE_PREMIERE', label: 'Matière Première', icon: 'fa-wheat-awn', color: 'var(--o)' },
    { value: 'CONSOMMABLE', label: 'Consommable', icon: 'fa-box-open', color: 'var(--g)' }
  ];

  ngOnInit() { this.load(); }

  ngAfterViewInit(): void {
    setTimeout(() => this.buildCharts(), 300);
  }

  load() {
    this.loading.set(true);
    forkJoin({
      brands: this.svc.getAllBrands(),
      lines: this.svc.getAllProductLines(),
      variants: this.svc.getAllProductVariants(),
      products: this.svc.getAllProducts(),
      stats: this.svc.getStats()
    }).pipe(takeUntil(this.d$)).subscribe({
      next: ({ brands, lines, variants, products, stats }) => {
        this.brands.set(brands);
        this.lines.set(lines);
        this.variants.set(variants);
        this.products.set(products);
        this.stats.set(stats);
        this.brandMap.clear();
        brands.forEach(b => this.brandMap.set(b.id, b.name));
        this.lineMap.clear();
        lines.forEach(l => this.lineMap.set(l.id, l.name));
        this.loading.set(false);
        setTimeout(() => this.buildCharts(), 100);
      },
      error: () => {
        this.showToast('Erreur lors du chargement des données', 'error');
        this.loading.set(false);
      }
    });
  }

  private buildCharts(): void {
    this.buildMaterialChart();
    this.buildCategoryChart();
  }

  private buildMaterialChart(): void {
    if (this.materialChart) { this.materialChart.destroy(); this.materialChart = undefined; }
    if (!this.materialChartCanvas?.nativeElement) return;
    const dist = this.materialDistribution();
    this.materialChart = new Chart(this.materialChartCanvas.nativeElement.getContext('2d')!, {
      type: 'doughnut',
      data: {
        labels: dist.map(d => d.label),
        datasets: [{
          data: dist.map(d => d.value),
          backgroundColor: ['#1A6B2A', '#EA580C', '#2563EB', '#7c3aed'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { padding: 12, font: { size: 11, family: 'Inter' } } }
        },
        cutout: '60%'
      }
    });
  }

  private buildCategoryChart(): void {
    if (this.categoryChart) { this.categoryChart.destroy(); this.categoryChart = undefined; }
    if (!this.categoryChartCanvas?.nativeElement) return;
    const dist = this.categoryDistribution();
    this.categoryChart = new Chart(this.categoryChartCanvas.nativeElement.getContext('2d')!, {
      type: 'bar',
      data: {
        labels: dist.map(d => d.label),
        datasets: [{
          label: 'Produits',
          data: dist.map(d => d.value),
          backgroundColor: 'rgba(26,107,42,.7)',
          borderColor: '#1A6B2A',
          borderWidth: 0,
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
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

  // ── Modal helpers ──
  openCreate(entity: 'line' | 'variant' | 'product' | 'price') {
    this.modalMode.set('create');
    this.modalEntity.set(entity);
    this.editingId.set(null);
    this.resetForm();
    // Auto-assign TANTY brand (id=1, the only brand)
    if (entity === 'line' && this.brands().length > 0) this.formBrandId = this.brands()[0].id;
    if (entity === 'variant') this.formLineId = this.filterLineId();
    this.showModal.set(true);
  }

  openEdit(entity: 'line' | 'variant' | 'product', item: any) {
    this.modalMode.set('edit');
    this.modalEntity.set(entity);
    this.editingId.set(item.id);
    this.resetForm();
    if (entity === 'line') {
      this.formName = item.name || '';
      this.formCode = item.code || '';
      this.formActive = item.active;
      this.formBrandId = item.brandId;
    } else if (entity === 'variant') {
      this.formName = item.name || '';
      this.formCode = item.code || '';
      this.formLineId = item.productLineId;
    } else if (entity === 'product') {
      this.formSku = item.sku || '';
      this.formBarcode = item.barcode || '';
      this.formCategory = item.category || '';
      this.formUnit = item.unit || 'unite';
      this.formUnitPrice = Number(item.unitPriceAmount || 0);
      this.formLeadTime = Number(item.leadTimeDays || 0);
      this.formSafetyStock = Number(item.safetyStockDays || 0);
      this.formPackagingType = item.packagingType || '';
      this.formQtyPerCarton = item.quantityPerCarton ?? null;
      this.formUnitWeight = item.unitWeight ? Number(item.unitWeight) : null;
      this.formVolume = item.volume || '';
      this.formCartonsPerAssort = item.cartonsPerAssortiment ?? null;
      this.formMaterialType = item.materialType || 'PRODUIT_FINI';
      this.formVariantId = item.variantId ?? null;
      this.formActive = item.active;
    }
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.editingId.set(null);
  }

  resetForm() {
    this.formName = '';
    this.formCode = '';
    this.formActive = true;
    this.formBrandId = null;
    this.formLineId = null;
    this.formSku = '';
    this.formBarcode = '';
    this.formCategory = '';
    this.formUnit = 'unite';
    this.formUnitPrice = 0;
    this.formLeadTime = 0;
    this.formSafetyStock = 0;
    this.formPackagingType = '';
    this.formQtyPerCarton = null;
    this.formUnitWeight = null;
    this.formVolume = '';
    this.formCartonsPerAssort = null;
    this.formMaterialType = 'PRODUIT_FINI';
    this.formVariantId = null;
  }

  saveModal() {
    const mode = this.modalMode();
    const entity = this.modalEntity();
    const id = this.editingId();

    if (entity === 'line') {
      const payload = { brandId: this.formBrandId!, name: this.formName, code: this.formCode, active: this.formActive };
      if (mode === 'create') {
        this.svc.createProductLine(payload).pipe(takeUntil(this.d$)).subscribe({ next: () => { this.showToast('Gamme créée', 'success'); this.closeModal(); this.load(); }, error: (e) => this.showToast(e.error?.message || 'Erreur', 'error') });
      } else {
        this.svc.updateProductLine(id!, payload).pipe(takeUntil(this.d$)).subscribe({ next: () => { this.showToast('Gamme modifiée', 'success'); this.closeModal(); this.load(); }, error: (e) => this.showToast(e.error?.message || 'Erreur', 'error') });
      }
    } else if (entity === 'variant') {
      const payload = { productLineId: this.formLineId!, name: this.formName, code: this.formCode };
      if (mode === 'create') {
        this.svc.createProductVariant(payload).pipe(takeUntil(this.d$)).subscribe({ next: () => { this.showToast('Variante créée', 'success'); this.closeModal(); this.load(); }, error: (e) => this.showToast(e.error?.message || 'Erreur', 'error') });
      } else {
        this.svc.updateProductVariant(id!, payload).pipe(takeUntil(this.d$)).subscribe({ next: () => { this.showToast('Variante modifiée', 'success'); this.closeModal(); this.load(); }, error: (e) => this.showToast(e.error?.message || 'Erreur', 'error') });
      }
    } else if (entity === 'product') {
      const payload: any = {
        sku: this.formSku, barcode: this.formBarcode, category: this.formCategory, unit: this.formUnit,
        unitPriceAmount: this.formUnitPrice, leadTimeDays: this.formLeadTime, safetyStockDays: this.formSafetyStock,
        packagingType: this.formPackagingType, quantityPerCarton: this.formQtyPerCarton, unitWeight: this.formUnitWeight,
        volume: this.formVolume, cartonsPerAssortiment: this.formCartonsPerAssort, materialType: this.formMaterialType,
        variantId: this.formVariantId, active: this.formActive
      };
      if (mode === 'create') {
        this.svc.createProduct(payload).pipe(takeUntil(this.d$)).subscribe({ next: () => { this.showToast('Produit créé', 'success'); this.closeModal(); this.load(); }, error: (e) => this.showToast(e.error?.message || 'Erreur', 'error') });
      } else {
        this.svc.updateProduct(id!, payload).pipe(takeUntil(this.d$)).subscribe({ next: () => { this.showToast('Produit modifié', 'success'); this.closeModal(); this.load(); }, error: (e) => this.showToast(e.error?.message || 'Erreur', 'error') });
      }
    }
  }

  deleteItem(entity: 'line' | 'variant' | 'product', id: number) {
    if (!confirm('Confirmer la suppression ?')) return;
    if (entity === 'line') this.svc.deleteProductLine(id).pipe(takeUntil(this.d$)).subscribe({ next: () => { this.showToast('Gamme supprimée', 'success'); this.load(); }, error: (e) => this.showToast(e.error?.message || 'Erreur', 'error') });
    else if (entity === 'variant') this.svc.deleteProductVariant(id).pipe(takeUntil(this.d$)).subscribe({ next: () => { this.showToast('Variante supprimée', 'success'); this.load(); }, error: (e) => this.showToast(e.error?.message || 'Erreur', 'error') });
    else if (entity === 'product') this.svc.deleteProduct(id).pipe(takeUntil(this.d$)).subscribe({ next: () => { this.showToast('Produit supprimé', 'success'); this.load(); }, error: (e) => this.showToast(e.error?.message || 'Erreur', 'error') });
  }

  // ── Price modal ──
  openPrices(product: any) {
    this.priceModalProduct.set(product);
    this.showPriceModal.set(true);
    this.loadPrices(product.id);
  }

  loadPrices(productId: number) {
    this.svc.getProductPrices(productId).pipe(takeUntil(this.d$)).subscribe({
      next: (prices) => this.productPrices.set(prices),
      error: () => this.productPrices.set([])
    });
  }

  closePriceModal() {
    this.showPriceModal.set(false);
    this.priceModalProduct.set(null);
    this.productPrices.set([]);
    this.priceEditingId = null;
    this.priceType = 'DISTRIBUTOR';
    this.priceAmount = 0;
    this.priceMinQty = 0;
  }

  savePrice() {
    const product = this.priceModalProduct();
    if (!product) return;
    const payload = { priceType: this.priceType as PriceType, price: this.priceAmount, currency: this.priceCurrency, minQuantity: this.priceMinQty, active: this.priceActive };
    if (this.priceEditingId) {
      this.svc.updateProductPrice(product.id, this.priceEditingId, payload).pipe(takeUntil(this.d$)).subscribe({
        next: () => { this.showToast('Prix modifié', 'success'); this.priceEditingId = null; this.priceType = 'DISTRIBUTOR'; this.priceAmount = 0; this.priceMinQty = 0; this.loadPrices(product.id); },
        error: (e) => this.showToast(e.error?.message || 'Erreur', 'error')
      });
    } else {
      this.svc.createProductPrice(product.id, { ...payload, productId: product.id }).pipe(takeUntil(this.d$)).subscribe({
        next: () => { this.showToast('Prix ajouté', 'success'); this.priceType = 'DISTRIBUTOR'; this.priceAmount = 0; this.priceMinQty = 0; this.loadPrices(product.id); },
        error: (e) => this.showToast(e.error?.message || 'Erreur', 'error')
      });
    }
  }

  editPrice(p: any) {
    this.priceEditingId = p.id;
    this.priceType = p.priceType;
    this.priceAmount = Number(p.price);
    this.priceCurrency = p.currency || 'XAF';
    this.priceMinQty = Number(p.minQuantity || 0);
    this.priceActive = p.active;
  }

  cancelEditPrice() {
    this.priceEditingId = null;
    this.priceType = 'DISTRIBUTOR';
    this.priceAmount = 0;
    this.priceMinQty = 0;
  }

  deletePrice(priceId: number) {
    const product = this.priceModalProduct();
    if (!product) return;
    if (!confirm('Supprimer ce prix ?')) return;
    this.svc.deleteProductPrice(product.id, priceId).pipe(takeUntil(this.d$)).subscribe({
      next: () => { this.showToast('Prix supprimé', 'success'); this.loadPrices(product.id); },
      error: (e) => this.showToast(e.error?.message || 'Erreur', 'error')
    });
  }

  // ── Helpers ──
  getBrandName(id: number): string { return this.brandMap.get(id) || '—'; }
  getLineName(id: number): string { return this.lineMap.get(id) || '—'; }
  getBrandNameForVariant(productLineId: number): string {
    const line = this.lines().find(l => l.id === productLineId);
    return line ? this.getBrandName(line.brandId) : '—';
  }
  lineCountForBrand(brandId: number): number { return this.lines().filter(l => l.brandId === brandId).length; }
  variantCountForLine(lineId: number): number { return this.variants().filter(v => v.productLineId === lineId).length; }
  productCountForVariant(variantId: number): number { return this.products().filter(p => p.variantId === variantId).length; }
  getPriceTypeLabel(type: string): string { return this.priceTypes.find(p => p.value === type)?.label || type; }
  getMaterialLabel(type: string): string { return this.materialTypes.find(m => m.value === type)?.label || type; }
  getMaterialIcon(type: string): string { return this.materialTypes.find(m => m.value === type)?.icon || 'fa-box'; }
  getMaterialColor(type: string): string { return this.materialTypes.find(m => m.value === type)?.color || 'var(--n600)'; }

  formatCFA(n: number): string { return new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA'; }

  showToast(msg: string, type: 'success' | 'error') {
    this.toastMsg.set(msg);
    this.toastType.set(type);
    setTimeout(() => this.toastMsg.set(''), 4000);
  }

  setTab(tab: 'lines' | 'variants' | 'products' | 'prices') {
    this.activeTab.set(tab);
    this.filterLineId.set(null);
  }

  ngOnDestroy() {
    this.d$.next(); this.d$.complete();
    this.materialChart?.destroy();
    this.categoryChart?.destroy();
  }
}
