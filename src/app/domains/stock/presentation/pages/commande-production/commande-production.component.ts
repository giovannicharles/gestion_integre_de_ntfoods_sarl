import { Component, OnInit, signal, inject, OnDestroy, computed } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { InternalOrderUseCase } from '../../../application/use-cases/orders/internal-order.use-case';
import { StockApiRepository } from '../../../infrastructure/repositories/stock-api.repository';
import { Product, StockLevel, InternalOrder } from '../../../domain/models';
import { AuthService } from '../../../../../core/auth/auth.service';

interface PackagingInfo {
  packagingType: string;
  quantity: number;
  quantityPerCarton: number;
  cartons: number;
}

interface OrderLineForm {
  uid: string;
  productId: number;
  productSku: string;
  productName: string;
  productUnit: string;
  selectedPackaging: string;
  quantityPerCarton: number;
  requestedQty: number;
  requestedCartons: number;
  notes: string;
  // combobox state
  searchText: string;
  showDropdown: boolean;
  notFound: boolean;
}

interface ProductWithStock {
  product: Product;
  stockLevel?: StockLevel;
  packagings: PackagingInfo[];
}

@Component({
  selector: 'app-commande-production',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DecimalPipe, DatePipe],
  templateUrl: './commande-production.component.html',
  styleUrls: ['./commande-production.component.css']
})
export class CommandeProductionComponent implements OnInit, OnDestroy {
  private d$ = new Subject<void>();
  private route = inject(ActivatedRoute);
  router = inject(Router);
  private orderUC = inject(InternalOrderUseCase);
  private repo = inject(StockApiRepository);
  private auth = inject(AuthService);

  loading = signal(true);
  saving = signal(false);
  success = signal(false);
  errorMsg = signal('');
  successMsg = signal('');

  // Onglets: 'new' = formulaire, 'history' = historique commandes
  activeTab = signal<'new' | 'history'>('new');

  products = signal<Product[]>([]);
  pfLevels = signal<StockLevel[]>([]);
  allStockItems = signal<any[]>([]);
  existingOrders = signal<InternalOrder[]>([]);
  productMap = signal<Map<number, ProductWithStock>>(new Map());
  skuMap = signal<Map<string, Product>>(new Map());

  lignes = signal<OrderLineForm[]>([]);
  globalNotes = '';
  productCount = signal(0);
  prefillAlertId: string | null = null;

  // ── Historique des commandes ──
  orders = signal<InternalOrder[]>([]);
  orderFilter = signal<string>('ALL');
  orderSearch = '';
  currentPage = signal(1);
  readonly pageSize = 8;

  filteredOrders = computed<InternalOrder[]>(() => {
    let list = this.orders();
    const filter = this.orderFilter();
    if (filter !== 'ALL') {
      list = list.filter(o => o.status === filter);
    }
    const q = this.orderSearch?.toLowerCase().trim();
    if (q) {
      list = list.filter(o =>
        (o.orderNumber || '').toLowerCase().includes(q) ||
        (o.requestedByName || '').toLowerCase().includes(q) ||
        (o.approvedByName || '').toLowerCase().includes(q) ||
        o.items.some(i => (i.productName || '').toLowerCase().includes(q) || (i.productSku || '').toLowerCase().includes(q))
      );
    }
    return list;
  });
  totalPages = computed(() => Math.max(1, Math.ceil(this.filteredOrders().length / this.pageSize)));
  paginatedOrders = computed<InternalOrder[]>(() => {
    const start = (this.currentPage() - 1) * this.pageSize;
    return this.filteredOrders().slice(start, start + this.pageSize);
  });

  // ── Détail commande ──
  selectedOrder = signal<InternalOrder | null>(null);
  showOrderDetail = signal(false);
  deliveryForm = { productId: 0, deliveredQty: 0 };
  delivering = signal(false);
  cancelReason = '';
  cancelling = signal(false);
  actionLoading = signal(false);

