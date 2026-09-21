import { Injectable, signal, computed, inject } from '@angular/core';
import { ProductionService, SessionDosageBE } from '../../../infrastructure/production.service';

/**
 * Contexte partagé des sessions de dosage pour l'Agent Doseur.
 *
 * Rôle unique et centralisé (DRY) :
 *  1. Mémoriser la session en cours de travail, pour ne pas la re-sélectionner
 *     à chaque changement de vue (Dosage, Machines, Fûts, Prédictions, Documents).
 *  2. Charger UNE SEULE FOIS les sessions ouvertes du jour et les exposer à
 *     toutes les vues, au lieu que chaque composant refasse le même appel
 *     `getSessionsDosageParDate(today)` + le même filtrage.
 *
 * Avant : cette logique était copiée à l'identique dans 5 composants.
 * Après : les composants se contentent d'appeler `chargerSessionsOuvertes()`
 * et de lire `sessionsOuvertes()` / `sessionActive()`.
 */
@Injectable({ providedIn: 'root' })
export class AdSessionContextService {
  private readonly prod = inject(ProductionService);

  /** Date du jour (ISO court), calculée une fois. */
  readonly today = new Date().toISOString().split('T')[0];

  // ── Sélection courante ────────────────────────────────────────────────
  readonly sessionActiveId = signal<number | null>(null);
  readonly referencePphActive = signal<string>('');
  readonly dateActive = signal<string>('');

  // ── Sessions ouvertes du jour (mutualisées) ───────────────────────────
  readonly sessionsOuvertes = signal<SessionDosageBE[]>([]);
  readonly chargement = signal(false);

  /** Session active résolue à partir de l'ID et de la liste chargée. */
  readonly sessionActive = computed<SessionDosageBE | null>(() => {
    const id = this.sessionActiveId();
    if (id == null) return null;
    return this.sessionsOuvertes().find(s => s.id === id) ?? null;
  });

  /** Vrai s'il n'existe aucune session ouverte à travailler aujourd'hui. */
  readonly aucuneSession = computed(() =>
    !this.chargement() && this.sessionsOuvertes().length === 0
  );

  /** Définit la session en cours de travail. */
  definir(id: number, referencePPH: string, date: string): void {
    this.sessionActiveId.set(id);
    this.referencePphActive.set(referencePPH);
    this.dateActive.set(date);
  }

  /** Efface la sélection courante. */
  effacer(): void {
    this.sessionActiveId.set(null);
    this.referencePphActive.set('');
    this.dateActive.set('');
  }

  /**
   * Charge les sessions ouvertes (non clôturées, non validées) du jour.
   * Restaure automatiquement la sélection précédente, et sélectionne
   * d'office l'unique session s'il n'y en a qu'une — un clic de moins
   * pour l'agent.
   *
   * @param forcer  recharge même si la liste est déjà en mémoire.
   */
  chargerSessionsOuvertes(forcer = false): void {
    if (!forcer && this.sessionsOuvertes().length > 0) return;
    this.chargement.set(true);
    this.prod.getSessionsDosageParDate(this.today).subscribe({
      next: sessions => {
        const ouvertes = sessions.filter(s => !s.cloturee && !s.validee);
        this.sessionsOuvertes.set(ouvertes);
        this.chargement.set(false);

        const idCourant = this.sessionActiveId();
        const encoreOuverte = idCourant != null && ouvertes.some(s => s.id === idCourant);

        if (encoreOuverte) return;                 // on garde la sélection valide
        if (ouvertes.length === 1) {               // auto-sélection si session unique
          const s = ouvertes[0];
          this.definir(s.id, s.referencePPH, s.date);
        } else {
          this.effacer();                          // sélection devenue invalide
        }
      },
      error: () => {
        this.sessionsOuvertes.set([]);
        this.chargement.set(false);
      },
    });
  }

  /** Sélectionne une session ouverte par son identifiant (depuis un `<select>`). */
  selectionnerParId(id: number | string): void {
    const num = Number(id);
    const s = this.sessionsOuvertes().find(x => x.id === num);
    if (s) this.definir(s.id, s.referencePPH, s.date);
    else this.effacer();
  }
}
