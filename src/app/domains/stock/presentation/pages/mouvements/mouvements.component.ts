import { Component, ChangeDetectionStrategy, OnInit, signal, inject, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject, forkJoin, takeUntil, catchError, of } from 'rxjs';
import { Chart, registerables } from 'chart.js';
import { StockLevelUseCase } from '../../../application/use-cases/inventaire/stock-level.use-case';
import { StockApiRepository } from '../../../infrastructure/repositories/stock-api.repository';
import { StockMovement, StockLevel } from '../../../domain/models';
import { AuthService } from '../../../../../core/auth/auth.service';
import { ApiService } from '../../../../../core/http/api.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';
Chart.register(...registerables);

@Component({ selector: 'app-mouvements', standalone: true, imports: [CommonModule, DatePipe, DecimalPipe, FormsModule], templateUrl: './mouvements.component.html', styleUrls: ['./mouvements.component.css'], changeDetection: ChangeDetectionStrategy.OnPush })
export class MouvementsComponent implements OnInit, OnDestroy {
  private d$ = new Subject<void>(); private uc = inject(StockLevelUseCase); private repo = inject(StockApiRepository); private auth = inject(AuthService); private api = inject(ApiService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  loading = signal(true); all = signal<StockMovement[]>([]); filtered = signal<StockMovement[]>([]); paginated = signal<StockMovement[]>([]);
  levels = signal<StockLevel[]>([]); search = ''; filterType = ''; filterProd = ''; filterStatus = '';
  pendingCount = signal(0); validating = signal(false);
  ps = 12; cp = signal(1); totalPages = signal(1);
  showAjust = signal(false); showTransfert = signal(false);
  ajustId = 0; ajustQty = 0; ajustMotif = ''; ajustSaving = signal(false);
  transfertId = 0; transfertQty = 0; transfertSaving = signal(false);
  Math = Math;
  toastMsg = signal(''); toastType = signal<'success' | 'error'>('success');
  get pages() { return Array.from({ length: this.totalPages() }, (_, i) => i + 1); }
  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['search']) {
        this.search = params['search'];
      }
      if (params['type']) {
        this.filterType = params['type'];
      }
    });
    forkJoin({ m: this.uc.getMovements().pipe(catchError(() => of([]))), l: this.uc.getAll().pipe(catchError(() => of([]))), p: this.api.get<StockMovement[]>('stock/movements/pending').pipe(catchError(() => of([]))) }).pipe(takeUntil(this.d$)).subscribe({ next: ({ m, l, p }) => { this.all.set(m); this.levels.set(l); this.pendingCount.set(p?.length || 0); this.applyFilters(); this.loading.set(false); }, error: (err) => { this.loading.set(false); this.showToast(extractApiError(err) || 'Erreur lors du chargement des mouvements', 'error'); } });
  }
  applyFilters() { let r = this.all(); if (this.search) { const q = this.search.toLowerCase(); r = r.filter(m => (m.product?.designation || m.product?.sku || '').toLowerCase().includes(q) || (m.reference || m.referenceNumber || '').toLowerCase().includes(q)); } if (this.filterType) r = r.filter(m => m.type === this.filterType); if (this.filterProd) r = r.filter(m => m.productId === +this.filterProd); if (this.filterStatus) r = r.filter(m => (m.status || 'VALIDATED') === this.filterStatus); this.filtered.set(r); const t = Math.ceil(r.length / this.ps) || 1; this.totalPages.set(t); this.goTo(1); }
  goTo(p: number) { const n = Math.max(1, Math.min(p, this.totalPages())); this.cp.set(n); const s = (n - 1) * this.ps; this.paginated.set(this.filtered().slice(s, s + this.ps)); }
  count(t: string) { return this.all().filter(m => m.type === t).length; }
  setFilterType(t: string) { this.filterType = this.filterType === t ? '' : t; this.applyFilters(); }
  voirTrace(ref?: string) { if (!ref) return; this.router.navigate(['/stock/lots/trace'], { queryParams: { lot: ref } }); }
  voirArticle(sku?: string) { if (!sku) return; this.router.navigate(['/stock/articles'], { queryParams: { sku, search: sku } }); }
  isEntree(t: string) { return t.startsWith('RECEPTION') || t === 'TRANSFER_MOBILE_TO_CENTRAL'; }
  getIcon(t: string) { const m: Record<string, string> = { RECEPTION_PRODUCTION: 'fa-industry', RECEPTION_CONSOMMABLE: 'fa-arrow-circle-down', RECEPTION_RAW_MATERIAL: 'fa-arrow-circle-down', RECEPTION_MATERIEL: 'fa-arrow-circle-down', TRANSFER_CENTRAL_TO_BUFFER: 'fa-boxes-stacked', TRANSFER_BUFFER_TO_MOBILE: 'fa-truck', TRANSFER_MOBILE_TO_CENTRAL: 'fa-arrow-rotate-left', SALE: 'fa-cash-register', ADJUSTMENT: 'fa-sliders', LOSS: 'fa-triangle-exclamation', EXPIRATION: 'fa-calendar-xmark' }; return m[t] || 'fa-circle'; }
  getColor(t: string) { const m: Record<string, string> = { RECEPTION_PRODUCTION: 'mc-t', RECEPTION_CONSOMMABLE: 'mc-g', RECEPTION_RAW_MATERIAL: 'mc-g', RECEPTION_MATERIEL: 'mc-g', TRANSFER_CENTRAL_TO_BUFFER: 'mc-t', TRANSFER_BUFFER_TO_MOBILE: 'mc-b', TRANSFER_MOBILE_TO_CENTRAL: 'mc-g', SALE: 'mc-b', ADJUSTMENT: 'mc-n', LOSS: 'mc-r', EXPIRATION: 'mc-r' }; return m[t] || 'mc-n'; }
  getLabel(t: string) { const m: Record<string, string> = { RECEPTION_PRODUCTION: 'Entrée production', RECEPTION_CONSOMMABLE: 'Réception consommable', RECEPTION_RAW_MATERIAL: 'Réception MP', RECEPTION_MATERIEL: 'Réception matériel', TRANSFER_CENTRAL_TO_BUFFER: 'Transfert central→tampon', TRANSFER_BUFFER_TO_MOBILE: 'Dotation (tampon→mobile)', TRANSFER_MOBILE_TO_CENTRAL: 'Retour mobile→central', SALE: 'Vente', ADJUSTMENT: 'Ajustement inventaire', LOSS: 'Perte/Casse', EXPIRATION: 'Expiration' }; return m[t] || t; }
  fCFA(n: number) { return new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA'; }
  getAjustSL() { return this.levels().find(sl => sl.id === +this.ajustId); }
  getTransfertSL() { return this.levels().find(sl => sl.id === +this.transfertId) || this.getMPLevels()[0]; }
  getMPLevels() {
    const central = this.levels().filter(sl => sl.warehouseId === 1 || sl.warehouseName?.toLowerCase().includes('central') || !sl.warehouseId);
    return central.length > 0 ? central : this.levels();
  }

  prodSearchTerm = signal('');
  ajustSearchTerm = signal('');

  getFilteredMPLevels(): StockLevel[] {
    const list = this.getMPLevels();
    const q = this.prodSearchTerm().trim().toLowerCase();
    if (!q) return list;
    return list.filter(sl =>
      (sl.productName || '').toLowerCase().includes(q) ||
      (sl.productSku || '').toLowerCase().includes(q) ||
      (sl.warehouseName || '').toLowerCase().includes(q)
    );
  }

  getFilteredAjustLevels(): StockLevel[] {
    const list = this.levels();
    const q = this.ajustSearchTerm().trim().toLowerCase();
    if (!q) return list;
    return list.filter(sl =>
      (sl.productName || '').toLowerCase().includes(q) ||
      (sl.productSku || '').toLowerCase().includes(q) ||
      (sl.warehouseName || '').toLowerCase().includes(q)
    );
  }

  selectTransfertProduct(sl: StockLevel): void {
    this.transfertId = sl.id;
    if (this.transfertQty <= 0) {
      this.transfertQty = Math.min(10, sl.quantity > 0 ? sl.quantity : 1);
    }
  }

  selectAjustProduct(sl: StockLevel): void {
    this.ajustId = sl.id;
    this.ajustQty = sl.quantity;
  }

  get selectedTransfertSL(): StockLevel | undefined {
    return this.levels().find(sl => sl.id === +this.transfertId);
  }

  get selectedAjustSL(): StockLevel | undefined {
    return this.levels().find(sl => sl.id === +this.ajustId);
  }

  openTransfertModal(): void {
    const list = this.getMPLevels();
    if (list.length > 0 && (!this.transfertId || !list.some(x => x.id === +this.transfertId))) {
      this.transfertId = list[0].id;
    }
    this.transfertQty = 1;
    this.showTransfert.set(true);
  }

  openAjustModal(): void {
    const list = this.levels();
    if (list.length > 0 && (!this.ajustId || !list.some(x => x.id === +this.ajustId))) {
      this.ajustId = list[0].id;
      this.ajustQty = list[0].quantity;
    }
    this.ajustMotif = '';
    this.showAjust.set(true);
  }

  onAjustProductChange(): void {
    const sl = this.selectedAjustSL;
    if (sl) {
      this.ajustQty = sl.quantity;
    }
  }

  setTransfertPct(pct: number): void {
    const sl = this.selectedTransfertSL;
    if (sl && sl.quantity > 0) {
      this.transfertQty = Math.max(1, Math.round((sl.quantity * pct) / 100));
    }
  }
  sauverAjust() { if (!this.ajustId || !this.ajustMotif || this.ajustSaving()) return; this.ajustSaving.set(true); this.uc.adjust(this.ajustId, this.ajustQty, this.ajustMotif).pipe(takeUntil(this.d$)).subscribe({ next: () => { this.ajustSaving.set(false); this.showAjust.set(false); this.showToast('Ajustement enregistré.', 'success'); forkJoin({ m: this.uc.getMovements(), l: this.uc.getAll() }).pipe(takeUntil(this.d$)).subscribe(({ m, l }) => { this.all.set(m); this.levels.set(l); this.applyFilters(); }); }, error: (err: any) => { this.ajustSaving.set(false); const msg = extractApiError(err) || 'Erreur lors de l\'ajustement'; this.showToast(msg, 'error'); } }); }
  sauverTransfert() {
    if (!this.transfertId || this.transfertQty <= 0 || this.transfertSaving()) return;
    this.transfertSaving.set(true);
    const sl = this.levels().find(x => x.id === this.transfertId);
    if (!sl) { this.transfertSaving.set(false); return; }
    const userId = this.auth.getCurrentUser()?.matricule || 'system';
    this.repo.replenishBuffer(sl.productSku || '', this.transfertQty, userId, `Transfert vers tampon - ${sl.productName}`).pipe(takeUntil(this.d$)).subscribe({
      next: () => { this.transfertSaving.set(false); this.showTransfert.set(false); this.showToast('Transfert vers tampon effectué.', 'success'); forkJoin({ m: this.uc.getMovements(), l: this.uc.getAll() }).pipe(takeUntil(this.d$)).subscribe(({ m, l }) => { this.all.set(m); this.levels.set(l); this.applyFilters(); }); },
      error: (err) => { this.transfertSaving.set(false); const msg = extractApiError(err) || 'Erreur lors du transfert'; this.showToast(msg, 'error'); }
    });
  }
  validateMovement(id: number) { if (this.validating()) return; this.validating.set(true); const user = this.auth.getCurrentUser(); const matricule = user?.matricule || 'system'; const uuid = this.matriculeToUuid(matricule); this.api.post(`stock/movements/${id}/validate`, {}, { validatedBy: uuid }).pipe(takeUntil(this.d$)).subscribe({ next: () => { this.validating.set(false); this.showToast('Mouvement validé avec succès.', 'success'); forkJoin({ m: this.uc.getMovements(), p: this.api.get<StockMovement[]>('stock/movements/pending').pipe(catchError(() => of([]))) }).pipe(takeUntil(this.d$)).subscribe(({ m, p }) => { this.all.set(m); this.pendingCount.set(p?.length || 0); this.applyFilters(); }); }, error: (err) => { this.validating.set(false); const msg = extractApiError(err) || 'Erreur lors de la validation'; this.showToast(msg, 'error'); } }); }
  matriculeToUuid(matricule: string): string { let hash = 0; for (let i = 0; i < matricule.length; i++) { hash = ((hash << 5) - hash) + matricule.charCodeAt(i); hash |= 0; } const hex = (hash >>> 0).toString(16).padStart(8, '0'); return `${hex.slice(0, 8)}-${hex.slice(0, 4)}-4${hex.slice(1, 4)}-8${hex.slice(0, 3)}-${hex.slice(0, 6).padEnd(12, '0')}`; }
  getStatusLabel(s?: string): string { if (!s || s === 'VALIDATED') return 'Validé'; if (s === 'PENDING') return 'En attente'; if (s === 'CANCELLED') return 'Annulé'; return s; }
  getStatusClass(s?: string): string { if (!s || s === 'VALIDATED') return 'badge-success'; if (s === 'PENDING') return 'badge-warning'; if (s === 'CANCELLED') return 'badge-danger'; return 'badge-neutral'; }
  showToast(msg: string, type: 'success' | 'error') { this.toastMsg.set(msg); this.toastType.set(type); if (type === 'success') { this.toast.success(msg, 'Mouvements'); } else { this.toast.error(msg, 'Mouvements'); } setTimeout(() => this.toastMsg.set(''), 4000); }

  exportMovementsCsv(): void {
    const list = this.filtered();
    if (list.length === 0) {
      this.toast.warning('Aucun mouvement à exporter.', 'Export CSV');
      return;
    }
    const headers = ['ID', 'Référence', 'Produit', 'Type', 'Quantité', 'Date', 'Statut', 'Motif'];
    const rows = list.map(m => [
      m.id ?? '',
      `"${m.reference || m.referenceNumber || ''}"`,
      `"${m.product?.designation || m.product?.sku || ''}"`,
      `"${this.getLabel(m.type)}"`,
      m.quantity ?? 0,
      `"${m.createdAt || m.requestedAt ? String(m.createdAt || m.requestedAt).substring(0, 10) : ''}"`,
      `"${this.getStatusLabel(m.status)}"`,
      `"${(m.notes || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `mouvements_stock_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.toast.success(`${list.length} mouvement(s) exporté(s) en CSV.`, 'Export CSV');
  }

  ngOnDestroy() { this.d$.next(); this.d$.complete(); }
}
