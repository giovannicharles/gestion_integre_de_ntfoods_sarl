// ═══ FICHIER : validation.component.ts ═══
// Réécrit : l'ancienne version appelait uc.getPending() (inexistant), passait r.id
// (number) aux méthodes de validation qui attendent désormais le receiptNumber, et
// affichait des montants FCFA — une violation du principe d'isolation financière du
// module Stock (seules les quantités physiques doivent y apparaître).
import { Component, OnInit, signal, inject, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { Subject, forkJoin, of, takeUntil } from 'rxjs';
import { ReceiptUseCase } from '../../../application/use-cases/reception/receipt.use-case';
import { AuthService } from '../../../../../core/auth/auth.service';
import { Receipt, ReceptionType } from '../../../domain/models/stock.models';

type ValidationAction = 'v1' | 'v2' | 'rej';

@Component({
  selector: 'app-validation',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, FormsModule, RouterLink],
  templateUrl: './validation.component.html',
  styleUrls: ['./validation.component.css']
})
export class ValidationComponent implements OnInit, OnDestroy {
  private d$ = new Subject<void>();
  private uc = inject(ReceiptUseCase);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private filterType: ReceptionType | null = null;

  loading = signal(true);
  firstPending = signal<Receipt[]>([]);
  secondPending = signal<Receipt[]>([]);
  selected = signal<Receipt | null>(null);
  action = signal<ValidationAction | null>(null);
  notes = '';
  authCode = '';
  rejectReason = '';
  processing = signal(false);
  toastMsg = signal('');
  toastType = signal<'success' | 'error'>('success');

  ngOnInit() {
    this.filterType = (this.route.snapshot.data?.['filterType'] as ReceptionType) ?? null;
    this.load();
  }

  load() {
    this.loading.set(true);
    const first$ = this.canValidateFirst() ? this.uc.getPendingFirstValidation(this.filterType ?? undefined) : of([]);
    const second$ = this.canValidateSecond() ? this.uc.getPendingSecondValidation(this.filterType ?? undefined) : of([]);
    forkJoin({
      first: first$,
      second: second$
    }).pipe(takeUntil(this.d$)).subscribe({
      next: ({ first, second }) => {
        this.firstPending.set(first);
        this.secondPending.set(second);
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.showToast('Erreur de chargement.', 'error'); }
    });
  }

  openAction(r: Receipt, a: ValidationAction) {
    this.selected.set(r);
    this.action.set(a);
    this.notes = '';
    this.authCode = '';
    this.rejectReason = '';
  }
  closeAction() { this.selected.set(null); this.action.set(null); }

  confirm() {
    const r = this.selected(); const a = this.action();
    if (!r) return;
    this.processing.set(true);
    const obs$ = a === 'v1' ? this.uc.validateFirst(r.receiptNumber, this.notes, this.authCode)
      : a === 'v2' ? this.uc.validateSecond(r.receiptNumber, this.notes, this.authCode)
      : this.uc.reject(r.receiptNumber, this.rejectReason);
    obs$.pipe(takeUntil(this.d$)).subscribe({
      next: () => {
        this.processing.set(false);
        this.closeAction();
        this.showToast(
          a === 'rej' ? 'Réception rejetée.' : a === 'v1' ? '1ère validation effectuée.' : 'Validation finale effectuée. Stock mis à jour.',
          'success'
        );
        this.load();
      },
      error: (err) => {
        this.processing.set(false);
        this.showToast(err?.error?.message || 'Erreur lors de la validation.', 'error');
      }
    });
  }

  itemCount(r: Receipt) { return r.items.length; }
  hasDeviations(r: Receipt) { return r.items.some(i => !i.exactMatch); }

  canValidateFirst() {
    return this.auth.hasAnyRole(['GESTIONNAIRE_STOCK', 'CHEF_PRODUCTION', 'ADMIN', 'DIRECTEUR_GENERAL']);
  }
  canValidateSecond() {
    return this.auth.hasAnyRole(['GESTIONNAIRE_STOCK', 'COMPTABLE', 'CONTROLEUR_GENERAL', 'ADMIN', 'DIRECTEUR_GENERAL']);
  }
  isSecondRoleOnly() {
    return !this.canValidateFirst() && this.canValidateSecond();
  }
  currentRoles(): string {
    return this.auth.getCurrentUser()?.roles?.join(', ') ?? '';
  }

  sLabel(s: string) {
    const m: Record<string, string> = { PENDING_FIRST_VALIDATION: 'Att. 1ère val.', PENDING_SECOND_VALIDATION: 'Att. 2ème val.' };
    return m[s] || s;
  }
  sClass(s: string) {
    const m: Record<string, string> = { PENDING_FIRST_VALIDATION: 'badge-warning', PENDING_SECOND_VALIDATION: 'badge-primary' };
    return m[s] || 'badge-neutral';
  }

  showToast(msg: string, type: 'success' | 'error') {
    this.toastMsg.set(msg);
    this.toastType.set(type);
    setTimeout(() => this.toastMsg.set(''), 4500);
  }

  ngOnDestroy() { this.d$.next(); this.d$.complete(); }
}
