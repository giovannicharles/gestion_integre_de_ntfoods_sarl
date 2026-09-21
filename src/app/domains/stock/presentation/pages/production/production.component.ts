// ═══ FICHIER : src/app/domains/stock/presentation/pages/production/production.component.ts ═══
// REMPLACE : le fichier existant — StockMockRepository → StockApiRepository
import { Component, OnInit, signal, inject, OnDestroy, ViewChild, ElementRef, AfterViewInit, computed } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { Chart, registerables } from 'chart.js';
import { ProductionBatchUseCase } from '../../../application/use-cases/production/production-batch.use-case';
import { StockApiRepository } from '../../../infrastructure/repositories/stock-api.repository';
import { StockRulesDomainService } from '../../../domain/services/stock-rules.domain.service';
import { ProductionBatch, Product, StockLevel } from '../../../domain/models';

Chart.register(...registerables);

@Component({
  selector: 'app-production',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, FormsModule, RouterLink],
  templateUrl: './production.component.html',
  styleUrls: ['./production.component.css']
})
export class ProductionComponent implements OnInit, AfterViewInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private readonly batchUC  = inject(ProductionBatchUseCase);
  private readonly repo     = inject(StockApiRepository);
  private readonly rules    = inject(StockRulesDomainService);
  private readonly router   = inject(Router);

  @ViewChild('trendCanvas') trendCanvas!: ElementRef<HTMLCanvasElement>;
  private chart: Chart | null = null;

  Math=Math;
  loading   = signal(true);
  error     = signal('');
  activeTab = signal<'pending'|'all'>('pending');
  batches   = signal<ProductionBatch[]>([]);
  pending   = signal<ProductionBatch[]>([]);
  pfLevels  = signal<StockLevel[]>([]);
  products  = signal<Product[]>([]);

  // Déclaration d'un nouveau lot — désormais page dédiée /stock/declaration-lot

  // Validation / Rejet
  selectedBatch = signal<ProductionBatch | null>(null);
  actionType    = signal<'validate'|'reject'|null>(null);
  validationNotes = ''; rejectionReason = '';
  processing = signal(false);

  toastMsg  = signal(''); toastType = signal<'success'|'error'>('success');
  today     = new Date();
  batchStats = signal<Record<string, unknown>>({});

  // ── Pagination lots ──
  batchPage = signal(1);
  readonly batchPageSize = 10;
  batchSearch = '';
  batchStatusFilter = signal<string>('ALL');

  filteredBatches = computed<ProductionBatch[]>(() => {
    let list = this.batches();
    const filter = this.batchStatusFilter();
    if (filter !== 'ALL') {
      list = list.filter(b => b.status === filter);
    }
    const q = this.batchSearch?.toLowerCase().trim();
    if (q) {
      list = list.filter(b =>
        (b.productName || '').toLowerCase().includes(q) ||
        (b.productSku || '').toLowerCase().includes(q) ||
        (b.declaredByName || '').toLowerCase().includes(q)
      );
    }
    return list;
  });
  batchTotalPages = computed(() => Math.max(1, Math.ceil(this.filteredBatches().length / this.batchPageSize)));
  paginatedBatches = computed<ProductionBatch[]>(() => {
    const start = (this.batchPage() - 1) * this.batchPageSize;
    return this.filteredBatches().slice(start, start + this.batchPageSize);
  });

  ngOnInit() { this.loadAll(); }

  ngAfterViewInit() { if (!this.loading()) this.buildChart(); }

  loadAll() {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      all:    this.batchUC.getAll(),
      levels: this.repo.getStockLevels(),
      prods:  this.batchUC.getFinishedProducts(),
      stats:  this.batchUC.getStats(),
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: ({ all, levels, prods, stats }) => {
        this.batches.set(all);
        this.pending.set(all.filter((b: ProductionBatch) => b.status === 'DECLARED_BY_PRODUCTION'));
        this.pfLevels.set(levels.filter((sl: StockLevel) => prods.some(p => p.id === sl.productId)));
        this.products.set(prods);
        this.batchStats.set(stats || {});
        this.loading.set(false);
        setTimeout(() => this.buildChart(), 100);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set('Erreur de chargement des données de production.');
      }
    });
  }

  statNum(key: string): number {
    const v = this.batchStats()[key];
    return v != null ? Number(v) : 0;
  }

  buildChart() {
    if (!this.trendCanvas) return;
    this.chart?.destroy();
    const last7 = this.batches().slice(0, 7).reverse();
    const ctx = this.trendCanvas.nativeElement.getContext('2d')!;
    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: last7.map((b: ProductionBatch) => b.batchDate ? new Date(b.batchDate).toLocaleDateString('fr-CM', { day: '2-digit', month: 'short' }) : b.productionDate),
        datasets: [
          { label: 'Quantité déclarée (kg)', data: last7.map((b: ProductionBatch) => b.declaredQuantityKg), borderColor: 'rgba(20,83,45,1)', backgroundColor: 'rgba(20,83,45,.12)', fill: true, tension: 0.4, pointBackgroundColor: 'rgba(20,83,45,1)', pointRadius: 5 },
          { label: 'Unités produites', data: last7.map((b: ProductionBatch) => (b.equivalentUnits || 0) / 100), borderColor: 'rgba(196,146,0,1)', backgroundColor: 'rgba(196,146,0,.1)', fill: true, tension: 0.4, pointBackgroundColor: 'rgba(196,146,0,1)', pointRadius: 5, yAxisID: 'y2' },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { font: { family: 'Poppins', size: 12, weight: 600 }, usePointStyle: true } } },
        scales: {
          y:  { position: 'left', beginAtZero: true, grid: { color: 'rgba(0,0,0,.04)' }, ticks: { font: { family: 'Inter', size: 11 } }, title: { display: true, text: 'kg', font: { family: 'Inter' } } },
          y2: { position: 'right', beginAtZero: true, grid: { display: false }, ticks: { font: { family: 'Inter', size: 11 } }, title: { display: true, text: 'x100 unités', font: { family: 'Inter' } } },
          x:  { grid: { display: false }, ticks: { font: { family: 'Inter', size: 10 } } }
        }
      }
    });
  }

  // ── Actions sur lots ─────────────────────────────────────
  openAction(b: ProductionBatch, type: 'validate'|'reject') {
    this.selectedBatch.set(b); this.actionType.set(type);
    this.validationNotes = ''; this.rejectionReason = '';
  }
  closeAction() { this.selectedBatch.set(null); this.actionType.set(null); }

  confirmerAction() {
    const b = this.selectedBatch(); if (!b) return;
    this.processing.set(true);
    const obs$ = this.actionType() === 'validate'
      ? this.batchUC.validate(b.id, this.validationNotes)
      : this.batchUC.reject(b.id, this.rejectionReason);
    obs$.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.processing.set(false); this.closeAction();
        const msg = this.actionType() === 'validate'
          ? `Lot validé. ${b.equivalentUnits} unités ajoutées au stock Produits Finis.`
          : 'Lot rejeté. La production en sera notifiée.';
        this.showToast(msg, this.actionType() === 'validate' ? 'success' : 'error');
        this.loadAll();
      },
      error: () => { this.processing.set(false); this.showToast('Erreur lors de l\'action.', 'error'); }
    });
  }

  // ── Déclaration lot → page dédiée ───────────────────────
  openDeclareModal() { this.router.navigate(['/stock/declaration-lot']); }

  // ── Helpers ───────────────────────────────────────────────
  applyBatchFilter() { this.batchPage.set(1); }
  goToBatchPage(p: number) { if (p >= 1 && p <= this.batchTotalPages()) this.batchPage.set(p); }
  nextBatchPage() { this.goToBatchPage(this.batchPage() + 1); }
  prevBatchPage() { this.goToBatchPage(this.batchPage() - 1); }

  getStatusLabel(s: string) { const m:Record<string,string>={DECLARED_BY_PRODUCTION:'Déclaré — Att. validation stock',VALIDATED_BY_STOCK:'Validé — Stock PF mis à jour',REJECTED:'Rejeté'}; return m[s]||s; }
  getStatusClass(s: string) { return s==='VALIDATED_BY_STOCK'?'badge-success':s==='REJECTED'?'badge-danger':'badge-warning'; }
  formatCFA(n: number) { return new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA'; }
  showToast(msg: string, type: 'success'|'error') { this.toastMsg.set(msg); this.toastType.set(type); setTimeout(() => this.toastMsg.set(''), 5000); }
  ngOnDestroy() { this.chart?.destroy(); this.destroy$.next(); this.destroy$.complete(); }
}