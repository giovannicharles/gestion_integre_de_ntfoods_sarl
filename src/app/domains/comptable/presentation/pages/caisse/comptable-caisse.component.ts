import { Component, OnInit, signal, inject, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { ComptableService, CaisseBE } from '../../../infrastructure/comptable.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';

@Component({
  selector: 'app-comptable-caisse',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, FormsModule],
  templateUrl: './comptable-caisse.component.html',
  styleUrls: ['./comptable-caisse.component.css']
})
export class ComptableCaisseComponent implements OnInit, OnDestroy {
  private d$ = new Subject<void>();
  private svc = inject(ComptableService);

  loading = signal(true);
  caisse = signal<CaisseBE | null>(null);
  historique = signal<CaisseBE[]>([]);
  today = new Date();
  showOuvrir = signal(false);
  showMouvement = signal(false);
  mouvementType: 'ENTREE' | 'SORTIE' = 'ENTREE';
  soldeInitial = 0;
  refOperation = '';
  montant = 0;
  motif = '';
  saving = signal(false);
  toastMsg = signal('');
  toastType = signal<'success' | 'error'>('success');

  get todayStr() {
    return this.today.toISOString().split('T')[0];
  }

  ngOnInit(): void {
    this.chargerCaisseJour();
    this.chargerHistorique();
  }

  chargerCaisseJour(): void {
    this.loading.set(true);
    this.svc.getCaisse(this.todayStr).pipe(takeUntil(this.d$)).subscribe({
      next: c => { this.caisse.set(c); this.loading.set(false); },
      error: () => { this.caisse.set(null); this.loading.set(false); },
    });
  }

  chargerHistorique(): void {
    const debut = new Date(this.today.getFullYear(), this.today.getMonth(), 1).toISOString().split('T')[0];
    this.svc.getCaisseParPeriode(debut, this.todayStr).pipe(takeUntil(this.d$)).subscribe({
      next: list => this.historique.set(list),
      error: () => {},
    });
  }

  ouvrirCaisse(): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.svc.ouvrirCaisse({ soldeInitial: this.soldeInitial }).pipe(takeUntil(this.d$)).subscribe({
      next: c => {
        this.caisse.set(c);
        this.saving.set(false);
        this.showOuvrir.set(false);
        this.soldeInitial = 0;
        this.showToast('Caisse ouverte pour aujourd\'hui.', 'success');
      },
      error: (e) => {
        this.saving.set(false);
        this.showToast(extractApiError(e), 'error');
      },
    });
  }

  enregistrerMouvement(): void {
    if (this.saving() || !this.montant || !this.motif) return;
    this.saving.set(true);
    const matricule = 'CURRENT_USER';
    const req = {
      referenceOperation: this.refOperation || `MAN-${Date.now()}`,
      montant: this.montant,
      motif: this.motif,
      matriculeOperateur: matricule,
    };
    const obs = this.mouvementType === 'ENTREE'
      ? this.svc.entreeCaisse(this.todayStr, req)
      : this.svc.sortieCaisse(this.todayStr, req);

    obs.pipe(takeUntil(this.d$)).subscribe({
      next: c => {
        this.caisse.set(c);
        this.saving.set(false);
        this.showMouvement.set(false);
        this.montant = 0;
        this.motif = '';
        this.refOperation = '';
        this.showToast(`${this.mouvementType === 'ENTREE' ? 'Entrée' : 'Sortie'} enregistrée.`, 'success');
      },
      error: (e) => {
        this.saving.set(false);
        this.showToast(extractApiError(e), 'error');
      },
    });
  }

  fCFA(n: number): string {
    return new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA';
  }

  showToast(msg: string, type: 'success' | 'error'): void {
    this.toastMsg.set(msg);
    this.toastType.set(type);
    setTimeout(() => this.toastMsg.set(''), 4000);
  }

  ngOnDestroy(): void {
    this.d$.next();
    this.d$.complete();
  }
}
