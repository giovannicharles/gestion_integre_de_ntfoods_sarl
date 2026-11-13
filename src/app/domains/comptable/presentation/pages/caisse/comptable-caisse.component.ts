import { Component, OnInit, signal, computed, inject, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { ComptableService, CaisseBE } from '../../../infrastructure/comptable.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';
import { ToastService } from '../../../../../core/services/toast.service';

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
  private toast = inject(ToastService);

  loading = signal(true);
  caisse = signal<CaisseBE | null>(null);
  erreur = signal<string | null>(null);
  historique = signal<CaisseBE[]>([]);
  today = new Date();
  showOuvrir = signal(false);
  showMouvement = signal(false);
  showBilletageModal = signal(false);
  mouvementType: 'ENTREE' | 'SORTIE' = 'ENTREE';
  soldeInitial = 0;
  refOperation = '';
  montant = 0;
  motif = '';
  saving = signal(false);

  // Billetage pour PV de caisse
  billetage = signal({
    b10000: 0,
    b5000: 0,
    b2000: 0,
    b1000: 0,
    b500: 0,
    pieces: 0
  });

  readonly totalPhysiqueCompte = computed(() => {
    const b = this.billetage();
    return (b.b10000 * 10000) + (b.b5000 * 5000) + (b.b2000 * 2000) + (b.b1000 * 1000) + (b.b500 * 500) + (b.pieces || 0);
  });

  readonly ecartCaisse = computed(() => {
    const theorique = this.caisse()?.soldeCourant || 0;
    return this.totalPhysiqueCompte() - theorique;
  });

  readonly seuilDepasse = computed(() => {
    const c = this.caisse();
    if (!c || !c.seuilSecurisation) return false;
    return c.soldeCourant > c.seuilSecurisation;
  });

  private dateLocaleIso(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  get todayStr() {
    return this.dateLocaleIso(this.today);
  }

  ngOnInit(): void {
    this.chargerCaisseJour();
    this.chargerHistorique();
  }

  chargerCaisseJour(): void {
    this.loading.set(true);
    this.svc.getCaisse(this.todayStr).pipe(takeUntil(this.d$)).subscribe({
      next: c => { this.caisse.set(c); this.erreur.set(null); this.loading.set(false); },
      error: (e) => {
        this.caisse.set(null);
        this.erreur.set(e?.error?.erreur || e?.error?.message || 'Journal de caisse indisponible.');
        this.loading.set(false);
      },
    });
  }

  chargerHistorique(): void {
    const debut = this.dateLocaleIso(new Date(this.today.getFullYear(), this.today.getMonth(), 1));
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
        this.toast.success('Caisse ouverte pour aujourd\'hui.');
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.error(extractApiError(e));
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
        this.toast.success(`${this.mouvementType === 'ENTREE' ? 'Entrée' : 'Sortie'} de caisse enregistrée.`);
      },
      error: (e) => {
        this.saving.set(false);
        this.toast.error(extractApiError(e));
      },
    });
  }

  ouvrirBilletage(): void {
    this.showBilletageModal.set(true);
  }

  fermerBilletage(): void {
    this.showBilletageModal.set(false);
  }

  imprimerBilletage(): void {
    window.print();
  }

  exporterCsv(): void {
    const c = this.caisse();
    if (!c) return;
    const rows = [
      ['Date', 'Reference Operation', 'Type', 'Motif', 'Montant FCFA', 'Heure']
    ];
    for (const l of c.lignes) {
      rows.push([
        c.date,
        l.referenceOperation,
        l.typeMouvement,
        l.motif,
        l.montant.toString(),
        new Date(l.dateOperation).toLocaleTimeString('fr-FR')
      ]);
    }
    const csvContent = '\uFEFF' + rows.map(r => r.map(col => `"${String(col).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `journal_caisse_${c.date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.toast.success('Brouillard de caisse exporté en CSV');
  }

  fCFA(n: number): string {
    return new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA';
  }

  ngOnDestroy(): void {
    this.d$.next();
    this.d$.complete();
  }
}
