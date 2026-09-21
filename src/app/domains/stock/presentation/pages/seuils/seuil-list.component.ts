import { Component, OnInit, signal, inject, OnDestroy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { StockApiRepository, StockLocationDto, StockThresholdDto } from '../../../infrastructure/repositories/stock-api.repository';
import { AuthService } from '../../../../../core/auth/auth.service';
import { Product } from '../../../domain/models/stock.models';
import { StockRulesDomainService } from '../../../domain/services/stock-rules.domain.service';

interface StockItemThreshold {
  id: number;
  productSku: string;
  productName: string;
  quantity: number;
  reorderPoint: number;
  safetyStock: number;
  unit: string;
  alertLevel?: string;
  thresholdId?: number;
  minimumThreshold?: number;
  maximumThreshold?: number;
  reorderThreshold?: number;
  reorderQuantity?: number;
  notes?: string;
}

@Component({
  selector: 'app-seuil-list',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe],
  templateUrl: './seuil-list.component.html',
  styleUrls: ['./seuil-list.component.css']
})
export class SeuilListComponent implements OnInit, OnDestroy {
  private d$ = new Subject<void>();
  private repo = inject(StockApiRepository);
  private auth = inject(AuthService);
  private rules = inject(StockRulesDomainService);

  loading = signal(true);
  saving = signal(false);
  errorMsg = signal('');
  successMsg = signal('');
  isDG = signal(false);

  activeTab = signal<'CENTRAL' | 'BUFFER'>('CENTRAL');

  centralLocations = signal<StockLocationDto[]>([]);
  bufferLocations = signal<StockLocationDto[]>([]);
  selectedCentralLocationId = signal('');
  selectedBufferLocationId = signal('');

  centralItems = signal<StockItemThreshold[]>([]);
  bufferItems = signal<StockItemThreshold[]>([]);

  showEditModal = signal(false);
  editingItem = signal<StockItemThreshold | null>(null);
  editMinimum = 0;
  editMaximum = 0;
  editReorder = 0;
  editReorderQty = 0;
  editNotes = '';

  showDeleteModal = signal(false);
  deleteTarget = signal<StockItemThreshold | null>(null);

  showBatchModal = signal(false);
  batchReorderPoint = 20;
  batchSafetyStock = 10;
  batchMaxStock = 0;

  showCreateModal = signal(false);
  createProductSearch = '';
  createSelectedProductId = 0;
  createSelectedProductSku = '';
  createSelectedProductName = '';
  createMinimum = 0;
  createMaximum = 0;
  createReorder = 0;
  createReorderQty = 0;
  createNotes = '';
  allProducts = signal<Product[]>([]);
  filteredProducts = signal<Product[]>([]);

  searchTerm = '';

  ngOnInit() {
    this.isDG.set(this.auth.hasRole('DIRECTEUR_GENERAL') || this.auth.hasRole('ADMIN'));
    this.loadLocations();
    this.loadProducts();
  }

  ngOnDestroy() { this.d$.next(); this.d$.complete(); }

  loadLocations() {
    this.loading.set(true);
    forkJoin({
      central: this.repo.getStockLocationsByType('STOCK_CENTRAL'),
      buffer: this.repo.getStockLocationsByType('STOCK_BUFFER')
    }).pipe(takeUntil(this.d$)).subscribe({
      next: ({ central, buffer }) => {
        this.centralLocations.set(central);
        this.bufferLocations.set(buffer);
        if (central.length > 0) this.selectedCentralLocationId.set(central[0].id);
        if (buffer.length > 0) this.selectedBufferLocationId.set(buffer[0].id);
        this.loadItems();
      },
      error: () => {
        this.errorMsg.set('Impossible de charger les emplacements.');
        this.loading.set(false);
      }
    });
  }

  loadProducts() {
    this.repo.getProducts().pipe(takeUntil(this.d$)).subscribe({
      next: (prods) => this.allProducts.set(prods),
      error: () => this.allProducts.set([])
    });
  }

