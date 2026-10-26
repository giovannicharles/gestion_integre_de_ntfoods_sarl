import { Component, OnInit, signal, computed, inject, HostListener } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { from, of, concatMap, catchError, map, toArray } from 'rxjs';
import {
  ProductionService, LotBE, PPHBE, DeclarerLotBE, TYPES_EMBALLAGE,
  ReferentielProductionBE, ConditionnementProductionBE
} from '../../../infrastructure/production.service';
import { ProductionRoleService } from '../../../infrastructure/production-role.service';
import { AuthService } from '../../../../../core/auth/auth.service';
import { ProductSearchComponent } from '../../../../../shared/components/product-search/product-search.component';
import { Product } from '../../../../stock/domain/models/stock.models';

type StatutFiltre = 'TOUS' | 'DECLARE' | 'RECEPTIONNE_STOCK' | 'VALIDATED_BY_STOCK' | 'REJETE';

/** Une ligne du formulaire de déclaration : un produit fini d'un PPH. */
interface LigneLot {
  referencePPH: string;
  productSku: string;
  productName: string;
  productUnit: string;
  declaredQuantityKg: number | null;
  equivalentUnits: number | null;
  dlc: string;
  conditioningType: string;
  conditioningQty: number | null;
  /** true dès que le nombre de conditionnements est saisi à la main : il ne se recalcule plus. */
  conditionnementManuel: boolean;
  notes: string;
}

/** Date au format yyyy-mm-dd en heure locale. */
function formaterDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Règle de datage appliquée par le serveur : 1er du mois si jour < 15, sinon le 15. */
export function dateFabricationDe(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return formaterDate(new Date(y, m - 1, d < 15 ? 1 : 15));
}

const STATUTS: Record<string, { libelle: string; classe: string }> = {
  DECLARE: { libelle: 'Déclaré', classe: 'lo-statut-attente' },
  RECEPTIONNE_STOCK: { libelle: 'Réceptionné stock', classe: 'lo-statut-info' },
  VALIDATED_BY_STOCK: { libelle: 'Validé stock', classe: 'lo-statut-ok' },
  REJETE: { libelle: 'Rejeté', classe: 'lo-statut-erreur' },
};

/**
 * LOTS & CONVERSION — produits finis.
 * Le Chef de Production déclare des lots à partir de ses PPH ; le Gestionnaire de Stock
 * (et le Chef de Production, comme le backend l'autorise) valide ou rejette les lots déclarés.
 */
@Component({
  selector: 'app-production-lots',
  standalone: true,
  imports: [CommonModule, DatePipe, ProductSearchComponent],
  templateUrl: './production-lots.component.html',
  styleUrls: ['./production-lots.component.css']
})
export class ProductionLotsComponent implements OnInit {
  private readonly svc = inject(ProductionService);
  private readonly authSvc = inject(AuthService);
  private readonly roles = inject(ProductionRoleService);

  readonly aujourdhui = formaterDate(new Date());

  /** Déclaration réservée au Chef de Production et à l'Admin (LotSpecification.peutDeclarer). */
  peutDeclarer = computed(() => this.roles.hasRole('CHEF_PRODUCTION', 'ADMIN'));
  /** Validation : mêmes rôles que l'autorisation PRODUCTION_LOT_VALIDER_STOCK côté serveur. */
  peutValider = computed(() => this.authSvc.hasAnyRole(['GESTIONNAIRE_STOCK', 'CHEF_PRODUCTION', 'ADMIN']));

  // ── Chargement ──
  lots = signal<LotBE[]>([]);
  lotsAValider = signal<LotBE[]>([]);
  pphs = signal<PPHBE[]>([]);
  referentiel = signal<ReferentielProductionBE[]>([]);
  enAttente = signal(0);
  chargement = computed(() => this.enAttente() > 0);
  erreurs = signal<{ lots?: string; aValider?: string }>({});
  derniereMaj = signal<Date | null>(null);
  private requete = 0;

  // ── Consultation ──
  recherche = signal('');
  statut = signal<StatutFiltre>('TOUS');
  readonly filtres: { code: StatutFiltre; libelle: string }[] = [
    { code: 'TOUS', libelle: 'Tous' },
    { code: 'DECLARE', libelle: 'Déclarés' },
    { code: 'RECEPTIONNE_STOCK', libelle: 'Réceptionnés' },
    { code: 'VALIDATED_BY_STOCK', libelle: 'Validés' },
    { code: 'REJETE', libelle: 'Rejetés' },
  ];

