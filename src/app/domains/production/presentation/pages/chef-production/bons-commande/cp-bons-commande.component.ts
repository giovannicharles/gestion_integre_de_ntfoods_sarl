import { Component, HostListener, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StockService, BonCommandeBE, FournisseurBE, ProduitBE } from '../../../../../stock/infrastructure/stock.service';
import { ProductionService, PPHBE } from '../../../../infrastructure/production.service';

// Groupes pour l'affichage dans le select — construits depuis le vrai
// catalogue (GET /api/stock/produits), plus jamais une liste codée en dur.
export interface GroupeProduits { label: string; produits: ProduitBE[]; }

function grouper(produits: ProduitBE[]): GroupeProduits[] {
  const map = new Map<string, ProduitBE[]>();
  for (const p of produits) {
    const key = `${p.categorieMetierLibelle ?? p.categorieMetier} — ${p.gamme}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }
  return Array.from(map.entries()).map(([label, ps]) => ({ label, produits: ps }));
}

/** Statuts réels du backend (StatutBonCommande). */
export const STATUTS_BC: { code: string; libelle: string; badge: string }[] = [
  { code: 'BROUILLON',    libelle: 'Brouillon',             badge: 'badge-neutral' },
  { code: 'VALIDE',       libelle: 'Validé',                badge: 'badge-info' },
  { code: 'ENVOYE',       libelle: 'Envoyé au fournisseur', badge: 'badge-warning' },
  { code: 'RECU_PARTIEL', libelle: 'Reçu partiellement',    badge: 'badge-warning' },
  { code: 'RECU_TOTAL',   libelle: 'Reçu en totalité',      badge: 'badge-success' },
  { code: 'CLOTURE',      libelle: 'Clôturé',               badge: 'badge-neutral' },
  { code: 'ANNULE',       libelle: 'Annulé',                badge: 'badge-danger' },
];

// ── Form ────────────────────────────────────────────────────────────────────
interface LigneForm {
  /** Code sélectionné dans le catalogue (pilote le pré-remplissage). */
  produitCode: string;
  codeProduit: string;
  designation: string;
  sku: string | null;
  quantiteCommandee: number | null;
  prixUnitaireHT: number | null;
}

/**
 * GESTION DES BONS DE COMMANDE — Chef de Production
 *
 * Création, suivi et validation des BC. La validation déclenche la génération
 * du plan de production (PPH) côté serveur. La période de production est
 * facultative : sans elle, le plan couvre la semaine ouvrée de la date de commande.
 */
@Component({
  selector: 'app-cp-bons-commande',
  standalone: true,
  imports: [CommonModule, DecimalPipe, DatePipe, FormsModule],
  templateUrl: './cp-bons-commande.component.html',
  styleUrls: ['./cp-bons-commande.component.css', '../_shared.css']
})
export class CpBonsCommandeComponent implements OnInit {
  private readonly svc = inject(StockService);
  private readonly prodSvc = inject(ProductionService);

  readonly statuts = STATUTS_BC;

  // ── Catalogue (chargé depuis GET /api/stock/produits) ──────────────────────
  produits = signal<ProduitBE[]>([]);
  groupesProduits = computed(() => grouper(this.produits()));

  // ── État ──────────────────────────────────────────────────────────────────
  loading    = signal(true);
  saving     = signal(false);
  error      = signal('');
  successMsg = signal('');

  bcs = signal<BonCommandeBE[]>([]);
  fournisseurs = signal<FournisseurBE[]>([]);

  // ── Indicateurs (calculés sur la liste complète, pas sur le filtre) ───────
  nbTotal = computed(() => this.bcs().length);
  nbEnRetard = computed(() => this.bcs().filter(bc => bc.enRetard).length);
  nbEnCours = computed(() => this.bcs().filter(bc => ['VALIDE', 'ENVOYE', 'RECU_PARTIEL'].includes(bc.statut)).length);
  nbBrouillons = computed(() => this.bcs().filter(bc => bc.statut === 'BROUILLON').length);
  montantEnCours = computed(() => this.bcs()
    .filter(bc => ['VALIDE', 'ENVOYE', 'RECU_PARTIEL'].includes(bc.statut))
    .reduce((s, bc) => s + this.montantTotal(bc), 0));

  // ── Filtres ───────────────────────────────────────────────────────────────
  recherche    = signal('');
  filtreStatut = signal('');

  bcsFiltres = computed(() => {
    const r = this.recherche().toLowerCase();
    const s = this.filtreStatut();
    return this.bcs().filter(bc =>
      (!r || bc.numero.toLowerCase().includes(r) || bc.codeFournisseur?.toLowerCase().includes(r)) &&
      (!s || bc.statut === s)
    );
  });

  // ── Détail ────────────────────────────────────────────────────────────────
  bcDetail = signal<BonCommandeBE | null>(null);
  /** PPH généré à partir du BC affiché (null tant qu'il n'y en a pas, ou pendant le chargement). */
  pphDuBc = signal<PPHBE | null>(null);
  actionEnCours = signal(false);
  actionErreur = signal('');

  // ── Période de production (édition depuis le détail) ──────────────────────
  periodeOuverte = signal(false);
  periodeDraft = { debut: '', fin: '' };
  periodeErreur = signal('');

  // ── Formulaire de création ────────────────────────────────────────────────
  showForm          = signal(false);
  formDateCommande  = new Date().toISOString().split('T')[0];
  formDateLivraison = '';
  formDateDebutProd = '';
  formDateFinProd   = '';
  /** Optionnel : laissé vide, le BC est créé sans fournisseur identifié ("NON_DEFINI" côté backend). */
  formCodeFournisseur = '';
  lignesForm: LigneForm[] = [this.nouvelleLigne()];

  // ── Cycle de vie ─────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.charger();
    this.svc.getFournisseurs().subscribe({ next: list => this.fournisseurs.set(list) });
    this.svc.getProduits({ actif: true }).subscribe({ next: list => this.produits.set(list) });
  }

  charger(): void {
    this.loading.set(true);
    this.error.set('');
    this.svc.getBonsCommande().subscribe({
      next: list => { this.bcs.set(list); this.loading.set(false); },
      error: () => { this.error.set('Erreur lors du chargement des bons de commande.'); this.loading.set(false); }
    });
  }

  // ── Formulaire ────────────────────────────────────────────────────────────
  ouvrirFormulaire(): void {
    this.formDateCommande  = new Date().toISOString().split('T')[0];
    this.formDateLivraison = '';
    this.formDateDebutProd = '';
    this.formDateFinProd   = '';
    this.formCodeFournisseur = '';
    this.lignesForm        = [this.nouvelleLigne()];
    this.error.set('');
    this.successMsg.set('');
    this.showForm.set(true);
  }

  fermerFormulaire(): void { if (!this.saving()) this.showForm.set(false); }

  nouvelleLigne(): LigneForm {
    return { produitCode: '', codeProduit: '', designation: '', sku: null, quantiteCommandee: null, prixUnitaireHT: null };
  }

  /** Appelé quand l'utilisateur choisit un produit dans le select — pré-remplit code, désignation, sku. */
  selectionnerProduit(code: string, index: number): void {
    const produit = this.produits().find(p => p.code === code);
    const ligne   = this.lignesForm[index];
    if (produit) {
      ligne.produitCode  = produit.code;
      ligne.codeProduit  = produit.code;
      ligne.designation  = produit.designation;
      ligne.sku          = produit.conditionnements?.[0]?.sku ?? null;
    } else {
      ligne.produitCode  = '';
      ligne.codeProduit  = '';
      ligne.designation  = '';
      ligne.sku          = null;
    }
  }

  ajouterLigne(): void  { this.lignesForm = [...this.lignesForm, this.nouvelleLigne()]; }

  supprimerLigne(i: number): void {
    if (this.lignesForm.length <= 1) return;
    this.lignesForm = this.lignesForm.filter((_, idx) => idx !== i);
  }

  /** Période : les deux dates ou aucune, et fin ≥ début. */
  periodeFormValide(debut: string, fin: string): boolean {
    if (!debut && !fin) return true;
    return !!debut && !!fin && fin >= debut;
  }

  formulaireValide(): boolean {
    if (!this.formDateCommande) return false;
    if (!this.periodeFormValide(this.formDateDebutProd, this.formDateFinProd)) return false;
    return this.lignesForm.every(l => l.codeProduit.trim() && (l.quantiteCommandee ?? 0) > 0);
  }

  get messagePeriodeForm(): string {
    if (!!this.formDateDebutProd !== !!this.formDateFinProd) return 'Renseignez les deux dates de la période, ou aucune.';
    if (this.formDateDebutProd && this.formDateFinProd && this.formDateFinProd < this.formDateDebutProd) return 'La fin de production doit être après le début.';
    return '';
  }

  soumettre(): void {
    if (!this.formulaireValide()) return;
    this.saving.set(true);
    this.error.set('');
    this.svc.creerBonCommande({
      codeFournisseur: this.formCodeFournisseur.trim() || null,
      dateCommande: this.formDateCommande,
      dateLivraisonPrevue: this.formDateLivraison || null,
      dateDebutProduction: this.formDateDebutProd || null,
      dateFinProduction: this.formDateFinProd || null,
      lignes: this.lignesForm.map(l => ({
        codeProduit:       l.codeProduit.trim().toUpperCase(),
        designation:       l.designation || null,
        sku:               l.sku || null,
        quantiteCommandee: l.quantiteCommandee!,
        prixUnitaireHT:    l.prixUnitaireHT ?? null,
      }))
    }).subscribe({
      next: bc => {
        this.bcs.update(list => [bc, ...list]);
        this.successMsg.set(`Bon de commande ${bc.numero} créé avec succès.`);
        this.saving.set(false);
        this.showForm.set(false);
      },
      error: err => {
        this.error.set(err?.error?.erreur || err?.error?.message || 'Erreur lors de la création du BC.');
        this.saving.set(false);
      }
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.bcDetail()) this.fermerDetail();
    else if (this.showForm()) this.fermerFormulaire();
  }

  // ── Détail ────────────────────────────────────────────────────────────────
  ouvrirDetail(bc: BonCommandeBE): void {
    this.bcDetail.set(bc);
    this.pphDuBc.set(null);
    this.actionErreur.set('');
    this.periodeOuverte.set(false);
    this.prodSvc.getPPHParBC(bc.numero).subscribe({
      next: list => this.pphDuBc.set(list[0] ?? null),
      error: () => this.pphDuBc.set(null),
    });
  }

  fermerDetail(): void {
    if (this.actionEnCours()) return;
    this.bcDetail.set(null);
    this.periodeOuverte.set(false);
  }

  peutValider(bc: BonCommandeBE): boolean { return bc.statut === 'BROUILLON'; }
  /** La période se modifie tant que la commande n'a pas été envoyée au fournisseur (même règle que le backend). */
  /** Toujours faux : l'API n'expose pas de modification de la période d'un BC existant. */
  peutModifierPeriode(_bc: BonCommandeBE): boolean { return false; }

  validerBc(bc: BonCommandeBE): void {
    if (!confirm(`Valider le bon de commande ${bc.numero} ? Le plan de production sera généré automatiquement.`)) return;
    this.actionEnCours.set(true);
    this.actionErreur.set('');
    this.svc.validerBonCommande(bc.numero).subscribe({
      next: maj => {
        this.remplacerBc(maj);
        this.actionEnCours.set(false);
        this.successMsg.set(`Bon de commande ${maj.numero} validé. Plan de production généré.`);
        this.prodSvc.getPPHParBC(maj.numero).subscribe({ next: list => this.pphDuBc.set(list[0] ?? null) });
      },
      error: err => {
        this.actionErreur.set(err?.error?.message || 'Validation impossible. Vérifiez les poids unitaires et les produits du BC.');
        this.actionEnCours.set(false);
      }
    });
  }

  ouvrirPeriode(bc: BonCommandeBE): void {
    this.periodeErreur.set('');
    this.periodeDraft = { debut: bc.dateDebutProduction ?? '', fin: bc.dateFinProduction ?? '' };
    this.periodeOuverte.set(true);
  }

  fermerPeriode(): void { this.periodeOuverte.set(false); }

  enregistrerPeriode(bc: BonCommandeBE): void {
    const p = this.periodeDraft;
    if (!this.periodeFormValide(p.debut, p.fin)) {
      this.periodeErreur.set(!!p.debut !== !!p.fin
        ? 'Renseignez les deux dates de la période, ou aucune.'
        : 'La fin de production doit être après le début.');
      return;
    }
    // L'API ne permet pas de modifier la période après création (aucun endpoint) : elle se fixe à la création du BC.
    this.periodeErreur.set('La période de production se fixe à la création du bon de commande : l\'API ne permet pas de la modifier ensuite.');
    void bc;
  }

  private remplacerBc(maj: BonCommandeBE): void {
    this.bcs.update(list => list.map(b => b.id === maj.id ? maj : b));
    this.bcDetail.set(maj);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  statutClass(statut: string): string {
    return this.statuts.find(s => s.code === statut)?.badge ?? 'badge-neutral';
  }

  /** Jours de retard d'un BC (livraison prévue dépassée), 0 si pas en retard. */
  joursRetard(bc: BonCommandeBE): number {
    if (!bc.enRetard || !bc.dateLivraisonPrevue) return 0;
    const [y, m, d] = bc.dateLivraisonPrevue.slice(0, 10).split('-').map(Number);
    const now = new Date();
    const aujourd = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.max(0, Math.round((aujourd - Date.UTC(y, m - 1, d)) / 86400000));
  }

  /** Nombre de BC dans un statut ; chaîne vide = tous. */
  compteStatut(code: string): number {
    return code ? this.bcs().filter(bc => bc.statut === code).length : this.bcs().length;
  }

  /** Teinte d'affichage d'un statut (pastille et pastille de progression). */
  teinte(statut: string): 'gris' | 'bleu' | 'jaune' | 'vert' | 'rouge' {
    switch (statut) {
      case 'VALIDE': return 'bleu';
      case 'ENVOYE':
      case 'RECU_PARTIEL': return 'jaune';
      case 'RECU_TOTAL': return 'vert';
      case 'ANNULE': return 'rouge';
      default: return 'gris';
    }
  }

  statutLibelle(bc: BonCommandeBE): string {
    return bc.statutLibelle ?? this.statuts.find(s => s.code === bc.statut)?.libelle ?? bc.statut;
  }

  /** Période affichée : « du … au … » si renseignée, sinon la semaine ouvrée de la commande (repli serveur). */
  libellePeriode(bc: BonCommandeBE): string {
    if (bc.dateDebutProduction && bc.dateFinProduction) {
      return `${this.formatDate(bc.dateDebutProduction)} → ${this.formatDate(bc.dateFinProduction)}`;
    }
    return 'Semaine de commande';
  }

  private formatDate(iso: string): string {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  montantTotal(bc: BonCommandeBE): number {
    if (bc.montantTotalHT != null) return bc.montantTotalHT;
    return bc.lignes.reduce((s, l) => s + (l.prixUnitaireHT ?? 0) * l.quantiteCommandee, 0);
  }

  /** True si au moins une ligne a une quantité ET un prix renseignés. */
  get aLignesAvecPrix(): boolean {
    return this.lignesForm.some(l => (l.quantiteCommandee || 0) > 0 && (l.prixUnitaireHT || 0) > 0);
  }

  /** Total estimé HT de toutes les lignes du formulaire. */
  get totalEstimeHT(): number {
    return this.lignesForm.reduce(
      (acc, l) => acc + (l.prixUnitaireHT || 0) * (l.quantiteCommandee || 0), 0
    );
  }
}
