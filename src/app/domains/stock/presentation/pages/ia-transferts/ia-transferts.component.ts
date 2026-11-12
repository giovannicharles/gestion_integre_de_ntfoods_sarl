import { Component, OnInit, OnDestroy, signal, computed, inject, ChangeDetectionStrategy} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil, catchError, of, forkJoin } from 'rxjs';
import { StockApiRepository } from '../../../infrastructure/repositories/stock-api.repository';
import { StockLevel, StockMovement } from '../../../domain/models';
import { IaService } from '../../../../../core/services/ia.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { AuthService } from '../../../../../core/auth/auth.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';

interface TransferSuggestion {
  productId: number;
  transferKind: 'CENTRAL_TO_BUFFER' | 'BUFFER_TO_MOBILE';
  productSku: string;
  productName: string;
  unit: string;
  fromWarehouse: string;
  toWarehouse: string;
  fromQty: number;
  toQty: number;
  suggestedQty: number;
  reason: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  selected: boolean;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-ia-transferts',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe],
  templateUrl: './ia-transferts.component.html',
  styleUrls: ['./ia-transferts.component.css']
})
export class IaTransfertsComponent implements OnInit, OnDestroy {
  private d$ = new Subject<void>();
  private repo = inject(StockApiRepository);
  private iaService = inject(IaService);
  private router = inject(Router);
  private toast = inject(ToastService);
  private auth = inject(AuthService);

  loading = signal(true);
  iaLoading = signal(false);
  executingKey = signal<string | null>(null);
  executingBatch = signal(false);
  error = signal('');
  searchQuery = signal('');
  readonly transferPageSize = 10;
  transferPage = signal(1);
  stockLevels = signal<StockLevel[]>([]);
  movements = signal<StockMovement[]>([]);
  suggestions = signal<TransferSuggestion[]>([]);
  iaConfigured = signal(false);
  iaSummary = signal('');
  filterPriority = signal<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');

  Math = Math;

  stats = computed(() => {
    const items = this.suggestions();
    return {
      total: items.length,
      high: items.filter(i => i.priority === 'HIGH').length,
      selected: items.filter(i => i.selected).length,
      totalUnits: items.filter(i => i.selected).reduce((s, i) => s + i.suggestedQty, 0)
    };
  });

  filteredSuggestions = computed(() => {
    const p = this.filterPriority();
    const q = this.searchQuery().toLowerCase().trim();
    const list = this.suggestions().filter(i => {
      if (p !== 'ALL' && i.priority !== p) return false;
      if (q && !i.productName.toLowerCase().includes(q) && !i.productSku.toLowerCase().includes(q)) return false;
      return true;
    });
    return [...list].sort((a, b) => this.priorityOrder(a.priority) - this.priorityOrder(b.priority));
  });

  transferTotalPages = computed(() => Math.max(1, Math.ceil(this.filteredSuggestions().length / this.transferPageSize)));
  transferPageRange = computed(() => Array.from({ length: this.transferTotalPages() }, (_, i) => i + 1));
  paginatedSuggestions = computed(() => {
    const start = (this.transferPage() - 1) * this.transferPageSize;
    return this.filteredSuggestions().slice(start, start + this.transferPageSize);
  });

  onSearchChange(q: string): void {
    this.searchQuery.set(q);
    this.transferPage.set(1);
  }

  ngOnInit(): void {
    this.checkIaStatus();
    this.loadData();
  }

  ngOnDestroy(): void {
    this.d$.next();
    this.d$.complete();
  }

  private checkIaStatus(): void {
    this.iaService.getStatus().pipe(takeUntil(this.d$)).subscribe({
      next: (s) => this.iaConfigured.set(s.configured),
      error: () => this.iaConfigured.set(false)
    });
  }

  private loadData(): void {
    this.loading.set(true);
    this.repo.getStockLevels().pipe(
      takeUntil(this.d$),
      catchError(() => of([]))
    ).subscribe({
      next: (levels) => {
        this.stockLevels.set(levels);
        this.generateTransferSuggestions(levels);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Erreur lors du chargement des données');
        this.loading.set(false);
      }
    });
  }

