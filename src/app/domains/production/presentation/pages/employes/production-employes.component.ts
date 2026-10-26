import { Component, OnInit, signal, computed, inject, HostListener } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import {
  ProductionService, LigneRegistreBE, PPHBE, AgentProductionBE, AffectationBE,
  CODES_POSTE, CodePosteRef, RegistreProductionBE
} from '../../../infrastructure/production.service';
import { ProductionRoleService } from '../../../infrastructure/production-role.service';

/** Ligne du formulaire : un employé, son poste et sa présence. */
interface LigneForm {
  matriculeEmploye: string;
  nomEmploye: string;
  poste: string;
  present: boolean;
  motifAbsence: string;
  heureArrivee: string;
  qteRealisee: number | null;
  unite: string;
}

/** Date au format yyyy-mm-dd en heure locale (évite le décalage de toISOString le soir). */
function formaterDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * REGISTRE DES EMPLOYÉS — Chef de Production.
 * Présences et réalisations du jour, par PPH : un registre par PPH et par date.
 * Le registre d'une date passée se consulte, il ne se modifie pas depuis cette page.
 */
@Component({
  selector: 'app-production-employes',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './production-employes.component.html',
  styleUrls: ['./production-employes.component.css']
})
export class ProductionEmployesComponent implements OnInit {
  private readonly svc = inject(ProductionService);
  private readonly roles = inject(ProductionRoleService);

  /**
   * Saisie possible pour le Responsable de Salle et le Chef de Production (et l'Admin).
   * Le premier qui enregistre le registre d'un PPH pour la journée bloque l'autre : le serveur
   * refuse un second registre pour le même PPH et la même date.
   */
  peutSaisir = computed(() => this.roles.hasRole('RESPONSABLE_SALLE', 'CHEF_PRODUCTION', 'ADMIN'));

  /** PPH déjà enregistrés aujourd'hui : leur registre ne peut plus être saisi. */
  pphDejaSaisis = computed(() => new Set(this.registresDuJour().map(r => r.referencePPH)));

  readonly aujourdhui = formaterDate(new Date());

  // ── Chargement ──
  pphs = signal<PPHBE[]>([]);
  agents = signal<AgentProductionBE[]>([]);
  codesPoste = signal<CodePosteRef[]>(CODES_POSTE);
  registresDuJour = signal<RegistreProductionBE[]>([]);
  enAttente = signal(0);
  chargement = computed(() => this.enAttente() > 0);
  erreurs = signal<{ registres?: string; agents?: string }>({});
  derniereMaj = signal<Date | null>(null);
  private requete = 0;

  // ── Registre du jour ──
  pphAffiche = signal<string>('');
  registreAffiche = computed<RegistreProductionBE | null>(() => {
    const liste = this.registresDuJour();
    return liste.find(r => r.referencePPH === this.pphAffiche()) ?? liste[0] ?? null;
  });

  presents = computed(() => this.registreAffiche()?.lignes.filter(l => l.present) ?? []);
  absents = computed(() => this.registreAffiche()?.lignes.filter(l => !l.present) ?? []);
  tauxPresence = computed(() => {
    const total = this.registreAffiche()?.lignes.length ?? 0;
    return total > 0 ? Math.round((this.presents().length / total) * 100) : 0;
  });
  postesDistincts = computed(() => new Set(this.registreAffiche()?.lignes.map(l => l.poste)).size);
  production = computed(() => this.presents().reduce((t, l) => t + (l.qteRealisee || 0), 0));

  // ── Saisie du registre ──
  tiroirOuvert = signal(false);
  referencePPH = signal('');
  lignes = signal<LigneForm[]>([]);
  affectationJour = signal<AffectationBE | null>(null);
  chargementAffectation = signal(false);
  erreurFormulaire = signal('');
  envoi = signal(false);

  /** Un registre existe déjà pour ce PPH aujourd'hui : on ne peut pas en créer un second. */
  registreExistant = computed(() =>
    this.registresDuJour().find(r => r.referencePPH === this.referencePPH()) ?? null);

