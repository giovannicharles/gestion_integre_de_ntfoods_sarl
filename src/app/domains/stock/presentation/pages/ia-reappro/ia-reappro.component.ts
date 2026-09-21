import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, catchError, of, forkJoin } from 'rxjs';
import { StockApiRepository } from '../../../infrastructure/repositories/stock-api.repository';
import { StockLevel } from '../../../domain/models';
import { IaService, PredictiveResponse } from '../../../../../core/services/ia.service';

interface ReapproItem {
  productSku: string;
  productName: string;
  warehouse: string;
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

  loading = signal(true);
  iaLoading = signal(false);
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
    let r = items;
    if (sev !== 'ALL') r = r.filter(i => i.severity === sev);
    if (this.search) {
      const q = this.search.toLowerCase();
      r = r.filter(i => i.productName.toLowerCase().includes(q) || i.productSku.toLowerCase().includes(q));
    }
    return r.sort((a, b) => this.severityOrder(a.severity) - this.severityOrder(b.severity));
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
          productSku: sl.productSku || '',
          productName: sl.productName || sl.productSku || '',
          warehouse: sl.warehouseName || '',
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