  // ── Toast ──
  toastMsg = signal('');
  toastType = signal<'success' | 'error'>('success');

  // Helper: immutably patch a line so the signal triggers change detection
  private patchLine(uid: string, patch: Partial<OrderLineForm>) {
    this.lignes.update(lines => lines.map(l => l.uid === uid ? { ...l, ...patch } : l));
  }
  private getLine(uid: string): OrderLineForm | undefined {
    return this.lignes().find(l => l.uid === uid);
  }

  ngOnInit() {
    const prefillProductId = this.route.snapshot.queryParamMap.get('productId');
    const prefillQty = this.route.snapshot.queryParamMap.get('qty');
    this.prefillAlertId = this.route.snapshot.queryParamMap.get('alertId');

    forkJoin({
      products: this.orderUC.getFinishedProducts(),
      levels: this.repo.getStockLevels(),
      orders: this.orderUC.getAll(),
      stockItems: this.repo.getAllStockItems()
    }).pipe(takeUntil(this.d$)).subscribe({
      next: ({ products, levels, orders, stockItems }) => {
        this.products.set(products);
        this.productCount.set(products.length);
        console.log('[CmdProd] Produits chargés:', products.length, products.slice(0, 3).map(p => ({ sku: p.sku, designation: p.designation, category: p.category })));
        this.pfLevels.set(levels.filter((sl: StockLevel) => products.some(p => p.id === sl.productId)));
        this.existingOrders.set(orders);
        this.orders.set(orders);
        this.allStockItems.set(stockItems as any[]);

        const map = new Map<number, ProductWithStock>();
        const skuM = new Map<string, Product>();
        products.forEach(p => {
          skuM.set(p.sku.toUpperCase(), p);
          const sl = levels.find(l => l.productId === p.id);
          const items = (stockItems as any[])
            .filter(si => si.productId === p.id || si.productSku === p.sku);

          // Collect all unique packaging types from stock items + product default
          const packagingMap = new Map<string, PackagingInfo>();
          if (p.packagingType) {
            packagingMap.set(p.packagingType, {
              packagingType: p.packagingType,
              quantity: 0,
              quantityPerCarton: p.quantityPerCarton || 0,
              cartons: 0
            });
          }
          items.forEach(si => {
            const pt = si.packagingType || p.packagingType || 'UNITE';
            const qpc = Number(si.quantityPerCarton || p.quantityPerCarton || 0);
            const qty = Number(si.quantity || 0);
            const existing = packagingMap.get(pt);
            if (existing) {
              existing.quantity += qty;
              if (qpc > 0 && existing.quantityPerCarton === 0) existing.quantityPerCarton = qpc;
            } else {
              packagingMap.set(pt, {
                packagingType: pt,
                quantity: qty,
                quantityPerCarton: qpc,
                cartons: qpc > 0 ? qty / qpc : 0
              });
            }
          });
          // Recalculate cartons for all
          packagingMap.forEach(v => {
            v.cartons = v.quantityPerCarton > 0 ? v.quantity / v.quantityPerCarton : 0;
          });

          map.set(p.id, { product: p, stockLevel: sl, packagings: Array.from(packagingMap.values()) });
        });
        this.productMap.set(map);
        this.skuMap.set(skuM);

        this.loading.set(false);

        if (prefillProductId) {
          this.addLine(Number(prefillProductId), prefillQty ? Number(prefillQty) : 0);
        } else {
          this.addLine();
        }
      },
      error: () => {
        this.errorMsg.set('Impossible de charger les produits finis. Vérifiez la connexion au serveur.');
        this.loading.set(false);
        this.addLine();
      }
    });
  }