  /** Agents proposés : ceux de l'affectation du jour, sinon tous les agents actifs. */
  agentsProposes = computed(() => {
    const aff = this.affectationJour();
    const agents = this.agents();
    if (!aff) {
      return agents.filter(a => a.actif).map(a => ({ matricule: a.matricule, nomComplet: a.nomComplet, poste: '', libellePoste: '' }));
    }
    const liste: { matricule: string; nomComplet: string; poste: string; libellePoste: string }[] = [];
    for (const ligne of aff.lignes) {
      for (const mat of ligne.matriculesEmployes) {
        const agent = agents.find(a => a.matricule === mat);
        if (agent) liste.push({ matricule: agent.matricule, nomComplet: agent.nomComplet, poste: ligne.codePoste, libellePoste: ligne.libellePoste });
      }
    }
    return liste;
  });

  /** Erreur bloquante d'une ligne, ou null. */
  erreurLigne(l: LigneForm): string | null {
    if (!l.matriculeEmploye) return 'Choisissez un agent';
    if (!l.poste) return 'Choisissez un poste';
    if (l.present && (l.qteRealisee === null || l.qteRealisee < 0)) return 'Quantité réalisée : nombre positif';
    if (l.present && !/^([01]\d|2[0-3]):[0-5]\d$/.test(l.heureArrivee)) return 'Heure d\'arrivée au format HH:mm';
    return null;
  }

  /** Un même agent ne peut figurer que sur une ligne. */
  matriculesEnDouble = computed(() => {
    const vus = new Set<string>();
    const doubles = new Set<string>();
    for (const l of this.lignes()) {
      if (!l.matriculeEmploye) continue;
      if (vus.has(l.matriculeEmploye)) doubles.add(l.matriculeEmploye);
      vus.add(l.matriculeEmploye);
    }
    return doubles;
  });

  formulaireValide = computed(() => {
    const ls = this.lignes();
    return !!this.referencePPH() && ls.length > 0 && !this.registreExistant()
      && ls.every(l => this.erreurLigne(l) === null) && this.matriculesEnDouble().size === 0;
  });

  // ── Consultation d'un registre précis ──
  consultPph = signal('');
  consultDate = signal(this.aujourdhui);
  consultResultat = signal<RegistreProductionBE | null>(null);
  consultChargement = signal(false);
  consultMessage = signal('');