  compteStatut = (code: StatutFiltre): number =>
    code === 'TOUS' ? this.lots().length : this.lots().filter(l => l.statut === code).length;

  lotsFiltres = computed(() => {
    const q = this.recherche().trim().toLowerCase();
    const s = this.statut();
    return this.lots()
      .filter(l => s === 'TOUS' || l.statut === s)
      .filter(l => !q
        || l.numeroLot.toLowerCase().includes(q)
        || l.productSku.toLowerCase().includes(q)
        || l.productName.toLowerCase().includes(q)
        || (l.referencePPH ?? '').toLowerCase().includes(q))
      .sort((a, b) => b.dateProduction.localeCompare(a.dateProduction) || b.numeroLot.localeCompare(a.numeroLot));
  });

  // ── Indicateurs ──
  kpis = computed<{ libelle: string; valeur: string; detail: string; alerte?: boolean }[]>(() => {
    const l = this.lots();
    const kg = l.reduce((t, x) => t + x.declaredQuantityKg, 0);
    const unites = l.reduce((t, x) => t + x.equivalentUnits, 0);
    const attente = l.filter(x => x.statut === 'DECLARE').length;
    const rejetes = l.filter(x => x.statut === 'REJETE').length;
    return [
      { libelle: 'En attente de validation', valeur: String(attente), detail: 'lots déclarés', alerte: attente > 0 },
      { libelle: 'Validés stock', valeur: String(l.filter(x => x.statut === 'VALIDATED_BY_STOCK').length), detail: 'intégrés à l\'inventaire' },
      { libelle: 'Rejetés', valeur: String(rejetes), detail: 'non conformes', alerte: rejetes > 0 },
      { libelle: 'Quantité déclarée', valeur: `${this.formaterKg(kg)} kg`, detail: `${unites} unité(s) équivalentes` },
    ];
  });

  // ── Déclaration ──
  drawerOuvert = signal(false);
  dateProduction = signal(this.aujourdhui);
  lignes = signal<LigneLot[]>([]);
  erreurFormulaire = signal('');
  envoi = signal(false);

  dateFabricationPrevue = computed(() => dateFabricationDe(this.dateProduction()));

  /** Erreur bloquante d'une ligne, ou null si la ligne est prête à être envoyée. */
  erreurLigne(l: LigneLot): string | null {
    if (!l.referencePPH) return 'Choisissez un PPH';
    if (!l.productSku) return 'Choisissez un produit';
    if (!(Number(l.declaredQuantityKg) > 0)) return 'Quantité supérieure à 0';
    if (!Number.isInteger(Number(l.equivalentUnits ?? 0)) || Number(l.equivalentUnits ?? 0) < 0) return 'Unités : nombre entier positif';
    if (!l.dlc) return 'DLC requise';
    if (l.dlc < this.dateProduction()) return 'La DLC doit être après la date de production';
    if (Number(l.conditioningQty ?? 0) > 0 && !l.conditioningType) return 'Précisez le conditionnement';
    return null;
  }

  formulaireValide = computed(() => {
    const ls = this.lignes();
    return ls.length > 0 && ls.every(l => this.erreurLigne(l) === null);
  });

  totalKgFormulaire = computed(() => this.lignes().reduce((t, l) => t + (Number(l.declaredQuantityKg) || 0), 0));

  /** Produits du PPH choisi, repris depuis ses lignes. */
  produitsDuPph(referencePPH: string): { codeProduit: string; nomProduit: string; unitesPrevues: number }[] {
    const pph = this.pphs().find(p => p.referencePPH === referencePPH);
    return (pph?.lignes ?? []).map(l => ({
      codeProduit: l.codeProduit, nomProduit: l.nomProduit, unitesPrevues: l.quantiteAttendueUnites,
    }));
  }

