import { Component, OnInit, signal, inject, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../../../../core/auth/auth.service';
import { CommercialService, VenteBE, AvoirBE } from '../../../infrastructure/commercial.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';

@Component({
  selector: 'app-commercial-ventes',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, FormsModule],
  templateUrl: './commercial-ventes.component.html',
  styleUrls: ['./commercial-ventes.component.css']
})
export class CommercialVentesComponent implements OnInit, OnDestroy {
  private d$ = new Subject<void>();
  private svc = inject(CommercialService);
  private auth = inject(AuthService);

  loading = signal(true);
  ventes = signal<VenteBE[]>([]);
  fCFA = (n: number) => new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA';

  showAnnuler = signal(false);
  showNonMarchand = signal(false);
  showAvoir = signal(false);
  selectedNumero = '';
  annulerMotif = '';
  saving = signal(false);

  nmTypeVente = 'DON';
  nmCodeClient = '';
  nmCodeProduit = '';
  nmDesignation = '';
  nmConditionnement = 'CARTON';
  nmQuantite = 1;
  nmMotif = '';

  avoirMotif = '';
  avoirs = signal<AvoirBE[]>([]);

  toastMsg = signal('');
  toastType = signal<'success' | 'error'>('success');

  ngOnInit(): void {
    this.chargerVentes();
  }

  chargerVentes(): void {
    this.loading.set(true);
    const now = new Date();
    const debut = new Date(now.getFullYear(), now.getMonth(), 1);
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    this.svc.getVentes(fmt(debut), fmt(now)).pipe(takeUntil(this.d$)).subscribe({
      next: page => { this.ventes.set(page.contenu); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  finaliserVente(numero: string): void {
    this.svc.finaliserVente(numero).pipe(takeUntil(this.d$)).subscribe({
      next: v => this.ventes.update(list => list.map(x => x.numeroVente === numero ? v : x)),
      error: (e) => this.showToast(extractApiError(e), 'error'),
    });
  }

  openAnnuler(numero: string): void {
    this.selectedNumero = numero;
    this.annulerMotif = '';
    this.showAnnuler.set(true);
  }

  confirmerAnnuler(): void {
    if (this.saving() || !this.annulerMotif) return;
    this.saving.set(true);
    this.svc.annulerVente(this.selectedNumero, this.annulerMotif).pipe(takeUntil(this.d$)).subscribe({
      next: v => {
        this.ventes.update(list => list.map(x => x.numeroVente === this.selectedNumero ? v : x));
        this.saving.set(false);
        this.showAnnuler.set(false);
        this.showToast('Vente annulée.', 'success');
      },
      error: (e) => { this.saving.set(false); this.showToast(extractApiError(e), 'error'); },
    });
  }

  openNonMarchand(): void {
    this.nmTypeVente = 'DON';
    this.nmCodeClient = '';
    this.nmCodeProduit = '';
    this.nmDesignation = '';
    this.nmQuantite = 1;
    this.nmMotif = '';
    this.showNonMarchand.set(true);
  }

  confirmerNonMarchand(): void {
    if (this.saving() || !this.nmCodeClient || !this.nmCodeProduit) return;
    this.saving.set(true);
    const matricule = this.auth.user()?.matricule ?? '';
    const now = new Date();
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    this.svc.declarerNonMarchand({
      typeVente: this.nmTypeVente,
      matriculeCommercial: matricule,
      codeClient: this.nmCodeClient,
      codeProduit: this.nmCodeProduit,
      designationProduit: this.nmDesignation,
      conditionnement: this.nmConditionnement,
      quantite: this.nmQuantite,
      date: fmt(now),
      motif: this.nmMotif,
    }).pipe(takeUntil(this.d$)).subscribe({
      next: v => {
        this.ventes.update(list => [v, ...list]);
        this.saving.set(false);
        this.showNonMarchand.set(false);
        this.showToast('Transaction non marchande enregistrée.', 'success');
      },
      error: (e) => { this.saving.set(false); this.showToast(extractApiError(e), 'error'); },
    });
  }

  openAvoir(numero: string): void {
    this.selectedNumero = numero;
    this.avoirMotif = '';
    this.showAvoir.set(true);
  }

  confirmerAvoir(): void {
    if (this.saving() || !this.avoirMotif) return;
    this.saving.set(true);
    this.svc.emettreAvoir(this.selectedNumero, {
      matriculeComptable: this.auth.user()?.matricule ?? '',
      motif: this.avoirMotif,
    }).pipe(takeUntil(this.d$)).subscribe({
      next: a => {
        this.avoirs.update(list => [a, ...list]);
        this.saving.set(false);
        this.showAvoir.set(false);
        this.showToast(`Avoir ${a.numeroAvoir} émis.`, 'success');
      },
      error: (e) => { this.saving.set(false); this.showToast(extractApiError(e), 'error'); },
    });
  }

  validerAvoir(numeroAvoir: string): void {
    this.svc.validerAvoir(numeroAvoir).pipe(takeUntil(this.d$)).subscribe({
      next: a => this.avoirs.update(list => list.map(x => x.numeroAvoir === numeroAvoir ? a : x)),
      error: (e) => this.showToast(extractApiError(e), 'error'),
    });
  }

  statutClass(s: string): string {
    const map: Record<string, string> = {
      EN_COURS: 'badge bg-orange', FINALISEE: 'badge bg-success', ANNULEE: 'badge bg-red',
    };
    return map[s] ?? 'badge bg-neutral';
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
