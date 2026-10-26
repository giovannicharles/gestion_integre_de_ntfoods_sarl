import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../../../core/http/api.service';
import { ApiResponse } from '../../../core/models/api-response.model';
import { PageResponse, PageParams } from '../../../core/models/page-response.model';

// ── DTOs ──────────────────────────────────────────────────────

export interface TableauBordStockBE {
  valeurStockCentral: number;
  valeurStockTampon: number;
  valeurStockMobile: number;
  nbAlertesActives: number;
  nbReceptionsEnAttente: number;
  nbMouvementsJour: number;
  nbLotsEnAttente: number;
}

export interface TableauBordEnrichiBE {
  stats: Record<string, number>;
  tampon: { produit: string; quantite: number; unite: string }[];
  stockCentral: { produit: string; quantite: number; unite: string }[];
  stockMobile: { matricule: string; nom: string; valeur: number }[];
  performances: { matricule: string; nom: string; ca: number; taux: number }[];
  invendus: { produit: string; quantite: number; valeur: number }[];
}

export interface NiveauStockBE {
  id: number;
  produitId: number | null;
  codeProduit: string;
  sku: string;
  designation: string;
  marque: string | null;
  gamme: string | null;
  categorie: string | null;
  entrepotId: number | null;
  codeEntrepot: string;
  libelleEntrepot: string;
  typeEntrepot: string;
  quantite: number;
  seuilReapprovisionnement: number;
  stockSecurite: number;
  niveauAlerte: string;
  valeurStock: number;
  dateModification: string | null;
}

/** Miroir de DemandeTransfertResponse (backend) — la demande créée, pas le transfert exécuté. */
export interface DemandeTransfertBE {
  demandeId: number;
  actionType: string;
  statut: string;
  seuilRequis: number;
}

/** Miroir de TransfertResponse (backend) — un transfert déjà exécuté. */
export interface TransfertBE {
  id: number;
  numero: string;
  codeEntrepotSource: string;
  codeEntrepotCible: string;
  statut: string;
  statutLibelle: string;
  declencheParSeuil: boolean;
  matriculeGestionnaire: string;
  dateExecution: string | null;
  lignes: { id: string; codeProduit: string; sku: string | null; quantite: number }[];
}

export interface MouvementBE {
  id: number;
  date: string;
  type: string;
  entrepot: string;
  codeProduit: string;
  designation: string;
  quantite: number;
  unite: string;
  referenceDocument: string;
  matriculeOperateur: string;
}

export interface LigneInventaireBE {
  codeProduit: string;
  designation: string;
  quantiteTheorique: number;
  quantiteComptee: number;
  ecart: number;
  unite: string;
}

export interface InventaireBE {
  id: number;
  numero: string;
  type: string;
  entrepot: string;
  statut: string;
  dateOuverture: string;
  dateCloture?: string;
  matriculeResponsable: string;
  lignes: LigneInventaireBE[];
}

export interface LigneReceptionBE {
  codeProduit: string;
  designation: string;
  quantite: number;
  unite: string;
}

export interface ReceptionBE {
  id: number;
  numero: string;
  type: string;
  statut: string;
  bonCommande?: string;
  matriculeResponsable: string;
  dateReception: string;
  lignes: LigneReceptionBE[];
}

export interface AlerteBE {
  id: number;
  reference: string;
  type: string;
  typeLibelle: string;
  message: string;
  destinataireRole: string;
  actionSuggeree: string;
  priorite: string;
  codeProduit: string;
  codeEntrepot: string;
  referenceLiee: string;
  statut: string;
  dateCreation: string;
  dateTraitement: string | null;
}

export interface SessionCommercialBE {
  id: number;
  numero: string;
  numeroSession: string;
  matriculeCommercial: string;
  nomCommercial?: string;
  datePreparation: string;
  dateEffet: string;
  dateCloture?: string;
  heureOuverture?: string;
  heureCloture?: string;
  statut: string;
  dotations?: string[];
  dotationsIds?: string[];
  nombreDotations?: number;
  montantTotalVentes?: number;
  montantTotalVersements?: number;
  ecartMontant?: number;
  matriculeCloture?: string;
  matriculeValidateurSecretaire?: string;
  matriculeValidateurComptable?: string;
  dateCreation?: string;
}

export interface LigneBonCommandeBE {
  id?: number;
  codeProduit: string;
  sku?: string;
  designation: string;
  quantiteCommandee: number;
  /** Calculé par le domaine mais non exposé par BonCommandeResponse : toujours null avec l'API actuelle. */
  quantiteProduite: number | null;
  quantiteRecue?: number;
  /** Idem : non exposé par l'API. */
  tauxRealisation: number | null;
  unite: string | null;
  prixUnitaireHT?: number;
}

