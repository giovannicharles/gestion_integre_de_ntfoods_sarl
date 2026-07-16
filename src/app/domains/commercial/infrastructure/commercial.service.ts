import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../../../core/http/api.service';
import { ApiResponse } from '../../../core/models/api-response.model';
import { PageResponse, PageParams } from '../../../core/models/page-response.model';

export interface ClientBE {
  id: number; codeClient: string; nom: string; telephone: string;
  adresse: string; localite: string; type: string;
  matriculeCommercialReferent: string; actif: boolean;
}

export interface LignePCBE {
  codeProduit: string; designationProduit: string; conditionnement: string;
  quantiteDemandee: number; quantiteValidee: number;
}

export interface PreCommandeBE {
  id: number; numeroPreCommande: string; matriculeCommercial: string;
  dateSoumission: string; dateEffet: string; statut: string;
  matriculeValidateurSecretaire?: string; matriculeValidateurComptable?: string;
  motifRefus?: string; soumiseEnSoiree: boolean; lignes: LignePCBE[];
}

export interface RecouvrementBE {
  id: number; referenceRecouvrement: string; codeClient: string; nomClient: string;
  montantDu: number; montantRembourse: number; montantRestant: number;
  dateEcheance: string; statut: string; matriculeCommercial: string; observations?: string;
}

export interface CarburantBE {
  id: number; referenceCarburant: string; matriculeCommercial: string;
  immatriculation: string; stationPartenaire: string; kilometrage: number;
  litresDemandes: number; montant: number;
  date: string; statut: string; signatureCommercial?: string;
  signatureSuperviseur?: string; motifRefus?: string; photoCompteur?: string;
  caZoneMoisCourantFCFA: number; ratioCarburantSurCaPourcent: number;
}

export interface VenteBE {
  id: number; numeroVente: string; matriculeCommercial: string;
  codeClient: string; date: string; modeReglement: string;
  typeVente: string; statut: string; montantTotal: number;
  lignes: LigneVenteBE[];
}

export interface LigneVenteBE {
  codeProduit: string; designation: string; conditionnement: string;
  quantite: number; prixUnitaire: number; remise: number;
  montantHT: number; montantTVA: number; montantTTC: number;
}

export interface AvoirBE {
  id: number; numeroAvoir: string; numeroVenteOriginale: string;
  matriculeCommercial: string; codeClient: string; matriculeComptable: string;
  montantHT: number; montantTVA: number; montantTTC: number;
  motif: string; dateAvoir: string; statut: string;
  dateCreation: string; dateValidation?: string;
}

export interface FicheSyntheseBE {
  date: string;
  caYaounde: number; caDouala: number; caTotal: number;
  effectifCommerciaux: number;
  vacInit: number; ca: number; vac: number;
  recouvrements: number; vteCpt: number; soldeVAC: number;
  cumulMensuelCA: number; eCheques: number; vstBanques: number;
  depensesJustifiees: number; depensesNonJust: number;
  sCaisse: number; montantAvaries: number; montantDotPromo: number;
  lignes: LigneFicheSyntheseBE[];
}

export interface LigneFicheSyntheseBE {
  codeProduit: string; qteProduite: number; stockVeille: number;
  stockCamion: number; stockTotal: number; qteSorties: number;
  stockFinal: number; qteAvoDotProm: number; qteFacturee: number;
}

@Injectable({ providedIn: 'root' })
export class CommercialService {
  private readonly api = inject(ApiService);

  // ── Clients / Prospects ─────────────────────────────────────

  getClients(commercial?: string): Observable<ClientBE[]> {
    const params: Record<string, string> = {};
    if (commercial) params['commercial'] = commercial;
    return this.api.get<ApiResponse<ClientBE[]>>('commercial/clients', params)
      .pipe(map(r => r.donnees ?? []));
  }

  creerClient(req: {
    nom: string; telephone: string; adresse: string;
    localite: string; type: string; matriculeCommercialReferent: string;
  }): Observable<ClientBE> {
    return this.api.post<ApiResponse<ClientBE>>('commercial/clients', req)
      .pipe(map(r => r.donnees!));
  }

  // ── Précommandes ────────────────────────────────────────────

