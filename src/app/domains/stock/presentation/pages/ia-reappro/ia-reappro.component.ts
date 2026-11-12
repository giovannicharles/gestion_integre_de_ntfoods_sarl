import { Component, OnInit, OnDestroy, signal, computed, inject, ChangeDetectionStrategy} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil, catchError, of, forkJoin } from 'rxjs';
import { StockApiRepository } from '../../../infrastructure/repositories/stock-api.repository';
import { StockLevel } from '../../../domain/models';
import { IaService, PredictiveResponse } from '../../../../../core/services/ia.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { AuthService } from '../../../../../core/auth/auth.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';

interface ReapproItem {
  productId: number;
  productSku: string;
  productName: string;
  warehouse: string;
  warehouseType: string;
  currentQty: number;
  unit: string;
  reorderPoint: number;
  safetyStock: number;
  suggestedQty: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  daysUntilRupture: number;
  probability: number;
  recommendedAction: string;
  selected: boolean;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-ia-reappro',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe],
  templateUrl: './ia-reappro.component.html',
  styleUrls: ['./ia-reappro.component.css']
})
export class IaReapproComponent implements OnInit, OnDestroy {
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
  readonly reapproPageSize = 10;
  reapproPage = signal(1);
  searchSignal = signal('');
  error = signal('');
  stockLevels = signal<StockLevel[]>([]);
  reapproItems = signal<ReapproItem[]>([]);
  iaResult = signal<PredictiveResponse | null>(null);
  iaConfigured = signal(false);
  filterSeverity = signal<'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
  search = '';

  Math = Math;

  stats = computed(() => {
    const items = this.reapproItems();
    return {
      total: items.length,
      critical: items.filter(i => i.severity === 'CRITICAL').length,
      high: items.filter(i => i.severity === 'HIGH').length,
      selected: items.filter(i => i.selected).length,
      totalSuggestedValue: items.filter(i => i.selected).reduce((s, i) => s + i.suggestedQty, 0)
    };
  });

  filteredItems = computed(() => {
    const sev = this.filterSeverity();
    const items = this.reapproItems();
    const q = this.searchSignal().toLowerCase().trim();
    let r = items;
    if (sev !== 'ALL') r = r.filter(i => i.severity === sev);
    if (q) {
      r = r.filter(i => i.productName.toLowerCase().includes(q) || i.productSku.toLowerCase().includes(q));
    }
    return [...r].sort((a, b) => this.severityOrder(a.severity) - this.severityOrder(b.severity));
  });

  reapproTotalPages = computed(() => Math.max(1, Math.ceil(this.filteredItems().length / this.reapproPageSize)));
  reapproPageRange = computed(() => Array.from({ length: this.reapproTotalPages() }, (_, i) => i + 1));
  paginatedItems = computed(() => {
    const start = (this.reapproPage() - 1) * this.reapproPageSize;
    return this.filteredItems().slice(start, start + this.reapproPageSize);
  });