  private generateTransferSuggestions(levels: StockLevel[]): void {
    const central = levels.filter(sl => sl.warehouseType === 'STOCK_CENTRAL');
    const buffer = levels.filter(sl => sl.warehouseType === 'STOCK_BUFFER');
    const mobile = levels.filter(sl => sl.warehouseType === 'STOCK_MOBILE');

    const suggestions: TransferSuggestion[] = [];

    // Central → Buffer: products low in buffer but available in central
    for (const bufItem of buffer) {
      if (bufItem.alertLevel === 'CRITIQUE' || bufItem.alertLevel === 'FAIBLE') {
        const centralItem = central.find(c => c.productSku === bufItem.productSku);
        if (centralItem && centralItem.quantity > centralItem.reorderPoint) {
          const surplus = centralItem.quantity - centralItem.reorderPoint;
          const needed = (bufItem.reorderPoint || 0) - bufItem.quantity;
          const suggestedQty = Math.min(surplus, Math.max(0, needed));
          if (suggestedQty > 0) {
            suggestions.push({
              productId: bufItem.productId || 0,
              transferKind: 'CENTRAL_TO_BUFFER',
              productSku: bufItem.productSku || '',
              productName: bufItem.productName || bufItem.productSku || '',
              unit: bufItem.productUnit || 'unité',
              fromWarehouse: centralItem.warehouseName || 'Stock Central',
              toWarehouse: bufItem.warehouseName || 'Stock Tampon',
              fromQty: centralItem.quantity,
              toQty: bufItem.quantity,
              suggestedQty,
              reason: `Tampon en alerte (${bufItem.alertLevel}), surplus disponible au central`,
              priority: bufItem.alertLevel === 'CRITIQUE' ? 'HIGH' : 'MEDIUM',
              selected: bufItem.alertLevel === 'CRITIQUE'
            });
          }
        }
      }
    }

    // Buffer → Mobile: products low in mobile but available in buffer
    for (const mobItem of mobile) {
      if (mobItem.alertLevel === 'CRITIQUE' || mobItem.alertLevel === 'FAIBLE') {
        const bufItem = buffer.find(b => b.productSku === mobItem.productSku);
        if (bufItem && bufItem.quantity > (bufItem.reorderPoint || 0)) {
          const surplus = bufItem.quantity - (bufItem.reorderPoint || 0);
          const needed = (mobItem.reorderPoint || 0) - mobItem.quantity;
          const suggestedQty = Math.min(surplus, Math.max(0, needed));
          if (suggestedQty > 0) {
            suggestions.push({
              productId: mobItem.productId || 0,
              transferKind: 'BUFFER_TO_MOBILE',
              productSku: mobItem.productSku || '',
              productName: mobItem.productName || mobItem.productSku || '',
              unit: mobItem.productUnit || 'unité',
              fromWarehouse: bufItem.warehouseName || 'Stock Tampon',
              toWarehouse: mobItem.warehouseName || 'Stock Mobile',
              fromQty: bufItem.quantity,
              toQty: mobItem.quantity,
              suggestedQty,
              reason: `Stock mobile en alerte (${mobItem.alertLevel}), tampon a du surplus`,
              priority: mobItem.alertLevel === 'CRITIQUE' ? 'HIGH' : 'MEDIUM',
              selected: mobItem.alertLevel === 'CRITIQUE'
            });
          }
        }
      }
    }

    // Central surplus → Buffer (overstock at central)
    for (const centralItem of central) {
      if (centralItem.alertLevel === 'SURPLUS') {
        const bufItem = buffer.find(b => b.productSku === centralItem.productSku);
        if (bufItem && bufItem.quantity < (bufItem.reorderPoint || 0) * 1.5) {
          const surplus = centralItem.quantity - (centralItem.reorderPoint || 0) * 1.5;
          if (surplus > 0) {
            suggestions.push({
              productId: centralItem.productId || 0,
              transferKind: 'CENTRAL_TO_BUFFER',
              productSku: centralItem.productSku || '',
              productName: centralItem.productName || centralItem.productSku || '',
              unit: centralItem.productUnit || 'unité',
              fromWarehouse: centralItem.warehouseName || 'Stock Central',
              toWarehouse: bufItem.warehouseName || 'Stock Tampon',
              fromQty: centralItem.quantity,
              toQty: bufItem.quantity,
              suggestedQty: Math.floor(surplus),
              reason: 'Surstock au central, transfert vers tampon pour équilibrer',
              priority: 'LOW',
              selected: false
            });
          }
        }
      }
    }

    this.suggestions.set(suggestions);
  }

  private priorityOrder(p: string): number {
    return p === 'HIGH' ? 0 : p === 'MEDIUM' ? 1 : 2;
  }

  setFilter(f: 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'): void {
    this.filterPriority.set(f);
    this.transferPage.set(1);
  }

