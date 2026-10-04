import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ComptableService, ObjectifCommercialBE, PrimeSemaineBE } from '../../../infrastructure/comptable.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';
import { fCFA } from '../../../../../shared/utils/format.utils';
import { AuthService } from '../../../../../core/auth/auth.service';

interface LigneCommercial {
  matriculeCommercial: string;
  objectif: ObjectifCommercialBE | null;
  prime: PrimeSemaineBE | null;
}

/**
 * Gestion des primes hebdomadaires — calcul, validation, versement.
 *
 * Le calcul (règle 80/75) est entièrement fait par le serveur à partir du
 * barème en vigueur : cet écran ne fait que transmettre la réalisation de la
 * semaine (CA global + détail par gamme), qui n'existe nulle part ailleurs de
 * façon fiable dans l'API (le contrôleur backend le dit explicitement : cette
 * agrégation est fournie par l'appelant). Les gammes proposées dans le
 * formulaire sont reprises telles quelles de l'objectif fixé pour ce
 * commercial cette semaine — jamais inventées.
 */
@Component({
  selector: 'app-comptable-primes',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './comptable-primes.component.html',
  styleUrls: ['./comptable-primes.component.css'],
})
export class ComptablePrimesComponent implements OnInit {
  private readonly cptSvc = inject(ComptableService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  fCFA = fCFA;
  /** Verser un versement de prime est un acte comptable, pas une simple validation. */
  peutVerser = computed(() => this.auth.hasAnyRole(['COMPTABLE', 'ADMIN']));
  semaineDebut = signal(this.lundiCourant());
  loading = signal(true);
  loadError = signal<string | null>(null);
  lignes = signal<LigneCommercial[]>([]);

  totalAVerser = computed(() =>
    this.lignes().filter(l => l.prime?.statut === 'VALIDEE').reduce((s, l) => s + (l.prime?.montantPrimeFCFA ?? 0), 0)
  );
  nbEligibles = computed(() => this.lignes().filter(l => l.prime?.eligible).length);

  // ── Formulaire de calcul ────────────────────────────────────────────────
  showCalculForm = signal(false);
  calculPour = signal<ObjectifCommercialBE | null>(null);
  totalVentesGlobal = signal(0);
  realisationsParGamme = signal<Record<string, number>>({});
  saving = signal(false);

  gammesDuCalcul = computed(() => Object.keys(this.calculPour()?.objectifsParGammeFCFA ?? {}));

  ngOnInit(): void {
    this.charger();
  }

  private lundiCourant(): string {
    const today = new Date();
    const lundi = new Date(today);
    lundi.setDate(today.getDate() - today.getDay() + 1);
    return lundi.toISOString().split('T')[0];
  }

  changerSemaine(valeur: string): void {
    if (!valeur) return;
    this.semaineDebut.set(valeur);
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      objectifs: this.cptSvc.getObjectifsParSemaine(this.semaineDebut()),
      primes: this.cptSvc.getPrimesParSemaine(this.semaineDebut()).pipe(catchError(() => of([] as PrimeSemaineBE[]))),
    }).subscribe({
      next: ({ objectifs, primes }) => {
        const primesParMatricule = new Map(primes.map(p => [p.matriculeCommercial, p]));
        const matricules = new Set([...objectifs.map(o => o.matriculeCommercial), ...primes.map(p => p.matriculeCommercial)]);
        const lignes: LigneCommercial[] = Array.from(matricules).map(m => ({
          matriculeCommercial: m,
          objectif: objectifs.find(o => o.matriculeCommercial === m) ?? null,
          prime: primesParMatricule.get(m) ?? null,
        }));
        this.lignes.set(lignes);
        this.loading.set(false);
      },
      error: e => { this.loadError.set(extractApiError(e)); this.loading.set(false); },
    });
  }

  // ── Calcul ──────────────────────────────────────────────────────────────

  ouvrirCalcul(ligne: LigneCommercial): void {
    if (!ligne.objectif) {
      this.toast.error('Aucun objectif fixé pour ce commercial cette semaine — impossible de calculer une prime sans cible.');
      return;
    }
    this.calculPour.set(ligne.objectif);
    this.totalVentesGlobal.set(0);
    const init: Record<string, number> = {};
    for (const g of Object.keys(ligne.objectif.objectifsParGammeFCFA ?? {})) init[g] = 0;
    this.realisationsParGamme.set(init);
    this.showCalculForm.set(true);
  }

  actualiserRealisationGamme(gamme: string, valeur: number): void {
    this.realisationsParGamme.update(r => ({ ...r, [gamme]: valeur }));
  }

  fermerCalcul(): void {
    if (this.saving()) return;
    this.showCalculForm.set(false);
  }

  confirmerCalcul(): void {
    const objectif = this.calculPour();
    if (!objectif) return;
    if (this.totalVentesGlobal() < 0) { this.toast.error('Le chiffre d\'affaires réalisé ne peut pas être négatif.'); return; }
    this.saving.set(true);
    this.cptSvc.calculerPrime({
      matriculeCommercial: objectif.matriculeCommercial,
      semaineDebut: objectif.semaineDebut,
      totalVentesGlobalFCFA: this.totalVentesGlobal(),
      realisationsParGammeFCFA: this.realisationsParGamme(),
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.showCalculForm.set(false);
        this.toast.success('Prime calculée selon le barème en vigueur.');
        this.charger();
      },
      error: e => { this.saving.set(false); this.toast.error(extractApiError(e), 'Calcul impossible'); },
    });
  }

  // ── Validation / versement ──────────────────────────────────────────────

  enTraitement = signal<Set<string>>(new Set());
  actionEnCours = (ref: string) => this.enTraitement().has(ref);

  valider(ligne: LigneCommercial): void {
    const ref = ligne.prime?.referencePrime;
    if (!ref || this.actionEnCours(ref)) return;
    this.enTraitement.update(s => new Set(s).add(ref));
    this.cptSvc.validerPrime(ref).subscribe({
      next: () => { this.finirAction(ref); this.toast.success('Prime validée.'); this.charger(); },
      error: e => { this.finirAction(ref); this.toast.error(extractApiError(e), 'Validation impossible'); },
    });
  }

  verser(ligne: LigneCommercial): void {
    const ref = ligne.prime?.referencePrime;
    if (!ref || this.actionEnCours(ref)) return;
    this.enTraitement.update(s => new Set(s).add(ref));
    this.cptSvc.verserPrime(ref).subscribe({
      next: () => { this.finirAction(ref); this.toast.success('Prime marquée comme versée.'); this.charger(); },
      error: e => { this.finirAction(ref); this.toast.error(extractApiError(e), 'Versement impossible'); },
    });
  }

  private finirAction(ref: string): void {
    this.enTraitement.update(s => { const n = new Set(s); n.delete(ref); return n; });
  }

  statutLabel(statut: string): string {
    return { CALCULEE: 'Calculée', VALIDEE: 'Validée', VERSEE: 'Versée' }[statut] ?? statut;
  }
}
