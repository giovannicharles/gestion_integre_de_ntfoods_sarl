// ═══ FICHIER : src/app/domains/stock/presentation/pages/production/production.component.ts ═══
// REMPLACE : le fichier existant — StockMockRepository → StockApiRepository
import { Component, OnInit, signal, inject, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { Chart, registerables } from 'chart.js';
import { ProductionBatchUseCase } from '../../../application/use-cases/production/production-batch.use-case';
import { InternalOrderUseCase } from '../../../application/use-cases/orders/internal-order.use-case';
import { StockApiRepository } from '../../../infrastructure/repositories/stock-api.repository';
import { StockRulesDomainService } from '../../../domain/services/stock-rules.domain.service';
import { ProductionBatch, Product, InternalOrder, StockLevel } from '../../../domain/models';
import { AuthService } from '../../../../../core/auth/auth.service';

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
  private readonly orderUC  = inject(InternalOrderUseCase);
  private readonly repo     = inject(StockApiRepository);
  private readonly rules    = inject(StockRulesDomainService);
  private readonly auth     = inject(AuthService);
  private readonly router   = inject(Router);

  @ViewChild('trendCanvas') trendCanvas!: ElementRef<HTMLCanvasElement>;
  private chart: Chart | null = null;

  Math=Math;
  loading   = signal(true);
  error     = signal('');
  activeTab = signal<'pending'|'all'|'orders'>('pending');
  batches   = signal<ProductionBatch[]>([]);
  pending   = signal<ProductionBatch[]>([]);
  orders    = signal<InternalOrder[]>([]);
  pfLevels  = signal<StockLevel[]>([]);
  products  = signal<Product[]>([]);

  // Déclaration d'un nouveau lot — désormais page dédiée /stock/declaration-lot

  // Validation / Rejet
  selectedBatch = signal<ProductionBatch | null>(null);
  actionType    = signal<'validate'|'reject'|null>(null);
  validationNotes = ''; rejectionReason = '';
  processing = signal(false);

  // Détail / livraison / annulation commande
  selectedOrder = signal<InternalOrder | null>(null);
  showOrderDetail = signal(false);
  deliveryForm = { productId: 0, deliveredQty: 0 };
  delivering = signal(false);
  cancelReason = '';
  cancelling = signal(false);

  toastMsg  = signal(''); toastType = signal<'success'|'error'>('success');
  today     = new Date();
  batchStats = signal<Record<string, unknown>>({});

  ngOnInit() { this.loadAll(); }

  ngAfterViewInit() { if (!this.loading()) this.buildChart(); }

  loadAll() {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      all:    this.batchUC.getAll(),
      orders: this.orderUC.getAll(),
      levels: this.repo.getStockLevels(),
      prods:  this.batchUC.getFinishedProducts(),
      stats:  this.batchUC.getStats(),
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: ({ all, orders, levels, prods, stats }) => {
        this.batches.set(all);
        this.pending.set(all.filter((b: ProductionBatch) => b.status === 'DECLARED_BY_PRODUCTION'));
        this.orders.set(orders);
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

  // ── Commande interne ─────────────────────────────────────
  openOrderModal() { this.router.navigate(['/stock/commande-production']); }

  approveOrder(id: number) {
    const user = this.auth.getCurrentUser();
    if (!user) { this.showToast('Session expirée.', 'error'); return; }
    this.orderUC.approve(id, user.matricule, `${user.firstname} ${user.lastname}`)
      .pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.showToast('Commande approuvée par le Chef de Production.', 'success'); this.loadAll(); },
      error: () => this.showToast('Erreur.', 'error')
    });
  }

  openOrderDetail(o: InternalOrder) {
    this.selectedOrder.set(o);
    this.showOrderDetail.set(true);
    this.deliveryForm = { productId: 0, deliveredQty: 0 };
    this.cancelReason = '';
  }
  closeOrderDetail() { this.showOrderDetail.set(false); this.selectedOrder.set(null); }

  cancelOrder(id: number) {
    if (!this.cancelReason || this.cancelling()) return;
    const user = this.auth.getCurrentUser();
    if (!user) { this.showToast('Session expirée.', 'error'); return; }
    this.cancelling.set(true);
    this.orderUC.cancel(id, user.matricule, this.cancelReason)
      .pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.cancelling.set(false); this.closeOrderDetail(); this.showToast('Commande annulée.', 'error'); this.loadAll(); },
      error: () => { this.cancelling.set(false); this.showToast('Erreur.', 'error'); }
    });
  }

  deliverOrder(orderId: number) {
    if (!this.deliveryForm.productId || !this.deliveryForm.deliveredQty || this.delivering()) return;
    this.delivering.set(true);
    this.orderUC.deliver(orderId, this.deliveryForm.productId, this.deliveryForm.deliveredQty)
      .pipe(takeUntil(this.destroy$)).subscribe({
      next: (updated) => {
        this.delivering.set(false);
        this.selectedOrder.set(updated);
        this.deliveryForm = { productId: 0, deliveredQty: 0 };
        this.showToast(`Livraison enregistrée. Statut: ${this.getOStatusLabel(updated.status)}`, 'success');
        this.loadAll();
      },
      error: () => { this.delivering.set(false); this.showToast('Erreur de livraison.', 'error'); }
    });
  }

  getDeliveryPct(o: InternalOrder): number {
    if (!o.items || o.items.length === 0) return 0;
    const totalRequested = o.items.reduce((s, i) => s + i.requestedQty, 0);
    const totalDelivered = o.items.reduce((s, i) => s + (i.deliveredQty || 0), 0);
    return totalRequested > 0 ? Math.round((totalDelivered / totalRequested) * 100) : 0;
  }

  countOrderStatus(status: string): number {
    return this.orders().filter(o => o.status === status).length;
  }

  // ── Helpers ───────────────────────────────────────────────
  getStatusLabel(s: string) { const m:Record<string,string>={DECLARED_BY_PRODUCTION:'Déclaré — Att. validation stock',VALIDATED_BY_STOCK:'Validé — Stock PF mis à jour',REJECTED:'Rejeté'}; return m[s]||s; }
  getStatusClass(s: string) { return s==='VALIDATED_BY_STOCK'?'badge-success':s==='REJECTED'?'badge-danger':'badge-warning'; }
  getOStatusLabel(s: string) { const m:Record<string,string>={DRAFT:'Brouillon — Att. approbation',APPROVED:'Approuvé — En production',PARTIALLY_DELIVERED:'Partiellement livré',DELIVERED:'Livré complet',CANCELLED:'Annulé'}; return m[s]||s; }
  getOStatusClass(s: string) { const m:Record<string,string>={DRAFT:'badge-warning',APPROVED:'badge-primary',PARTIALLY_DELIVERED:'badge-secondary',DELIVERED:'badge-success',CANCELLED:'badge-danger'}; return m[s]||'badge-neutral'; }
  formatCFA(n: number) { return new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA'; }
  showToast(msg: string, type: 'success'|'error') { this.toastMsg.set(msg); this.toastType.set(type); setTimeout(() => this.toastMsg.set(''), 5000); }
  ngOnDestroy() { this.chart?.destroy(); this.destroy$.next(); this.destroy$.complete(); }
}