export interface BonCommandeBE {
  id: number;
  numero: string;
  codeFournisseur: string;
  nomFournisseur?: string;
  statut: string;
  statutLibelle?: string;
  dateCreation: string;
  dateCommande?: string;
  dateLivraisonPrevue?: string;
  dateDebutProduction?: string;
  dateFinProduction?: string;
  dateValidation?: string;
  matriculeCreateur?: string;
  montantTotalHT?: number;
  /** Calculé par le domaine (BonCommande.tauxRealisation) mais non exposé par BonCommandeResponse : null. */
  tauxRealisation: number | null;
  enRetard?: boolean;
  lignes: LigneBonCommandeBE[];
}

/**
 * BonCommandeResponse ne contient ni tauxRealisation, ni quantiteProduite, ni unite : absents du JSON, ils
 * arriveraient « undefined ». On les pose explicitement à null pour que les écrans affichent « — ».
 */
function normaliserBC(bc: BonCommandeBE): BonCommandeBE {
  return {
    ...bc,
    tauxRealisation: bc.tauxRealisation ?? null,
    lignes: (bc.lignes ?? []).map(l => ({ ...l, quantiteProduite: l.quantiteProduite ?? null, tauxRealisation: l.tauxRealisation ?? null, unite: l.unite ?? null })),
  };
}

/** GET /api/stock/produits — miroir de ProduitResponse. */
export interface ConditionnementProduitBE {
  id: string; sku: string; niveau: string; niveauLibelle: string; libelle: string;
  facteurConversionVersBase: number; poidsUnitaireGrammes: number; volumeUnitaireCm3: number;
  prixUnitaireHT: number | null; codeBarres: string | null;
}

export interface ProduitBE {
  id: number; code: string; marque: string; gamme: string; variete: string; designation: string;
  categorie: string; categorieLibelle: string; categorieMetier: string; categorieMetierLibelle: string;
  actif: boolean; prixDistributeur: number | null; prixGrossiste: number | null; prixDetaillant: number | null;
  tva: boolean; conditionnementCommercial: string | null; uniteVenteCommerciale: string | null;
  conditionnements: ConditionnementProduitBE[];
}

/** GET /api/stock/fournisseurs — miroir de FournisseurResponse. */
export interface FournisseurBE {
  id: number; code: string; raisonSociale: string; telephone: string | null;
  email: string | null; adresse: string | null; actif: boolean;
}

@Injectable({ providedIn: 'root' })
export class StockService {
  private readonly api = inject(ApiService);

  // ── Tableau de bord ─────────────────────────────────────────

  getDashboard(): Observable<TableauBordStockBE> {
    return this.api.get<ApiResponse<TableauBordStockBE>>('stock/dashboard')
      .pipe(map(r => r.donnees!));
  }

  getDashboardEnrichi(): Observable<TableauBordEnrichiBE> {
    return this.api.get<ApiResponse<TableauBordEnrichiBE>>('stock/dashboard/enrichi')
      .pipe(map(r => r.donnees!));
  }

  // ── État des stocks ─────────────────────────────────────────

  getEtatStock(params: { entrepot?: string } = {}): Observable<NiveauStockBE[]> {
    const p: Record<string, string> = {};
    if (params.entrepot) p['entrepot'] = params.entrepot;
    return this.api.get<ApiResponse<NiveauStockBE[]>>('stock/levels', p)
      .pipe(map(r => r.donnees ?? []));
  }

  // ── Mouvements ──────────────────────────────────────────────

  getMouvements(params: {
    produit?: string; entrepot?: string; type?: string;
    document?: string; debut?: string; fin?: string;
  } = {}, page?: PageParams): Observable<PageResponse<MouvementBE>> {
    const p: Record<string, string> = {};
    if (params.produit) p['produit'] = params.produit;
    if (params.entrepot) p['entrepot'] = params.entrepot;
    if (params.type) p['type'] = params.type;
    if (params.document) p['document'] = params.document;
    if (params.debut) p['debut'] = params.debut;
    if (params.fin) p['fin'] = params.fin;
    if (page?.page !== undefined) p['page'] = String(page.page);
    if (page?.size !== undefined) p['size'] = String(page.size);
    if (page?.sort) p['sort'] = page.sort;
    return this.api.get<ApiResponse<PageResponse<MouvementBE>>>('stock/mouvements', p)
      .pipe(map(r => r.donnees!));
  }

