import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ProductionService, PPHBE, AffectationBE, AgentProductionBE, SessionDosageBE,
} from '../../../../infrastructure/production.service';

/** Date locale au format AAAA-MM-JJ (évite le décalage UTC de toISOString). */
function dateLocaleIso(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Seuils d'alerte, en % de l'objectif individuel. */
export const SEUIL_VIGILANCE = 50;
export const SEUIL_OBJECTIF_ATTEINT = 100;
export const SEUIL_DEPASSEMENT = 120;

export type Niveau = 'vide' | 'bas' | 'moyen' | 'ok' | 'depasse';

/** Un employé affecté au poste, avec sa quantité du jour (null tant qu'elle n'est pas saisie). */
interface LigneEmploye {
  matricule: string;
  nom: string;
  objectif: number;
  quantite: number | null;
}

/**
 * PRODUCTION INDIVIDUELLE — Responsable de Salle.
 * Saisit la production de chaque employé affecté à un poste, pour la journée. Les employés viennent de
 * l'affectation (pas de saisie libre) ; chacun reçoit un objectif individuel (objectif du poste réparti entre
 * les employés) et un taux. La somme des quantités individuelles devient la réalisation du poste.
 * Les sessions de dosage du jour, saisies par l'agent doseur, sont affichées en lecture seule.
 */
@Component({
  selector: 'app-rs-production-individuelle',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, FormsModule, RouterLink],
  templateUrl: './rs-production-individuelle.component.html',
  styleUrls: ['./rs-production-individuelle.component.css'],
})
export class RsProductionIndividuelleComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  readonly aujourdhui = new Date();
  readonly seuilVigilance = SEUIL_VIGILANCE;
  readonly seuilAtteint = SEUIL_OBJECTIF_ATTEINT;
  readonly seuilDepassement = SEUIL_DEPASSEMENT;

  readonly chargement = signal(true);
  readonly enregistrement = signal(false);
  readonly message = signal('');
  readonly erreur = signal('');
  readonly sessionExpiree = signal(false);
  readonly sansAffectation = signal(false);

  readonly pphs = signal<PPHBE[]>([]);
  readonly referenceChoisie = signal('');
  readonly affectation = signal<AffectationBE | null>(null);
  readonly agents = signal<AgentProductionBE[]>([]);
  readonly posteChoisi = signal('');
  readonly employes = signal<LigneEmploye[]>([]);

  readonly sessions = signal<SessionDosageBE[]>([]);
  readonly erreurSessions = signal('');

  readonly ligneCourante = computed(() =>
    this.affectation()?.lignes.find(l => l.codePoste === this.posteChoisi()) ?? null);
  readonly saisieCourante = computed(() =>
    this.affectation()?.saisies.find(s => s.codePoste === this.posteChoisi()) ?? null);
  readonly unite = computed(() => this.ligneCourante()?.unite ?? '');

  readonly nbEmployesAffectes = computed(() =>
    new Set((this.affectation()?.lignes ?? []).flatMap(l => l.matriculesEmployes)).size);
  readonly nbPostesSaisis = computed(() =>
    (this.affectation()?.saisies ?? []).filter(s => s.productionsIndividuelles.length > 0).length);
  readonly nbPostes = computed(() => this.affectation()?.lignes.length ?? 0);

  readonly totalSaisi = computed(() =>
    this.employes().reduce((t, e) => t + (e.quantite ?? 0), 0));
  readonly toutRenseigne = computed(() =>
    this.employes().length > 0 && this.employes().every(e => e.quantite !== null));
  readonly tauxPoste = computed(() => {
    const objectif = this.ligneCourante()?.objectifAjuste ?? 0;
    return objectif > 0 ? this.totalSaisi() / objectif * 100 : 0;
  });
  readonly niveauPoste = computed(() => this.niveau(this.tauxPoste(), this.toutRenseigne()));

  readonly erreursSaisie = computed(() => {
    const msgs: string[] = [];
    this.employes().forEach(e => {
      if (e.quantite === null) msgs.push(`${e.nom || e.matricule} : quantité à saisir.`);
      else if (!Number.isFinite(e.quantite) || e.quantite < 0) msgs.push(`${e.nom || e.matricule} : quantité invalide.`);
    });
    return msgs;
  });
  readonly peutEnregistrer = computed(() =>
    !!this.posteChoisi() && this.employes().length > 0 && this.erreursSaisie().length === 0 && !this.enregistrement());

  readonly sessionsTotaux = computed(() => {
    const s = this.sessions();
    const matieres = new Map<string, number>();
    s.forEach(x => x.matieresUtilisees.forEach(m =>
      matieres.set(m.typeMatiere, (matieres.get(m.typeMatiere) ?? 0) + m.quantiteKg)));
    return {
      futsNets: s.reduce((t, x) => t + x.nbFutsNets, 0),
      futsCasses: s.reduce((t, x) => t + x.nbFutsCasses, 0),
      ouvertes: s.filter(x => !x.cloturee).length,
      matieres: [...matieres.entries()].map(([type, kg]) => ({ type, kg })),
    };
  });

  private readonly nomsParMatricule = computed(() =>
    new Map(this.agents().map(a => [a.matricule, a.nomComplet])));

  ngOnInit(): void {
    this.chargerAgents();
    this.chargerPphs();
    this.chargerSessions();
  }

  private chargerAgents(): void {
    this.svc.getAgentsProduction().subscribe({
      next: list => this.agents.set(list),
      error: (e: unknown) => this.noterErreur(e, 'La liste des employés n\'a pas pu être chargée.'),
    });
  }

  chargerPphs(): void {
    this.chargement.set(true);
    this.svc.getPPHs('EN_COURS').subscribe({
      next: list => {
        this.pphs.set(list);
        this.chargement.set(false);
        if (list.length === 0) {
          this.referenceChoisie.set('');
          this.affectation.set(null);
        } else if (!list.some(p => p.referencePPH === this.referenceChoisie())) {
          this.choisirPph(list[0].referencePPH);
        }
      },
      error: (e: unknown) => { this.chargement.set(false); this.noterErreur(e, 'Les plans en cours n\'ont pas pu être chargés.'); },
    });
  }

  choisirPph(reference: string): void {
    this.referenceChoisie.set(reference);
    this.affectation.set(null);
    this.sansAffectation.set(false);
    this.posteChoisi.set('');
    this.employes.set([]);
    this.message.set('');
    this.erreur.set('');
    if (reference) this.chargerAffectation(reference);
  }

  private chargerAffectation(reference: string): void {
    this.chargement.set(true);
    this.svc.getAffectationDuJour(reference).subscribe({
      next: a => {
        this.affectation.set(a);
        this.chargement.set(false);
        const sansProd = a.lignes.find(l => !a.saisies.some(s => s.codePoste === l.codePoste && s.productionsIndividuelles.length > 0));
        this.choisirPoste((sansProd ?? a.lignes[0])?.codePoste ?? '');
      },
      error: (e: unknown) => {
        this.chargement.set(false);
        if ((e as { status?: number })?.status === 404) {
          this.sansAffectation.set(true);
          return;
        }
        this.noterErreur(e, 'L\'affectation du jour n\'a pas pu être chargée.');
      },
    });
  }

  private chargerSessions(): void {
    this.svc.getSessionsDosageParDate(dateLocaleIso()).subscribe({
      next: list => { this.sessions.set(list); this.erreurSessions.set(''); },
      error: (e: unknown) => {
        this.sessions.set([]);
        if ((e as { status?: number })?.status === 401) { this.sessionExpiree.set(true); return; }
        this.erreurSessions.set('Les sessions de dosage du jour n\'ont pas pu être chargées.');
      },
    });
  }

  /** Ouvre un poste : un employé par ligne, quantités pré-remplies si elles existent déjà. */
  choisirPoste(code: string): void {
    this.posteChoisi.set(code);
    this.message.set('');
    this.erreur.set('');
    const a = this.affectation();
    const ligne = a?.lignes.find(l => l.codePoste === code);
    if (!ligne) { this.employes.set([]); return; }
    const objectif = ligne.matriculesEmployes.length > 0 ? ligne.objectifAjuste / ligne.matriculesEmployes.length : 0;
    const existantes = new Map(
      (a?.saisies.find(s => s.codePoste === code)?.productionsIndividuelles ?? [])
        .map(p => [p.matriculeEmploye, p.quantiteRealisee]));
    this.employes.set(ligne.matriculesEmployes.map(m => ({
      matricule: m,
      nom: this.nomsParMatricule().get(m) ?? '',
      objectif,
      quantite: existantes.has(m) ? existantes.get(m)! : null,
    })));
  }

  majQuantite(i: number, valeur: number | null): void {
    const q = valeur === null || valeur === undefined ? null : Number(valeur);
    this.employes.update(l => l.map((e, k) => k === i ? { ...e, quantite: q } : e));
  }

  /** Taux individuel en % ; null tant que la quantité n'est pas saisie. */
  tauxEmploye(e: LigneEmploye): number | null {
    if (e.quantite === null || !Number.isFinite(e.quantite)) return null;
    return e.objectif > 0 ? e.quantite / e.objectif * 100 : null;
  }

  niveauEmploye(e: LigneEmploye): Niveau {
    const t = this.tauxEmploye(e);
    return this.niveau(t ?? 0, t !== null);
  }

  niveau(pct: number, renseigne: boolean): Niveau {
    if (!renseigne) return 'vide';
    if (pct >= SEUIL_DEPASSEMENT) return 'depasse';
    if (pct >= SEUIL_OBJECTIF_ATTEINT) return 'ok';
    if (pct >= SEUIL_VIGILANCE) return 'moyen';
    return 'bas';
  }

  libelleNiveau(n: Niveau): string {
    return ({ vide: 'À saisir', bas: 'Sous le seuil', moyen: 'À surveiller', ok: 'Objectif atteint', depasse: 'Dépassement à vérifier' } as const)[n];
  }

  nomEmploye(matricule: string): string {
    return this.nomsParMatricule().get(matricule) ?? matricule;
  }

  /**
   * Enregistre les productions du poste. Le total individuel devient la réalisation du poste : le serveur remplace
   * la saisie existante, donc les détails déjà saisis (épluchage, cartons…) sont renvoyés tels quels.
   */
  enregistrer(): void {
    const a = this.affectation();
    const code = this.posteChoisi();
    if (!a || !this.peutEnregistrer()) return;
    const existante = this.saisieCourante();
    if (existante && !confirm(`Une réalisation est déjà enregistrée pour ${this.ligneCourante()?.libellePoste}. Elle sera remplacée. Continuer ?`)) return;

    const d = existante?.details;
    const details: Record<string, number> = {};
    if (d) {
      if (d.nbRegimesEpluches !== null) details['nbRegimesEpluches'] = d.nbRegimesEpluches;
      if (d.nbRegimesDecoupes !== null) details['nbRegimesDecoupes'] = d.nbRegimesDecoupes;
      if (d.nbSceauxEtiquetes !== null) details['nbSceauxEtiquetes'] = d.nbSceauxEtiquetes;
      if (d.nbEtiquettesDatees !== null) details['nbEtiquettesDatees'] = d.nbEtiquettesDatees;
      if (d.nbSachetsDates !== null) details['nbSachetsDates'] = d.nbSachetsDates;
      if (d.nbCartonsProduits !== null) details['nbCartonsProduits'] = d.nbCartonsProduits;
      if (d.kgChipsProduits !== null) details['kgChipsProduits'] = d.kgChipsProduits;
    }

    this.enregistrement.set(true);
    this.erreur.set('');
    this.message.set('');
    this.svc.saisirRealisationPoste({
      affectationId: a.id,
      poste: code,
      quantiteRealisee: this.totalSaisi(),
      productionsIndividuelles: this.employes().map(e => ({
        matriculeEmploye: e.matricule,
        nomEmploye: e.nom.trim() || this.nomEmploye(e.matricule),
        poste: code,
        quantiteRealisee: e.quantite ?? 0,
      })),
      details: Object.keys(details).length ? details : undefined,
    }).subscribe({
      next: maj => {
        this.affectation.set(maj);
        this.enregistrement.set(false);
        this.message.set(`Productions individuelles enregistrées pour ${this.ligneCourante()?.libellePoste}.`);
        this.choisirPoste(code);
      },
      error: (e: unknown) => {
        this.enregistrement.set(false);
        this.noterErreur(e, 'Les productions n\'ont pas pu être enregistrées.');
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
    this.erreur.set(err?.error?.erreur || err?.error?.message || repli);
  }

  /** Le poste a-t-il déjà des productions individuelles saisies aujourd'hui ? */
  posteSaisi(codePoste: string): boolean {
    return (this.affectation()?.saisies ?? []).some(s => s.codePoste === codePoste && s.productionsIndividuelles.length > 0);
  }

  readonly nbEmployesRenseignes = computed(() => this.employes().filter(e => e.quantite !== null).length);
}
