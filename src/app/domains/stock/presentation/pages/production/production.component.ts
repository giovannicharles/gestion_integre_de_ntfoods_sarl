import { Component, OnInit, signal, inject, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { Chart, registerables } from 'chart.js';
import { ProductionBatchUseCase } from '../../../application/use-cases/production/production-batch.use-case';
import { InternalOrderUseCase } from '../../../application/use-cases/orders/internal-order.use-case';
import { StockMockRepository } from '../../../infrastructure/repositories/stock-mock.repository';
import { StockRulesDomainService } from '../../../domain/services/stock-rules.domain.service';
import { ProductionBatch, Product, InternalOrder, StockLevel } from '../../../domain/models/stock.models';

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
  private readonly repo     = inject(StockMockRepository);
  private readonly rules    = inject(StockRulesDomainService);

  @ViewChild('trendCanvas') trendCanvas!: ElementRef<HTMLCanvasElement>;
  private chart: Chart | null = null;

  Math=Math;
  loading   = signal(true);
  activeTab = signal<'pending'|'all'|'orders'>('pending');
  batches   = signal<ProductionBatch[]>([]);
  pending   = signal<ProductionBatch[]>([]);
  orders    = signal<InternalOrder[]>([]);
  pfLevels  = signal<StockLevel[]>([]);
  products  = signal<Product[]>([]);

  // Déclaration d'un nouveau lot (interface Chef de Production)
  showDeclareModal = signal(false);
  declareForm = { productId: 0, declaredQuantityKg: 0, productionDate: new Date().toISOString().split('T')[0], notes: '' };
  declaring = signal(false);

  // Validation / Rejet
  selectedBatch = signal<ProductionBatch | null>(null);
  actionType    = signal<'validate'|'reject'|null>(null);
  validationNotes = ''; rejectionReason = '';
  processing = signal(false);

  // Commande interne
  showOrderModal = signal(false);
  orderForm: { items: Array<{productId: number; requestedQty: number; notes: string}>; notes: string } = { items: [{productId: 0, requestedQty: 0, notes: ''}], notes: '' };
  ordering = signal(false);

  toastMsg  = signal(''); toastType = signal<'success'|'error'>('success');
  today     = new Date();

  ngOnInit() { this.loadAll(); }

  ngAfterViewInit() { if (!this.loading()) this.buildChart(); }

  loadAll() {
    this.loading.set(true);
    forkJoin({
      all:    this.batchUC.getAll(),
      pending:this.batchUC.getAll(),
      orders: this.orderUC.getAll(),
      levels: this.repo.getStockLevels(),
      prods:  this.batchUC.getFinishedProducts(),
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: ({ all, orders, levels, prods }) => {
        this.batches.set(all);
        this.pending.set(all.filter(b => b.status === 'DECLARED_BY_PRODUCTION'));
        this.orders.set(orders);
        this.pfLevels.set(levels.filter(sl => sl.warehouseId === 3));
        this.products.set(prods);
        this.loading.set(false);
        setTimeout(() => this.buildChart(), 100);
      },
      error: () => this.loading.set(false)
    });
  }

  buildChart() {
    if (!this.trendCanvas) return;
    this.chart?.destroy();
    const last7 = this.batches().slice(0, 7).reverse();
    const ctx = this.trendCanvas.nativeElement.getContext('2d')!;
    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: last7.map(b => b.batchDate ? new Date(b.batchDate).toLocaleDateString('fr-CM', { day: '2-digit', month: 'short' }) : b.productionDate),
        datasets: [
          { label: 'Quantité déclarée (kg)', data: last7.map(b => b.declaredQuantityKg), borderColor: 'rgba(26,107,42,1)', backgroundColor: 'rgba(26,107,42,.12)', fill: true, tension: 0.4, pointBackgroundColor: 'rgba(26,107,42,1)', pointRadius: 5 },
          { label: 'Unités produites', data: last7.map(b => (b.equivalentUnits || 0) / 100), borderColor: 'rgba(200,168,0,1)', backgroundColor: 'rgba(200,168,0,.1)', fill: true, tension: 0.4, pointBackgroundColor: 'rgba(200,168,0,1)', pointRadius: 5, yAxisID: 'y2' },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { font: { family: 'DM Sans', size: 12 }, usePointStyle: true } } },
        scales: {
          y:  { position: 'left',  beginAtZero: true, grid: { color: 'rgba(0,0,0,.04)' }, ticks: { font: { family: 'DM Sans', size: 11 } }, title: { display: true, text: 'kg' } },
          y2: { position: 'right', beginAtZero: true, grid: { display: false }, ticks: { font: { family: 'DM Sans', size: 11 } }, title: { display: true, text: 'x100 unités' } },
          x:  { grid: { display: false }, ticks: { font: { family: 'DM Sans', size: 10 } } }
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
      error: () => { this.processing.set(false); this.showToast('Erreur.', 'error'); }
    });
  }

  // ── Déclaration lot (Chef de Production) ─────────────────
  openDeclareModal() { this.declareForm = { productId: 0, declaredQuantityKg: 0, productionDate: new Date().toISOString().split('T')[0], notes: '' }; this.showDeclareModal.set(true); }
  closeDeclareModal() { this.showDeclareModal.set(false); }

  getPreviewUnits(): number {
    if (!this.declareForm.productId || !this.declareForm.declaredQuantityKg) return 0;
    const p = this.products().find(x => x.id === this.declareForm.productId);
    return p ? this.rules.kgToUnits(this.declareForm.declaredQuantityKg, p.unit) : 0;
  }
  getPreviewBatchDate(): string {
    if (!this.declareForm.productionDate) return '—';
    return this.rules.calcBatchDate(new Date(this.declareForm.productionDate)).toLocaleDateString('fr-CM', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  declareBatch() {
    if (!this.declareForm.productId || !this.declareForm.declaredQuantityKg || this.declaring()) return;
    this.declaring.set(true);
    this.batchUC.declare({
      productId: this.declareForm.productId,
      declaredQuantityKg: this.declareForm.declaredQuantityKg,
      productionDate: this.declareForm.productionDate,
      notes: this.declareForm.notes,
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: b => {
        this.declaring.set(false); this.closeDeclareModal();
        this.showToast(`Lot déclaré : ${b.equivalentUnits} unités de ${b.productName}. En attente de validation stock.`, 'success');
        this.loadAll();
      },
      error: () => { this.declaring.set(false); this.showToast('Erreur de déclaration.', 'error'); }
    });
  }

  // ── Commande interne ─────────────────────────────────────
  openOrderModal() { this.orderForm = { items: [{ productId: 0, requestedQty: 0, notes: '' }], notes: '' }; this.showOrderModal.set(true); }
  closeOrderModal() { this.showOrderModal.set(false); }
  addOrderItem() { this.orderForm.items.push({ productId: 0, requestedQty: 0, notes: '' }); }
  removeOrderItem(i: number) { if (this.orderForm.items.length > 1) this.orderForm.items.splice(i, 1); }

  createOrder() {
    if (this.ordering()) return;
    this.ordering.set(true);
    this.orderUC.create({ items: this.orderForm.items as any, notes: this.orderForm.notes })
      .pipe(takeUntil(this.destroy$)).subscribe({
        next: o => {
          this.ordering.set(false); this.closeOrderModal();
          this.showToast(`Commande ${o.orderNumber} créée. En attente d'approbation du Chef de Production.`, 'success');
          this.loadAll();
        },
        error: () => { this.ordering.set(false); this.showToast('Erreur.', 'error'); }
      });
  }

  approveOrder(id: number) {
    this.orderUC.approve(id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.showToast('Commande approuvée par le Chef de Production.', 'success'); this.loadAll(); },
      error: () => this.showToast('Erreur.', 'error')
    });
  }

  // ── Helpers ───────────────────────────────────────────────
  getStatusLabel(s: string) { const m:Record<string,string>={DECLARED_BY_PRODUCTION:'Déclaré — Att. validation stock',VALIDATED_BY_STOCK:'Validé — Stock PF mis à jour',REJECTED:'Rejeté'}; return m[s]||s; }
  getStatusClass(s: string) { return s==='VALIDATED_BY_STOCK'?'badge-success':s==='REJECTED'?'badge-danger':'badge-warning'; }
  getOStatusLabel(s: string) { const m:Record<string,string>={DRAFT:'Brouillon — Att. approbation',APPROVED:'Approuvé — En production',PARTIALLY_DELIVERED:'Partiellement livré',DELIVERED:'Livré complet',CANCELLED:'Annulé'}; return m[s]||s; }
  getOStatusClass(s: string) { const m:Record<string,string>={DRAFT:'badge-warning',APPROVED:'badge-info',PARTIALLY_DELIVERED:'badge-secondary',DELIVERED:'badge-success',CANCELLED:'badge-danger'}; return m[s]||'badge-neutral'; }
  formatCFA(n: number) { return new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA'; }
  showToast(msg: string, type: 'success'|'error') { this.toastMsg.set(msg); this.toastType.set(type); setTimeout(() => this.toastMsg.set(''), 5000); }
  ngOnDestroy() { this.chart?.destroy(); this.destroy$.next(); this.destroy$.complete(); }
}
