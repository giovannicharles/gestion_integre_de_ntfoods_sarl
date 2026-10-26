import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { of, switchMap } from 'rxjs';
import { ProductionService, SessionBroyageBE } from '../../../../infrastructure/production.service';

/** Date locale au format AAAA-MM-JJ (évite le décalage UTC de toISOString). */
function dateLocaleIso(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Ajoute n jours à une date AAAA-MM-JJ, en calendrier local. */
function ajouterJours(iso: string, n: number): string {
  const [y, m, j] = iso.split('-').map(Number);
  return dateLocaleIso(new Date(y, m - 1, j + n));
}

/** Seuil de validation d'une journée, en fraction de l'objectif journalier (règle backend). */
const SEUIL_VALIDATION = 0.85;

/**
 * INDICATEURS JOURNALIERS — Chef Machiniste.
 *
 * Clôture d'une session de broyage : quantité nette broyée et pertes (kg), avec le pourcentage de
 * pertes recalculé comme le backend (pertes ÷ (nette + pertes)).
 *
 * Règles reprises du backend, vérifiées avant l'envoi :
 * - la nette ne peut dépasser l'objectif journalier + le dépassement autorisé (sinon 409) ; la page
 *   propose d'autoriser l'excédent avant la clôture ;
 * - une session déjà clôturée ne se modifie plus ;
 * - une journée dont le réalisé est sous 85 % de l'objectif n'est validée qu'avec une justification.
 */
@Component({
  selector: 'app-cm-indicateurs',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, FormsModule, RouterLink],
  templateUrl: './cm-indicateurs.component.html',
  styleUrls: ['./cm-indicateurs.component.css'],
})
export class CmIndicateursComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  readonly aujourdhui = dateLocaleIso();

  readonly chargement = signal(true);
  readonly enCours = signal(false);
  readonly erreur = signal('');
  readonly succes = signal('');
  readonly sessionExpiree = signal(false);
  readonly derniereMaj = signal<Date | null>(null);
  readonly sessionsJour = signal<SessionBroyageBE[]>([]);

  // ── Saisie de clôture ──
  readonly sessionId = signal<number | null>(null);
  readonly nette = signal<number | null>(null);
  readonly pertes = signal<number | null>(null);
  readonly justificatif = signal('');

  readonly session = computed(() => this.sessionsJour().find(s => s.id === this.sessionId()) ?? null);

  /** Dernières pertes clôturées sur 30 jours, pour le même type de poudre : suggestion, jamais enregistrée seule. */
  readonly historique = signal<SessionBroyageBE[]>([]);
  readonly dernierePertes = computed<{ date: string; kg: number } | null>(() => {
    const s = this.session();
    if (!s) return null;
    const trouvee = this.historique()
      .filter(h => h.typePoudre === s.typePoudre && h.pertesKg != null && h.id !== s.id)
      .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)[0];
    return trouvee ? { date: trouvee.date, kg: trouvee.pertesKg! } : null;
  });

  /** Écart objectif − réalisé de la session : repère affiché à côté des pertes, non enregistré. */
  readonly ecartObjectifRealise = computed(() => {
    const s = this.session();
    if (!s) return 0;
    const realise = s.realisations.reduce((t, r) => t + r.realiseKg, 0);
    return Math.max(0, Math.round((s.objectifJournalierKg - realise) * 10) / 10);
  });

  reprendrePertes(kg: number): void {
    this.pertes.set(kg);
  }
  readonly sessionCloturee = computed(() => this.session()?.statut === 'CLOTUREE');

  /** Quantité nette d'une session : celle déjà clôturée, sinon la somme du poste ECRASAGE. */
  quantiteNetteDe(s: SessionBroyageBE): number {
    return s.quantiteNetteBroyeeKg ?? s.realisations
      .filter(r => r.operation === 'ECRASAGE')
      .reduce((t, r) => t + (r.realiseKg ?? 0), 0);
  }

  readonly totalRealise = computed(() =>
    (this.session()?.realisations ?? []).reduce((t, r) => t + r.realiseKg, 0));
  readonly seuilKg = computed(() => (this.session()?.objectifJournalierKg ?? 0) * SEUIL_VALIDATION);
  readonly journeeValidee = computed(() => this.session()?.journeeValidee ?? false);
  readonly sousSeuil = computed(() => !!this.session() && this.totalRealise() < this.seuilKg());

  /** Plafond de nette sans autorisation : objectif journalier + dépassement déjà autorisé. */
  readonly plafond = computed(() => {
    const s = this.session();
    return s ? s.objectifJournalierKg + s.depassementAutoriseKg : 0;
  });
  readonly excedent = computed(() => Math.max(0, (this.nette() ?? 0) - this.plafond()));

  /** % de pertes comme le backend : pertes ÷ (nette + pertes). */
  readonly pctPertes = computed(() => {
    const n = this.nette() ?? 0;
    const p = this.pertes() ?? 0;
    return n + p > 0 ? Math.round((p / (n + p)) * 1000) / 10 : 0;
  });

  /** Raisons qui empêchent la clôture, affichées sous le formulaire. */
  readonly bloquants = computed(() => {
    const raisons: string[] = [];
    if (!this.session()) raisons.push('choisir une session');
    if (this.sessionCloturee()) raisons.push('la session est déjà clôturée');
    if (this.nette() === null || this.nette()! <= 0) raisons.push('saisir la quantité nette broyée');
    if (this.pertes() === null || this.pertes()! < 0) raisons.push('saisir les pertes (0 si aucune)');
    if (this.excedent() > 0) raisons.push(`autoriser le dépassement de ${this.excedent()} kg`);
    return raisons;
  });
  readonly peutCloturer = computed(() => this.bloquants().length === 0 && !this.enCours());

  // ── Synthèse du jour ──
  readonly sessionsClosesCount = computed(() => this.sessionsJour().filter(s => s.statut === 'CLOTUREE').length);
  readonly netteParType = computed(() => {
    const cumul = new Map<string, { libelle: string; kg: number }>();
    for (const s of this.sessionsJour()) {
      const cur = cumul.get(s.typePoudre) ?? { libelle: s.typePoudreLibelle, kg: 0 };
      cur.kg += this.quantiteNetteDe(s);
      cumul.set(s.typePoudre, cur);
    }
    return [...cumul.values()];
  });
  readonly netteTotale = computed(() => this.sessionsJour().reduce((t, s) => t + this.quantiteNetteDe(s), 0));
  readonly pertesTotales = computed(() => this.sessionsJour().reduce((t, s) => t + (s.pertesKg ?? 0), 0));
  readonly pctPertesGlobal = computed(() => {
    const brut = this.netteTotale() + this.pertesTotales();
    return brut > 0 ? Math.round((this.pertesTotales() / brut) * 1000) / 10 : 0;
  });

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set('');
    // Historique seulement pour la suggestion de pertes : son échec ne bloque pas la page
    this.svc.getSessionsBroyage({ debut: ajouterJours(this.aujourdhui, -30), fin: this.aujourdhui })
      .subscribe({ next: h => this.historique.set(h), error: () => this.historique.set([]) });
    this.svc.getSessionsBroyage({ debut: this.aujourdhui, fin: this.aujourdhui }).subscribe({
      next: list => {
        this.sessionsJour.set(list);
        this.derniereMaj.set(new Date());
        this.chargement.set(false);
        if (this.sessionId() && !list.some(s => s.id === this.sessionId())) this.choisirSession(null);
      },
      error: (e: unknown) => {
        this.noterErreur(e, 'Les sessions du jour n\'ont pas pu être chargées.');
        this.chargement.set(false);
      },
    });
  }

  /** Choix d'une session : la nette et les pertes sont pré-remplies depuis ce qui est déjà connu. */
  choisirSession(id: number | null): void {
    this.sessionId.set(id);
    this.succes.set('');
    this.erreur.set('');
    this.justificatif.set('');
    const s = this.sessionsJour().find(x => x.id === id);
    if (!s) { this.nette.set(null); this.pertes.set(null); return; }
    this.nette.set(this.quantiteNetteDe(s));
    this.pertes.set(s.pertesKg ?? null);
  }

  /** Autorise le dépassement pour que la nette passe le plafond, puis la session reste à clôturer. */
  autoriserExcedent(): void {
    const s = this.session();
    const extra = this.excedent();
    if (!s || extra <= 0) return;
    this.enCours.set(true);
    this.erreur.set('');
    this.svc.autoriserDepassementBroyage(s.id, extra).subscribe({
      next: maj => {
        this.remplacer(maj);
        this.succes.set(`Dépassement de ${extra} kg autorisé pour la session #${s.id}. Vous pouvez clôturer.`);
        this.enCours.set(false);
      },
      error: (e: unknown) => {
        this.enCours.set(false);
        this.noterErreur(e, 'Le dépassement n\'a pas pu être autorisé.');
      },
    });
  }

  /** Clôture la session ; la justification (si la journée est sous le seuil) est enregistrée ensuite. */
  cloturer(): void {
    const s = this.session();
    if (!s || !this.peutCloturer()) return;
    this.enCours.set(true);
    this.erreur.set('');
    this.succes.set('');
    const justif = this.justificatif().trim();
    const doitJustifier = this.sousSeuil() && !!justif;

    // La justification part seulement après la clôture réussie (elle ne doit pas être envoyée en parallèle)
    this.svc.cloturerSessionBroyage({
      sessionId: s.id, quantiteNetteBroyeeKg: this.nette()!, pertesKg: this.pertes()!,
    }).pipe(
      switchMap(maj => doitJustifier && !maj.journeeValidee
        ? this.svc.justifierNonValidationBroyage(s.id, justif)
        : of(maj)),
    ).subscribe({
        next: maj => {
          this.remplacer(maj);
          const validee = maj.journeeValidee ? 'journée validée' : 'journée non validée';
          this.succes.set(`Session #${maj.id} clôturée · pertes ${(maj.pctPertes ?? 0).toFixed(1)} % · ${validee}.`);
          this.choisirSession(null);
          this.enCours.set(false);
        },
        error: (e: unknown) => {
          this.enCours.set(false);
          this.noterErreur(e, 'La session n\'a pas pu être clôturée.');
        },
      });
  }

  libelleStatut(s: SessionBroyageBE): string {
    if (s.statut === 'CLOTUREE') return s.journeeValidee ? 'Clôturée · validée' : 'Clôturée · non validée';
    return 'Ouverte';
  }

  private remplacer(maj: SessionBroyageBE): void {
    this.sessionsJour.update(list => list.map(x => x.id === maj.id ? maj : x));
  }

  private noterErreur(e: unknown, repli: string): void {
    const err = e as { status?: number; error?: { erreur?: string; message?: string } };
    if (err?.status === 401) {
      this.sessionExpiree.set(true);
      this.erreur.set('Votre session a été fermée, probablement parce que ce compte a été ouvert ailleurs.');
      return;
    }
    // Le backend renvoie la raison métier (dépassement, session déjà clôturée…) : on l'affiche telle quelle
    this.erreur.set(err?.error?.erreur || err?.error?.message || repli);
  }
}