  getPrecommandesAValider(page?: PageParams): Observable<PageResponse<PreCommandeBE>> {
    const params: Record<string, string> = {};
    if (page?.page !== undefined) params['page'] = String(page.page);
    if (page?.size !== undefined) params['size'] = String(page.size);
    if (page?.sort) params['sort'] = page.sort;
    return this.api.get<ApiResponse<PageResponse<PreCommandeBE>>>('commercial/precommandes/a-valider', params)
      .pipe(map(r => r.donnees!));
  }

  getPrecommandesParDate(date: string, page?: PageParams): Observable<PageResponse<PreCommandeBE>> {
    const params: Record<string, string> = {};
    if (page?.page !== undefined) params['page'] = String(page.page);
    if (page?.size !== undefined) params['size'] = String(page.size);
    if (page?.sort) params['sort'] = page.sort;
    return this.api.get<ApiResponse<PageResponse<PreCommandeBE>>>(`commercial/precommandes/date-effet/${date}`, params)
      .pipe(map(r => r.donnees!));
  }

  soumettrePrecommande(req: {
    matriculeCommercial: string; dateSoumission: string;
    lignes: { codeProduit: string; designation: string; conditionnement: string; quantite: number }[];
  }): Observable<PreCommandeBE> {
    return this.api.post<ApiResponse<PreCommandeBE>>('commercial/precommandes', req)
      .pipe(map(r => r.donnees!));
  }

  validerSecretaire(numero: string, matricule: string): Observable<PreCommandeBE> {
    return this.api.patch<ApiResponse<PreCommandeBE>>(
      `commercial/precommandes/${encodeURIComponent(numero)}/valider-secretaire?matriculeSecretaire=${encodeURIComponent(matricule)}`,
      {}
    ).pipe(map(r => r.donnees!));
  }

  validerComptable(numero: string, matricule: string): Observable<PreCommandeBE> {
    return this.api.patch<ApiResponse<PreCommandeBE>>(
      `commercial/precommandes/${encodeURIComponent(numero)}/valider-comptable?matriculeComptable=${encodeURIComponent(matricule)}`,
      {}
    ).pipe(map(r => r.donnees!));
  }

  // ── Recouvrements ───────────────────────────────────────────

  getRecouvrements(params: { commercial?: string; client?: string; statut?: string } = {}): Observable<RecouvrementBE[]> {
    const p: Record<string, string> = {};
    if (params.commercial) p['commercial'] = params.commercial;
    if (params.client) p['client'] = params.client;
    if (params.statut) p['statut'] = params.statut;
    return this.api.get<ApiResponse<RecouvrementBE[]>>('commercial/recouvrements', p)
      .pipe(map(r => r.donnees ?? []));
  }

  rembourserRecouvrement(reference: string, montant: number): Observable<RecouvrementBE> {
    return this.api.patch<ApiResponse<RecouvrementBE>>(
      `commercial/recouvrements/${encodeURIComponent(reference)}/rembourser?montant=${montant}`,
      {}
    ).pipe(map(r => r.donnees!));
  }

  // ── Carburant ───────────────────────────────────────────────

  getCarburant(params: { commercial?: string; statut?: string } = {}): Observable<CarburantBE[]> {
    const p: Record<string, string> = {};
    if (params.commercial) p['commercial'] = params.commercial;
    if (params.statut) p['statut'] = params.statut;
    return this.api.get<ApiResponse<CarburantBE[]>>('commercial/carburant', p)
      .pipe(map(r => r.donnees ?? []));
  }

  creerCarburant(req: {
    matriculeCommercial: string; immatriculation: string;
    stationPartenaire: string; kilometrage: number;
    litresDemandes: number; montant: number;
    photoCompteur?: string;
  }): Observable<CarburantBE> {
    return this.api.post<ApiResponse<CarburantBE>>('commercial/carburant', req)
      .pipe(map(r => r.donnees!));
  }

  signerCarburant(reference: string, req: {
    signatureCommercial: string; signatureSuperviseur: string;
  }): Observable<CarburantBE> {
    return this.api.patch<ApiResponse<CarburantBE>>(
      `commercial/carburant/${encodeURIComponent(reference)}/signer`,
      req
    ).pipe(map(r => r.donnees!));
  }