  /**
   * Produits cherchables pour la recherche partagée — seulement ceux du PPH choisi
   * (règle métier : un lot ne se déclare que pour un produit prévu au plan).
   */
  /** Produits du PPH au format attendu par le champ de recherche partagé (sku = code produit). */
  itemsDuPph(referencePPH: string): Product[] {
    return this.produitsDuPph(referencePPH).map(p => ({ sku: p.codeProduit, designation: p.nomProduit } as Product));
  }

  selectedDisplayText(l: LigneLot): string {
    return l.productSku ? `${l.productSku} — ${l.productName}` : '';
  }

  readonly typesEmballage = TYPES_EMBALLAGE;

  ngOnInit(): void {
    this.charger();
    this.svc.getPPHs().subscribe({ next: p => this.pphs.set(p), error: () => this.pphs.set([]) });
    this.svc.getReferentielFormules().subscribe({ next: r => this.referentiel.set(r), error: () => this.referentiel.set([]) });
  }

  @HostListener('document:keydown.escape')
  onEchap(): void {
    if (this.aConfirmer()) this.aConfirmer.set(null);
    else if (this.aRejeter()) this.aRejeter.set(null);
    else if (this.drawerOuvert() && !this.envoi()) this.fermerDrawer();
  }

  charger(): void {
    const id = ++this.requete;
    this.enAttente.set(2);
    this.erreurs.set({});
    const termine = (source: 'lots' | 'aValider', erreur?: string) => {
      if (id !== this.requete) return;
      if (erreur) this.erreurs.update(e => ({ ...e, [source]: erreur }));
      this.enAttente.update(n => n - 1);
      if (this.enAttente() === 0) this.derniereMaj.set(new Date());
    };
    const messageErreur = (e: any) => e?.error?.erreur || e?.error?.message || 'Chargement impossible.';

    this.svc.getLots().subscribe({
      next: l => { if (id === this.requete) this.lots.set(l); termine('lots'); },
      error: e => { if (id === this.requete) this.lots.set([]); termine('lots', messageErreur(e)); },
    });
    this.svc.getLotsAValider().subscribe({
      next: l => { if (id === this.requete) this.lotsAValider.set(l); termine('aValider'); },
      error: e => { if (id === this.requete) this.lotsAValider.set([]); termine('aValider', messageErreur(e)); },
    });
  }

  // ── Formulaire de déclaration ──
  ouvrirDeclaration(): void {
    this.dateProduction.set(this.aujourdhui);
    this.erreurFormulaire.set('');
    this.lignes.set([this.ligneVide()]);
    this.drawerOuvert.set(true);
  }

  fermerDrawer(): void {
    if (this.envoi()) return;
    this.drawerOuvert.set(false);
  }

  ajouterLigne(): void {
    this.lignes.update(ls => [...ls, this.ligneVide()]);
  }

  /** Copie la ligne sous elle, avec le même PPH et les mêmes quantités ; le produit reste à choisir. */
  dupliquerLigne(i: number): void {
    this.lignes.update(ls => {
      const source = ls[i];
      return [...ls.slice(0, i + 1), { ...source, productSku: '', productName: '' }, ...ls.slice(i + 1)];
    });
  }

  supprimerLigne(i: number): void {
    this.lignes.update(ls => ls.filter((_, idx) => idx !== i));
  }

  majLigne(i: number, champ: keyof LigneLot, valeur: unknown): void {
    // Un champ numérique vidé donne NaN : on le ramène à null pour ne pas l'afficher.
    const propre = typeof valeur === 'number' && Number.isNaN(valeur) ? null : valeur;
    this.lignes.update(ls => ls.map((l, idx) => {
      if (idx !== i) return l;
      const maj: LigneLot = { ...l, [champ]: propre };
      // Saisie manuelle du nombre de cartons : on ne le recalcule plus.
      if (champ === 'conditioningQty') maj.conditionnementManuel = true;
      // Les unités changent : le nombre de cartons suit, sauf correction manuelle.
      if (champ === 'equivalentUnits' && !l.conditionnementManuel) {
        maj.conditioningQty = this.quantiteConditionnements(propre as number | null);
      }
      return maj;
    }));
  }

  /** Produit du référentiel, avec son conditionnement (le premier qui a un type). */
  conditionnementDe(codeProduit: string): ConditionnementProductionBE | null {
    const produit = this.referentiel().find(p => p.codeProduit === codeProduit);
    return produit?.conditionnements.find(c => c.type) ?? produit?.conditionnements[0] ?? null;
  }

