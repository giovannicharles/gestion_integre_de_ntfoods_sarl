import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProductionService, PPHBE, PPHLigneBE, AvancementBroyageBE } from '../../../infrastructure/production.service';
import { StockService, BonCommandeBE } from '../../../../stock/infrastructure/stock.service';
import { BesoinsParJourComponent } from '../../shared/besoins-par-jour/besoins-par-jour.component';
import { nomsMatieres, qteMatiere, totalKg } from '../../../infrastructure/production-besoins.util';

type FiltreStatut = 'TOUS' | 'BROUILLON' | 'VALIDE' | 'EN_COURS' | 'CLOTURE';

interface LigneModifiable { codeProduit: string; nomProduit: string; objectifSemaine: number; productionRealisee: number; }
interface LigneNouvellePPH { codeProduit: string; nomProduit: string; objectifSemaine: number; }

/**
 * PLANS DE PRODUCTION (PPH) — Chef de Production.
 *
 * Sélection liée : choisir un plan renseigne son bon de commande, et choisir un
 * bon de commande affiche ses plans. Les deux sont toujours cohérents.
 */
@Component({
  selector: 'app-production-plan',
  standalone: true,
  imports: [BesoinsParJourComponent, CommonModule, DatePipe, DecimalPipe, RouterLink, FormsModule],
  templateUrl: './production-plan.component.html',
  styleUrls: ['./production-plan.component.css']
})
export class ProductionPlanComponent implements OnInit {
  private readonly prodSvc = inject(ProductionService);
  private readonly stockSvc = inject(StockService);
  private readonly route = inject(ActivatedRoute);

  // ── Données ───────────────────────────────────────────────────────────────
  plans = signal<PPHBE[]>([]);
  bcs = signal<BonCommandeBE[]>([]);

  // ── Sélection (toujours synchronisée) ─────────────────────────────────────
  plan = signal<PPHBE | null>(null);
  bc = signal<BonCommandeBE | null>(null);
  /** Plans rattachés au BC sélectionné (issus de GET /pph/bc/{ref}). */
  plansDuBc = signal<PPHBE[]>([]);

  loading = signal(true);
  chargementPlan = signal(false);
  erreur = signal('');
  message = signal('');

  // ── Filtres de la liste des plans ─────────────────────────────────────────
  recherche = signal('');
  filtreStatut = signal<FiltreStatut>('TOUS');
  seulementBc = signal(false);

  readonly statuts: { code: FiltreStatut; libelle: string }[] = [
    { code: 'TOUS', libelle: 'Tous' },
    { code: 'BROUILLON', libelle: 'Brouillon' },
    { code: 'VALIDE', libelle: 'Validé' },
    { code: 'EN_COURS', libelle: 'En cours' },
    { code: 'CLOTURE', libelle: 'Clôturé' },
  ];

  plansFiltres = computed(() => {
    const q = this.recherche().trim().toLowerCase();
    const s = this.filtreStatut();
    const source = this.seulementBc() ? this.plansDuBc() : this.plans();
    return source.filter(p =>
      (s === 'TOUS' || p.statut === s) &&
      (!q || p.referencePPH.toLowerCase().includes(q) || (p.referenceBC ?? '').toLowerCase().includes(q)));
  });

  compteStatut(code: FiltreStatut): number {
    return code === 'TOUS' ? this.plans().length : this.plans().filter(p => p.statut === code).length;
  }

  // ── Indicateurs du plan sélectionné ───────────────────────────────────────
  lignes = computed<PPHLigneBE[]>(() => this.plan()?.lignes ?? []);
  objectifTotal = computed(() => this.lignes().reduce((s, l) => s + (l.objectifSemaine || 0), 0));
  realiseTotal = computed(() => this.lignes().reduce((s, l) => s + (l.productionRealisee || 0), 0));
  avancement = computed(() => {
    const t = this.objectifTotal();
    return t === 0 ? 0 : Math.min(100, Math.round((this.realiseTotal() / t) * 100));
  });
  futsTotal = computed(() => (this.plan()?.repartitionJours ?? []).reduce((s, j) => s + (j.futsPrevus || 0), 0));
  matieresTotalKg = computed(() => (this.plan()?.repartitionJours ?? [])
    .reduce((s, j) => s + totalKg(j.besoinsMatieresPremiere), 0));
  matieresResume = computed(() => {
    const listes = (this.plan()?.repartitionJours ?? []).map(j => j.besoinsMatieresPremiere);
    return nomsMatieres(listes).map(nom => ({
      nom, quantite: listes.reduce((s, l) => s + qteMatiere(l, nom), 0)
    })).filter(m => m.quantite > 0);
  });
  emballagesTotal = computed(() => (this.plan()?.repartitionJours ?? [])
    .reduce((s, j) => s + j.besoinsEmballage.reduce((t, b) => t + b.quantite, 0), 0));