  addLine(productId?: number, qty?: number) {
    const p = productId ? this.products().find(pr => pr.id === productId) : undefined;
    const info = productId ? this.productMap().get(productId) : undefined;
    const defaultPackaging = info && info.packagings.length > 0
      ? info.packagings[0].packagingType
      : (p?.packagingType || 'UNITE');
    const defaultQpc = info && info.packagings.length > 0
      ? info.packagings[0].quantityPerCarton
      : (p?.quantityPerCarton || 0);

    const newLine: OrderLineForm = {
      uid: 'l' + Date.now() + Math.random(),
      productId: productId || 0,
      productSku: p?.sku || '',
      productName: p?.designation || p?.sku || '',
      productUnit: p?.unit || 'unite',
      selectedPackaging: defaultPackaging,
      quantityPerCarton: defaultQpc,
      requestedQty: qty || 0,
      requestedCartons: 0,
      notes: '',
      searchText: p ? `[${p.sku}] ${p.designation || p.sku}` : '',
      showDropdown: false,
      notFound: false
    };
    this.lignes.update(lines => [...lines, newLine]);
  }

  removeLine(i: number) {
    if (this.lignes().length > 1) {
      this.lignes.update(lines => lines.filter((_, idx) => idx !== i));
    }
  }

  // ── COMBOBOX SEARCH ──────────────────────────────────────
  getSearchResults(line: OrderLineForm): Product[] {
    if (!line.searchText || line.searchText.length < 1) return this.products().slice(0, 20);
    const q = line.searchText.toLowerCase().replace(/[\[\]]/g, '').trim();
    if (!q) return this.products().slice(0, 20);
    return this.products()
      .filter(p =>
        (p.sku || '').toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().replace(/[-_\s]/g, '').includes(q.replace(/[-_\s]/g, '')) ||
        (p.designation || '').toLowerCase().includes(q) ||
        (p.packagingType || '').toLowerCase().includes(q)
      )
      .slice(0, 20);
  }

  onSearchFocus(line: OrderLineForm) {
    this.patchLine(line.uid, { showDropdown: true });
  }

  onSearchBlur(line: OrderLineForm) {
    setTimeout(() => { this.patchLine(line.uid, { showDropdown: false }); }, 200);
  }

  onSearchInput(line: OrderLineForm) {
    const searchText = line.searchText || '';

    // If a product was previously selected and user types again,
    // reset the selection so we can search fresh
    if (line.productId > 0) {
      this.patchLine(line.uid, {
        productId: 0,
        productSku: '',
        productName: '',
        selectedPackaging: 'UNITE',
        quantityPerCarton: 0,
        requestedCartons: 0,
        notFound: false,
        showDropdown: true
      });
    } else {
      this.patchLine(line.uid, { showDropdown: true, notFound: false });
    }

    // Auto-match by exact SKU (try multiple normalizations)
    const clean = searchText.replace(/[\[\]]/g, '').trim().toUpperCase();
    if (clean.length >= 1) {
      const exact = this.skuMap().get(clean);
      if (exact) {
        this.selectProduct(line, exact);
        return;
      }
      // Try without spaces/dashes/underscores
      const normalized = clean.replace(/[-_\s]/g, '');
      const found = this.products().find(p =>
        (p.sku || '').toUpperCase().replace(/[-_\s]/g, '') === normalized
      );
      if (found) {
        this.selectProduct(line, found);
        return;
      }
    }

    // Check if search matches a product partially
    const results = this.getSearchResults(line);
    if (results.length === 0 && searchText.length >= 2) {
      this.patchLine(line.uid, { notFound: true });
    }
  }

  onSearchKeydown(event: KeyboardEvent, line: OrderLineForm) {
    if (event.key === 'Enter') {
      event.preventDefault();
      const results = this.getSearchResults(line);
      if (results.length > 0) {
        this.selectProduct(line, results[0]);
      }
    } else if (event.key === 'Escape') {
      this.patchLine(line.uid, { showDropdown: false });
    }
  }

