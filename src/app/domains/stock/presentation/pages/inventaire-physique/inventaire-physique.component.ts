import { Component, OnInit, signal, inject, OnDestroy, computed } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { StockApiRepository, PhysicalInventory, PhysicalInventoryItem, PhysicalInventorySummary, StockLocationDto } from '../../../infrastructure/repositories/stock-api.repository';
import { AuthService } from '../../../../../core/auth/auth.service';

@Component({
  selector: 'app-inventaire-physique',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe],
  templateUrl: './inventaire-physique.component.html',
  styleUrls: ['./inventaire-physique.component.css']
})
export class InventairePhysiqueComponent implements OnInit, OnDestroy {
  private d$ = new Subject<void>();
  private repo = inject(StockApiRepository);
  private auth = inject(AuthService);

  loading = signal(true);
  inventories = signal<PhysicalInventory[]>([]);
  selectedInventory = signal<PhysicalInventory | null>(null);
  inventoryItems = signal<PhysicalInventoryItem[]>([]);
  summary = signal<PhysicalInventorySummary | null>(null);
  showCreateForm = signal(false);
  showDetail = signal(false);
  creating = signal(false);
  counting = signal(false);
  completing = signal(false);
  validating = signal(false);

  locations = signal<StockLocationDto[]>([]);
  selectedLocationId = signal('');
  notes = '';

  search = '';
  filterStatus = signal<'ALL' | 'IN_PROGRESS' | 'COMPLETED' | 'VALIDATED'>('ALL');

  // Counting modal
  countingItem = signal<PhysicalInventoryItem | null>(null);
  countedQty = 0;
  countedNotes = '';

  // Validation modal
  showValidateModal = signal(false);
  applyCorrections = true;

  toastMsg = signal('');
  toastType = signal<'success' | 'error'>('success');

  isDG = signal(false);

  hasActiveInventory = computed(() => this.inventories().some(i => i.status === 'IN_PROGRESS'));
  activeInventoryLocation = computed(() => {
    const active = this.inventories().find(i => i.status === 'IN_PROGRESS');
    return active?.locationName || 'un emplacement';
  });

  filteredInventories = computed(() => {
    let list = this.inventories();
    const fs = this.filterStatus();
    if (fs !== 'ALL') list = list.filter(i => i.status === fs);
    if (this.search) {
      const q = this.search.toLowerCase();
      list = list.filter(i =>
        i.reference.toLowerCase().includes(q) ||
        (i.locationName || '').toLowerCase().includes(q) ||
        (i.countedBy || '').toLowerCase().includes(q)
      );
    }
    return list;
  });

  ngOnInit() {
    this.isDG.set(this.auth.hasRole('DIRECTEUR_GENERAL') || this.auth.hasRole('ADMIN'));
    this.loadData();
  }

  ngOnDestroy() { this.d$.next(); this.d$.complete(); }

  loadData() {
    this.loading.set(true);
    forkJoin({
      inventories: this.repo.getPhysicalInventories(),
      locations: this.repo.getLocations()
    }).pipe(takeUntil(this.d$)).subscribe({
      next: ({ inventories, locations }) => {
        this.inventories.set(inventories || []);
        this.locations.set(locations || []);
        if (locations && locations.length > 0) this.selectedLocationId.set(locations[0].id);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.showToast('Erreur lors du chargement', 'error');
      }
    });
  }

  openCreateForm() {
    this.notes = '';
    this.showCreateForm.set(true);
  }

  closeCreateForm() { this.showCreateForm.set(false); }

  createInventory() {
    const locId = this.selectedLocationId();
    if (!locId) { this.showToast('Sélectionnez un emplacement', 'error'); return; }
    const user = this.auth.getCurrentUser();
    const countedBy = user?.matricule || 'system';
    this.creating.set(true);
    this.repo.createPhysicalInventory(locId, countedBy, this.notes || undefined)
      .pipe(takeUntil(this.d$)).subscribe({
        next: (inv) => {
          this.creating.set(false);
          this.showCreateForm.set(false);
          this.showToast(`Inventaire ${inv.reference} créé avec ${inv.totalItems} articles`, 'success');
          this.loadData();
          this.openDetail(inv);
        },
        error: () => {
          this.creating.set(false);
          this.showToast('Erreur lors de la création', 'error');
        }
      });
  }

  openDetail(inv: PhysicalInventory) {
    this.selectedInventory.set(inv);
    this.showDetail.set(true);
    this.loadInventoryDetail(inv.id);
  }

  closeDetail() {
    this.showDetail.set(false);
    this.selectedInventory.set(null);
    this.inventoryItems.set([]);
    this.summary.set(null);
  }

