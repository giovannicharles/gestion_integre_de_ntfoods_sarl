import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ProductionService, SessionBroyageBE, ObjectifMachinisteBE, OPERATIONS_BROYAGE,
} from '../../../../infrastructure/production.service';

/** Date locale au format AAAA-MM-JJ (évite le décalage UTC de toISOString). */
function dateLocaleIso(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Seuil en dessous duquel une réalisation est signalée comme insuffisante (règle de validation de journée). */
const SEUIL_VALIDATION_PCT = 85;

/**
 * RÉALISATIONS JOURNALIÈRES — Chef Machiniste.
 *
 * La saisie est guidée par les objectifs de la session choisie : seuls les machinistes qui ont un
 * objectif dans cette session sont proposés, leur poste et leur objectif sont renseignés
 * automatiquement, et la date et le type de poudre sont ceux de la session (non modifiables).
 *
 * Le dépassement de l'objectif est accepté (le backend n'impose pas de plafond à la réalisation) :
 * il est signalé à l'écran, et le plafond objectif + dépassement autorisé n'est vérifié qu'à la clôture.
 * Une nouvelle saisie remplace la précédente pour le même machiniste, le même poste et la même poudre.
 */
@Component({
  selector: 'app-cm-realisations',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, FormsModule, RouterLink],
  templateUrl: './cm-realisations.component.html',
  styleUrls: ['./cm-realisations.component.css'],
})
export class CmRealisationsComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  readonly aujourdhui = dateLocaleIso();
  readonly libelleOperation = (code: string): string => OPERATIONS_BROYAGE.find(o => o.code === code)?.libelle ?? code;

  readonly chargement = signal(true);
  readonly enregistrement = signal(false);
  readonly erreur = signal('');
  readonly succes = signal('');
  readonly sessionExpiree = signal(false);
  readonly derniereMaj = signal<Date | null>(null);
  readonly sessionsJour = signal<SessionBroyageBE[]>([]);

  // ── Saisie ──
  readonly sessionId = signal<number | null>(null);
  readonly matricule = signal('');
  readonly operation = signal('');
  readonly realiseKg = signal<number | null>(null);

  readonly session = computed(() => this.sessionsJour().find(s => s.id === this.sessionId()) ?? null);
  readonly sessionCloturee = computed(() => this.session()?.statut === 'CLOTUREE');

  /** Machinistes qui ont un objectif dans la session choisie, sans doublon. */
  readonly machinistes = computed(() => {
    const s = this.session();
    if (!s) return [];
    const vus = new Map<string, { matricule: string; nom: string }>();
    for (const o of s.objectifsMachinistes) {
      if (!vus.has(o.machinisteMatricule)) vus.set(o.machinisteMatricule, { matricule: o.machinisteMatricule, nom: o.nomMachiniste });
    }
    return [...vus.values()];
  });

  /** Objectifs du machiniste choisi : un par poste. */
  readonly objectifsDuMachiniste = computed<ObjectifMachinisteBE[]>(() => {
    const s = this.session();
    if (!s || !this.matricule()) return [];
    return s.objectifsMachinistes.filter(o => o.machinisteMatricule === this.matricule());
  });

  readonly objectifChoisi = computed(() =>
    this.objectifsDuMachiniste().find(o => o.operation === this.operation()) ?? null);
  readonly objectifKg = computed(() => this.objectifChoisi()?.objectifKg ?? 0);

  /** Réalisation déjà saisie pour ce machiniste, ce poste dans cette session : elle sera remplacée. */
  readonly existante = computed(() => {
    const s = this.session();
    if (!s || !this.matricule() || !this.operation()) return null;
    return s.realisations.find(r => r.machinisteMatricule === this.matricule() && r.operation === this.operation()) ?? null;
  });

  readonly pct = computed(() => {
    const obj = this.objectifKg();
    const real = this.realiseKg() ?? 0;
    return obj > 0 ? Math.round((real / obj) * 1000) / 10 : 0;
  });
  readonly ecart = computed(() => (this.realiseKg() ?? 0) - this.objectifKg());

  /** Message d'état sous la saisie : bloquant, dépassement, insuffisance, ou objectif atteint. */
  readonly etat = computed<{ type: 'bloquant' | 'depassement' | 'insuffisant' | 'atteint' | 'neutre'; texte: string } | null>(() => {
    const s = this.session();
    if (!s) return null;
    if (this.sessionCloturee()) return { type: 'bloquant', texte: 'Session clôturée : aucune réalisation ne peut plus être saisie.' };
    if (!this.matricule()) return { type: 'neutre', texte: 'Choisissez un machiniste pour afficher son objectif.' };
    if (this.objectifsDuMachiniste().length === 0) {
      return { type: 'bloquant', texte: 'Ce machiniste n\'a aucun objectif dans cette session.' };
    }
    if (!this.objectifChoisi()) return { type: 'bloquant', texte: 'Ce machiniste n\'a pas d\'objectif sur ce poste.' };
    const real = this.realiseKg();
    if (real === null || real === undefined) return { type: 'neutre', texte: 'Saisissez la quantité réalisée.' };
    if (real <= 0) return { type: 'bloquant', texte: 'La quantité réalisée doit être supérieure à 0.' };
    if (this.ecart() > 0) {
      return { type: 'depassement', texte: `Dépassement de ${Math.round(this.ecart())} kg au-delà de l'objectif (${this.pct()} %). La saisie est acceptée et sera prise en compte.` };
    }
    if (this.ecart() === 0) return { type: 'atteint', texte: 'Objectif atteint exactement.' };
    if (this.pct() < SEUIL_VALIDATION_PCT) {
      return { type: 'insuffisant', texte: `Réalisé inférieur à l'objectif : il manque ${Math.abs(this.ecart())} kg (${this.pct()} %). Sous ${SEUIL_VALIDATION_PCT} %, la journée devra être justifiée.` };
    }
    return { type: 'neutre', texte: `Il manque ${Math.abs(this.ecart())} kg pour atteindre l'objectif (${this.pct()} %).` };
  });

  readonly peutEnregistrer = computed(() =>
    !!this.session() && !this.sessionCloturee() && !!this.matricule() && !!this.objectifChoisi()
    && (this.realiseKg() ?? 0) > 0 && !this.enregistrement());

  // ── Synthèse de la session ──
  readonly totalRealiseSession = computed(() =>
    (this.session()?.realisations ?? []).reduce((t, r) => t + r.realiseKg, 0));
  /** Somme des objectifs attribués aux machinistes, à comparer à l'objectif journalier de la session. */
  readonly objectifsRepartis = computed(() =>
    (this.session()?.objectifsMachinistes ?? []).reduce((t, o) => t + o.objectifKg, 0));
  /** Écart de répartition : positif = objectif journalier non réparti ; négatif = répartition excédentaire. */
  readonly ecartRepartition = computed(() =>
    (this.session()?.objectifJournalierKg ?? 0) - this.objectifsRepartis());

  readonly depassementSession = computed(() => {
    const s = this.session();
    if (!s) return false;
    return this.totalRealiseSession() > s.objectifJournalierKg + s.depassementAutoriseKg;
  });

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set('');
    this.svc.getSessionsBroyage({ debut: this.aujourdhui, fin: this.aujourdhui }).subscribe({
      next: list => {
        this.sessionsJour.set(list);
        this.derniereMaj.set(new Date());
        this.chargement.set(false);
        if (this.sessionId() && !list.some(s => s.id === this.sessionId())) this.choisirSession(null);
        if (!this.sessionId()) {
          const premiere = list.find(s => s.statut !== 'CLOTUREE') ?? list[0];
          if (premiere) this.choisirSession(premiere.id);
        }
      },
      error: (e: unknown) => {
        this.noterErreur(e, 'Les sessions du jour n\'ont pas pu être chargées.');
        this.chargement.set(false);
      },
    });
  }

  /** Changer de session réinitialise le machiniste et le poste : ils dépendent de la session. */
  choisirSession(id: number | null): void {
    this.sessionId.set(id);
    this.matricule.set('');
    this.operation.set('');
    this.realiseKg.set(null);
    this.succes.set('');
    this.erreur.set('');
  }

  /** Choix du machiniste : poste et objectif sont renseignés automatiquement. */
  choisirMachiniste(matricule: string): void {
    this.matricule.set(matricule);
    this.realiseKg.set(null);
    this.succes.set('');
    const objectifs = this.objectifsDuMachiniste();
    if (objectifs.length === 0) { this.operation.set(''); return; }
    // Priorité au premier poste encore sans réalisation, sinon le premier poste de son objectif
    const sansRealisation = objectifs.find(o => !this.realisee(o.operation));
    this.operation.set((sansRealisation ?? objectifs[0]).operation);
  }

  /** Changement de poste : l'objectif suit le poste (il ne reste jamais celui du poste précédent). */
  choisirPoste(code: string): void {
    this.operation.set(code);
    this.succes.set('');
  }

  realisee(operation: string): boolean {
    return (this.session()?.realisations ?? []).some(r => r.machinisteMatricule === this.matricule() && r.operation === operation);
  }

  enregistrer(): void {
    const s = this.session();
    const obj = this.objectifChoisi();
    if (!s || !obj || !this.peutEnregistrer()) return;
    this.enregistrement.set(true);
    this.erreur.set('');
    this.succes.set('');
    this.svc.enregistrerRealisationBroyage({
      sessionId: s.id,
      machinisteMatricule: obj.machinisteMatricule,
      nomMachiniste: obj.nomMachiniste,
      operation: obj.operation,
      typePoudre: s.typePoudre,
      objectifKg: obj.objectifKg,
      realiseKg: this.realiseKg()!,
    }).subscribe({
      next: maj => {
        this.sessionsJour.update(list => list.map(x => x.id === maj.id ? maj : x));
        this.succes.set(`Réalisation enregistrée pour ${obj.nomMachiniste} : ${this.realiseKg()} kg (${this.libelleOperation(obj.operation)}).`);
        this.matricule.set('');
        this.operation.set('');
        this.realiseKg.set(null);
        this.enregistrement.set(false);
      },
      error: (e: unknown) => {
        this.enregistrement.set(false);
        this.noterErreur(e, 'La réalisation n\'a pas pu être enregistrée.');
      },
    });
  }

  private noterErreur(e: unknown, repli: string): void {
    const err = e as { status?: number; error?: { erreur?: string; message?: string } };
    if (err?.status === 401) {
      this.sessionExpiree.set(true);
      this.erreur.set('Votre session a été fermée, probablement parce que ce compte a été ouvert ailleurs.');
      return;
    }
    // Le backend renvoie la raison métier (ex. session clôturée) : on l'affiche telle quelle
    this.erreur.set(err?.error?.erreur || err?.error?.message || repli);
  }
}
