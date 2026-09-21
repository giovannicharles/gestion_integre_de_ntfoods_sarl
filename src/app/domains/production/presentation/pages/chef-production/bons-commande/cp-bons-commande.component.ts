import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StockService, BonCommandeBE } from '../../../../../stock/infrastructure/stock.service';

// ── Catalogue produits (extrait de LISTE DES PRODUITS.xlsx) ─────────────────
export interface ProduitCatalogue {
  code: string;
  designation: string;
  sku: string | null;
  categorie: string;
  gamme: string;
}

export const CATALOGUE_PRODUITS: ProduitCatalogue[] = [
  // TANTY BOUILLIE DE SOJA — SACHETS
  { code: 'TBS-SAC-001', designation: 'REINE BOUILLIE SOJA ARACHIDES',        sku: null,    categorie: 'TANTY BOUILLIE DE SOJA', gamme: 'Sachets' },
  { code: 'TBS-SAC-002', designation: 'REINE BOUILLIE SOJA CLASSIC',           sku: null,    categorie: 'TANTY BOUILLIE DE SOJA', gamme: 'Sachets' },
  { code: 'TBS-SAC-003', designation: 'REINE BOUILLIE SOJA LACTEE CROISSANCE', sku: null,    categorie: 'TANTY BOUILLIE DE SOJA', gamme: 'Sachets' },
  { code: 'TBS-SAC-004', designation: 'REINE BOUILLIE SOJA MULTI CEREALE',     sku: null,    categorie: 'TANTY BOUILLIE DE SOJA', gamme: 'Sachets' },
  { code: 'TBS-SAC-005', designation: 'REINE BOUILLIE SOJA POISSON',           sku: null,    categorie: 'TANTY BOUILLIE DE SOJA', gamme: 'Sachets' },
  { code: 'TBS-SAC-006', designation: 'TANTY BOUILLIE SOJA ARACHIDES',         sku: null,    categorie: 'TANTY BOUILLIE DE SOJA', gamme: 'Sachets' },
  { code: 'TBS-SAC-007', designation: 'TANTY BOUILLIE SOJA LACTEE',            sku: null,    categorie: 'TANTY BOUILLIE DE SOJA', gamme: 'Sachets' },
  { code: 'TBS-SAC-008', designation: 'TANTY BOUILLIE SOJA NATURE',            sku: null,    categorie: 'TANTY BOUILLIE DE SOJA', gamme: 'Sachets' },
  { code: 'TBS-SAC-009', designation: 'TANTY BOUILLIE SOJA PARFUME',           sku: null,    categorie: 'TANTY BOUILLIE DE SOJA', gamme: 'Sachets' },
  { code: 'TBS-SAC-010', designation: 'TANTY BOUILLIE SOJA POISSON',           sku: null,    categorie: 'TANTY BOUILLIE DE SOJA', gamme: 'Sachets' },
  // TANTY BOUILLIE DE SOJA — ÉTUIS
  { code: 'TBS-ETU-001', designation: 'PRESTIGE REINE BOUILLIE ARACHIDES',         sku: null, categorie: 'TANTY BOUILLIE DE SOJA', gamme: 'Étuis' },
  { code: 'TBS-ETU-002', designation: 'PRESTIGE REINE BOUILLIE CLASSIC',           sku: null, categorie: 'TANTY BOUILLIE DE SOJA', gamme: 'Étuis' },
  { code: 'TBS-ETU-003', designation: 'PRESTIGE REINE BOUILLIE LACTEE CROISSANCE', sku: null, categorie: 'TANTY BOUILLIE DE SOJA', gamme: 'Étuis' },
  { code: 'TBS-ETU-004', designation: 'PRESTIGE REINE BOUILLIE MULTI CEREALE',     sku: null, categorie: 'TANTY BOUILLIE DE SOJA', gamme: 'Étuis' },
  { code: 'TBS-ETU-005', designation: 'PRESTIGE REINE BOUILLIE POISSON',           sku: null, categorie: 'TANTY BOUILLIE DE SOJA', gamme: 'Étuis' },
  { code: 'TBS-ETU-006', designation: 'PRESTIGE TANTY BOUILLIE ARACHIDES',         sku: null, categorie: 'TANTY BOUILLIE DE SOJA', gamme: 'Étuis' },
  { code: 'TBS-ETU-007', designation: 'PRESTIGE TANTY BOUILLIE LACTEE',            sku: null, categorie: 'TANTY BOUILLIE DE SOJA', gamme: 'Étuis' },
  { code: 'TBS-ETU-008', designation: 'PRESTIGE TANTY BOUILLIE NATURE',            sku: null, categorie: 'TANTY BOUILLIE DE SOJA', gamme: 'Étuis' },
  { code: 'TBS-ETU-009', designation: 'PRESTIGE TANTY BOUILLIE PARFUME',           sku: null, categorie: 'TANTY BOUILLIE DE SOJA', gamme: 'Étuis' },
  { code: 'TBS-ETU-010', designation: 'PRESTIGE TANTY BOUILLIE POISSON',           sku: null, categorie: 'TANTY BOUILLIE DE SOJA', gamme: 'Étuis' },
  // REINE COSTARD POWDER — 1L
  { code: 'RCP-1L-001', designation: 'REINE COSTARD POWDER 1L BANANE',        sku: null, categorie: 'TANTY BOUILLIE DE SOJA', gamme: 'Seaux Costard 1L' },
  { code: 'RCP-1L-002', designation: 'REINE COSTARD POWDER 1L FRAISE',        sku: null, categorie: 'TANTY BOUILLIE DE SOJA', gamme: 'Seaux Costard 1L' },
  { code: 'RCP-1L-003', designation: 'REINE COSTARD POWDER 1L FRUITS ET OEUFS',  sku: null, categorie: 'TANTY BOUILLIE DE SOJA', gamme: 'Seaux Costard 1L' },
  { code: 'RCP-1L-004', designation: 'REINE COSTARD POWDER 1L LACTEE BISCUITE',  sku: null, categorie: 'TANTY BOUILLIE DE SOJA', gamme: 'Seaux Costard 1L' },
  // REINE COSTARD POWDER — 2L
  { code: 'RCP-2L-001', designation: 'REINE COSTARD POWDER 2L BANANE',         sku: null, categorie: 'TANTY BOUILLIE DE SOJA', gamme: 'Seaux Costard 2L' },
  { code: 'RCP-2L-002', designation: 'REINE COSTARD POWDER 2L FRAISE',         sku: null, categorie: 'TANTY BOUILLIE DE SOJA', gamme: 'Seaux Costard 2L' },
  { code: 'RCP-2L-003', designation: 'REINE COSTARD POWDER 2L FRUITS ET OEUFS', sku: null, categorie: 'TANTY BOUILLIE DE SOJA', gamme: 'Seaux Costard 2L' },
  { code: 'RCP-2L-004', designation: 'REINE COSTARD POWDER 2L LACTEE BISCUITE', sku: null, categorie: 'TANTY BOUILLIE DE SOJA', gamme: 'Seaux Costard 2L' },
  // REINE COSTARD POWDER — 5L
  { code: 'RCP-5L-001', designation: 'REINE COSTARD POWDER 5L FRUITS ET OEUFS', sku: null, categorie: 'TANTY BOUILLIE DE SOJA', gamme: 'Seaux Costard 5L' },
  // BABYVITA
  { code: 'BVT-001', designation: 'BABYVITA 1L', sku: '12 seaux x 390g', categorie: 'null', gamme: 'Babyvita' },
  { code: 'BVT-002', designation: 'BABYVITA 2L', sku: '4 seaux x 880g',  categorie: 'null', gamme: 'Babyvita' },
  // TANTY CHOCOLAT
  { code: 'TCH-001', designation: 'TANTY CHOCOLAT 2L',  sku: '4 seaux x 2,2kg', categorie: 'null', gamme: 'Seaux' },
  { code: 'TCH-002', designation: 'TANTY CHOCOLAT 5L',  sku: 'seau de 4,1kg',   categorie: 'null', gamme: 'Seaux' },
  { code: 'TCH-003', designation: 'TANTY CHOCOLAT 10L', sku: 'seau de 9,2kg',   categorie: 'null', gamme: 'Seaux' },
  // INGRÉDIENTS
  { code: 'ING-CHP-001', designation: 'TANTY CHAPELURE', sku: '12 etuis x 200g', categorie: 'null', gamme: 'Étuis' },
  // TANTY A GRIGNOTER — MINIS
  { code: 'TAG-MIN-001', designation: 'MIN A GRIGNOTER ARACHIDES ENROBEES',   sku: null, categorie: 'TANTY A GRIGNOTER', gamme: 'Minis' },
  { code: 'TAG-MIN-002', designation: 'MIN A GRIGNOTER CARAMELS',             sku: null, categorie: 'TANTY A GRIGNOTER', gamme: 'Minis' },
  { code: 'TAG-MIN-003', designation: 'MIN A GRIGNOTER CROQUETTES',           sku: null, categorie: 'TANTY A GRIGNOTER', gamme: 'Minis' },
  { code: 'TAG-MIN-004', designation: 'MINI A GRIGNOTER CHIPS DE PLANTAINS',  sku: null, categorie: 'TANTY A GRIGNOTER', gamme: 'Minis' },
  { code: 'TAG-MIN-005', designation: 'TANTY BEIGNETS SOUFFLES',              sku: null, categorie: 'TANTY A GRIGNOTER', gamme: 'Minis' },
  // TANTY A GRIGNOTER — MOYENS
  { code: 'TAG-MOY-001', designation: 'MOYEN A GRIGNOTER ARACHIDES ENROBEES',  sku: null, categorie: 'TANTY A GRIGNOTER', gamme: 'Moyens' },
  { code: 'TAG-MOY-002', designation: 'MOYEN A GRIGNOTER CARAMELS',            sku: null, categorie: 'TANTY A GRIGNOTER', gamme: 'Moyens' },
  { code: 'TAG-MOY-003', designation: 'MOYEN A GRIGNOTER CROQUETTES',          sku: null,  categorie: 'TANTY A GRIGNOTER', gamme: 'Moyens' },
  { code: 'TAG-MOY-004', designation: 'MOYEN A GRIGNOTER CHIPS DE PLANTAINS',  sku: null, categorie: 'TANTY A GRIGNOTER', gamme: 'Moyens' },
  // TANTY A GRIGNOTER — GRANDS
  { code: 'TAG-GRD-001', designation: 'GRAND A GRIGNOTER ARACHIDES ENROBEES', sku: null, categorie: 'TANTY A GRIGNOTER', gamme: 'Grands' },
  { code: 'TAG-GRD-002', designation: 'GRAND A GRIGNOTER CARAMELS',           sku: null, categorie: 'TANTY A GRIGNOTER', gamme: 'Grands' },
  { code: 'TAG-GRD-003', designation: 'GRAND A GRIGNOTER CROQUETTES',         sku: null, categorie: 'TANTY A GRIGNOTER', gamme: 'Grands' },
];

