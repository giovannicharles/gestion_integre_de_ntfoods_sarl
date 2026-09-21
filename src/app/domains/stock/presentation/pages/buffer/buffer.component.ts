import { Component, OnInit, signal, computed, inject, OnDestroy } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { StockApiRepository, StockLocationDto, BufferValuationResponse } from '../../../infrastructure/repositories/stock-api.repository';
import { StockLevelUseCase } from '../../../application/use-cases/inventaire/stock-level.use-case';
import { StockMovement } from '../../../domain/models';
import { AuthService } from '../../../../../core/auth/auth.service';

interface PackagingDetail {
  packagingType: string;
  quantity: number;
  quantityPerCarton: number;
  cartons: number;
}

interface BufferItem {
  id: number;
  productId: number;
  productSku: string;
  productName: string;
  quantity: number;
  reorderPoint: number;
  safetyStock: number;
  unit: string;
  materialType: string;
  productLineName: string;
  brandName: string;
  alertLevel: string;
  centralQty: number;
  centralReorder: number;
  recommendedQty: number;
  unitPrice: number;
  itemValue: number;
  packagings: PackagingDetail[];
  centralPackagings: PackagingDetail[];
}

@Component({
  selector: 'app-buffer',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe, DatePipe],
  templateUrl: './buffer.component.html',
  styleUrls: ['./buffer.component.css']
})
export class BufferComponent implements OnInit, OnDestroy {
  private d$ = new Subject<void>();
  private repo = inject(StockApiRepository);
  private uc = inject(StockLevelUseCase);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);

  loading = signal(true);
  allItems = signal<BufferItem[]>([]);
  filtered = signal<BufferItem[]>([]);
  movements = signal<StockMovement[]>([]);

  // Filters
  search = '';
  filterAlert = signal<'ALL' | 'CRITIQUE' | 'FAIBLE' | 'NORMAL'>('ALL');
  filterMaterial = signal<'ALL' | 'PRODUIT_FINI' | 'MATIERE_PREMIERE' | 'CONSOMMABLE'>('ALL');
  sortBy = signal<'name' | 'qty' | 'alert'>('name');
  sortDir = signal<'asc' | 'desc'>('asc');

  // Pagination
  ps = 10;
  cp = signal(1);
  totalPages = computed(() => Math.max(1, Math.ceil(this.filtered().length / this.ps)));
  paginated = computed(() => {
    const s = (this.cp() - 1) * this.ps;
    return this.filtered().slice(s, s + this.ps);
  });

  // Modal
  showReappro = signal(false);
  reapproItem = signal<BufferItem | null>(null);
  reapproQty = 0;
  reapproNotes = '';
  reapproSaving = signal(false);

  // Add to buffer modal
  showAddBuffer = signal(false);
  addBufferSearch = '';
  addBufferQty = 0;
  addBufferNotes = '';
  addBufferSaving = signal(false);
  centralProductsNotInBuffer = signal<any[]>([]);
  addBufferSelectedSku = signal('');

  totalValue = signal(0);
  toastMsg = signal('');
  toastType = signal<'success'|'error'>('success');

  // Computed counts
  criticalCount = computed(() => this.allItems().filter(i => i.alertLevel === 'CRITIQUE').length);
  warningCount = computed(() => this.allItems().filter(i => i.alertLevel === 'FAIBLE').length);
  okCount = computed(() => this.allItems().filter(i => i.alertLevel === 'NORMAL').length);
  produitFiniCount = computed(() => this.allItems().filter(i => i.materialType === 'PRODUIT_FINI').length);
  matierePremiereCount = computed(() => this.allItems().filter(i => i.materialType === 'MATIERE_PREMIERE').length);
  consommableCount = computed(() => this.allItems().filter(i => i.materialType === 'CONSOMMABLE').length);
  totalQty = computed(() => this.allItems().reduce((s, i) => s + i.quantity, 0));

  Math = Math;
  private centralLocationIds: string[] = [];
  private bufferLocationIds: string[] = [];
  private prefillProductId: string | null = null;

  ngOnInit() {
    this.prefillProductId = this.route.snapshot.queryParamMap.get('productId');
    this.load();
  }

  load() {
    this.loading.set(true);
    forkJoin({
      items: this.uc.getAllStockItems(),
      movements: this.uc.getMovements(),
      central: this.repo.getStockLocationsByType('STOCK_CENTRAL'),
      buffer: this.repo.getStockLocationsByType('STOCK_BUFFER'),
      valuation: this.uc.getBufferValuation()
    }).pipe(takeUntil(this.d$)).subscribe(({items, movements, central, buffer, valuation}) => {
      this.centralLocationIds = central.map((l: StockLocationDto) => l.id);
      this.bufferLocationIds = buffer.map((l: StockLocationDto) => l.id);

      const priceMap = new Map<string, { unitPrice: number; itemValue: number }>();
      (valuation as BufferValuationResponse).items.forEach(v => {
        priceMap.set(v.productSku, { unitPrice: Number(v.unitPrice || 0), itemValue: Number(v.totalValue || 0) });
      });
      this.totalValue.set(Number((valuation as BufferValuationResponse).totalValue || 0));

      const allRaw = items as any[];
      const bufferItems = allRaw.filter(r => this.bufferLocationIds.includes(r.locationId || ''));
      const centralItems = allRaw.filter(r => this.centralLocationIds.includes(r.locationId || ''));

      // Group by productSku — a product can have multiple packaging types
      const bufferBySku = new Map<string, any[]>();
      bufferItems.forEach(r => {
        const sku = r.productSku || '';
        if (!bufferBySku.has(sku)) bufferBySku.set(sku, []);
        bufferBySku.get(sku)!.push(r);
      });
      const centralBySku = new Map<string, any[]>();
      centralItems.forEach(r => {
        const sku = r.productSku || '';
        if (!centralBySku.has(sku)) centralBySku.set(sku, []);
        centralBySku.get(sku)!.push(r);
      });

      const mapped: BufferItem[] = Array.from(bufferBySku.entries()).map(([sku, rows]) => {
        const totalQty = rows.reduce((s, r) => s + Number(r.quantity || 0), 0);
        const reorder = Math.max(...rows.map(r => Number(r.reorderPoint || 0)));
        const safety = Math.max(...rows.map(r => Number(r.safetyStock || 0)));
        const centralRows = centralBySku.get(sku) || [];
        const centralQty = centralRows.reduce((s, r) => s + Number(r.quantity || 0), 0);
        const centralReorder = Math.max(...centralRows.map(r => Number(r.reorderPoint || 0)), 0);
        const recommended = Math.max(0, reorder - totalQty);
        const priceInfo = priceMap.get(sku);
        const first = rows[0];

        const packagings: PackagingDetail[] = rows.map(r => ({
          packagingType: r.packagingType || 'CARTON',
          quantity: Number(r.quantity || 0),
          quantityPerCarton: Number(r.quantityPerCarton || 0),
          cartons: Number(r.quantityPerCarton || 0) > 0 ? Math.floor(Number(r.quantity || 0) / Number(r.quantityPerCarton || 0)) : 0
        }));
        const centralPackagings: PackagingDetail[] = centralRows.map(r => ({
          packagingType: r.packagingType || 'CARTON',
          quantity: Number(r.quantity || 0),
          quantityPerCarton: Number(r.quantityPerCarton || 0),
          cartons: Number(r.quantityPerCarton || 0) > 0 ? Math.floor(Number(r.quantity || 0) / Number(r.quantityPerCarton || 0)) : 0
        }));

        return {
          id: first.id,
          productId: first.productId || 0,
          productSku: sku,
          productName: first.productName || sku || 'Produit',
          quantity: totalQty,
          reorderPoint: reorder,
          safetyStock: safety,
          unit: first.productUnit || 'unite',
          materialType: first.materialType || 'PRODUIT_FINI',
          productLineName: first.productLineName || '',
          brandName: first.brandName || '',
          alertLevel: this.computeAlert(totalQty, reorder, safety),
          centralQty,
          centralReorder,
          recommendedQty: recommended,
          unitPrice: priceInfo?.unitPrice || 0,
          itemValue: priceInfo?.itemValue || 0,
          packagings,
          centralPackagings
        };
      });

      this.allItems.set(mapped);
      this.applyFilters();
      this.movements.set(movements.filter(m => m.type === 'TRANSFER_CENTRAL_TO_BUFFER').slice(0, 20));
      this.loading.set(false);

      // Si arrivé depuis une alerte, ouvrir automatiquement le modal de réappro
      if (this.prefillProductId) {
        const target = mapped.find(i => String(i.productId) === this.prefillProductId);
        if (target) {
          this.openReappro(target);
        }
        this.prefillProductId = null;
      }
    });
  }

  private computeAlert(qty: number, reorder: number, safety: number): string {
    if (safety > 0 && qty <= safety) return 'CRITIQUE';
    if (reorder > 0 && qty <= reorder) return 'FAIBLE';
    return 'NORMAL';
  }

  applyFilters() {
    let r = this.allItems();

    const fa = this.filterAlert();
    if (fa !== 'ALL') r = r.filter(i => i.alertLevel === fa);

    const fm = this.filterMaterial();
    if (fm !== 'ALL') r = r.filter(i => i.materialType === fm);

    if (this.search) {
      const q = this.search.toLowerCase();
      r = r.filter(i => i.productName.toLowerCase().includes(q) || i.productSku.toLowerCase().includes(q));
    }

    const sb = this.sortBy();
    const dir = this.sortDir() === 'asc' ? 1 : -1;
    r = [...r].sort((a, b) => {
      if (sb === 'name') return a.productName.localeCompare(b.productName) * dir;
      if (sb === 'qty') return (a.quantity - b.quantity) * dir;
      if (sb === 'alert') {
        const order: Record<string, number> = { CRITIQUE: 0, FAIBLE: 1, NORMAL: 2 };
        return ((order[a.alertLevel] ?? 3) - (order[b.alertLevel] ?? 3)) * dir;
      }
      return 0;
    });

    this.filtered.set(r);
    this.cp.set(1);
  }

  setSort(field: 'name' | 'qty' | 'alert') {
    if (this.sortBy() === field) {
      this.sortDir.update(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortBy.set(field);
      this.sortDir.set('asc');
    }
    this.applyFilters();
  }

  openReappro(item: BufferItem) {
    this.reapproItem.set(item);
    this.reapproQty = item.recommendedQty > 0 ? item.recommendedQty : (item.centralQty > 0 ? 10 : 0);
    this.reapproNotes = `Réapprovisionnement tampon - ${item.productName} (${item.productSku})`;
    this.showReappro.set(true);
  }

  closeReappro() {
    this.showReappro.set(false);
    this.reapproItem.set(null);
  }

  confirmReappro() {
    const item = this.reapproItem();
    if (!item || this.reapproQty <= 0 || this.reapproSaving()) return;
    if (this.reapproQty > item.centralQty) {
      this.showToast(`Stock central insuffisant: ${item.centralQty} ${item.unit} disponibles`, 'error');
      return;
    }
    this.reapproSaving.set(true);
    const userId = this.auth.getCurrentUser()?.matricule || 'system';

    this.uc.replenishBuffer(item.productSku, this.reapproQty, userId, this.reapproNotes)
      .pipe(takeUntil(this.d$)).subscribe({
        next: () => {
          // Résoudre les alertes pour ce produit après réappro
          this.repo.resolveAlertsByProduct(item.productId).pipe(takeUntil(this.d$)).subscribe({
            next: (count) => console.log(`[Buffer] ${count} alerte(s) résolue(s) pour productId=${item.productId}`),
            error: () => {}
          });
          this.reapproSaving.set(false);
          this.showToast(`Réapprovisionnement effectué: ${this.reapproQty} ${item.unit} transférés du central vers le tampon`, 'success');
          this.closeReappro();
          this.load();
        },
        error: (err) => {
          this.reapproSaving.set(false);
          const msg = err?.error?.message || 'Erreur lors du réapprovisionnement';
          this.showToast(msg, 'error');
        }
      });
  }

  openAddBuffer() {
    this.addBufferSearch = '';
    this.addBufferQty = 0;
    this.addBufferNotes = '';
    this.addBufferSelectedSku.set('');
    // Load central stock items to show products available to add
    this.uc.getAllStockItems().pipe(takeUntil(this.d$)).subscribe({
      next: (items: any[]) => {
        const centralItems = items.filter(r => this.centralLocationIds.includes(r.locationId || ''));
        const bufferSkus = new Set(this.allItems().map(i => i.productSku));
        // Only show products in central that are NOT yet in buffer
        const available = centralItems
          .filter(c => !bufferSkus.has(c.productSku))
          .map(c => ({
            productSku: c.productSku || '',
            productName: c.productName || c.productSku || 'Produit',
            quantity: Number(c.quantity || 0),
            packagingType: c.packagingType || 'CARTON',
            unit: c.productUnit || 'unite'
          }));
        this.centralProductsNotInBuffer.set(available);
        this.showAddBuffer.set(true);
      },
      error: () => this.showToast('Erreur lors du chargement des produits centraux', 'error')
    });
  }

  closeAddBuffer() {
    this.showAddBuffer.set(false);
    this.centralProductsNotInBuffer.set([]);
  }

  get filteredCentralProducts() {
    const term = this.addBufferSearch.toLowerCase().trim();
    if (!term) return this.centralProductsNotInBuffer();
    return this.centralProductsNotInBuffer().filter(p =>
      p.productSku.toLowerCase().includes(term) || p.productName.toLowerCase().includes(term)
    );
  }

  selectAddBufferProduct(sku: string) {
    this.addBufferSelectedSku.set(sku);
    this.addBufferQty = 0;
  }

  addBufferSelectedProduct = computed(() => {
    const sku = this.addBufferSelectedSku();
    if (!sku) return null;
    return this.centralProductsNotInBuffer().find(p => p.productSku === sku) || null;
  });

  confirmAddBuffer() {
    const sku = this.addBufferSelectedSku();
    if (!sku || this.addBufferQty <= 0 || this.addBufferSaving()) return;
    const product = this.centralProductsNotInBuffer().find(p => p.productSku === sku);
    if (!product) return;
    if (this.addBufferQty > product.quantity) {
      this.showToast(`Stock central insuffisant: ${product.quantity} ${product.unit} disponibles`, 'error');
      return;
    }
    this.addBufferSaving.set(true);
    const userId = this.auth.getCurrentUser()?.matricule || 'system';
    this.repo.addToBuffer(sku, this.addBufferQty, userId, this.addBufferNotes || `Ajout au tampon - ${product.productName}`)
      .pipe(takeUntil(this.d$)).subscribe({
        next: () => {
          this.addBufferSaving.set(false);
          this.showToast(`Produit ajouté au tampon: ${this.addBufferQty} ${product.unit} transférés`, 'success');
          this.closeAddBuffer();
          this.load();
        },
        error: (err) => {
          this.addBufferSaving.set(false);
          const msg = err?.error?.message || 'Erreur lors de l\'ajout au tampon';
          this.showToast(msg, 'error');
        }
      });
  }

  reapproAll() {
    const items = this.allItems().filter(i => i.alertLevel !== 'NORMAL' && i.centralQty > 0 && i.recommendedQty > 0);
    if (items.length === 0) {
      this.showToast('Aucun produit à réapprovisionner', 'error');
      return;
    }
    this.reapproSaving.set(true);
    const userId = this.auth.getCurrentUser()?.matricule || 'system';
    let done = 0;
    let errors = 0;
    items.forEach(item => {
      this.uc.replenishBuffer(item.productSku, item.recommendedQty, userId, `Réappro auto tampon - ${item.productSku}`)
        .pipe(takeUntil(this.d$)).subscribe({
          next: () => {
            done++;
            if (done + errors === items.length) {
              this.reapproSaving.set(false);
              this.showToast(`${done} produit(s) réapprovisionné(s)${errors > 0 ? `, ${errors} erreur(s)` : ''}`, errors > 0 ? 'error' : 'success');
              this.load();
            }
          },
          error: () => {
            errors++;
            if (done + errors === items.length) {
              this.reapproSaving.set(false);
              this.showToast(`${done} produit(s) réapprovisionné(s), ${errors} erreur(s)`, 'error');
              this.load();
            }
          }
        });
    });
  }

  goTo(page: number) {
    const n = Math.max(1, Math.min(page, this.totalPages()));
    this.cp.set(n);
  }

  getAlertClass(level: string): string {
    if (level === 'CRITIQUE') return 'critical';
    if (level === 'FAIBLE') return 'warning';
    return 'ok';
  }

  getColor(level: string): string {
    if (level === 'CRITIQUE') return 'var(--r)';
    if (level === 'FAIBLE') return 'var(--o)';
    return 'var(--g)';
  }

  getNClass(level: string): string {
    if (level === 'CRITIQUE') return 'badge-danger';
    if (level === 'FAIBLE') return 'badge-warning';
    return 'badge-success';
  }

  getPct(qty: number, reorder: number): number {
    if (reorder <= 0) return 100;
    return Math.min(100, Math.round((qty / reorder) * 100));
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

  fCFA(n: number): string {
    return new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA';
  }

  getPackagingLabel(pkg: string): string {
    const m: Record<string, string> = {
      CARTON: 'Carton',
      SEAU: 'Seau',
      GAINE: 'Gaine',
      SAC: 'Sac',
      BIDON: 'Bidon',
      FUT: 'Fût',
      CARTON_ASSORTI: 'Carton assorti',
      VRAC: 'Vrac'
    };
    return m[pkg] || pkg;
  }

  showToast(msg: string, type: 'success'|'error') {
    this.toastMsg.set(msg);
    this.toastType.set(type);
    setTimeout(() => this.toastMsg.set(''), 4000);
  }

  ngOnDestroy() {
    this.d$.next();
    this.d$.complete();
  }
}
