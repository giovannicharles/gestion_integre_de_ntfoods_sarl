import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ProductionService, PPHBE, AffectationBE, AgentProductionBE, CodePosteRef, DUREES_AFFECTATION,
} from '../../../../infrastructure/production.service';

/** Date locale au format AAAA-MM-JJ (évite le décalage UTC de toISOString). */
function dateLocaleIso(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Une ligne de l'éditeur : un poste, ses employés et la durée. */
interface LigneForm {
  poste: string;
  matricules: string[];
  duree: string;
}

/**
 * AFFECTATION DES EMPLOYÉS — Responsable de Salle.
 * Affectation du jour d'un plan en cours : postes, employés et durée. Une affectation se crée, se corrige
 * tant qu'elle est en brouillon, puis se valide ; une fois validée elle devient consultation seule.
 * Un employé ne peut occuper qu'un seul poste à la fois dans une même affectation.
 */
@Component({
  selector: 'app-rs-affectation-employes',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, FormsModule, RouterLink],
  templateUrl: './rs-affectation-employes.component.html',
  styleUrls: ['./rs-affectation-employes.component.css'],
})
export class RsAffectationEmployesComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  readonly aujourdhui = dateLocaleIso();
  readonly durees = DUREES_AFFECTATION;

  readonly chargement = signal(true);
  readonly chargementAgents = signal(true);
  readonly chargementAffectation = signal(false);
  readonly action = signal<'' | 'enregistrer' | 'valider'>('');
  readonly message = signal('');
  readonly erreur = signal('');
  readonly sessionExpiree = signal(false);

  readonly pphs = signal<PPHBE[]>([]);
  readonly agents = signal<AgentProductionBE[]>([]);
  readonly postes = signal<CodePosteRef[]>([]);
  readonly affectation = signal<AffectationBE | null>(null);

  readonly referenceChoisie = signal('');
  /** Éditeur : lignes de l'affectation du jour (vide tant qu'aucun plan n'est choisi). */
  readonly lignes = signal<LigneForm[]>([{ poste: '', matricules: [], duree: 'JOURNEE_COMPLETE' }]);

  readonly agentsActifs = computed(() => this.agents().filter(a => a.actif));
  readonly postesActifs = computed(() => this.postes().filter(p => p.actif !== false));

  readonly estEnBrouillon = computed(() => !this.affectation() || this.affectation()!.statut === 'BROUILLON');
  readonly estValidee = computed(() => this.affectation()?.statut === 'VALIDEE');
  readonly planChoisi = computed(() => this.pphs().find(p => p.referencePPH === this.referenceChoisie()) ?? null);

  /** Tous les employés déjà placés dans l'éditeur, toutes lignes confondues. */
  readonly matriculesUtilises = computed(() => new Set(this.lignes().flatMap(l => l.matricules)));

  /** Lignes complètes (poste et au moins un employé) : seules elles sont envoyées. */
  readonly lignesCompletes = computed(() => this.lignes().filter(l => l.poste && l.matricules.length > 0));
  readonly effectifTotal = computed(() => this.matriculesUtilises().size);

  /** Employés actifs qui ne sont placés sur aucun poste de l'affectation en cours. */
  readonly nonAffectes = computed(() => {
    const utilises = this.matriculesUtilises();
    return this.agentsActifs().filter(a => !utilises.has(a.matricule));
  });
  readonly objectifTotal = computed(() =>
    this.lignesCompletes().reduce((t, l) => t + this.objectifIndicatif(l.poste, l.matricules.length, l.duree), 0));

  readonly peutEnregistrer = computed(() =>
    !!this.referenceChoisie() && this.lignesCompletes().length > 0 && this.estEnBrouillon()
    && this.action() === '' && !this.chargementAffectation());
  readonly peutValider = computed(() => !!this.affectation() && this.estEnBrouillon() && this.action() === '');

  ngOnInit(): void {
    this.charger();
    this.chargerAgents();
    this.chargerPostes();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set('');
    this.svc.getPPHs('EN_COURS').subscribe({
      next: list => {
        this.pphs.set(list);
        this.chargement.set(false);
        if (list.length === 1 && !this.referenceChoisie()) this.choisirPph(list[0].referencePPH);
        else if (this.referenceChoisie() && !list.some(p => p.referencePPH === this.referenceChoisie())) this.choisirPph('');
      },
      error: (e: unknown) => {
        this.chargement.set(false);
        this.noterErreur(e, 'Les plans en cours n\'ont pas pu être chargés.');
      },
    });
  }

  chargerAgents(): void {
    this.chargementAgents.set(true);
    this.svc.getAgentsProduction().subscribe({
      next: list => { this.agents.set(list); this.chargementAgents.set(false); },
      error: (e: unknown) => { this.chargementAgents.set(false); this.noterErreur(e, 'La liste des employés n\'a pas pu être chargée.'); },
    });
  }

  /** Postes de production issus du référentiel serveur (et non d'une liste figée). */
  chargerPostes(): void {
    this.svc.getPostesProduction().subscribe({
      next: list => this.postes.set(list),
      error: (e: unknown) => this.noterErreur(e, 'Le référentiel des postes n\'a pas pu être chargé.'),
    });
  }

  choisirPph(reference: string): void {
    this.referenceChoisie.set(reference);
    this.message.set('');
    this.erreur.set('');
    this.affectation.set(null);
    this.lignes.set([{ poste: '', matricules: [], duree: 'JOURNEE_COMPLETE' }]);
    if (reference) this.chargerAffectation(reference);
  }

  /** Lit l'affectation du jour du plan. Une absence (404) signifie simplement qu'il faut en créer une. */
  chargerAffectation(reference: string): void {
    this.chargementAffectation.set(true);
    this.svc.getAffectationDuJour(reference).subscribe({
      next: a => {
        this.affectation.set(a);
        this.remplirEditeur(a);
        this.chargementAffectation.set(false);
      },
      error: (e: unknown) => {
        this.chargementAffectation.set(false);
        if ((e as { status?: number })?.status === 404) {
          this.affectation.set(null);
          return;
        }
        this.noterErreur(e, 'L\'affectation du jour n\'a pas pu être chargée.');
      },
    });
  }

  private remplirEditeur(a: AffectationBE): void {
    const lignes = a.lignes.map(l => ({ poste: l.codePoste, matricules: [...l.matriculesEmployes], duree: l.duree }));
    this.lignes.set(lignes.length ? lignes : [{ poste: '', matricules: [], duree: 'JOURNEE_COMPLETE' }]);
  }

  ajouterLigne(): void {
    this.lignes.update(l => [...l, { poste: '', matricules: [], duree: 'JOURNEE_COMPLETE' }]);
  }

  retirerLigne(i: number): void {
    this.lignes.update(l => l.filter((_, k) => k !== i));
  }

  mettreAJourPoste(i: number, poste: string): void {
    this.lignes.update(l => l.map((x, k) => k === i ? { ...x, poste } : x));
  }

  mettreAJourDuree(i: number, duree: string): void {
    this.lignes.update(l => l.map((x, k) => k === i ? { ...x, duree } : x));
  }

  /** Employés proposés pour la ligne i : ceux qui ne sont placés nulle part ailleurs. */
  disponibles(i: number): AgentProductionBE[] {
    const ailleurs = new Set(this.lignes().filter((_, k) => k !== i).flatMap(l => l.matricules));
    const dejaIci = new Set(this.lignes()[i]?.matricules ?? []);
    return this.agentsActifs().filter(a => !ailleurs.has(a.matricule) && !dejaIci.has(a.matricule));
  }

  ajouterEmploye(i: number, matricule: string): void {
    if (!matricule) return;
    this.lignes.update(l => l.map((x, k) => k === i && !x.matricules.includes(matricule)
      ? { ...x, matricules: [...x.matricules, matricule] } : x));
  }

  retirerEmploye(i: number, matricule: string): void {
    this.lignes.update(l => l.map((x, k) => k === i ? { ...x, matricules: x.matricules.filter(m => m !== matricule) } : x));
  }

  nomAgent(matricule: string): string {
    return this.agents().find(a => a.matricule === matricule)?.nomComplet ?? matricule;
  }

  libellePoste(code: string): string {
    return this.postes().find(p => p.code === code)?.libelle ?? code;
  }

  unitePoste(code: string): string {
    return this.postes().find(p => p.code === code)?.unite ?? '';
  }

  libelleDuree(code: string): string {
    return this.durees.find(d => d.code === code)?.libelle ?? code;
  }

  /** Objectif indicatif d'une ligne, selon l'effectif, le référentiel du poste et la durée. */
  objectifIndicatif(poste: string, effectif: number, duree: string): number {
    const p = this.postes().find(c => c.code === poste);
    if (!p || !p.effectifReference) return 0;
    const coeff = duree === 'DEMI_JOURNEE' ? 0.5 : 1;
    return Math.round((effectif / p.effectifReference) * p.productionJournaliere * coeff * 10) / 10;
  }

  /** Crée l'affectation du jour, ou enregistre les corrections d'un brouillon existant. */
  enregistrer(): void {
    if (!this.peutEnregistrer()) return;
    const lignes = this.lignesCompletes().map(l => ({ poste: l.poste, matriculesEmployes: l.matricules, duree: l.duree }));
    this.action.set('enregistrer');
    this.erreur.set('');
    this.message.set('');
    const a = this.affectation();
    const requete = a
      ? this.svc.modifierLignesAffectation(a.id, lignes)
      : this.svc.creerAffectation({ referencePPH: this.referenceChoisie(), date: this.aujourdhui, lignes });
    requete.subscribe({
      next: maj => {
        this.affectation.set(maj);
        this.remplirEditeur(maj);
        this.message.set(a ? 'Corrections enregistrées.' : 'Affectation créée. Les objectifs sont calculés par le serveur.');
        this.action.set('');
      },
      error: (e: unknown) => {
        this.action.set('');
        this.noterErreur(e, 'L\'affectation n\'a pas pu être enregistrée.');
      },
    });
  }

  /** Valide l'affectation : elle devient consultation seule. */
  valider(): void {
    const a = this.affectation();
    if (!a || !this.peutValider()) return;
    if (!confirm('Valider cette affectation ? Elle ne sera plus modifiable.')) return;
    this.action.set('valider');
    this.erreur.set('');
    this.svc.validerAffectation(a.id).subscribe({
      next: maj => {
        this.affectation.set(maj);
        this.remplirEditeur(maj);
        this.message.set('Affectation validée.');
        this.action.set('');
      },
      error: (e: unknown) => {
        this.action.set('');
        this.noterErreur(e, 'L\'affectation n\'a pas pu être validée.');
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
    // Le serveur renvoie la raison métier (affectation déjà existante, employé déjà affecté…) : on l'affiche
    this.erreur.set(err?.error?.erreur || err?.error?.message || repli);
  }
}