  notification = signal<{ type: 'ok' | 'erreur'; texte: string } | null>(null);
  private minuterie: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.charger();
    this.svc.getPPHs().subscribe({ next: p => this.pphs.set(p), error: () => this.pphs.set([]) });
    this.svc.getPostesProduction().subscribe({
      next: p => this.codesPoste.set(p.length > 0 ? p : CODES_POSTE),
      error: () => this.codesPoste.set(CODES_POSTE),
    });
  }

  @HostListener('document:keydown.escape')
  onEchap(): void {
    if (this.tiroirOuvert() && !this.envoi()) this.fermerTiroir();
  }

  charger(): void {
    const id = ++this.requete;
    this.enAttente.set(2);
    this.erreurs.set({});
    const termine = (source: 'registres' | 'agents', erreur?: string) => {
      if (id !== this.requete) return;
      if (erreur) this.erreurs.update(e => ({ ...e, [source]: erreur }));
      this.enAttente.update(n => n - 1);
      if (this.enAttente() === 0) this.derniereMaj.set(new Date());
    };
    const messageErreur = (e: any) => e?.error?.erreur || e?.error?.message || 'Chargement impossible.';

    this.svc.getRegistres({ debut: this.aujourdhui, fin: this.aujourdhui }).subscribe({
      next: r => { if (id === this.requete) this.registresDuJour.set(r); termine('registres'); },
      error: e => { if (id === this.requete) this.registresDuJour.set([]); termine('registres', messageErreur(e)); },
    });
    this.svc.getAgentsProduction().subscribe({
      next: a => { if (id === this.requete) this.agents.set(a); termine('agents'); },
      error: e => { if (id === this.requete) this.agents.set([]); termine('agents', messageErreur(e)); },
    });
  }

  choisirPphAffiche(ref: string): void {
    this.pphAffiche.set(ref);
  }

  // ── Tiroir de saisie ──
  ouvrirTiroir(): void {
    if (!this.peutSaisir()) return;
    this.erreurFormulaire.set('');
    this.referencePPH.set('');
    this.affectationJour.set(null);
    this.lignes.set([this.ligneVide()]);
    this.tiroirOuvert.set(true);
  }

  fermerTiroir(): void {
    if (this.envoi()) return;
    this.tiroirOuvert.set(false);
  }

  /** Changement de PPH : l'affectation du jour de ce PPH fixe les agents et leurs postes. */
  choisirPph(ref: string): void {
    this.referencePPH.set(ref);
    this.affectationJour.set(null);
    this.lignes.set([this.ligneVide()]);
    this.erreurFormulaire.set('');
    if (!ref) return;
    this.chargementAffectation.set(true);
    this.svc.getAffectationDuJour(ref).subscribe({
      next: a => { this.affectationJour.set(a); this.chargementAffectation.set(false); },
      error: () => { this.affectationJour.set(null); this.chargementAffectation.set(false); },
    });
  }

  ajouterLigne(): void {
    this.lignes.update(ls => [...ls, this.ligneVide()]);
  }

  supprimerLigne(i: number): void {
    this.lignes.update(ls => ls.filter((_, idx) => idx !== i));
  }

  /** Choix de l'agent : nom et poste viennent de l'affectation quand elle existe. */
  choisirAgent(i: number, matricule: string): void {
    const agent = this.agentsProposes().find(a => a.matricule === matricule);
    const base = this.agents().find(a => a.matricule === matricule);
    this.lignes.update(ls => ls.map((l, idx) => idx === i
      ? { ...l, matriculeEmploye: matricule, nomEmploye: agent?.nomComplet ?? base?.nomComplet ?? '', poste: agent?.poste ?? l.poste }
      : l));
  }

  majLigne(i: number, champ: keyof LigneForm, valeur: unknown): void {
    const propre = typeof valeur === 'number' && Number.isNaN(valeur) ? null : valeur;
    this.lignes.update(ls => ls.map((l, idx) => idx === i ? { ...l, [champ]: propre } : l));
  }

  enregistrer(): void {
    if (!this.formulaireValide() || this.envoi()) return;
    this.envoi.set(true);
    this.erreurFormulaire.set('');
    this.svc.enregistrerRegistre({
      referencePPH: this.referencePPH(),
      date: this.aujourdhui,
      lignes: this.lignes().map(l => ({
        matriculeEmploye: l.matriculeEmploye,
        nomEmploye: l.nomEmploye,
        poste: l.poste,
        present: l.present,
        motifAbsence: l.present ? undefined : (l.motifAbsence.trim() || undefined),
        heureArrivee: l.present ? l.heureArrivee : undefined,
        qteRealisee: l.present ? Number(l.qteRealisee ?? 0) : 0,
        unite: l.unite || undefined,
      })),
    }).subscribe({
      next: r => {
        this.envoi.set(false);
        this.tiroirOuvert.set(false);
        this.pphAffiche.set(r.referencePPH);
        this.notifier(`Registre ${r.referencePPH} enregistré — ${r.nbPresents} présent(s), ${r.nbAbsents} absent(s).`, 'ok');
        this.charger();
      },
      error: e => {
        this.envoi.set(false);
        this.erreurFormulaire.set(e?.error?.erreur || e?.error?.message || 'Enregistrement impossible.');
      },
    });
  }

  // ── Consultation ──
  consulter(): void {
    if (!this.consultPph() || !this.consultDate()) {
      this.consultMessage.set('Choisissez un PPH et une date.');
      return;
    }
    this.consultChargement.set(true);
    this.consultMessage.set('');
    this.svc.getRegistre(this.consultPph(), this.consultDate()).subscribe({
      next: r => { this.consultResultat.set(r); this.consultChargement.set(false); },
      error: () => {
        this.consultResultat.set(null);
        this.consultChargement.set(false);
        this.consultMessage.set('Aucun registre pour ce PPH à cette date.');
      },
    });
  }

  notifier(texte: string, type: 'ok' | 'erreur'): void {
    this.notification.set({ type, texte });
    if (this.minuterie) clearTimeout(this.minuterie);
    this.minuterie = setTimeout(() => this.notification.set(null), 5000);
  }

  // ── Affichage ──
  private ligneVide(): LigneForm {
    return { matriculeEmploye: '', nomEmploye: '', poste: '', present: true, motifAbsence: '', heureArrivee: '', qteRealisee: null, unite: 'kg' };
  }

  libellePoste(code: string): string {
    return this.codesPoste().find(c => c.code === code)?.libelle ?? code;
  }

  formaterQuantite(v: number): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(v);
  }

  /** Motif d'absence : tiret si aucun motif n'a été saisi. */
  motifOuTiret(l: LigneRegistreBE): string {
    return l.motifAbsence?.trim() || '—';
  }
}
