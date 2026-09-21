import { Component, OnInit, signal, inject, computed, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { DotationUseCase } from '../../../application/use-cases/dotation/dotation.use-case';
import { AuthService } from '../../../../../core/auth/auth.service';
import { ApiService } from '../../../../../core/http/api.service';
import { DotationRequest, DotationItem } from '../../../domain/models';

type ActionMode = 'verifyPayment' | 'validateQuantities' | 'reviewAndApprove' | 'approve' | 'reject' | 'execute' | 'delete' | null;

@Component({
  selector: 'app-dotation-list',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, FormsModule, RouterLink],
  templateUrl: './dotation-list.component.html',
  styleUrls: ['./dotation-list.component.css']
})
export class DotationListComponent implements OnInit, OnDestroy {
  private d$ = new Subject<void>();
  private uc = inject(DotationUseCase);
  private auth = inject(AuthService);
  private router = inject(Router);
  private api = inject(ApiService);

  loading = signal(true);
  error = signal('');
  all = signal<DotationRequest[]>([]);
  filtered = signal<DotationRequest[]>([]);
  paginated = signal<DotationRequest[]>([]);
  pageSize = 10;
  currentPage = signal(1);
  totalPages = signal(1);
  search = '';
  filterStatut = '';

  selected = signal<DotationRequest | null>(null);
  actionMode = signal<ActionMode>(null);
  rejectReason = '';
  validationComments = '';
  editedItems = signal<DotationItem[]>([]);
  processing = signal(false);

  toastMsg = signal('');
  toastType = signal<'success' | 'error'>('success');

  Math = Math;

  // Role-based action visibility
  userRoles = computed(() => this.auth.getCurrentUser()?.roles || []);
  canVerifyPayment = computed(() => this.userRoles().some(r => ['SECRETAIRE', 'ADMIN'].includes(r)));
  canValidateQuantities = computed(() => this.userRoles().some(r => ['COMPTABLE', 'ADMIN'].includes(r)));
  canManageStock = computed(() => this.userRoles().some(r => ['GESTIONNAIRE_STOCK', 'ADMIN'].includes(r)));
  canCreateDotation = computed(() => this.userRoles().some(r => ['COMMERCIAL', 'ADMIN'].includes(r)));