  selectProduct(line: OrderLineForm, p: Product) {
    // Set packaging from stock data
    const info = this.productMap().get(p.id);
    const selectedPackaging = info && info.packagings.length > 0
      ? info.packagings[0].packagingType
      : (p.packagingType || 'UNITE');
    const quantityPerCarton = info && info.packagings.length > 0
      ? info.packagings[0].quantityPerCarton
      : (p.quantityPerCarton || 0);

    const requestedQty = line.requestedQty;
    const requestedCartons = quantityPerCarton > 0
      ? Math.ceil(requestedQty / quantityPerCarton * 100) / 100
      : 0;

    this.patchLine(line.uid, {
      productId: p.id,
      productSku: p.sku,
      productName: p.designation || p.sku,
      productUnit: p.unit || 'unite',
      searchText: `[${p.sku}] ${p.designation || p.sku}`,
      showDropdown: false,
      notFound: false,
      selectedPackaging,
      quantityPerCarton,
      requestedCartons
    });
  }

  clearProduct(line: OrderLineForm) {
    this.patchLine(line.uid, {
      productId: 0,
      productSku: '',
      productName: '',
      searchText: '',
      selectedPackaging: 'UNITE',
      quantityPerCarton: 0,
      requestedQty: 0,
      requestedCartons: 0,
      notes: '',
      notFound: false,
      showDropdown: false
    });
  }

  // ── PACKAGING SELECTION ──────────────────────────────────
  onPackagingChange(line: OrderLineForm) {
    const info = this.productMap().get(line.productId);
    if (info) {
      const pk = info.packagings.find(p => p.packagingType === line.selectedPackaging);
      if (pk) {
        const requestedCartons = pk.quantityPerCarton > 0
          ? Math.ceil(line.requestedQty / pk.quantityPerCarton * 100) / 100
          : 0;
        this.patchLine(line.uid, {
          quantityPerCarton: pk.quantityPerCarton,
          requestedCartons
        });
      }
    }
  }

  getAvailablePackagings(productId: number): PackagingInfo[] {
    const info = this.productMap().get(productId);
    return info ? info.packagings : [];
  }

  onQtyChange(line: OrderLineForm) {
    const requestedCartons = line.quantityPerCarton > 0
      ? Math.ceil(line.requestedQty / line.quantityPerCarton * 100) / 100
      : 0;
    this.patchLine(line.uid, { requestedQty: line.requestedQty, requestedCartons });
  }

  onCartonsChange(line: OrderLineForm) {
    const requestedQty = line.quantityPerCarton > 0
      ? line.requestedCartons * line.quantityPerCarton
      : line.requestedQty;
    this.patchLine(line.uid, { requestedCartons: line.requestedCartons, requestedQty });
  }

  getProductStock(productId: number): ProductWithStock | undefined {
    return this.productMap().get(productId);
  }

  getStockLevel(productId: number): StockLevel | undefined {
    return this.pfLevels().find(sl => sl.productId === productId);
  }

  isValid(): boolean {
    return this.lignes().some(l => Number(l.productId) > 0 && l.requestedQty > 0);
  }

  getTotalRequestedQty(): number {
    return this.lignes()
      .filter(l => Number(l.productId) > 0 && l.requestedQty > 0)
      .reduce((sum, l) => sum + Number(l.requestedQty), 0);
  }

  getTotalCartons(): number {
    return this.lignes()
      .filter(l => Number(l.productId) > 0 && l.requestedQty > 0)
      .reduce((sum, l) => sum + (l.requestedCartons || 0), 0);
  }

  getValidLineCount(): number {
    return this.lignes().filter(l => Number(l.productId) > 0 && l.requestedQty > 0).length;
  }

  getPackagingLabel(type: string): string {
    const m: Record<string, string> = {
      'SEAU_1L': 'Seau 1L',
      'SEAU_5L': 'Seau 5L',
      'SEAU_10L': 'Seau 10L',
      'CARTON': 'Carton',
      'SAC': 'Sac',
      'SACHET_42G': 'Sachet 42g',
      'KG': 'Kilogramme',
      'UNITE': 'Unité',
      'LITER': 'Litre'
    };
    return m[type] || type || 'Unité';
  }