// Groupes pour l'affichage dans le select
export interface GroupeProduits { label: string; produits: ProduitCatalogue[]; }

function grouper(produits: ProduitCatalogue[]): GroupeProduits[] {
  const map = new Map<string, ProduitCatalogue[]>();
  for (const p of produits) {
    const key = `${p.categorie} — ${p.gamme}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }
  return Array.from(map.entries()).map(([label, ps]) => ({ label, produits: ps }));
}

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

  // ── Catalogue ─────────────────────────────────────────────────────────────
  readonly catalogueProduits = CATALOGUE_PRODUITS;
  readonly groupesProduits   = grouper(CATALOGUE_PRODUITS);

  // ── État ──────────────────────────────────────────────────────────────────
  loading    = signal(true);
  saving     = signal(false);
  error      = signal('');
  successMsg = signal('');

  bcs = signal<BonCommandeBE[]>([]);

  // ── Filtres ───────────────────────────────────────────────────────────────
  recherche   = signal('');
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

  // ── Formulaire de création ────────────────────────────────────────────────
  showForm        = signal(false);
  formDateCommande = new Date().toISOString().split('T')[0];
  formDateLivraison = '';
  lignesForm: LigneForm[] = [this.nouvelleLigne()];

  // ── Cycle de vie ─────────────────────────────────────────────────────────
  ngOnInit(): void { this.charger(); }

  charger(): void {
    this.loading.set(true);
    this.error.set('');
    this.svc.getBonsCommande().subscribe({
      next: (list: BonCommandeBE[]) => { this.bcs.set(list); this.loading.set(false); },
      error: () => { this.error.set('Erreur lors du chargement des bons de commande.'); this.loading.set(false); }
    });
  }

  // ── Formulaire ────────────────────────────────────────────────────────────
  ouvrirFormulaire(): void {
    this.formDateCommande  = new Date().toISOString().split('T')[0];
    this.formDateLivraison = '';
    this.lignesForm        = [this.nouvelleLigne()];
    this.error.set('');
    this.successMsg.set('');
    this.showForm.set(true);
  }

  fermerFormulaire(): void { this.showForm.set(false); }

  nouvelleLigne(): LigneForm {
    return { produitCode: '', codeProduit: '', designation: '', sku: null, quantiteCommandee: null, prixUnitaireHT: null };
  }

  /** Appelé quand l'utilisateur choisit un produit dans le select — pré-remplit code, désignation, sku. */
  selectionnerProduit(code: string, index: number): void {
    const produit = CATALOGUE_PRODUITS.find(p => p.code === code);
    const ligne   = this.lignesForm[index];
    if (produit) {
      ligne.codeProduit  = produit.code;
      ligne.designation  = produit.designation;
      ligne.sku          = produit.sku;
    } else {
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

  formulaireValide(): boolean {
    if (!this.formDateCommande) return false;
    return this.lignesForm.every(l => l.codeProduit.trim() && (l.quantiteCommandee ?? 0) > 0);
  }

  soumettre(): void {
    if (!this.formulaireValide()) return;
    this.saving.set(true);
    this.error.set('');
    this.svc.creerBonCommande({
      codeFournisseur: null,
      dateCommande: this.formDateCommande,
      dateLivraisonPrevue: this.formDateLivraison || null,
      lignes: this.lignesForm.map(l => ({
        codeProduit:       l.codeProduit.trim().toUpperCase(),
        designation:       l.designation || null,
        sku:               l.sku || null,
        quantiteCommandee: l.quantiteCommandee!,
        prixUnitaireHT:    l.prixUnitaireHT ?? null,
      }))
    }).subscribe({
      next: (bc: BonCommandeBE) => {
        this.bcs.update(list => [bc, ...list]);
        this.successMsg.set(`Bon de commande ${bc.numero} créé avec succès.`);
        this.saving.set(false);
        this.showForm.set(false);
      },
      error: (err: any) => {
        this.error.set(err?.error?.erreur || err?.error?.message || 'Erreur lors de la création du BC.');
        this.saving.set(false);
      }
    });
  }

  // ── Détail ────────────────────────────────────────────────────────────────
  ouvrirDetail(bc: BonCommandeBE): void { this.bcDetail.set(bc); }
  fermerDetail(): void { this.bcDetail.set(null); }

  // ── Helpers ───────────────────────────────────────────────────────────────
  statutClass(statut: string): string {
    const map: Record<string, string> = {
      BROUILLON:    'badge-neutral',
      VALIDE:       'badge-info',
      ENVOYE:       'badge-warning',
      RECEPTIONNE:  'badge-success',
      CLOTURE:      'badge-neutral',
      ANNULE:       'badge-danger',
    };
    return map[statut] ?? 'badge-neutral';
  }

  montantTotal(bc: BonCommandeBE): number {
    if (bc.montantTotalHT != null) return bc.montantTotalHT;
    return (bc.lignes || []).reduce((s: number, l: any) => s + (l.prixUnitaireHT ?? 0) * l.quantiteCommandee, 0);
  }

  /** Accumulateur pour le calcul du total estimé dans le template. */
  readonly totalEstime = (acc: number, l: LigneForm): number =>
    acc + (l.prixUnitaireHT ?? 0) * (l.quantiteCommandee ?? 0);

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