  loadItems() {
    const centralId = this.selectedCentralLocationId();
    const bufferId = this.selectedBufferLocationId();
    if (!centralId && !bufferId) { this.loading.set(false); return; }

    const calls: any = {};
    if (centralId) {
      calls.centralItems = this.repo.getItemsWithThresholds(centralId);
      calls.centralThresholds = this.repo.getThresholdsByLocation(centralId);
    }
    if (bufferId) {
      calls.bufferItems = this.repo.getItemsWithThresholds(bufferId);
      calls.bufferThresholds = this.repo.getThresholdsByLocation(bufferId);
    }

    forkJoin(calls).pipe(takeUntil(this.d$)).subscribe({
      next: (results: any) => {
        if (results.centralItems) this.centralItems.set(this.mergeThresholds(this.mapItems(results.centralItems), results.centralThresholds || []));
        if (results.bufferItems) this.bufferItems.set(this.mergeThresholds(this.mapItems(results.bufferItems), results.bufferThresholds || []));
        this.loading.set(false);
      },
      error: () => {
        this.errorMsg.set('Impossible de charger les seuils.');
        this.loading.set(false);
      }
    });
  }

  private mergeThresholds(items: StockItemThreshold[], thresholds: StockThresholdDto[]): StockItemThreshold[] {
    const thresholdMap = new Map<string, StockThresholdDto>();
    thresholds.forEach(t => thresholdMap.set(t.productSku, t));
    return items.map(item => {
      const t = thresholdMap.get(item.productSku);
      if (t) {
        return {
          ...item,
          thresholdId: t.id,
          minimumThreshold: Number(t.minimumThreshold || 0),
          maximumThreshold: Number(t.maximumThreshold || 0),
          reorderThreshold: Number(t.reorderThreshold || 0),
          reorderQuantity: Number(t.reorderQuantity || 0),
          notes: t.notes || '',
          reorderPoint: Number(t.reorderThreshold || item.reorderPoint || 0),
          safetyStock: Number(t.minimumThreshold || item.safetyStock || 0),
          alertLevel: this.computeAlertLevel(item.quantity, Number(t.reorderThreshold || 0), Number(t.minimumThreshold || 0), Number(t.maximumThreshold || 0))
        };
      }
      return item;
    });
  }

  private mapItems(raw: any[]): StockItemThreshold[] {
    return (raw || []).map(item => ({
      id: item.id,
      productSku: item.productSku || item.sku || '',
      productName: item.productName || item.designation || item.productSku || '',
      quantity: Number(item.quantity || 0),
      reorderPoint: Number(item.reorderPoint || 0),
      safetyStock: Number(item.safetyStock || 0),
      unit: this.resolveUnit(item.packagingType) || item.productUnit || item.unit || 'unités',
      alertLevel: this.computeAlertLevel(Number(item.quantity || 0), Number(item.reorderPoint || 0), Number(item.safetyStock || 0), Number(item.maximumThreshold || 0))
    }));
  }

  private computeAlertLevel(qty: number, reorder: number, safety: number, max?: number): string {
    if (safety > 0 && qty <= safety) return 'CRITIQUE';
    if (reorder > 0 && qty <= reorder) return 'FAIBLE';
    if (max && max > 0 && qty > max) return 'SURSTOCK';
    return 'NORMAL';
  }

  private resolveUnit(packagingType?: string): string {
    if (!packagingType) return '';
    return this.rules.getConditioningLabel(packagingType.toUpperCase());
  }

  switchTab(tab: 'CENTRAL' | 'BUFFER') {
    this.activeTab.set(tab);
    this.errorMsg.set('');
    this.successMsg.set('');
  }

  onLocationChange() {
    this.loadItems();
  }

  get currentItems(): StockItemThreshold[] {
    const items = this.activeTab() === 'CENTRAL' ? this.centralItems() : this.bufferItems();
    const term = this.searchTerm.toLowerCase().trim();
    if (!term) return items;
    return items.filter(i =>
      i.productName.toLowerCase().includes(term) ||
      i.productSku.toLowerCase().includes(term)
    );
  }

  get currentLocationId(): string {
    return this.activeTab() === 'CENTRAL'
      ? this.selectedCentralLocationId()
      : this.selectedBufferLocationId();
  }

  get currentLocations(): StockLocationDto[] {
    return this.activeTab() === 'CENTRAL' ? this.centralLocations() : this.bufferLocations();
  }

