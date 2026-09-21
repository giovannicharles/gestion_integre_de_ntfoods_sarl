import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  TarificationService, GrilleTarifaireBE, PrixExceptionnelBE, SegmentClient,
} from '../../../infrastructure/tarification.service';
import { fCFA } from '../../../../../shared/utils/format.utils';

/**
 * Grille tarifaire homologuée et surveillance des dérogations.
 *
 * <p>Le serveur refusait déjà toute vente saisie hors grille, mais aucun écran ne
 * permettait de fixer un prix homologué : la règle était opposable sans être
 * administrable.</p>
 *
 * <p>L'octroi d'un prix exceptionnel se fait directement depuis cet écran, sans
 * code OTP : l'accès est réservé au DG, au Directeur Commercial, à la Chargée
 * RP & Commercial et au Comptable par la permission
 * COMMERCIAL_PRIX_EXCEPTIONNEL_GERER.</p>
 */
@Component({
  selector: 'app-tarification',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './tarification.component.html',
  styleUrls: ['./tarification.component.css'],
})
export class TarificationComponent implements OnInit {
  private readonly svc = inject(TarificationService);

  fCFA = fCFA;

  loading = signal(false);
  traitementEnCours = signal(false);
  message = signal<{ texte: string; type: 'succes' | 'erreur' } | null>(null);

  grille = signal<GrilleTarifaireBE[]>([]);
  derogations = signal<PrixExceptionnelBE[]>([]);

  readonly segments: SegmentClient[] =
    ['DETAIL', 'GROSSISTE', 'SEMI_GROSSISTE', 'DISTRIBUTEUR', 'REVENDEUR'];

  filtreSegment = signal<SegmentClient | ''>('');

  // Formulaire d'homologation
  codeProduit = signal('');
  segment = signal<SegmentClient>('DETAIL');
  prix = signal<number | null>(null);

  // Formulaire de dérogation (prix exceptionnel)
  derogTraitementEnCours = signal(false);
  derogCodeProduit = signal('');
  derogCodeClient = signal('');
  derogPrix = signal<number | null>(null);
  derogMotif = signal('');

  grilleFiltree = computed(() => {
    const s = this.filtreSegment();
    return s ? this.grille().filter(g => g.segment === s) : this.grille();
  });

  nbProduits = computed(() => new Set(this.grille().map(g => g.codeProduit)).size);
  ecartDerogations = computed(() =>
    this.derogations().reduce((s, d) => s + Math.abs(d.ecartFCFA), 0)
  );

  /** Prix déjà homologué pour le couple en cours de saisie, s'il existe. */
  prixExistant = computed(() => {
    const code = this.codeProduit().trim().toUpperCase();
    if (!code) return null;
    return this.grille().find(g => g.codeProduit === code && g.segment === this.segment()) ?? null;
  });

  ngOnInit(): void {
    this.charger();
  }

  private charger(): void {
    this.loading.set(true);
    const fin = new Date();
    const debut = new Date();
    debut.setDate(debut.getDate() - 30);

    forkJoin({
      grille: this.svc.getGrille().pipe(catchError(() => of([] as GrilleTarifaireBE[]))),
      derogations: this.svc.getDerogations(this.iso(debut), this.iso(fin))
        .pipe(catchError(() => of([] as PrixExceptionnelBE[]))),
    }).subscribe({
      next: ({ grille, derogations }) => {
        this.grille.set(grille);
        this.derogations.set(derogations);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.afficher("La grille tarifaire n'a pas pu être chargée.", 'erreur');
      },
    });
  }

  formulaireValide(): boolean {
    const p = this.prix();
    return this.codeProduit().trim().length > 0 && p !== null && Number.isFinite(p) && p > 0;
  }

  homologuer(): void {
    if (!this.formulaireValide()) return;

    const existant = this.prixExistant();
    this.traitementEnCours.set(true);
    this.svc.definirPrix({
      codeProduit: this.codeProduit().trim().toUpperCase(),
      segment: this.segment(),
      prixHomologueFCFA: this.prix()!,
    }).subscribe({
      next: (g) => {
        this.traitementEnCours.set(false);
        this.codeProduit.set('');
        this.prix.set(null);
        this.afficher(
          existant
            ? `Prix de ${g.codeProduit} (${g.segment}) révisé : ${this.fCFA(existant.prixHomologueFCFA)} → ${this.fCFA(g.prixHomologueFCFA)}.`
            : `Prix de ${g.codeProduit} (${g.segment}) homologué à ${this.fCFA(g.prixHomologueFCFA)}.`,
          'succes');
        this.charger();
      },
      error: (e) => {
        this.traitementEnCours.set(false);
        this.afficher(this.messageErreur(e), 'erreur');
      },
    });
  }

  derogationValide(): boolean {
    const p = this.derogPrix();
    return this.derogCodeProduit().trim().length > 0
      && this.derogCodeClient().trim().length > 0
      && this.derogMotif().trim().length > 0
      && p !== null && Number.isFinite(p) && p > 0;
  }

  accorderDerogation(): void {
    if (!this.derogationValide()) return;

    this.derogTraitementEnCours.set(true);
    this.svc.accorderPrixExceptionnel({
      codeProduit: this.derogCodeProduit().trim().toUpperCase(),
      codeClient: this.derogCodeClient().trim().toUpperCase(),
      prixAppliqueFCFA: this.derogPrix()!,
      motif: this.derogMotif().trim(),
    }).subscribe({
      next: (d) => {
        this.derogTraitementEnCours.set(false);
        this.derogCodeProduit.set('');
        this.derogCodeClient.set('');
        this.derogPrix.set(null);
        this.derogMotif.set('');
        this.afficher(`Prix exceptionnel ${d.reference} accordé pour ${d.codeClient}.`, 'succes');
        this.charger();
      },
      error: (e) => {
        this.derogTraitementEnCours.set(false);
        this.afficher(this.messageErreur(e), 'erreur');
      },
    });
  }

  ecartClass(ecart: number): string {
    if (ecart > 0) return 'ecart-pos';
    if (ecart < 0) return 'ecart-neg';
    return '';
  }

  private iso(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private afficher(texte: string, type: 'succes' | 'erreur'): void {
    this.message.set({ texte, type });
  }

  private messageErreur(e: unknown): string {
    const err = e as { error?: { message?: string; erreur?: string } };
    return err?.error?.erreur ?? err?.error?.message ?? "L'opération n'a pas abouti.";
  }
}