  // ── Inventaires ─────────────────────────────────────────────

  getInventaires(statut?: string): Observable<InventaireBE[]> {
    const params: Record<string, string> = {};
    if (statut) params['statut'] = statut;
    return this.api.get<ApiResponse<InventaireBE[]>>('stock/inventaires', params)
      .pipe(map(r => r.donnees ?? []));
  }

  getInventaire(numero: string): Observable<InventaireBE> {
    return this.api.get<ApiResponse<InventaireBE>>(`stock/inventaires/${encodeURIComponent(numero)}`)
      .pipe(map(r => r.donnees!));
  }

  /** Corps = OuvrirInventaireRequest (type, codeEntrepot obligatoires). */
  ouvrirInventaire(req: {
    type: string; codeEntrepot: string; perimetreGamme?: string; perimetreProduit?: string;
  }): Observable<InventaireBE> {
    return this.api.post<ApiResponse<InventaireBE>>('stock/inventaires', req)
      .pipe(map(r => r.donnees!));
  }

  /** Corps = SaisirComptageRequest : la ligne d'inventaire est désignée par son id (idLigne). */
  saisirComptage(numero: string, req: {
    idLigne: string; quantiteComptee: number;
  }): Observable<InventaireBE> {
    return this.api.patch<ApiResponse<InventaireBE>>(
      `stock/inventaires/${encodeURIComponent(numero)}/comptage`, req
    ).pipe(map(r => r.donnees!));
  }

  cloturerComptage(numero: string): Observable<InventaireBE> {
    return this.api.post<ApiResponse<InventaireBE>>(
      `stock/inventaires/${encodeURIComponent(numero)}/cloturer-comptage`, {}
    ).pipe(map(r => r.donnees!));
  }

  validerInventaire(numero: string, justification?: string): Observable<InventaireBE> {
    const params: Record<string, string> = {};
    if (justification) params['justification'] = justification;
    return this.api.post<ApiResponse<InventaireBE>>(
      `stock/inventaires/${encodeURIComponent(numero)}/valider`, {}, 
    ).pipe(map(r => r.donnees!));
  }

  // ── Réceptions ──────────────────────────────────────────────

  getReceptions(params: { statut?: string; bonCommande?: string } = {}): Observable<ReceptionBE[]> {
    const p: Record<string, string> = {};
    if (params.statut) p['statut'] = params.statut;
    if (params.bonCommande) p['bonCommande'] = params.bonCommande;
    return this.api.get<ApiResponse<ReceptionBE[]>>('stock/receptions', p)
      .pipe(map(r => r.donnees ?? []));
  }

  getReception(numero: string): Observable<ReceptionBE> {
    return this.api.get<ApiResponse<ReceptionBE>>(`stock/receptions/${encodeURIComponent(numero)}`)
      .pipe(map(r => r.donnees!));
  }

  creerReceptionFournisseur(req: {
    bonCommande: string; lignes: { codeProduit: string; quantite: number; unite: string }[];
  }): Observable<ReceptionBE> {
    return this.api.post<ApiResponse<ReceptionBE>>('stock/receptions/fournisseur', req)
      .pipe(map(r => r.donnees!));
  }

  creerReceptionProduction(req: {
    lotProduction: string; lignes: { codeProduit: string; quantite: number; unite: string }[];
  }): Observable<ReceptionBE> {
    return this.api.post<ApiResponse<ReceptionBE>>('stock/receptions/production', req)
      .pipe(map(r => r.donnees!));
  }

  validerReceptionEtape1(numero: string): Observable<ReceptionBE> {
    return this.api.post<ApiResponse<ReceptionBE>>(
      `stock/receptions/${encodeURIComponent(numero)}/valider-etape1`, {}
    ).pipe(map(r => r.donnees!));
  }

  validerReceptionEtape2(numero: string): Observable<ReceptionBE> {
    return this.api.post<ApiResponse<ReceptionBE>>(
      `stock/receptions/${encodeURIComponent(numero)}/valider-etape2`, {}
    ).pipe(map(r => r.donnees!));
  }

  rejeterReception(numero: string, motif: string): Observable<ReceptionBE> {
    return this.api.post<ApiResponse<ReceptionBE>>(
      `stock/receptions/${encodeURIComponent(numero)}/rejeter?motif=${encodeURIComponent(motif)}`, {}
    ).pipe(map(r => r.donnees!));
  }

  // ── Alertes ─────────────────────────────────────────────────

