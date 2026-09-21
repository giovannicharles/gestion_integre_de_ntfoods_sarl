import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, catchError, of } from 'rxjs';
import { StockApiRepository } from '../../../infrastructure/repositories/stock-api.repository';
import { StockLevel, StockMovement } from '../../../domain/models';
import { IaService } from '../../../../../core/services/ia.service';

interface TransferSuggestion {
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

  loading = signal(true);
  iaLoading = signal(false);
  error = signal('');
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
    const items = this.suggestions();
    if (p === 'ALL') return items.sort((a, b) => this.priorityOrder(a.priority) - this.priorityOrder(b.priority));
    return items.filter(i => i.priority === p).sort((a, b) => this.priorityOrder(a.priority) - this.priorityOrder(b.priority));
  });

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
