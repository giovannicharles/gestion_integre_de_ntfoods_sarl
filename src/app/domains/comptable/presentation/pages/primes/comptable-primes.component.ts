import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ComptableService, ObjectifCommercialBE, PrimeSemaineBE } from '../../../infrastructure/comptable.service';
import { CommercialService } from '../../../../commercial/infrastructure/commercial.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';
import { fCFA } from '../../../../../shared/utils/format.utils';
import { AuthService } from '../../../../../core/auth/auth.service';
import { CanDirective } from '../../../../../shared/directives/can.directive';

interface LigneCommercial {
  matriculeCommercial: string;
  objectif: ObjectifCommercialBE | null;
  prime: PrimeSemaineBE | null;
}

/**
 * Gestion des primes hebdomadaires — calcul, validation, versement.
 *
 * Le calcul de l'éligibilité (règle 80/75) est entièrement fait par le serveur à partir du
 * barème en vigueur : cet écran transmet la réalisation de la semaine (CA global + détail par
 * gamme) pour ce calcul.
 *
 * Correction 2026-10-25 (signalé par audit) : cette réalisation était jusqu'ici **toujours**
 * saisie à la main, alors qu'un calcul automatique existe déjà et tourne sur les vraies ventes
 * (`CalculerPrimesHebdoUseCase`, exposé par `GET /api/commercial/rapports/primes`) — jamais
 * appelé depuis cet écran. Le formulaire se pré-remplit maintenant avec ce calcul quand une
 * ligne existe pour ce commercial sur la semaine ; le Comptable reste libre de corriger avant de
 * confirmer (les champs restent des saisies, pas un simple affichage) — aucune donnée n'est
 * jamais envoyée sans qu'il l'ait vue.
 */
@Component({
  selector: 'app-comptable-primes',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, CanDirective],
  templateUrl: './comptable-primes.component.html',
  styleUrls: ['./comptable-primes.component.css'],
})
export class ComptablePrimesComponent implements OnInit {
  private readonly cptSvc = inject(ComptableService);
  private readonly comSvc = inject(CommercialService);
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
  /** Les valeurs ci-dessus viennent-elles du calcul automatique (vraies ventes) ? Juste informatif. */
  preRempliAutomatiquement = signal(false);
  chargementAuto = signal(false);

  gammesDuCalcul = computed(() => Object.keys(this.calculPour()?.objectifsParGammeFCFA ?? {}));

  ngOnInit(): void {
    this.charger();
  }

  private lundiCourant(): string {
    const today = new Date();
    // (getDay()+6)%7 : lundi=0 ... dimanche=6 — gère correctement le dimanche
    // (getDay()=0 → recule de 6 jours, pas d'avance d'un jour comme `getDay()-1`).
    const lundi = new Date(today);
    lundi.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    // Composition manuelle en heure locale — `toISOString()` convertit en UTC et
    // décale la date avant 01:00 (WAT).
    return `${lundi.getFullYear()}-${String(lundi.getMonth() + 1).padStart(2, '0')}-${String(lundi.getDate()).padStart(2, '0')}`;
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
    const objectif = ligne.objectif;
    if (!objectif) {
      this.toast.error('Aucun objectif fixé pour ce commercial cette semaine — impossible de calculer une prime sans cible.');
      return;
    }
    this.calculPour.set(objectif);
    this.totalVentesGlobal.set(0);
    const init: Record<string, number> = {};
    for (const g of Object.keys(objectif.objectifsParGammeFCFA ?? {})) init[g] = 0;
    this.realisationsParGamme.set(init);
    this.preRempliAutomatiquement.set(false);
    this.showCalculForm.set(true);

    // Pré-remplissage depuis les vraies ventes (2026-10-25) — le Comptable garde la main pour
    // corriger avant de confirmer ; en l'absence de résultat (pas de ventes cette semaine pour
    // ce commercial), les champs restent à 0, jamais une valeur inventée.
    this.chargementAuto.set(true);
    this.comSvc.getPrimesHebdoAutomatique(objectif.semaineDebut, objectif.semaineFin).subscribe({
      next: resultats => {
        this.chargementAuto.set(false);
        const resultat = resultats.find(r => r.matriculeCommercial === objectif.matriculeCommercial);
        if (!resultat || this.calculPour() !== objectif) return;
        this.totalVentesGlobal.set(Math.round(resultat.caRealise));
        const realisations: Record<string, number> = {};
        for (const [gamme, cibleFCFA] of Object.entries(objectif.objectifsParGammeFCFA ?? {})) {
          const tauxPct = resultat.tauxParGamme[gamme] ?? 0;
          realisations[gamme] = Math.round((tauxPct / 100) * cibleFCFA);
        }
        this.realisationsParGamme.set(realisations);
        this.preRempliAutomatiquement.set(true);
      },
      error: () => this.chargementAuto.set(false),
    });
  }

  actualiserRealisationGamme(gamme: string, valeur: number): void {
    this.realisationsParGamme.update(r => ({ ...r, [gamme]: valeur }));
    this.preRempliAutomatiquement.set(false);
  }

  actualiserTotalVentesGlobal(valeur: number): void {
    this.totalVentesGlobal.set(valeur);
    this.preRempliAutomatiquement.set(false);
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