  getAlertes(params: { statut?: string; role?: string } = {}): Observable<AlerteBE[]> {
    const p: Record<string, string> = {};
    if (params.statut) p['statut'] = params.statut;
    if (params.role) p['role'] = params.role;
    return this.api.get<ApiResponse<AlerteBE[]>>('stock/alertes', p)
      .pipe(map(r => r.donnees ?? []));
  }

  getStockLevelAlertes(): Observable<NiveauStockBE[]> {
    return this.api.get<ApiResponse<NiveauStockBE[]>>('stock/levels/alerts')
      .pipe(map(r => r.donnees ?? []));
  }

  getStockLevelAlertesCritiques(): Observable<NiveauStockBE[]> {
    return this.api.get<ApiResponse<NiveauStockBE[]>>('stock/levels/alerts/critical')
      .pipe(map(r => r.donnees ?? []));
  }

  getStockLevelsByWarehouse(entrepotId: number): Observable<NiveauStockBE[]> {
    return this.api.get<ApiResponse<NiveauStockBE[]>>(`stock/levels/warehouse/${entrepotId}`)
      .pipe(map(r => r.donnees ?? []));
  }

  adjustStock(stockLevelId: number, newQuantity: number, reason: string): Observable<NiveauStockBE> {
    return this.api.post<ApiResponse<NiveauStockBE>>('stock/levels/adjust', { stockLevelId, newQuantity, reason })
      .pipe(map(r => r.donnees!));
  }

  /**
   * @deprecated Écrit directement le stock sans passer par le moteur de demandes (invariant 1) — plus appelé par
   * aucun écran (2026-09-30). Utiliser {@link demanderTransfert}, qui crée une demande approuvée par un second
   * acteur avant que le stock ne bouge (`TransfertController`/`StockNiveauTransfertHandler`).
   */
  transferToBuffer(id: number, quantity: number): Observable<NiveauStockBE> {
    return this.api.post<ApiResponse<NiveauStockBE>>(`stock/levels/${id}/transfer-to-buffer?quantity=${quantity}`, {})
      .pipe(map(r => r.donnees!));
  }

  /**
   * Demande un transfert central → tampon (2026-09-30) — le stock ne bouge pas à cet appel (202) : une demande est
   * créée, exécutée automatiquement quand un second acteur l'approuve (`TransfertController`). Sans
   * codeEntrepotSource/Cible, le CENTRAL et le TAMPON uniques sont résolus côté serveur.
   */
  demanderTransfert(lignes: { codeProduit: string; sku?: string | null; quantite: number }[]): Observable<DemandeTransfertBE> {
    return this.api.post<ApiResponse<DemandeTransfertBE>>('stock/transferts', {
      codeEntrepotSource: null,
      codeEntrepotCible: null,
      lignes: lignes.map((l) => ({ codeProduit: l.codeProduit, sku: l.sku ?? null, quantite: l.quantite })),
    }).pipe(map((r) => r.donnees!));
  }

  /** Transferts déjà exécutés (historique) — les demandes en attente se suivent sur /validations. */
  listerTransfertsExecutes(statut?: string): Observable<TransfertBE[]> {
    const p: Record<string, string> = {};
    if (statut) p['statut'] = statut;
    return this.api.get<ApiResponse<TransfertBE[]>>('stock/transferts', p)
      .pipe(map((r) => r.donnees ?? []));
  }

  marquerAlerteLue(reference: string): Observable<AlerteBE> {
    return this.api.post<ApiResponse<AlerteBE>>(
      `stock/alertes/${encodeURIComponent(reference)}/lue`, {}
    ).pipe(map(r => r.donnees!));
  }

  traiterAlerte(reference: string): Observable<AlerteBE> {
    return this.api.post<ApiResponse<AlerteBE>>(
      `stock/alertes/${encodeURIComponent(reference)}/traiter`, {}
    ).pipe(map(r => r.donnees!));
  }

  // ── Sessions commerciaux ────────────────────────────────────

  getSessionsParCommercial(matricule: string): Observable<SessionCommercialBE[]> {
    return this.api.get<ApiResponse<SessionCommercialBE[]>>(`stock/sessions/commercial/${encodeURIComponent(matricule)}`)
      .pipe(map(r => (r.donnees ?? []).map(s => ({
        ...s,
        numero: s.numero || s.numeroSession || '',
        numeroSession: s.numeroSession || s.numero || ''
      }))));
  }

  getSessionsParDate(date: string): Observable<SessionCommercialBE[]> {
    return this.api.get<ApiResponse<SessionCommercialBE[]>>(`stock/sessions/date/${date}`)
      .pipe(map(r => (r.donnees ?? []).map(s => ({
        ...s,
        numero: s.numero || s.numeroSession || '',
        numeroSession: s.numeroSession || s.numero || ''
      }))));
  }

