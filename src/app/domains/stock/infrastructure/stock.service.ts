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
  matriculeCommercial: string;
  datePreparation: string;
  dateEffet: string;
  statut: string;
  dotations: string[];
  matriculeValidateurSecretaire?: string;
  matriculeValidateurComptable?: string;
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

  ouvrirInventaire(req: {
    type: string; entrepot: string; justification?: string;
  }): Observable<InventaireBE> {
    return this.api.post<ApiResponse<InventaireBE>>('stock/inventaires', req)
      .pipe(map(r => r.donnees!));
  }

  saisirComptage(numero: string, req: {
    codeProduit: string; quantiteComptee: number;
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

  transferToBuffer(id: number, quantity: number): Observable<NiveauStockBE> {
    return this.api.post<ApiResponse<NiveauStockBE>>(`stock/levels/${id}/transfer-to-buffer?quantity=${quantity}`, {})
      .pipe(map(r => r.donnees!));
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
      .pipe(map(r => r.donnees ?? []));
  }

  getSessionsParDate(date: string): Observable<SessionCommercialBE[]> {
    return this.api.get<ApiResponse<SessionCommercialBE[]>>(`stock/sessions/date/${date}`)
      .pipe(map(r => r.donnees ?? []));
  }

  getSessionsParStatut(statut: string): Observable<SessionCommercialBE[]> {
    return this.api.get<ApiResponse<SessionCommercialBE[]>>(`stock/sessions/statut/${encodeURIComponent(statut)}`)
      .pipe(map(r => r.donnees ?? []));
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

  // ── Rapports (téléchargement fichiers) ──────────────────────

  getRapportEtatStock(params: {
    entrepot?: string; produit?: string; type?: string; format?: string;
  } = {}): Observable<Blob> {
    const p: Record<string, string> = { format: params.format ?? 'xlsx' };
    if (params.entrepot) p['entrepot'] = params.entrepot;
    if (params.produit) p['produit'] = params.produit;
    if (params.type) p['type'] = params.type;
    return this.api.get('stock/rapports/etat-stock', p) as unknown as Observable<Blob>;
  }
}
