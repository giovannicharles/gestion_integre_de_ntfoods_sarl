import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../../../../../core/auth/auth.service';
import { ComptableService, VersementBE } from '../../../infrastructure/comptable.service';
import { StockService, SessionCommercialBE } from '../../../../stock/infrastructure/stock.service';

/**
 * Validation comptable des fins de tournée.
 *
 * Dernière étape du cycle : les tournées déjà rapprochées par la secrétaire sont
 * contrôlées puis clôturées définitivement. Cet écran n'existait pas — la méthode
 * de validation était présente dans le service mais n'était appelée nulle part,
 * si bien qu'aucune session ne pouvait atteindre son terme.
 */
@Component({
  selector: 'app-comptable-sessions',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './comptable-sessions.component.html',
  styleUrls: ['./comptable-sessions.component.css'],
})
export class ComptableSessionsComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly svc = inject(ComptableService);
  private readonly stockSvc = inject(StockService);

  today = new Date();
  fCFA = (n: number) => new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA';

  loading = signal(false);
  traitementEnCours = signal<string | null>(null);
  message = signal<{ texte: string; type: 'succes' | 'erreur' } | null>(null);

  /** Tournées rapprochées par la secrétaire, en attente de validation comptable. */
  sessionsAValider = signal<SessionCommercialBE[]>([]);
  /** Tournées déjà clôturées, pour vérification a posteriori. */
  sessionsTerminees = signal<SessionCommercialBE[]>([]);
  versements = signal<VersementBE[]>([]);

  totalAValider = computed(() =>
    this.sessionsAValider().reduce((s, sess) => s + (this.versementDe(sess.matriculeCommercial)?.cashVerse ?? 0), 0)
  );
  nbEcartsNonJustifies = computed(() =>
    this.sessionsAValider().filter(s => {
      const v = this.versementDe(s.matriculeCommercial);
      return v?.alerteRouge && !v.justificationEcart;
    }).length
  );

  ngOnInit(): void {
    this.charger();
  }

  private charger(): void {
    this.loading.set(true);
    forkJoin({
      aValider: this.stockSvc.getSessionsParStatut('VALIDE_SECRETAIRE')
        .pipe(catchError(() => of([] as SessionCommercialBE[]))),
      terminees: this.stockSvc.getSessionsParStatut('TERMINEE')
        .pipe(catchError(() => of([] as SessionCommercialBE[]))),
      versements: this.svc.getVersements({ date: this.fmtDate(new Date()) })
        .pipe(catchError(() => of([] as VersementBE[]))),
    }).subscribe({
      next: ({ aValider, terminees, versements }) => {
        this.sessionsAValider.set(aValider);
        this.sessionsTerminees.set(terminees);
        this.versements.set(versements);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.afficher("Les sessions n'ont pas pu être chargées.", 'erreur');
      },
    });
  }

  versementDe(matricule: string): VersementBE | undefined {
    return this.versements().find(v => v.matriculeCommercial === matricule);
  }

  valider(session: SessionCommercialBE): void {
    const v = this.versementDe(session.matriculeCommercial);
    if (v?.alerteRouge && !v.justificationEcart) {
      this.afficher(
        `L'écart de ${this.fCFA(v.ecart)} sur la tournée ${session.numeroSession} n'est pas justifié : `
        + `la validation clôturerait le cycle sur un manquant inexpliqué.`, 'erreur');
      return;
    }

    this.traitementEnCours.set(session.numeroSession);
    this.stockSvc.validerSessionComptable(session.numeroSession, this.matricule()).subscribe({
      next: () => {
        this.traitementEnCours.set(null);
        this.afficher(`Tournée ${session.numeroSession} clôturée définitivement.`, 'succes');
        this.charger();
      },
      error: (e) => {
        this.traitementEnCours.set(null);
        this.afficher(this.messageErreur(e), 'erreur');
      },
    });
  }

  ecartClass(ecart: number): string {
    if (ecart > 0) return 'ecart-pos';
    if (ecart < 0) return 'ecart-neg';
    return 'ecart-ok';
  }

  private afficher(texte: string, type: 'succes' | 'erreur'): void {
    this.message.set({ texte, type });
  }

  private messageErreur(e: unknown): string {
    const err = e as { error?: { message?: string; erreur?: string } };
    return err?.error?.erreur ?? err?.error?.message ?? "La validation n'a pas abouti.";
  }

  private matricule(): string {
    return this.auth.user()?.matricule ?? '';
  }

  private fmtDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