  sauvegarder() {
    if (!this.isValid() || this.saving()) return;
    this.saving.set(true);
    this.errorMsg.set('');

    const user = this.auth.getCurrentUser();
    if (!user) {
      this.errorMsg.set('Session expirée. Veuillez vous reconnecter.');
      this.saving.set(false);
      return;
    }

    const validLines = this.lignes().filter(l => Number(l.productId) > 0 && l.requestedQty > 0);

    const items = validLines.map(l => ({
      productId: l.productId,
      productSku: l.productSku,
      productName: l.productName,
      productUnit: l.productUnit,
      packagingType: l.selectedPackaging,
      quantityPerCarton: l.quantityPerCarton || undefined,
      requestedQty: l.requestedQty,
      notes: l.notes || undefined
    }));

    const payload = {
      requestedBy: user.matricule,
      requestedByName: `${user.firstname} ${user.lastname}`.trim() || 'Gestionnaire Stock',
      notes: this.globalNotes || undefined,
      items
    };

    this.orderUC.create(payload as any).pipe(takeUntil(this.d$)).subscribe({
      next: (order) => {
        // Résoudre les alertes pour les produits commandés
        const productIds = validLines.map(l => l.productId);
        productIds.forEach(pid => {
          this.repo.resolveAlertsByProduct(pid).pipe(takeUntil(this.d$)).subscribe({
            next: (count) => console.log(`[CmdProd] ${count} alerte(s) résolue(s) pour productId=${pid}`),
            error: () => {}
          });
        });

        this.saving.set(false);
        this.success.set(true);
        this.successMsg.set(`Commande ${order.orderNumber} créée. En attente d'approbation du Chef de Production.`);
        this.loadOrders();
        setTimeout(() => {
          this.success.set(false);
          this.activeTab.set('history');
        }, 2000);
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMsg.set(err?.error?.message || 'Erreur lors de la création de la commande.');
      }
    });
  }

  // ── Gestion des commandes (historique) ───────────────────
  loadOrders() {
    this.orderUC.getAll().pipe(takeUntil(this.d$)).subscribe({
      next: (orders) => {
        this.orders.set(orders);
        this.existingOrders.set(orders);
      },
      error: () => this.showToast('Erreur lors du chargement des commandes.', 'error')
    });
  }

  applyOrderFilter() {
    this.currentPage.set(1);
  }

  goToPage(p: number) {
    if (p >= 1 && p <= this.totalPages()) this.currentPage.set(p);
  }

  nextPage() { this.goToPage(this.currentPage() + 1); }
  prevPage() { this.goToPage(this.currentPage() - 1); }

  countOrderStatus(status: string): number {
    return this.orders().filter(o => o.status === status).length;
  }

  getDeliveryPct(o: InternalOrder): number {
    if (!o.items || o.items.length === 0) return 0;
    const totalRequested = o.items.reduce((s, i) => s + i.requestedQty, 0);
    const totalDelivered = o.items.reduce((s, i) => s + (i.deliveredQty || 0), 0);
    return totalRequested > 0 ? Math.round((totalDelivered / totalRequested) * 100) : 0;
  }

  getOStatusLabel(s: string): string {
    const m: Record<string, string> = {
      DRAFT: 'Brouillon — Att. approbation',
      APPROVED: 'Approuvé — En production',
      PARTIALLY_DELIVERED: 'Partiellement livré',
      DELIVERED: 'Livré complet',
      CANCELLED: 'Annulé'
    };
    return m[s] || s;
  }

  getOStatusClass(s: string): string {
    const m: Record<string, string> = {
      DRAFT: 'badge-warning',
      APPROVED: 'badge-primary',
      PARTIALLY_DELIVERED: 'badge-secondary',
      DELIVERED: 'badge-success',
      CANCELLED: 'badge-danger'
    };
    return m[s] || 'badge-neutral';
  }