  onSearchChange(v: string): void {
    this.search = v;
    this.searchSignal.set(v);
    this.reapproPage.set(1);
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
        this.generateReapproItems(levels);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Erreur lors du chargement des données de stock');
        this.loading.set(false);
      }
    });
  }

  private generateReapproItems(levels: StockLevel[]): void {
    const items: ReapproItem[] = levels
      .filter(sl => sl.alertLevel === 'CRITIQUE' || sl.alertLevel === 'FAIBLE')
      .map(sl => {
        const reorderPoint = sl.reorderPoint || 0;
        const safetyStock = sl.safetyStock || 0;
        const currentQty = sl.quantity || 0;
        const suggestedQty = Math.max(0, reorderPoint + safetyStock - currentQty);
        const severity = this.calcSeverity(sl.alertLevel, currentQty, safetyStock);
        const daysUntilRupture = this.estimateDaysUntilRupture(sl);
        return {
          productId: sl.productId || 0,
          productSku: sl.productSku || '',
          productName: sl.productName || sl.productSku || '',
          warehouse: sl.warehouseName || '',
          warehouseType: sl.warehouseType || '',
          currentQty,
          unit: this.resolveUnitLabel(sl.packagingType) || sl.productUnit || 'unités',
          reorderPoint,
          safetyStock,
          suggestedQty,
          severity,
          daysUntilRupture,
          probability: severity === 'CRITICAL' ? 0.9 : severity === 'HIGH' ? 0.7 : 0.4,
          recommendedAction: this.buildAction(sl, suggestedQty),
          selected: severity === 'CRITICAL' || severity === 'HIGH'
        };
      });
    this.reapproItems.set(items);
  }

  private calcSeverity(alertLevel: string | undefined, qty: number, safety: number): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
    if (alertLevel === 'CRITIQUE' || qty <= safety) return 'CRITICAL';
    if (alertLevel === 'FAIBLE') return 'HIGH';
    if (qty <= (safety * 2)) return 'MEDIUM';
    return 'LOW';
  }

  private estimateDaysUntilRupture(sl: StockLevel): number {
    const qty = sl.quantity || 0;
    const reorder = sl.reorderPoint || 0;
    if (reorder <= 0) return 999;
    const ratio = qty / reorder;
    if (ratio <= 0.5) return 3;
    if (ratio <= 0.8) return 7;
    if (ratio <= 1) return 14;
    return 30;
  }

  private buildAction(sl: StockLevel, qty: number): string {
    if (qty <= 0) return `${sl.productName}: stock épuisé, commande urgente requise`;
    const unitLabel = this.resolveUnitLabel(sl.packagingType) || sl.productUnit || 'unités';
    if (sl.alertLevel === 'CRITIQUE') return `${sl.productName}: commander ${qty} ${unitLabel} en urgence`;
    return `${sl.productName}: commander ${qty} ${unitLabel} pour atteindre le seuil optimal`;
  }

  private severityOrder(s: string): number {
    return s === 'CRITICAL' ? 0 : s === 'HIGH' ? 1 : s === 'MEDIUM' ? 2 : 3;
  }

  setFilter(f: 'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'): void {
    this.filterSeverity.set(f);
    this.reapproPage.set(1);
  }

  executeReapproItem(item: ReapproItem): void {
    const qty = Math.max(1, item.suggestedQty || 10);
    if ((item.warehouseType || '').toUpperCase().includes('BUFFER') && item.productSku) {
      const key = item.productSku + item.warehouse;
      this.executingKey.set(key);
      const userId = this.auth.getCurrentUser()?.matricule || 'system';
      this.repo.replenishBuffer(item.productSku, qty, userId, `Réappro IA - ${item.productName}`).pipe(takeUntil(this.d$)).subscribe({
        next: () => {
          this.executingKey.set(null);
          this.toast.success(`Tampon réapprovisionné : +${qty} ${item.unit} (${item.productName})`);
          this.loadData();
        },
        error: (err) => {
          this.executingKey.set(null);
          this.toast.error(extractApiError(err));
        }
      });
      return;
    }
    this.router.navigate(['/stock/commande-production'], {
      queryParams: { productId: item.productId, qty }
    });
  }

  executeSelectedBuffer(): void {
    const selected = this.reapproItems().filter(i => i.selected && i.suggestedQty > 0);
    if (!selected.length) {
      this.toast.warning('Sélectionnez au moins un produit à réapprovisionner.');
      return;
    }
    const bufferItems = selected.filter(i => (i.warehouseType || '').toUpperCase().includes('BUFFER') && i.productSku);
    const nonBufferItems = selected.filter(i => !(i.warehouseType || '').toUpperCase().includes('BUFFER'));
    if (bufferItems.length > 0) {
      this.executingBatch.set(true);
      const userId = this.auth.getCurrentUser()?.matricule || 'system';
      const calls = bufferItems.map(i =>
        this.repo.replenishBuffer(i.productSku, i.suggestedQty, userId, `Réappro IA groupé - ${i.productName}`).pipe(
          catchError(() => of(null))
        )
      );
      forkJoin(calls).pipe(takeUntil(this.d$)).subscribe(() => {
        this.executingBatch.set(false);
        this.toast.success(`${bufferItems.length} transfert(s) vers le tampon exécuté(s).`);
        this.loadData();
      });
      return;
    }
    if (nonBufferItems.length > 0) {
      const first = nonBufferItems[0];
      this.router.navigate(['/stock/commande-production'], {
        queryParams: { productId: first.productId, qty: first.suggestedQty }
      });
    }
  }

  exportReapproCsv(): void {
    const items = this.reapproItems().filter(i => i.selected).length
      ? this.reapproItems().filter(i => i.selected)
      : this.filteredItems();
    if (!items.length) {
      this.toast.warning('Aucune recommandation à exporter.');
      return;
    }
    const headers = ['SKU', 'Produit', 'Magasin', 'Stock actuel', 'Sécurité', 'Qté suggérée', 'Sévérité', 'Action'];
    const rows = items.map(i => [
      i.productSku,
      i.productName.replace(/;/g, ','),
      i.warehouse.replace(/;/g, ','),
      String(i.currentQty),
      String(i.safetyStock),
      String(i.suggestedQty),
      i.severity,
      i.recommendedAction.replace(/;/g, ',')
    ]);
    const csv = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tanty-ia-reappro-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.toast.success(`${items.length} recommandation(s) exportée(s).`);
  }

  toggleSelect(item: ReapproItem): void {
    item.selected = !item.selected;
    this.reapproItems.update(items => [...items]);
  }

  selectAll(): void {
    this.reapproItems.update(items => items.map(i => ({ ...i, selected: true })));
  }

  selectCritical(): void {
    this.reapproItems.update(items => items.map(i => ({ ...i, selected: i.severity === 'CRITICAL' || i.severity === 'HIGH' })));
  }

  deselectAll(): void {
    this.reapproItems.update(items => items.map(i => ({ ...i, selected: false })));
  }

  runIaAnalysis(): void {
    if (this.iaLoading()) return;
    this.iaLoading.set(true);
    this.error.set('');

    const stockData = this.stockLevels().map(sl => ({
      sku: sl.productSku,
      name: sl.productName,
      warehouse: sl.warehouseName,
      quantity: sl.quantity,
      unit: sl.productUnit,
      reorderPoint: sl.reorderPoint,
      safetyStock: sl.safetyStock,
      alertLevel: sl.alertLevel
    }));

    this.iaService.predict({
      domain: 'stock',
      predictionType: 'reapprovisionnement',
      horizonDays: 30,
      stockData
    }).pipe(takeUntil(this.d$)).subscribe({
      next: (resp) => {
        this.iaResult.set(resp);
        this.applyIaSuggestions(resp);
        this.iaLoading.set(false);
      },
      error: (err) => {
        this.error.set('Erreur lors de l\'analyse IA: ' + (err?.message || 'inconnue'));
        this.iaLoading.set(false);
      }
    });
  }

  private applyIaSuggestions(resp: PredictiveResponse): void {
    if (!resp.usingFallback && resp.rupturePredictions) {
      this.reapproItems.update(items => items.map(item => {
        const pred = resp.rupturePredictions.find(p => p.productSku === item.productSku);
        if (pred) {
          return {
            ...item,
            daysUntilRupture: pred.daysUntilRupture || item.daysUntilRupture,
            probability: pred.probability || item.probability,
            recommendedAction: pred.recommendedAction || item.recommendedAction,
            suggestedQty: pred.suggestedQuantity > 0 ? pred.suggestedQuantity : item.suggestedQty
          };
        }
        return item;
      }));
    }
  }

  getSeverityClass(s: string): string {
    return s === 'CRITICAL' ? 'sev-critical' : s === 'HIGH' ? 'sev-high' : s === 'MEDIUM' ? 'sev-medium' : 'sev-low';
  }

  getSeverityIcon(s: string): string {
    return s === 'CRITICAL' ? 'fa-circle-exclamation' : s === 'HIGH' ? 'fa-triangle-exclamation' : s === 'MEDIUM' ? 'fa-circle-info' : 'fa-circle-check';
  }

  getSeverityLabel(s: string): string {
    return s === 'CRITICAL' ? 'Critique' : s === 'HIGH' ? 'Élevé' : s === 'MEDIUM' ? 'Moyen' : 'Faible';
  }

  fCFA(n: number): string {
    return new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA';
  }

  refresh(): void {
    this.loadData();
  }

  private packagingLabels: Record<string, string> = {
    CARTON: 'cartons', CARTON_ASSORTI: 'cartons d\'assortis',
    SEAU_1L: 'seaux 1L', SEAU_2L: 'seaux 2L', SEAU_5L: 'seaux 5L', SEAU_10L: 'seaux 10L', SEAU: 'seaux',
    SACHET_42G: 'sachets 42g', SACHET_60G: 'sachets 60g', SACHET_62G: 'sachets 62g', SACHET: 'sachets',
    ETUI: 'étuis', BOITE: 'boîtes', BOUTEILLE: 'bouteilles', BIDON: 'bidons',
    DOYPACK_80G: 'doypacks 80g', DOYPACK_140G: 'doypacks 140g', DOYPACK_350G: 'doypacks 350g', DOYPACK: 'doypacks',
    SAC: 'sacs', GAINE: 'gaines',
  };

  resolveUnitLabel(packagingType?: string): string {
    if (!packagingType) return '';
    return this.packagingLabels[packagingType.toUpperCase()] || packagingType.toLowerCase() + 's';
  }
}