  /** Nombre de conditionnements déclarés : le même que le nombre d'unités, sauf si le champ est corrigé à la main. */
  quantiteConditionnements(unites: number | null): number | null {
    return unites && unites > 0 ? unites : null;
  }

  /** Texte affiché sous le produit : conditionnement du produit et sa composition d'emballage. */
  descriptionConditionnement(codeProduit: string): { libelle: string; regle: string | null } | null {
    const cond = this.conditionnementDe(codeProduit);
    if (!cond) return null;
    const regles = cond.composants.map(c => `${c.quantiteComposant} ${c.type.toLowerCase()} pour ${c.quantiteUnitesProduites} unité(s)`);
    return { libelle: cond.libelle, regle: regles.length ? regles.join(' · ') : null };
  }

  /** Choix du PPH : réinitialise le produit, qui doit appartenir à ce PPH. */
  choisirPph(i: number, referencePPH: string): void {
    this.lignes.update(ls => ls.map((l, idx) => idx === i
      ? { ...l, referencePPH, productSku: '', productName: '', productUnit: '' }
      : l));
  }

  /**
   * Choix du produit : son conditionnement vient avec (type du conditionnement du produit,
   * ex. SEAU pour « 12 seaux x 390g ») et la quantité suit les unités déjà saisies.
   * L'unité (productUnit, attendue par l'API) se déduit du type de conditionnement.
   */
  choisirProduit(i: number, codeProduit: string): void {
    const produit = this.produitsDuPph(this.lignes()[i]?.referencePPH ?? '').find(p => p.codeProduit === codeProduit);
    const cond = this.conditionnementDe(codeProduit);
    const typeEmballage = this.typesEmballage.find(t => t.code === cond?.type);
    this.lignes.update(ls => ls.map((l, idx) => {
      if (idx !== i) return l;
      // Unités : celles déjà saisies, sinon celles prévues dans le PPH pour ce produit.
      const unites = l.equivalentUnits && l.equivalentUnits > 0 ? l.equivalentUnits : (produit?.unitesPrevues || null);
      return {
        ...l,
        productSku: codeProduit,
        productName: produit?.nomProduit ?? codeProduit,
        productUnit: typeEmballage?.libelle ?? '',
        equivalentUnits: unites,
        conditioningType: cond?.type ?? '',
        conditioningQty: this.quantiteConditionnements(unites),
        conditionnementManuel: false,
      };
    }));
  }

  /**
   * Envoie les lignes une par une, dans l'ordre. Une ligne refusée n'empêche pas les autres ;
   * les lignes acceptées sont enregistrées, seules les refusées restent dans le formulaire.
   */
  declarerTout(): void {
    if (!this.formulaireValide() || this.envoi()) return;
    const date = this.dateProduction();
    const declarant = this.authSvc.user()?.nomComplet || undefined;
    const envois = this.lignes().map(l => ({
      ligne: l,
      req: {
        referencePPH: l.referencePPH,
        productSku: l.productSku,
        productName: l.productName,
        productUnit: l.productUnit || undefined,
        declaredQuantityKg: Number(l.declaredQuantityKg),
        equivalentUnits: Number(l.equivalentUnits ?? 0),
        dateProduction: date,
        dlc: l.dlc,
        notes: l.notes || undefined,
        declaredBy: declarant,
        ...(Number(l.conditioningQty ?? 0) > 0 ? { conditioningType: l.conditioningType, conditioningQty: Number(l.conditioningQty) } : {}),
      } as DeclarerLotBE,
    }));

    this.envoi.set(true);
    this.erreurFormulaire.set('');
    from(envois).pipe(
      concatMap(({ ligne, req }) => this.svc.declarerLot(req).pipe(
        map(lot => ({ ok: true as const, lot, ligne })),
        catchError(e => of({
          ok: false as const, ligne,
          erreur: e?.error?.erreur || e?.error?.message || 'refus du serveur',
        })),
      )),
      toArray(),
    ).subscribe(resultats => {
      this.envoi.set(false);
      const crees = resultats.filter(r => r.ok).map(r => (r as { lot: LotBE }).lot);
      const refus = resultats.filter(r => !r.ok) as { ligne: LigneLot; erreur: string }[];

      if (crees.length) this.lots.update(liste => [...crees, ...liste]);

      if (refus.length === 0) {
        this.drawerOuvert.set(false);
        this.notifier(`${crees.length} lot(s) déclaré(s) — en attente de validation stock.`, 'ok');
        this.charger();
      } else {
        this.lignes.set(refus.map(r => r.ligne));
        this.erreurFormulaire.set(
          `${refus.length} ligne(s) refusée(s) par le serveur : ${refus.map(r => r.erreur).join(' ; ')}`
          + (crees.length ? ` — ${crees.length} lot(s) déjà enregistré(s).` : ''));
        if (crees.length) this.charger();
      }
    });
  }