  get pages() {
    return Array.from({ length: this.totalPages() }, (_, i) => i + 1);
  }

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.uc.getAll().pipe(takeUntil(this.d$)).subscribe({
      next: r => {
        this.all.set(r);
        this.applyFilters();
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Erreur de chargement des dotations. Vérifiez la connexion au serveur.');
      }
    });
  }

  applyFilters() {
    let result = [...this.all()];

    if (this.search) {
      const s = this.search.toLowerCase();
      result = result.filter((d: DotationRequest) =>
        (d.referenceNumber || '').toLowerCase().includes(s) ||
        (d.commercialName || '').toLowerCase().includes(s)
      );
    }

    if (this.filterStatut) {
      result = result.filter((d: DotationRequest) => d.status === this.filterStatut);
    }

    this.filtered.set(result);
    this.updatePag();
  }

  clearFilters() {
    this.search = '';
    this.filterStatut = '';
    this.applyFilters();
  }

  updatePag() {
    const t = Math.ceil(this.filtered().length / this.pageSize) || 1;
    this.totalPages.set(t);
    this.goToPage(1);
  }

  goToPage(p: number) {
    const n = Math.max(1, Math.min(p, this.totalPages()));
    this.currentPage.set(n);
    const s = (n - 1) * this.pageSize;
    this.paginated.set(this.filtered().slice(s, s + this.pageSize));
  }

  getEndIndex(): number {
    return Math.min(this.currentPage() * this.pageSize, this.filtered().length);
  }

  countStatus(s: string): number {
    return this.all().filter((d: DotationRequest) => d.status === s).length;
  }

  openDetail(d: DotationRequest) {
    this.selected.set(d);
    this.actionMode.set(null);
  }

  closeDetail() {
    this.selected.set(null);
    this.actionMode.set(null);
  }

  openAction(mode: ActionMode) {
    this.actionMode.set(mode);
    this.rejectReason = '';
    this.validationComments = '';
    if (mode === 'validateQuantities' || mode === 'reviewAndApprove') {
      this.editedItems.set(this.selected()!.items.map(i => ({ ...i })));
    }
  }

  updateApprovedQty(index: number, qty: number) {
    const items = [...this.editedItems()];
    items[index] = { ...items[index], approvedQuantity: qty };
    this.editedItems.set(items);
  }

  confirmAction() {
    const d = this.selected();
    const mode = this.actionMode();
    if (!d || !d.id || !mode) return;

    this.processing.set(true);
    const user = this.auth.getCurrentUser();
    const matricule = user?.matricule || 'system';

    let obs$: any;
    switch (mode) {
      case 'verifyPayment':
        obs$ = this.uc.verifyPayment(d.id, matricule);
        break;
      case 'validateQuantities':
        obs$ = this.uc.validateQuantities(d.id, matricule, this.validationComments || '', this.editedItems());
        break;
      case 'reviewAndApprove':
        obs$ = this.uc.reviewAndApprove(d.id, matricule, this.validationComments || '', this.editedItems());
        break;
      case 'approve':
        obs$ = this.uc.approve(d.id, matricule);
        break;
      case 'reject':
        obs$ = this.uc.reject(d.id, matricule, this.rejectReason || 'Rejeté via interface');
        break;
      case 'execute':
        obs$ = this.uc.execute(d.id, matricule);
        break;
      case 'delete':
        obs$ = this.uc.delete(d.id);
        break;
      default:
        return;
    }

    obs$.pipe(takeUntil(this.d$)).subscribe({
      next: () => {
        this.processing.set(false);
        const msg = mode === 'verifyPayment' ? 'Paiement vérifié.'
          : mode === 'validateQuantities' ? 'Quantités validées par le comptable.'
          : mode === 'reviewAndApprove' ? 'Quantités révisées et dotation approuvée par le gestionnaire.'
          : mode === 'approve' ? 'Dotation approuvée par le gestionnaire.'
          : mode === 'reject' ? 'Dotation rejetée.'
          : mode === 'execute' ? 'Livraison effectuée. Stock mobile mis à jour.'
          : 'Dotation supprimée.';
        this.showToast(msg, 'success');
        this.closeDetail();
        this.load();
      },
      error: (err: any) => {
        this.processing.set(false);
        this.showToast(err?.error?.message || 'Erreur lors de l\'opération.', 'error');
      }
    });
  }

  sLabel(s: string) {
    const m: Record<string, string> = {
      PENDING: 'En attente paiement',
      PAYMENT_VERIFIED: 'Paiement vérifié',
      QUANTITY_VALIDATED: 'Quantités validées',
      REVIEWED: 'Révisé',
      APPROVED: 'Approuvé',
      REJECTED: 'Rejeté',
      COMPLETED: 'Livré'
    };
    return m[s] || s;
  }

  sClass(s: string) {
    const m: Record<string, string> = {
      PENDING: 'badge-warning',
      PAYMENT_VERIFIED: 'badge-secondary',
      QUANTITY_VALIDATED: 'badge-info',
      REVIEWED: 'badge-primary',
      APPROVED: 'badge-success',
      REJECTED: 'badge-danger',
      COMPLETED: 'badge-success'
    };
    return m[s] || 'badge-neutral';
  }

  sIcon(s: string) {
    const m: Record<string, string> = {
      PENDING: 'fa-hourglass-half',
      PAYMENT_VERIFIED: 'fa-money-check-dollar',
      QUANTITY_VALIDATED: 'fa-calculator',
      REVIEWED: 'fa-clipboard-check',
      APPROVED: 'fa-check-circle',
      REJECTED: 'fa-xmark-circle',
      COMPLETED: 'fa-truck-fast'
    };
    return m[s] || 'fa-circle';
  }

  stepLabel(s: string): string {
    const m: Record<string, string> = {
      PENDING: 'Étape 1/4 — En attente vérification paiement (Secrétaire)',
      PAYMENT_VERIFIED: 'Étape 2/4 — En attente validation quantités (Comptable)',
      QUANTITY_VALIDATED: 'Étape 3/4 — En attente révision / approbation (Gestionnaire de stock)',
      REVIEWED: 'Étape 3/4 — Révisé, en attente approbation finale (Gestionnaire de stock)',
      APPROVED: 'Étape 4/4 — En attente livraison (Gestionnaire de stock)',
      REJECTED: 'Demande rejetée',
      COMPLETED: 'Dotation livrée'
    };
    return m[s] || s;
  }

  getWorkflowStep(status: string): number {
    const steps: Record<string, number> = {
      PENDING: 0, PAYMENT_VERIFIED: 1, QUANTITY_VALIDATED: 2,
      REVIEWED: 2, APPROVED: 3, COMPLETED: 4, REJECTED: -1
    };
    return steps[status] ?? 0;
  }

  getWorkflowSteps(d: DotationRequest) {
    const current = this.getWorkflowStep(d.status);
    const isRejected = d.status === 'REJECTED';
    return [
      { label: 'Précommande', actor: d.commercialName || '—', icon: 'fa-cart-plus', color: '#0277D5',
        done: current >= 0, current: current === 0 && !isRejected, timestamp: d.requestedAt },
      { label: 'Vérification paiement', actor: d.paymentVerifiedBy || 'Secrétaire', icon: 'fa-money-check-dollar', color: '#D97706',
        done: current >= 1, current: current === 1 && !isRejected, timestamp: d.paymentVerifiedAt },
      { label: 'Arbitrage quantités', actor: d.quantityValidatedBy || 'Comptable', icon: 'fa-calculator', color: '#7C3AED',
        done: current >= 2, current: current === 2 && !isRejected, timestamp: d.quantityValidatedAt },
      { label: 'Approbation', actor: d.reviewedBy || d.approvedBy || 'Gestionnaire', icon: 'fa-clipboard-check', color: '#14532D',
        done: current >= 3, current: current === 3 && !isRejected, timestamp: d.reviewedAt || d.approvedAt },
      { label: 'Livraison', actor: d.deliveredBy || 'Gestionnaire', icon: 'fa-truck-fast', color: '#15803D',
        done: current >= 4, current: current === 4 && !isRejected, timestamp: d.completedAt },
    ];
  }

  getProgressPct(status: string): number {
    const step = this.getWorkflowStep(status);
    if (step < 0) return 0;
    return Math.round((step / 4) * 100);
  }

  showToast(msg: string, type: 'success' | 'error') {
    this.toastMsg.set(msg);
    this.toastType.set(type);
    setTimeout(() => this.toastMsg.set(''), 4500);
  }

  downloadFicheSynthese(id: number) {
    this.api.getBlob(`stock/dotations/${id}/fiche-synthese`).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fiche_synthese_${id}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      },
      error: () => this.showToast('Erreur lors du téléchargement de la fiche.', 'error')
    });
  }

  ngOnDestroy() {
    this.d$.next();
    this.d$.complete();
  }
}