  get currentSelectedLocationId(): string {
    return this.activeTab() === 'CENTRAL'
      ? this.selectedCentralLocationId()
      : this.selectedBufferLocationId();
  }

  set currentSelectedLocationId(val: string) {
    if (this.activeTab() === 'CENTRAL') this.selectedCentralLocationId.set(val);
    else this.selectedBufferLocationId.set(val);
  }

  openEditModal(item: StockItemThreshold) {
    if (!this.isDG()) return;
    this.editingItem.set(item);
    this.editMinimum = item.minimumThreshold ?? item.safetyStock ?? 0;
    this.editMaximum = item.maximumThreshold ?? 0;
    this.editReorder = item.reorderThreshold ?? item.reorderPoint ?? 0;
    this.editReorderQty = item.reorderQuantity ?? 0;
    this.editNotes = item.notes ?? '';
    this.showEditModal.set(true);
  }

  closeEditModal() {
    this.showEditModal.set(false);
    this.editingItem.set(null);
  }

  saveThreshold() {
    const item = this.editingItem();
    if (!item) return;
    const locationId = this.currentLocationId;
    if (!locationId) return;

    this.saving.set(true);
    this.errorMsg.set('');

    if (item.thresholdId) {
      this.repo.updateThreshold(item.thresholdId, {
        minimumThreshold: this.editMinimum,
        maximumThreshold: this.editMaximum,
        reorderThreshold: this.editReorder,
        reorderQuantity: this.editReorderQty,
        notes: this.editNotes
      }).pipe(takeUntil(this.d$)).subscribe({
        next: () => {
          this.saving.set(false);
          this.closeEditModal();
          this.loadItems();
          this.successMsg.set(`Seuils mis à jour pour ${item.productName} (synchronisés sur tous les emplacements)`);
          setTimeout(() => this.successMsg.set(''), 3000);
        },
        error: () => {
          this.saving.set(false);
          this.errorMsg.set('Erreur lors de la mise à jour des seuils.');
        }
      });
    } else {
      this.repo.createThreshold({
        locationId,
        productId: item.id,
        productSku: item.productSku,
        minimumThreshold: this.editMinimum,
        maximumThreshold: this.editMaximum,
        reorderThreshold: this.editReorder,
        reorderQuantity: this.editReorderQty,
        notes: this.editNotes
      }).pipe(takeUntil(this.d$)).subscribe({
        next: () => {
          this.saving.set(false);
          this.closeEditModal();
          this.loadItems();
          this.successMsg.set(`Seuils créés pour ${item.productName}`);
          setTimeout(() => this.successMsg.set(''), 3000);
        },
        error: () => {
          this.saving.set(false);
          this.errorMsg.set('Erreur lors de la création des seuils.');
        }
      });
    }
  }

  openCreateModal() {
    if (!this.isDG()) return;
    this.createProductSearch = '';
    this.createSelectedProductId = 0;
    this.createSelectedProductSku = '';
    this.createSelectedProductName = '';
    this.createMinimum = 0;
    this.createMaximum = 0;
    this.createReorder = 0;
    this.createReorderQty = 0;
    this.createNotes = '';
    this.filteredProducts.set(this.allProducts().slice(0, 20));
    this.showCreateModal.set(true);
  }

  closeCreateModal() {
    this.showCreateModal.set(false);
  }

  searchProducts() {
    const term = this.createProductSearch.toLowerCase().trim();
    if (!term) {
      this.filteredProducts.set(this.allProducts().slice(0, 20));
      return;
    }
    this.filteredProducts.set(
      this.allProducts().filter(p =>
        (p.sku || '').toLowerCase().includes(term) ||
        (p.designation || '').toLowerCase().includes(term)
      ).slice(0, 20)
    );
  }

  selectProduct(p: Product) {
    this.createSelectedProductId = p.id;
    this.createSelectedProductSku = p.sku;
    this.createSelectedProductName = p.designation || p.sku;
    this.createProductSearch = this.createSelectedProductName;
  }