  getSessionsParStatut(statut: string): Observable<SessionCommercialBE[]> {
    return this.api.get<ApiResponse<SessionCommercialBE[]>>(`stock/sessions/statut/${encodeURIComponent(statut)}`)
      .pipe(map(r => (r.donnees ?? []).map(s => ({
        ...s,
        numero: s.numero || s.numeroSession || '',
        numeroSession: s.numeroSession || s.numero || ''
      }))));
  }

  preparerSession(req: {
    matriculeCommercial: string; datePreparation: string;
  }): Observable<SessionCommercialBE> {
    return this.api.post<ApiResponse<SessionCommercialBE>>('stock/sessions/preparer', req)
      .pipe(map(r => r.donnees!));
  }

  ouvrirSession(numero: string): Observable<SessionCommercialBE> {
    return this.api.patch<ApiResponse<SessionCommercialBE>>(
      `stock/sessions/${encodeURIComponent(numero)}/ouvrir`, {}
    ).pipe(map(r => r.donnees!));
  }

  cloturerSession(numero: string, matricule: string): Observable<SessionCommercialBE> {
    return this.api.patch<ApiResponse<SessionCommercialBE>>(
      `stock/sessions/${encodeURIComponent(numero)}/cloturer?matricule=${encodeURIComponent(matricule)}`, {}
    ).pipe(map(r => r.donnees!));
  }

  validerSessionSecretaire(numero: string, matricule: string): Observable<SessionCommercialBE> {
    return this.api.patch<ApiResponse<SessionCommercialBE>>(
      `stock/sessions/${encodeURIComponent(numero)}/valider-secretaire?matricule=${encodeURIComponent(matricule)}`, {}
    ).pipe(map(r => r.donnees!));
  }

  validerSessionComptable(numero: string, matricule: string): Observable<SessionCommercialBE> {
    return this.api.patch<ApiResponse<SessionCommercialBE>>(
      `stock/sessions/${encodeURIComponent(numero)}/valider-comptable?matricule=${encodeURIComponent(matricule)}`, {}
    ).pipe(map(r => r.donnees!));
  }

  // ── Bons de commande (pour le module production) ────────────

  getBonsCommande(params: { statut?: string } = {}): Observable<BonCommandeBE[]> {
    const p: Record<string, string> = {};
    if (params.statut) p['statut'] = params.statut;
    return this.api.get<ApiResponse<BonCommandeBE[]>>('stock/bons-commande', p)
      .pipe(map(r => (r.donnees ?? []).map(normaliserBC)));
  }

  getBonCommande(numero: string): Observable<BonCommandeBE | null> {
    return this.api.get<ApiResponse<BonCommandeBE>>(`stock/bons-commande/${encodeURIComponent(numero)}`)
      .pipe(map(r => r.donnees ? normaliserBC(r.donnees) : null));
  }

  validerBonCommande(numero: string): Observable<BonCommandeBE> {
    return this.api.post<ApiResponse<BonCommandeBE>>(
      `stock/bons-commande/${encodeURIComponent(numero)}/valider`, {}
    ).pipe(map(r => normaliserBC(r.donnees!)));
  }

  creerBonCommande(req: {
    codeFournisseur: string | null;
    dateCommande: string;
    dateLivraisonPrevue?: string | null;
    dateDebutProduction?: string | null;
    dateFinProduction?: string | null;
    lignes: {
      codeProduit: string;
      designation?: string | null;
      sku?: string | null;
      quantiteCommandee: number;
      prixUnitaireHT?: number | null;
    }[];
  }): Observable<BonCommandeBE> {
    return this.api.post<ApiResponse<BonCommandeBE>>('stock/bons-commande', req)
      .pipe(map(r => normaliserBC(r.donnees!)));
  }

  // ── Catalogue et fournisseurs (lecture) ──────────────────────

  /** Filtres acceptés par l'API : marque, gamme, variete, actif. */
  getProduits(params: { marque?: string; gamme?: string; variete?: string; actif?: boolean } = {}): Observable<ProduitBE[]> {
    const p: Record<string, string> = {};
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') p[k] = String(v);
    return this.api.get<ApiResponse<ProduitBE[]>>('stock/produits', p)
      .pipe(map(r => r.donnees ?? []));
  }

  getFournisseurs(): Observable<FournisseurBE[]> {
    return this.api.get<ApiResponse<FournisseurBE[]>>('stock/fournisseurs')
      .pipe(map(r => r.donnees ?? []));
  }
}