  /** Les lignes du BC sont-elles couvertes par le plan ? (détecte un plan obsolète par rapport au BC.) */
  ecartBcPlan = computed(() => {
    const bc = this.bc();
    const plan = this.plan();
    if (!bc || !plan) return null;
    const codesPlan = new Set(plan.lignes.map(l => l.codeProduit));
    const absents = bc.lignes.filter(l => !codesPlan.has(l.codeProduit)).map(l => l.codeProduit);
    return absents.length ? absents : null;
  });

  peutRecalculer = computed(() => ['BROUILLON', 'VALIDE'].includes(this.plan()?.statut ?? ''));
  /** Toujours faux : l'API n'expose pas de modification de la période d'un BC existant. */
  peutModifierPeriode = computed(() => false);

  // ── Modales ───────────────────────────────────────────────────────────────
  showCreer = signal(false);
  creerRef = { referencePPH: '', referenceBC: '', semaine: '', dateDebut: '', dateFin: '' };
  creerLignes: LigneNouvellePPH[] = [{ codeProduit: '', nomProduit: '', objectifSemaine: 0 }];

  showLignes = signal(false);
  lignesEdition: LigneModifiable[] = [];

  showPeriode = signal(false);
  periodeDraft = { debut: '', fin: '' };

  // ── Cycle de vie ──────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.prodSvc.getPPHs().subscribe({
      next: list => {
        this.plans.set(this.trierParDate(list));
        this.loading.set(false);
        this.initialiserSelection();
      },
      error: () => { this.erreur.set('Impossible de charger les plans de production.'); this.loading.set(false); }
    });
    this.stockSvc.getBonsCommande().subscribe({
      next: list => this.bcs.set(list),
      error: () => this.erreur.set('Impossible de charger les bons de commande.')
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.showCreer()) this.showCreer.set(false);
    else if (this.showLignes()) this.showLignes.set(false);
    else if (this.showPeriode()) this.showPeriode.set(false);
  }

  /** Sélection initiale : le BC demandé en paramètre, sinon le plan le plus récent. */
  private initialiserSelection(): void {
    const bcParam = this.route.snapshot.queryParamMap.get('bc');
    if (bcParam) { this.selectionnerBc(bcParam); return; }
    const premier = this.plans()[0];
    if (premier) this.selectionnerPlan(premier.referencePPH);
  }

  // ── Sélection liée ────────────────────────────────────────────────────────

  /** Poudre prévue par le plan et poudre écrasée des sessions de broyage (lecture seule). */
  avancementBroyage = signal<AvancementBroyageBE | null>(null);
  erreurAvancementBroyage = signal('');

  private chargerAvancementBroyage(reference: string): void {
    this.avancementBroyage.set(null);
    this.erreurAvancementBroyage.set('');
    this.prodSvc.getAvancementBroyage(reference).subscribe({
      next: a => this.avancementBroyage.set(a),
      error: () => this.erreurAvancementBroyage.set('L\'avancement du broyage n\'a pas pu être chargé.'),
    });
  }

  libelleMatiere(code: string): string {
    return ({ MAIS: 'Maïs', SOJA: 'Soja', ARACHIDE: 'Arachide' } as Record<string, string>)[code] ?? code;
  }

  /** Choisir un plan : charge son détail et renseigne son bon de commande. */
  selectionnerPlan(reference: string): void {
    this.chargementPlan.set(true);
    this.erreur.set('');
    this.chargerAvancementBroyage(reference);
    this.prodSvc.getPPH(reference).subscribe({
      next: p => {
        this.plan.set(p);
        this.chargementPlan.set(false);
        this.synchroniserBc(p.referenceBC);
      },
      error: () => {
        this.erreur.set(`Impossible de charger le plan ${reference}.`);
        this.chargementPlan.set(false);
      }
    });
  }

  /** Choisir un BC : charge ses plans et sélectionne le premier. */
  selectionnerBc(numero: string): void {
    this.bcDemande = numero;
    this.seulementBc.set(true);
    this.filtreStatut.set('TOUS');
    this.recherche.set('');
    if (!numero) {
      this.seulementBc.set(false);
      this.bc.set(null);
      this.plansDuBc.set([]);
      this.plan.set(null);
      this.chargementPlan.set(false);
      return;
    }
    this.chargementPlan.set(true);
    this.erreur.set('');
    this.plansDuBc.set([]);
    this.plan.set(null);
    this.stockSvc.getBonCommande(numero).subscribe({
      next: bc => { if (this.bcDemande === numero) this.bc.set(bc); },
      error: () => { if (this.bcDemande === numero) this.erreur.set(`Bon de commande ${numero} introuvable.`); },
    });
    this.prodSvc.getPPHParBC(numero).subscribe({
      next: liste => {
        if (this.bcDemande !== numero) return;
        const trie = this.trierParDate(liste);
        this.plansDuBc.set(trie);
        if (trie.length) {
          this.selectionnerPlan(trie[0].referencePPH);
        } else {
          this.chargementPlan.set(false);
        }
      },
      error: () => {
        if (this.bcDemande !== numero) return;
        this.plansDuBc.set([]);
        this.chargementPlan.set(false);
      }
    });
  }

  /** Dernier BC demandé : permet d'ignorer les réponses arrivées après un autre choix. */
  private bcDemande = '';

  /** Aligne le BC affiché sur celui du plan sélectionné. */
  private synchroniserBc(referenceBC: string | null): void {
    if (!referenceBC) { this.bc.set(null); this.plansDuBc.set([]); return; }
    if (this.bc()?.numero === referenceBC) return;
    this.stockSvc.getBonCommande(referenceBC).subscribe({
      next: bc => this.bc.set(bc),
      error: () => this.bc.set(null),
    });
    this.prodSvc.getPPHParBC(referenceBC).subscribe({
      next: liste => this.plansDuBc.set(this.trierParDate(liste)),
      error: () => this.plansDuBc.set([]),
    });
  }

  /** Après une action sur le plan, remplace sa version dans la liste et la sélection. */
  private remplacerPlan(maj: PPHBE): void {
    this.plan.set(maj);
    this.plans.update(list => this.trierParDate(list.map(p => p.referencePPH === maj.referencePPH ? maj : p)));
  }

  private trierParDate(liste: PPHBE[]): PPHBE[] {
    return [...liste].sort((a, b) => (b.dateDebut ?? '').localeCompare(a.dateDebut ?? ''));
  }

  // ── Actions sur le plan ───────────────────────────────────────────────────

  validerPlan(): void {
    const ref = this.plan()?.referencePPH;
    if (!ref) return;
    this.prodSvc.validerPPH(ref).subscribe({
      next: p => { this.remplacerPlan(p); this.message.set('Plan validé.'); },
      error: e => this.message.set(this.messageErreur(e, 'Validation impossible.'))
    });
  }

  demarrerPlan(): void {
    const ref = this.plan()?.referencePPH;
    if (!ref) return;
    this.prodSvc.demarrerPPH(ref).subscribe({
      next: p => { this.remplacerPlan(p); this.message.set('Production démarrée.'); },
      error: e => this.message.set(this.messageErreur(e, 'Démarrage impossible.'))
    });
  }

  cloturerPlan(): void {
    const ref = this.plan()?.referencePPH;
    if (!ref || !confirm('Clôturer ce plan ? Il ne sera plus modifiable.')) return;
    this.prodSvc.cloturerPPH(ref).subscribe({
      next: p => { this.remplacerPlan(p); this.message.set('Plan clôturé.'); },
      error: e => this.message.set(this.messageErreur(e, 'Clôture impossible.'))
    });
  }

  recalculerPlan(): void {
    const ref = this.plan()?.referencePPH;
    if (!ref) return;
    if (!confirm('Recalculer ce plan depuis le bon de commande et le catalogue actuels ? Les quantités calculées seront remplacées.')) return;
    this.prodSvc.recalculerPPH(ref).subscribe({
      next: r => {
        this.remplacerPlan(r.pph);
        this.message.set(r.ajustementsManuelsEcrases
          ? 'Plan recalculé. Vos ajustements manuels précédents ont été remplacés, à refaire si besoin.'
          : 'Plan recalculé.');
      },
      error: e => this.message.set(this.messageErreur(e, 'Recalcul impossible (plan démarré, clôturé ou BC introuvable).'))
    });
  }

  // ── Objectifs ─────────────────────────────────────────────────────────────

  ouvrirLignes(): void {
    this.lignesEdition = this.lignes().map(l => ({
      codeProduit: l.codeProduit, nomProduit: l.nomProduit,
      objectifSemaine: l.objectifSemaine, productionRealisee: l.productionRealisee
    }));
    this.showLignes.set(true);
  }

  enregistrerLignes(): void {
    const ref = this.plan()?.referencePPH;
    if (!ref) return;
    this.prodSvc.modifierLignesPPH(ref, this.lignesEdition.map(l => ({
      codeProduit: l.codeProduit, objectifSemaine: l.objectifSemaine
    }))).subscribe({
      next: p => { this.remplacerPlan(p); this.showLignes.set(false); this.message.set('Objectifs enregistrés.'); },
      error: e => this.message.set(this.messageErreur(e, 'Modification des objectifs impossible.'))
    });
  }

  totalEdition(): number {
    return this.lignesEdition.reduce((s, l) => s + (Number(l.objectifSemaine) || 0), 0);
  }

  // ── Période du BC ─────────────────────────────────────────────────────────

  ouvrirPeriode(): void {
    const bc = this.bc();
    if (!bc) return;
    this.periodeDraft = { debut: bc.dateDebutProduction ?? '', fin: bc.dateFinProduction ?? '' };
    this.showPeriode.set(true);
  }

  enregistrerPeriode(): void {
    const bc = this.bc();
    if (!bc) return;
    const { debut, fin } = this.periodeDraft;
    if (!!debut !== !!fin) { this.message.set('Renseignez les deux dates, ou aucune.'); return; }
    if (debut && fin && fin < debut) { this.message.set('La fin doit être après le début.'); return; }
    // L'API n'expose aucune modification de la période d'un BC existant : elle se fixe à sa création.
    this.message.set("La période de production se fixe à la création du bon de commande : l'API ne permet pas de la modifier ensuite.");
  }

  // ── Création manuelle ─────────────────────────────────────────────────────

  ouvrirCreer(): void {
    this.creerRef = { referencePPH: '', referenceBC: this.bc()?.numero ?? '', semaine: '', dateDebut: '', dateFin: '' };
    this.creerLignes = [{ codeProduit: '', nomProduit: '', objectifSemaine: 0 }];
    this.showCreer.set(true);
  }

  creerPlan(): void {
    const lignes = this.creerLignes.filter(l => l.codeProduit.trim() && l.objectifSemaine > 0);
    const r = this.creerRef;
    if (!r.referencePPH || !r.semaine || !r.dateDebut || !r.dateFin || lignes.length === 0) {
      this.message.set('Référence, semaine, dates et au moins une ligne sont obligatoires.');
      return;
    }
    this.prodSvc.creerPPH({ ...r, lignes }).subscribe({
      next: p => {
        this.plans.update(list => this.trierParDate([...list, p]));
        this.showCreer.set(false);
        this.remplacerPlan(p);
        this.synchroniserBc(p.referenceBC);
        this.message.set(`Plan ${p.referencePPH} créé.`);
      },
      error: e => this.message.set(this.messageErreur(e, 'Création du plan impossible.'))
    });
  }

  // ── Affichage ─────────────────────────────────────────────────────────────

  /** Raison précise renvoyée par le backend (champ « erreur »), à défaut le message générique. */
  messageErreur(e: { error?: { erreur?: string; message?: string } } | null, repli: string): string {
    return e?.error?.erreur || e?.error?.message || repli;
  }

  statutClass(s: string | undefined | null): string {
    const map: Record<string, string> = {
      BROUILLON: 'pl-statut pl-statut-brouillon',
      VALIDE: 'pl-statut pl-statut-valide',
      EN_COURS: 'pl-statut pl-statut-encours',
      CLOTURE: 'pl-statut pl-statut-cloture',
    };
    return map[s ?? ''] ?? 'pl-statut';
  }

  statutLibelle(s: string | undefined | null): string {
    return this.statuts.find(x => x.code === s)?.libelle ?? (s ?? '—');
  }

  progression(realise: number, prevu: number): number {
    if (!prevu) return 0;
    return Math.min(100, Math.round((realise / prevu) * 100));
  }

  periodePlan(p: PPHBE): string {
    return `${p.dateDebut} → ${p.dateFin}`;
  }
}