  saveCreateThreshold() {
    const locationId = this.currentLocationId;
    if (!locationId) return;
    if (!this.createSelectedProductId) {
      this.errorMsg.set('Veuillez sélectionner un produit.');
      return;
    }

    this.saving.set(true);
    this.errorMsg.set('');
    this.repo.createThreshold({
      locationId,
      productId: this.createSelectedProductId,
      productSku: this.createSelectedProductSku,
      minimumThreshold: this.createMinimum,
      maximumThreshold: this.createMaximum,
      reorderThreshold: this.createReorder,
      reorderQuantity: this.createReorderQty,
      notes: this.createNotes
    }).pipe(takeUntil(this.d$)).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeCreateModal();
        this.loadItems();
        this.successMsg.set(`Seuils créés pour ${this.createSelectedProductName} (synchronisés sur tous les emplacements)`);
        setTimeout(() => this.successMsg.set(''), 3000);
      },
      error: () => {
        this.saving.set(false);
        this.errorMsg.set('Erreur lors de la création des seuils.');
      }
    });
  }

  openDeleteModal(item: StockItemThreshold) {
    if (!this.isDG() || !item.thresholdId) return;
    this.deleteTarget.set(item);
    this.showDeleteModal.set(true);
  }

  closeDeleteModal() {
    this.showDeleteModal.set(false);
    this.deleteTarget.set(null);
  }

  confirmDeleteThreshold() {
    const item = this.deleteTarget();
    if (!item || !item.thresholdId) return;
    this.repo.deleteThreshold(item.thresholdId).pipe(takeUntil(this.d$)).subscribe({
      next: () => {
        this.closeDeleteModal();
        this.loadItems();
        this.successMsg.set(`Seuils supprimés pour ${item.productName} (tous emplacements)`);
        setTimeout(() => this.successMsg.set(''), 3000);
      },
      error: () => {
        this.closeDeleteModal();
        this.errorMsg.set('Erreur lors de la suppression.');
        setTimeout(() => this.errorMsg.set(''), 3000);
      }
    });
  }

  deleteThreshold(item: StockItemThreshold) {
    this.openDeleteModal(item);
  }

  openBatchModal() {
    if (!this.isDG()) return;
    this.batchReorderPoint = 20;
    this.batchSafetyStock = 10;
    this.batchMaxStock = 0;
    this.showBatchModal.set(true);
  }

  closeBatchModal() {
    this.showBatchModal.set(false);
  }

  saveBatchThresholds() {
    const locationId = this.currentLocationId;
    if (!locationId) return;

    this.saving.set(true);
    this.errorMsg.set('');
    this.repo.setDefaultThresholds(locationId, this.batchReorderPoint, this.batchSafetyStock, this.batchMaxStock || undefined)
      .pipe(takeUntil(this.d$)).subscribe({
        next: () => {
          this.saving.set(false);
          this.closeBatchModal();
          this.loadItems();
          this.successMsg.set(`Seuils par défaut appliqués (réappro: ${this.batchReorderPoint}, sécurité: ${this.batchSafetyStock}, max: ${this.batchMaxStock || '—'})`);
          setTimeout(() => this.successMsg.set(''), 3000);
        },
        error: () => {
          this.saving.set(false);
          this.errorMsg.set('Erreur lors de l\'application des seuils par défaut.');
        }
      });
  }

  get overstockCount(): number {
    const items = this.activeTab() === 'CENTRAL' ? this.centralItems() : this.bufferItems();
    return items.filter(i => i.alertLevel === 'SURSTOCK').length;
  }

  get criticalCount(): number {
    const items = this.activeTab() === 'CENTRAL' ? this.centralItems() : this.bufferItems();
    return items.filter(i => i.alertLevel === 'CRITIQUE').length;
  }

  get lowCount(): number {
    const items = this.activeTab() === 'CENTRAL' ? this.centralItems() : this.bufferItems();
    return items.filter(i => i.alertLevel === 'FAIBLE').length;
  }

  get normalCount(): number {
    const items = this.activeTab() === 'CENTRAL' ? this.centralItems() : this.bufferItems();
    return items.filter(i => i.alertLevel === 'NORMAL').length;
  }

  get totalItems(): number {
    return this.activeTab() === 'CENTRAL' ? this.centralItems().length : this.bufferItems().length;
  }
}