  executeTransfer(item: TransferSuggestion): void {
    if (item.transferKind === 'CENTRAL_TO_BUFFER' && item.productSku) {
      const key = item.productSku + item.fromWarehouse + item.toWarehouse;
      this.executingKey.set(key);
      const userId = this.auth.getCurrentUser()?.matricule || 'system';
      this.repo.replenishBuffer(item.productSku, item.suggestedQty, userId, `Transfert IA : ${item.reason}`).pipe(takeUntil(this.d$)).subscribe({
        next: () => {
          this.executingKey.set(null);
          this.toast.success(`Transfert exécuté : ${item.suggestedQty} ${item.unit} vers ${item.toWarehouse}`);
          this.loadData();
        },
        error: (err) => {
          this.executingKey.set(null);
          this.toast.error(extractApiError(err));
        }
      });
      return;
    }
    this.router.navigate(['/stock/dotations/new'], {
      queryParams: { productId: item.productId, qty: item.suggestedQty }
    });
  }

  executeSelectedTransfers(): void {
    const selected = this.suggestions().filter(s => s.selected && s.suggestedQty > 0);
    if (!selected.length) {
      this.toast.warning('Sélectionnez au moins un transfert.');
      return;
    }
    const centralToBuffer = selected.filter(s => s.transferKind === 'CENTRAL_TO_BUFFER' && s.productSku);
    if (!centralToBuffer.length) {
      const first = selected[0];
      this.router.navigate(['/stock/dotations/new'], {
        queryParams: { productId: first.productId, qty: first.suggestedQty }
      });
      return;
    }
    this.executingBatch.set(true);
    const userId = this.auth.getCurrentUser()?.matricule || 'system';
    forkJoin(
      centralToBuffer.map(item =>
        this.repo.replenishBuffer(item.productSku, item.suggestedQty, userId, `Transfert IA groupé : ${item.reason}`).pipe(
          catchError(() => of(null))
        )
      )
    ).pipe(takeUntil(this.d$)).subscribe(() => {
      this.executingBatch.set(false);
      this.toast.success(`${centralToBuffer.length} transfert(s) Central → Tampon exécuté(s).`);
      this.loadData();
    });
  }

  exportTransfersCsv(): void {
    const list = this.filteredSuggestions();
    if (!list.length) {
      this.toast.warning('Aucun transfert à exporter.');
      return;
    }
    const headers = ['SKU', 'Produit', 'Source', 'Destination', 'Stock source', 'Stock dest', 'Qté suggérée', 'Priorité', 'Motif'];
    const rows = list.map(s => [
      s.productSku,
      s.productName.replace(/;/g, ','),
      s.fromWarehouse.replace(/;/g, ','),
      s.toWarehouse.replace(/;/g, ','),
      String(s.fromQty),
      String(s.toQty),
      String(s.suggestedQty),
      s.priority,
      s.reason.replace(/;/g, ',')
    ]);
    const csv = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tanty-ia-transferts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.toast.success(`${list.length} suggestion(s) exportée(s).`);
  }

  toggleSelect(item: TransferSuggestion): void {
    item.selected = !item.selected;
    this.suggestions.update(items => [...items]);
  }

  selectAll(): void {
    this.suggestions.update(items => items.map(i => ({ ...i, selected: true })));
  }

  selectHigh(): void {
    this.suggestions.update(items => items.map(i => ({ ...i, selected: i.priority === 'HIGH' })));
  }

  deselectAll(): void {
    this.suggestions.update(items => items.map(i => ({ ...i, selected: false })));
  }

  runIaOptimization(): void {
    if (this.iaLoading()) return;
    this.iaLoading.set(true);

    const stockData = this.stockLevels().map(sl => ({
      sku: sl.productSku,
      name: sl.productName,
      warehouse: sl.warehouseName,
      warehouseType: sl.warehouseType,
      quantity: sl.quantity,
      unit: sl.productUnit,
      reorderPoint: sl.reorderPoint,
      safetyStock: sl.safetyStock,
      alertLevel: sl.alertLevel
    }));

    this.iaService.predict({
      domain: 'stock',
      predictionType: 'optimisation_transferts',
      horizonDays: 15,
      stockData
    }).pipe(takeUntil(this.d$)).subscribe({
      next: (resp) => {
        this.iaSummary.set(resp.summary);
        this.iaLoading.set(false);
      },
      error: () => {
        this.iaSummary.set('Erreur lors de l\'optimisation IA. Les recommandations locales restent disponibles.');
        this.iaLoading.set(false);
      }
    });
  }

  getPriorityClass(p: string): string {
    return p === 'HIGH' ? 'prio-high' : p === 'MEDIUM' ? 'prio-medium' : 'prio-low';
  }

  getPriorityIcon(p: string): string {
    return p === 'HIGH' ? 'fa-bolt' : p === 'MEDIUM' ? 'fa-arrow-right-arrow-left' : 'fa-circle-info';
  }

  getPriorityLabel(p: string): string {
    return p === 'HIGH' ? 'Haute' : p === 'MEDIUM' ? 'Moyenne' : 'Faible';
  }

  refresh(): void {
    this.loadData();
  }
}