  private ligneVide(): LigneLot {
    return {
      referencePPH: '', productSku: '', productName: '', productUnit: '',
      declaredQuantityKg: null, equivalentUnits: null, dlc: '',
      conditioningType: '', conditioningQty: null, conditionnementManuel: false,
      notes: '',
    };
  }

  // ── Validation par le stock ──
  aConfirmer = signal<LotBE | null>(null);
  aRejeter = signal<LotBE | null>(null);
  motifRejet = signal('');
  actionEnCours = signal<string | null>(null);

  demanderValidation(lot: LotBE): void { this.aConfirmer.set(lot); }

  confirmerValidation(): void {
    const lot = this.aConfirmer();
    if (!lot) return;
    this.actionEnCours.set(lot.numeroLot);
    this.svc.validerLot(lot.numeroLot).subscribe({
      next: l => {
        this.remplacerLot(l);
        this.actionEnCours.set(null);
        this.aConfirmer.set(null);
        this.notifier(`Lot ${l.numeroLot} validé — fiche verrouillée.`, 'ok');
      },
      error: e => {
        this.actionEnCours.set(null);
        this.aConfirmer.set(null);
        this.notifier(e?.error?.erreur || e?.error?.message || 'Validation impossible.', 'erreur');
      },
    });
  }

  ouvrirRejet(lot: LotBE): void {
    this.motifRejet.set('');
    this.aRejeter.set(lot);
  }

  confirmerRejet(): void {
    const lot = this.aRejeter();
    const motif = this.motifRejet().trim();
    if (!lot || motif.length < 3) return;
    this.actionEnCours.set(lot.numeroLot);
    this.svc.rejeterLot(lot.numeroLot, motif).subscribe({
      next: l => {
        this.remplacerLot(l);
        this.actionEnCours.set(null);
        this.aRejeter.set(null);
        this.notifier(`Lot ${l.numeroLot} rejeté.`, 'ok');
      },
      error: e => {
        this.actionEnCours.set(null);
        this.notifier(e?.error?.erreur || e?.error?.message || 'Rejet impossible.', 'erreur');
      },
    });
  }

  private remplacerLot(l: LotBE): void {
    this.lots.update(liste => liste.map(x => x.numeroLot === l.numeroLot ? l : x));
    this.lotsAValider.update(liste => liste.filter(x => x.numeroLot !== l.numeroLot));
  }

  // ── Notification ──
  notification = signal<{ type: 'ok' | 'erreur'; texte: string } | null>(null);
  private minuterie: ReturnType<typeof setTimeout> | null = null;

  notifier(texte: string, type: 'ok' | 'erreur'): void {
    this.notification.set({ type, texte });
    if (this.minuterie) clearTimeout(this.minuterie);
    this.minuterie = setTimeout(() => this.notification.set(null), 5000);
  }

  // ── Affichage ──
  libelleStatut(s: string): string { return STATUTS[s]?.libelle ?? s; }
  classeStatut(s: string): string { return STATUTS[s]?.classe ?? ''; }

  peutAgirSur(lot: LotBE): boolean {
    return this.peutValider() && (lot.statut === 'DECLARE' || lot.statut === 'RECEPTIONNE_STOCK');
  }

  formaterKg(v: number): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(v);
  }

  jourRestant(dlc: string): number {
    const [y, m, d] = dlc.split('-').map(Number);
    const [ty, tm, td] = this.aujourdhui.split('-').map(Number);
    return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86400000);
  }
}