  refuserCarburant(reference: string, motif: string): Observable<CarburantBE> {
    return this.api.patch<ApiResponse<CarburantBE>>(
      `commercial/carburant/${encodeURIComponent(reference)}/refuser?motif=${encodeURIComponent(motif)}`,
      {}
    ).pipe(map(r => r.donnees!));
  }

  // ── Ventes ─────────────────────────────────────────────────

  getVentes(debut: string, fin: string, page?: PageParams): Observable<PageResponse<VenteBE>> {
    const params: Record<string, string> = { debut, fin };
    if (page?.page !== undefined) params['page'] = String(page.page);
    if (page?.size !== undefined) params['size'] = String(page.size);
    if (page?.sort) params['sort'] = page.sort;
    return this.api.get<ApiResponse<PageResponse<VenteBE>>>('commercial/ventes', params)
      .pipe(map(r => r.donnees!));
  }

  getVentesParCommercial(matricule: string, page?: PageParams): Observable<PageResponse<VenteBE>> {
    const params: Record<string, string> = {};
    if (page?.page !== undefined) params['page'] = String(page.page);
    if (page?.size !== undefined) params['size'] = String(page.size);
    if (page?.sort) params['sort'] = page.sort;
    return this.api.get<ApiResponse<PageResponse<VenteBE>>>(`commercial/ventes/commercial/${matricule}`, params)
      .pipe(map(r => r.donnees!));
  }

  finaliserVente(numero: string): Observable<VenteBE> {
    return this.api.patch<ApiResponse<VenteBE>>(
      `commercial/ventes/${encodeURIComponent(numero)}/finaliser`, {}
    ).pipe(map(r => r.donnees!));
  }

  annulerVente(numero: string, motif: string): Observable<VenteBE> {
    return this.api.patch<ApiResponse<VenteBE>>(
      `commercial/ventes/${encodeURIComponent(numero)}/annuler?motif=${encodeURIComponent(motif)}`, {}
    ).pipe(map(r => r.donnees!));
  }

  declarerNonMarchand(req: {
    typeVente: string; matriculeCommercial: string; codeClient: string;
    codeProduit: string; designationProduit: string; conditionnement: string;
    quantite: number; date: string; motif: string;
    pourcentageLot?: number; photoJustificative?: string;
  }): Observable<VenteBE> {
    return this.api.post<ApiResponse<VenteBE>>('commercial/ventes/non-marchand', req)
      .pipe(map(r => r.donnees!));
  }

  emettreAvoir(numeroVente: string, req: {
    matriculeComptable: string; motif: string;
  }): Observable<AvoirBE> {
    return this.api.post<ApiResponse<AvoirBE>>(
      `commercial/ventes/${encodeURIComponent(numeroVente)}/avoir`, req
    ).pipe(map(r => r.donnees!));
  }

  validerAvoir(numeroAvoir: string): Observable<AvoirBE> {
    return this.api.patch<ApiResponse<AvoirBE>>(
      `commercial/ventes/avoirs/${encodeURIComponent(numeroAvoir)}/valider`, {}
    ).pipe(map(r => r.donnees!));
  }

  refuserPrecommande(numero: string, motif: string, matriculeValidateur: string): Observable<PreCommandeBE> {
    return this.api.patch<ApiResponse<PreCommandeBE>>(
      `commercial/precommandes/${encodeURIComponent(numero)}/refuser?motif=${encodeURIComponent(motif)}&matriculeValidateur=${encodeURIComponent(matriculeValidateur)}`, {}
    ).pipe(map(r => r.donnees!));
  }

  livrerPrecommande(numero: string): Observable<PreCommandeBE> {
    return this.api.patch<ApiResponse<PreCommandeBE>>(
      `commercial/precommandes/${encodeURIComponent(numero)}/livrer`, {}
    ).pipe(map(r => r.donnees!));
  }

  // ── Fiche synthèse journalière ─────────────────────────────

  getFicheSynthese(date?: string): Observable<FicheSyntheseBE> {
    const params: Record<string, string> = {};
    if (date) params['date'] = date;
    return this.api.get<ApiResponse<FicheSyntheseBE>>('commercial/dashboard/fiche-synthese', params)
      .pipe(map(r => r.donnees!));
  }
}
