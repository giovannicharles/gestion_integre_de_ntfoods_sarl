import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin, of, Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  ProductionService, PPHBE, EmployeBE, SessionBroyageBE, OPERATIONS_BROYAGE, TYPES_POUDRE,
} from '../../../../infrastructure/production.service';

/** Date locale au format AAAA-MM-JJ (évite le décalage UTC de toISOString). */
function dateLocaleIso(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Ajoute n jours à une date AAAA-MM-JJ, en calendrier local. */
function ajouterJours(iso: string, n: number): string {
  const [y, m, j] = iso.split('-').map(Number);
  return dateLocaleIso(new Date(y, m - 1, j + n));
}

interface ObjectifDraft {
  machinisteMatricule: string; nomMachiniste: string; operation: string; objectifKg: number;
}

/**
 * OBJECTIFS DES MACHINISTES — Chef Machiniste.
 * Ouverture d'une session de broyage avec les objectifs de chaque machiniste, et consultation des
 * objectifs des 7 derniers jours regroupés par session.
 *
 * Règles backend reprises ici : une seule session par PPH, date et type de poudre ; objectif
 * journalier strictement positif ; au moins un objectif. Pas de modification ni de suppression
 * d'un objectif isolé (non exposées par le backend) : seule l'ouverture de session crée des objectifs.
 */
@Component({
  selector: 'app-cm-objectifs',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, FormsModule, RouterLink],
  templateUrl: './cm-objectifs.component.html',
  styleUrls: ['./cm-objectifs.component.css'],
})
export class CmObjectifsComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  readonly aujourdhui = dateLocaleIso();
  readonly operations = OPERATIONS_BROYAGE;
  readonly typesPoudre = TYPES_POUDRE;

  readonly chargement = signal(true);
  readonly erreur = signal('');
  readonly sessionExpiree = signal(false);
  readonly succes = signal('');
  readonly derniereMaj = signal<Date | null>(null);

  readonly pphs = signal<PPHBE[]>([]);
  readonly machinistes = signal<EmployeBE[]>([]);
  readonly sessions = signal<SessionBroyageBE[]>([]);
  /** Toutes les sessions du PPH choisi, pour détecter un doublon avant l'envoi. */
  readonly sessionsDuPph = signal<SessionBroyageBE[]>([]);

  // ── Formulaire de nouvelle session ──
  readonly referencePPH = signal('');
  readonly date = signal(this.aujourdhui);
  readonly typePoudre = signal('MAIS');
  readonly objectifGlobal = signal<number | null>(null);
  readonly brouillon = signal<ObjectifDraft[]>([]);
  readonly enCreation = signal(false);

  nouvel: { machinisteMatricule: string; operation: string; objectifKg: number | null } = {
    machinisteMatricule: '', operation: 'ECRASAGE', objectifKg: null,
  };

  readonly totalBrouillon = computed(() => this.brouillon().reduce((t, o) => t + o.objectifKg, 0));
  readonly ecartGlobal = computed(() => (this.objectifGlobal() ?? 0) - this.totalBrouillon());

  /** Session déjà ouverte pour ce PPH, cette date et ce type de poudre : le backend la refuse. */
  readonly conflit = computed(() => this.sessionsDuPph()
    .find(s => s.date === this.date() && s.typePoudre === this.typePoudre()) ?? null);

  /** Raisons qui empêchent la création, affichées à l'utilisateur. */
  readonly bloquants = computed(() => {
    const raisons: string[] = [];
    if (!this.referencePPH()) raisons.push('choisir un plan');
    if (!this.date()) raisons.push('choisir une date');
    if (!(this.objectifGlobal() && this.objectifGlobal()! > 0)) raisons.push('saisir un objectif journalier supérieur à 0');
    if (this.brouillon().length === 0) raisons.push('ajouter au moins un machiniste');
    if (this.conflit()) raisons.push('une session existe déjà pour ce plan, cette date et cette poudre');
    return raisons;
  });
  readonly peutCreer = computed(() => this.bloquants().length === 0 && !this.enCreation());

  /** Machinistes actifs, proposés dans le formulaire. */
  readonly machinistesActifs = computed(() => this.machinistes().filter(m => m.actif));

  /** Sessions de la période, regroupées avec leurs objectifs. */
  readonly sessionsRecentes = computed(() =>
    [...this.sessions()].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id));

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set('');
    forkJoin({
      pphs: this.tolerer(this.svc.getPPHs(), [] as PPHBE[]),
      machinistes: this.tolerer(this.svc.getMachinistes(), [] as EmployeBE[]),
      sessions: this.tolerer(this.svc.getSessionsBroyage({ debut: ajouterJours(this.aujourdhui, -7), fin: this.aujourdhui }), [] as SessionBroyageBE[]),
    }).subscribe(r => {
      this.pphs.set(r.pphs);
      this.machinistes.set(r.machinistes);
      this.sessions.set(r.sessions);
      this.derniereMaj.set(new Date());
      this.chargement.set(false);
    });
  }

  choisirPph(reference: string): void {
    this.referencePPH.set(reference);
    this.sessionsDuPph.set([]);
    this.succes.set('');
    if (!reference) return;
    this.svc.getSessionsBroyage({ referencePPH: reference }).subscribe({
      next: s => this.sessionsDuPph.set(s),
      error: (e: unknown) => this.noterErreur(e, 'Les sessions de ce plan n\'ont pas pu être vérifiées.'),
    });
  }

  selectionnerMachiniste(matricule: string): void {
    this.nouvel.machinisteMatricule = matricule;
  }

  ajouterAuBrouillon(): void {
    const m = this.machinistes().find(x => x.matricule === this.nouvel.machinisteMatricule);
    const kg = this.nouvel.objectifKg ?? 0;
    if (!m) { this.erreur.set('Choisir un machiniste.'); return; }
    if (kg <= 0) { this.erreur.set('L\'objectif du machiniste doit être supérieur à 0.'); return; }
    if (this.brouillon().some(o => o.machinisteMatricule === m.matricule && o.operation === this.nouvel.operation)) {
      this.erreur.set(`${m.nomComplet} a déjà un objectif pour ce poste.`);
      return;
    }
    this.erreur.set('');
    this.brouillon.update(l => [...l, {
      machinisteMatricule: m.matricule, nomMachiniste: m.nomComplet, operation: this.nouvel.operation, objectifKg: kg,
    }]);
    this.nouvel = { machinisteMatricule: '', operation: this.nouvel.operation, objectifKg: null };
  }

  retirerDuBrouillon(index: number): void {
    this.brouillon.update(l => l.filter((_, i) => i !== index));
  }

  creerObjectifs(): void {
    if (!this.peutCreer()) return;
    this.enCreation.set(true);
    this.erreur.set('');
    this.succes.set('');
    this.svc.ouvrirSessionBroyage({
      referencePPH: this.referencePPH(),
      date: this.date(),
      typePoudre: this.typePoudre(),
      objectifJournalierKg: this.objectifGlobal()!,
      objectifsMachinistes: this.brouillon(),
    }).subscribe({
      next: s => {
        this.sessions.update(l => [s, ...l]);
        this.sessionsDuPph.update(l => [s, ...l]);
        this.brouillon.set([]);
        this.objectifGlobal.set(null);
        this.succes.set(`Objectifs enregistrés : session #${s.id} ouverte le ${s.date}.`);
        this.enCreation.set(false);
      },
      error: (e: unknown) => {
        this.enCreation.set(false);
        this.noterErreur(e, 'Les objectifs n\'ont pas pu être enregistrés.');
      },
    });
  }

  libelleOperation(code: string): string {
    return this.operations.find(o => o.code === code)?.libelle ?? code;
  }

  libelleTypePoudre(code: string): string {
    return this.typesPoudre.find(t => t.code === code)?.libelle ?? code;
  }

  private tolerer<T>(source: Observable<T>, repli: T): Observable<T> {
    return source.pipe(catchError((e: unknown) => {
      this.noterErreur(e, 'Certaines données n\'ont pas pu être chargées.');
      return of(repli);
    }));
  }

  private noterErreur(e: unknown, repli: string): void {
    const err = e as { status?: number; error?: { erreur?: string; message?: string } };
    if (err?.status === 401) {
      this.sessionExpiree.set(true);
      this.erreur.set('Votre session a été fermée, probablement parce que ce compte a été ouvert ailleurs.');
      return;
    }
    // Le backend renvoie la raison métier (ex. session déjà existante) : on l'affiche telle quelle
    this.erreur.set(err?.error?.erreur || err?.error?.message || repli);
  }
}
