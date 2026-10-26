import { Component, OnInit, computed, inject, signal } from '@angular/core';
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

/** Une ligne de l'éditeur ; les matricules sont saisis en texte, séparés par des virgules ou des espaces. */
interface LigneForm {
  poste: string;
  matriculesTexte: string;
  duree: string;
}

/**
 * PLANNING JOURNALIER — Responsable de Salle.
 * Consulte l'affectation du jour d'un plan en cours, la corrige tant qu'elle est en brouillon, puis la confirme.
 * Une fois confirmée, le planning est verrouillé et les réalisations peuvent être saisies.
 * La création de l'affectation se fait sur la page « Affectation des employés ».
 */
@Component({
  selector: 'app-rs-planning-journalier',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, FormsModule, RouterLink],
  templateUrl: './rs-planning-journalier.component.html',
  styleUrls: ['./rs-planning-journalier.component.css'],
})
export class RsPlanningJournalierComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  readonly aujourdhui = dateLocaleIso();
  readonly durees = DUREES_AFFECTATION;

  readonly chargement = signal(true);
  readonly chargementAffectation = signal(false);
  readonly action = signal<'' | 'enregistrer' | 'confirmer'>('');
  readonly message = signal('');
  readonly erreur = signal('');
  readonly sessionExpiree = signal(false);
  /** Vrai quand le plan n'a pas d'affectation pour aujourd'hui (réponse 404, cas normal). */
  readonly sansAffectation = signal(false);

  readonly pphs = signal<PPHBE[]>([]);
  readonly referenceChoisie = signal('');
  readonly affectation = signal<AffectationBE | null>(null);
  readonly postes = signal<CodePosteRef[]>([]);
  readonly agents = signal<AgentProductionBE[]>([]);

  readonly modeEdition = signal(false);
  readonly lignesEdition = signal<LigneForm[]>([]);

  readonly estVerrouillee = computed(() => this.affectation()?.statut === 'VALIDEE');
  readonly nbPostes = computed(() => this.affectation()?.lignes.length ?? 0);
  readonly nbEmployes = computed(() =>
    new Set((this.affectation()?.lignes ?? []).flatMap(l => l.matriculesEmployes)).size);
  readonly nbDemiJournees = computed(() =>
    (this.affectation()?.lignes ?? []).filter(l => l.duree === 'DEMI_JOURNEE').length);

  readonly agentsParMatricule = computed(() => new Map(this.agents().map(a => [a.matricule, a])));

  /** Lignes complètes (poste et au moins un employé) : seules elles sont envoyées. */
  readonly lignesPretes = computed(() => this.lignesEdition()
    .filter(l => l.poste && this.matriculesDe(l.matriculesTexte).length > 0)
    .map(l => ({ poste: l.poste, matriculesEmployes: this.matriculesDe(l.matriculesTexte), duree: l.duree })));

  /** Erreurs bloquantes de la saisie, affichées avant tout envoi. */
  readonly erreursEdition = computed(() => {
    const msgs = new Set<string>();
    const parMatricule = this.agentsParMatricule();
    const vus = new Set<string>();
    this.lignesEdition().forEach((l, i) => {
      const mats = this.matriculesDe(l.matriculesTexte);
      if (!l.poste && mats.length > 0) msgs.add(`Ligne ${i + 1} : choisissez un poste.`);
      if (l.poste && mats.length === 0) msgs.add(`Ligne ${i + 1} : ajoutez au moins un employé.`);
      for (const m of mats) {
        const agent = parMatricule.get(m);
        if (!agent || !agent.actif) msgs.add(`${m} : matricule inconnu ou inactif.`);
        if (vus.has(m)) msgs.add(`${m} est affecté à plusieurs postes.`);
        vus.add(m);
      }
    });
    return [...msgs];
  });

  readonly peutEnregistrer = computed(() =>
    this.modeEdition() && this.action() === '' && this.lignesPretes().length > 0 && this.erreursEdition().length === 0);

  ngOnInit(): void {
    this.chargerReferentiels();
    this.chargerPphs();
  }

  /** Postes et employés viennent du serveur : un poste ou un employé ajouté apparaît sans toucher au code. */
  private chargerReferentiels(): void {
    this.svc.getPostesProduction().subscribe({
      next: list => this.postes.set(list),
      error: (e: unknown) => this.noterErreur(e, 'Le référentiel des postes n\'a pas pu être chargé.'),
    });
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
    this.modeEdition.set(false);
    this.lignesEdition.set([]);
    this.message.set('');
    this.erreur.set('');
    this.affectation.set(null);
    this.sansAffectation.set(false);
    if (reference) this.chargerAffectation(reference);
  }

  chargerAffectation(reference: string): void {
    this.chargementAffectation.set(true);
    this.svc.getAffectationDuJour(reference).subscribe({
      next: a => {
        this.affectation.set(a);
        this.chargementAffectation.set(false);
      },
      error: (e: unknown) => {
        this.chargementAffectation.set(false);
        if ((e as { status?: number })?.status === 404) {
          this.sansAffectation.set(true);
          return;
        }
        this.noterErreur(e, 'L\'affectation du jour n\'a pas pu être chargée.');
      },
    });
  }

  ouvrirEdition(): void {
    const a = this.affectation();
    if (!a || this.estVerrouillee()) return;
    const lignes = a.lignes.map(l => ({
      poste: l.codePoste,
      matriculesTexte: l.matriculesEmployes.join(', '),
      duree: l.duree,
    }));
    this.lignesEdition.set(lignes.length ? lignes : [{ poste: '', matriculesTexte: '', duree: 'JOURNEE_COMPLETE' }]);
    this.modeEdition.set(true);
    this.message.set('');
    this.erreur.set('');
  }

  annulerEdition(): void {
    this.modeEdition.set(false);
    this.lignesEdition.set([]);
  }

  ajouterLigne(): void {
    this.lignesEdition.update(l => [...l, { poste: '', matriculesTexte: '', duree: 'JOURNEE_COMPLETE' }]);
  }

  retirerLigne(i: number): void {
    this.lignesEdition.update(l => l.filter((_, k) => k !== i));
  }

  majPoste(i: number, poste: string): void {
    this.lignesEdition.update(l => l.map((x, k) => k === i ? { ...x, poste } : x));
  }

  majDuree(i: number, duree: string): void {
    this.lignesEdition.update(l => l.map((x, k) => k === i ? { ...x, duree } : x));
  }

  majMatricules(i: number, matriculesTexte: string): void {
    this.lignesEdition.update(l => l.map((x, k) => k === i ? { ...x, matriculesTexte } : x));
  }

  enregistrer(): void {
    const a = this.affectation();
    if (!a || !this.peutEnregistrer()) return;
    this.action.set('enregistrer');
    this.erreur.set('');
    this.svc.modifierLignesAffectation(a.id, this.lignesPretes()).subscribe({
      next: maj => {
        this.affectation.set(maj);
        this.modeEdition.set(false);
        this.lignesEdition.set([]);
        this.message.set('Planning mis à jour. Les objectifs ont été recalculés par le serveur.');
        this.action.set('');
      },
      error: (e: unknown) => {
        this.action.set('');
        this.noterErreur(e, 'Le planning n\'a pas pu être enregistré.');
      },
    });
  }

  /** Confirmer verrouille la production de la journée : une confirmation est demandée. */
  confirmer(): void {
    const a = this.affectation();
    if (!a || this.estVerrouillee() || this.action() !== '') return;
    if (!confirm('Confirmer le planning ? Il sera verrouillé et ne pourra plus être modifié.')) return;
    this.action.set('confirmer');
    this.erreur.set('');
    this.svc.validerAffectation(a.id).subscribe({
      next: maj => {
        this.affectation.set(maj);
        this.modeEdition.set(false);
        this.message.set('Planning confirmé. La production de la journée est verrouillée.');
        this.action.set('');
      },
      error: (e: unknown) => {
        this.action.set('');
        this.noterErreur(e, 'Le planning n\'a pas pu être confirmé.');
      },
    });
  }

  /** Objectif indicatif d'une ligne, selon l'effectif, le référentiel du poste et la durée. */
  objectifIndicatif(poste: string, effectif: number, duree: string): number {
    const p = this.postes().find(c => c.code === poste);
    if (!p || !p.effectifReference) return 0;
    const coeff = duree === 'DEMI_JOURNEE' ? 0.5 : 1;
    return Math.round((effectif / p.effectifReference) * p.productionJournaliere * coeff * 10) / 10;
  }

  /** Découpe la saisie en matricules en majuscules, sans doublon dans la même ligne. */
  matriculesDe(texte: string): string[] {
    const mats = texte.split(/[,;\s]+/).map(m => m.trim().toUpperCase()).filter(Boolean);
    return [...new Set(mats)];
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

  private noterErreur(e: unknown, repli: string): void {
    const err = e as { status?: number; error?: { erreur?: string; message?: string } };
    if (err?.status === 401) {
      this.sessionExpiree.set(true);
      this.erreur.set('Votre session a été fermée, probablement parce que ce compte a été ouvert ailleurs.');
      return;
    }
    this.erreur.set(err?.error?.erreur || err?.error?.message || repli);
  }
}