  loadInventoryDetail(id: number) {
    forkJoin({
      items: this.repo.getPhysicalInventoryItems(id),
      summary: this.repo.getPhysicalInventorySummary(id)
    }).pipe(takeUntil(this.d$)).subscribe({
      next: ({ items, summary }) => {
        this.inventoryItems.set(items || []);
        this.summary.set(summary || null);
      },
      error: () => this.showToast('Erreur lors du chargement du détail', 'error')
    });
  }

  openCounting(item: PhysicalInventoryItem) {
    if (item.status === 'VALIDATED') return;
    this.countingItem.set(item);
    this.countedQty = item.countedQuantity ?? item.systemQuantity;
    this.countedNotes = item.notes || '';
  }

  closeCounting() { this.countingItem.set(null); }

  saveCount() {
    const item = this.countingItem();
    if (!item || this.counting()) return;
    if (this.countedQty < 0) {
      this.showToast('La quantité comptée ne peut pas être négative', 'error');
      return;
    }
    this.counting.set(true);
    this.repo.countPhysicalInventoryItem(item.id, this.countedQty, this.countedNotes || undefined)
      .pipe(takeUntil(this.d$)).subscribe({
        next: (updated) => {
          this.counting.set(false);
          const items = this.inventoryItems().map(i => i.id === updated.id ? updated : i);
          this.inventoryItems.set(items);
          this.closeCounting();
          this.showToast(`Comptage enregistré pour ${item.productSku}`, 'success');
          if (this.selectedInventory()) {
            this.loadInventoryDetail(this.selectedInventory()!.id);
          }
        },
        error: () => {
          this.counting.set(false);
          this.showToast('Erreur lors du comptage', 'error');
        }
      });
  }

  completeInventory() {
    const inv = this.selectedInventory();
    if (!inv || this.completing()) return;
    this.completing.set(true);
    this.repo.completePhysicalInventory(inv.id)
      .pipe(takeUntil(this.d$)).subscribe({
        next: (updated) => {
          this.completing.set(false);
          this.selectedInventory.set(updated);
          this.loadInventoryDetail(inv.id);
          this.showToast('Inventaire complété — écarts calculés', 'success');
          this.loadData();
        },
        error: () => {
          this.completing.set(false);
          this.showToast('Erreur lors de la finalisation', 'error');
        }
      });
  }

  openValidateModal() {
    this.applyCorrections = true;
    this.showValidateModal.set(true);
  }

  closeValidateModal() { this.showValidateModal.set(false); }

  validateInventory() {
    const inv = this.selectedInventory();
    if (!inv || this.validating()) return;
    const user = this.auth.getCurrentUser();
    const validatedBy = user?.matricule || 'system';
    this.validating.set(true);
    this.repo.validatePhysicalInventory(inv.id, validatedBy, this.applyCorrections)
      .pipe(takeUntil(this.d$)).subscribe({
        next: (updated) => {
          this.validating.set(false);
          this.showValidateModal.set(false);
          this.selectedInventory.set(updated);
          this.loadInventoryDetail(inv.id);
          this.showToast(this.applyCorrections
            ? 'Inventaire validé — corrections appliquées au stock'
            : 'Inventaire validé sans corrections', 'success');
          this.loadData();
        },
        error: () => {
          this.validating.set(false);
          this.showToast('Erreur lors de la validation', 'error');
        }
      });
  }

  getStatusLabel(status: string): string {
    const m: Record<string, string> = {
      IN_PROGRESS: 'En cours',
      COMPLETED: 'Complété',
      VALIDATED: 'Validé'
    };
    return m[status] || status;
  }

  getStatusClass(status: string): string {
    const m: Record<string, string> = {
      IN_PROGRESS: 'badge-warning',
      COMPLETED: 'badge-info',
      VALIDATED: 'badge-success'
    };
    return m[status] || 'badge-neutral';
  }

  getItemStatusClass(status: string): string {
    const m: Record<string, string> = {
      PENDING: 'badge-neutral',
      COUNTED: 'badge-info',
      VALIDATED: 'badge-success'
    };
    return m[status] || 'badge-neutral';
  }

  getDiscrepancyClass(disc: number | undefined): string {
    if (!disc || disc === 0) return 'disc-zero';
    return disc > 0 ? 'disc-positive' : 'disc-negative';
  }

  getDiscrepancySign(disc: number | undefined): string {
    if (!disc || disc === 0) return '';
    return disc > 0 ? '+' : '';
  }

  getProgress(): number {
    const s = this.summary();
    if (!s || s.totalItems === 0) return 0;
    return Math.round((s.countedItems / s.totalItems) * 100);
  }

  fCFA(n: number): string {
    return new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA';
  }

  showToast(msg: string, type: 'success' | 'error') {
    this.toastMsg.set(msg);
    this.toastType.set(type);
    setTimeout(() => this.toastMsg.set(''), 4000);
  }
}