  // ── Timeline d'une commande ──
  getOrderTimeline(o: InternalOrder): { label: string; date?: string; done: boolean; icon: string }[] {
    const steps = [
      { label: 'Commande créée', date: o.createdAt, done: true, icon: 'fa-file-circle-plus' },
      { label: 'Approbation Chef Prod.', date: o.approvedAt, done: !!o.approvedAt, icon: 'fa-check' },
      { label: 'En production', date: o.approvedAt, done: o.status === 'APPROVED' || o.status === 'PARTIALLY_DELIVERED' || o.status === 'DELIVERED', icon: 'fa-industry' },
      { label: 'Livraison', date: o.status === 'DELIVERED' ? o.orderDate : undefined, done: o.status === 'DELIVERED', icon: 'fa-truck-fast' },
    ];
    if (o.status === 'CANCELLED') {
      return [
        { label: 'Commande créée', date: o.createdAt, done: true, icon: 'fa-file-circle-plus' },
        { label: 'Annulée', date: o.cancelledAt, done: true, icon: 'fa-xmark' },
      ];
    }
    return steps;
  }

  // ── Actions sur commande ──
  openOrderDetail(o: InternalOrder) {
    this.selectedOrder.set(o);
    this.showOrderDetail.set(true);
    this.deliveryForm = { productId: 0, deliveredQty: 0 };
    this.cancelReason = '';
  }
  closeOrderDetail() {
    this.showOrderDetail.set(false);
    this.selectedOrder.set(null);
  }

  approveOrder(id: number) {
    const user = this.auth.getCurrentUser();
    if (!user) { this.showToast('Session expirée.', 'error'); return; }
    this.actionLoading.set(true);
    this.orderUC.approve(id, user.matricule, `${user.firstname} ${user.lastname}`)
      .pipe(takeUntil(this.d$)).subscribe({
      next: (updated) => {
        this.actionLoading.set(false);
        this.updateOrderInList(updated);
        this.showToast('Commande approuvée par le Chef de Production.', 'success');
      },
      error: () => { this.actionLoading.set(false); this.showToast('Erreur lors de l\'approbation.', 'error'); }
    });
  }

  cancelOrder(id: number) {
    if (!this.cancelReason || this.cancelling()) return;
    const user = this.auth.getCurrentUser();
    if (!user) { this.showToast('Session expirée.', 'error'); return; }
    this.cancelling.set(true);
    this.orderUC.cancel(id, user.matricule, this.cancelReason)
      .pipe(takeUntil(this.d$)).subscribe({
      next: (updated) => {
        this.cancelling.set(false);
        this.updateOrderInList(updated);
        this.showToast('Commande annulée.', 'error');
      },
      error: () => { this.cancelling.set(false); this.showToast('Erreur lors de l\'annulation.', 'error'); }
    });
  }

  deliverOrder(orderId: number) {
    if (!this.deliveryForm.productId || !this.deliveryForm.deliveredQty || this.delivering()) return;
    this.delivering.set(true);
    this.orderUC.deliver(orderId, this.deliveryForm.productId, this.deliveryForm.deliveredQty)
      .pipe(takeUntil(this.d$)).subscribe({
      next: (updated) => {
        this.delivering.set(false);
        this.updateOrderInList(updated);
        this.selectedOrder.set(updated);
        this.deliveryForm = { productId: 0, deliveredQty: 0 };
        this.showToast(`Livraison enregistrée. Statut: ${this.getOStatusLabel(updated.status)}`, 'success');
      },
      error: () => { this.delivering.set(false); this.showToast('Erreur de livraison.', 'error'); }
    });
  }

  private updateOrderInList(updated: InternalOrder) {
    this.orders.update(list => list.map(o => o.id === updated.id ? updated : o));
    this.existingOrders.update(list => list.map(o => o.id === updated.id ? updated : o));
  }

  // ── Helpers ──
  showToast(msg: string, type: 'success' | 'error') {
    this.toastMsg.set(msg);
    this.toastType.set(type);
    setTimeout(() => this.toastMsg.set(''), 5000);
  }

  ngOnDestroy() { this.d$.next(); this.d$.complete(); }
}
