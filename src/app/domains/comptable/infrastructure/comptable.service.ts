import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../../../core/http/api.service';
import { ApiResponse } from '../../../core/models/api-response.model';
import { PageResponse, PageParams } from '../../../core/models/page-response.model';

export interface VersementBE {
  id: number; referenceVersement: string; matriculeCommercial: string;
  montantAttendu: number; cashVerse: number; ecart: number;
  alerteRouge: boolean; typeVersement: string; date: string;
  statut: string; justificationEcart?: string; matriculeValidateur?: string;
}

export interface LigneFactureBE {
  referenceArticle: string; designation: string; quantite: number;
  prixUnitaireHT: number; tauxTVA: number; remise: number;
  montantHT: number; montantTVA: number; montantTTC: number;
}

export interface FactureBE {
  id: number; numeroFacture: string; codeClient: string;
  typeFacture: string; referenceFactureOrigine?: string;
  dateEmission: string; statut: string; matriculeEmetteur: string;
  montantTotalHT: number; montantTotalTVA: number; montantTotalTTC: number;
  lignes: LigneFactureBE[];
}

export interface CaisseLigneBE {
  referenceOperation: string; typeMouvement: string; montant: number;
  motif: string; dateOperation: string; matriculeOperateur: string;
}

export interface CaisseBE {
  id: number; date: string; soldeCourant: number; seuilSecurisation: number;
  totalEntrees: number; totalSorties: number; lignes: CaisseLigneBE[];
}

export interface DecaissementBE {
  id: number; numero: string; typeDepense: string;
  matriculeProposant: string; montantFCFA: number;
  beneficiaire: string; dateDepense: string; motif: string;
  statut: string; matriculeDG?: string; matriculeExecuteur?: string;
  dateValidationDG?: string; dateApprobationDG?: string;
  dateExecution?: string; motifAnnulation?: string;
}

export interface ObjectifCommercialBE {
  id: number; matriculeCommercial: string;
  semaineDebut: string; semaineFin: string;
  objectifGlobal: number; objectifFarines: number;
  objectifEaux: number; objectifJus: number;
  objectifSnacks: number; objectifBiscuits: number;
  objectifConfiseries: number;
  matriculeDefinisseur: string; dateDefinition: string;
}

export interface ReconciliationBE {
  matricule: string; date: string;
  caDeclare: number; valeurRetoursValides: number;
  resultatNet: number;
}

export interface DashboardComptabiliteBE {
  date: string;
  soldeCaisse: number;
  totalEntreesCaisse: number;
  totalSortiesCaisse: number;
  totalFacturesEmises: number;
  totalFacturesPayees: number;
  nbFacturesImpayees: number;
  totalDecaissementsExecutes: number;
  nbDecaissementsEnAttente: number;
  nbVersementsEnAttente: number;
  nbAlertesRouges: number;
  nbPrimesValideesNonVersées: number;
  totalPrimesAVerser: number;
}

@Injectable({ providedIn: 'root' })
export class ComptableService {
  private readonly api = inject(ApiService);

  // ── Dashboard ───────────────────────────────────────────────

  getDashboard(): Observable<DashboardComptabiliteBE> {
    return this.api.get<ApiResponse<DashboardComptabiliteBE>>('comptabilite/dashboard')
      .pipe(map(r => r.donnees!));
  }

  // ── Versements ──────────────────────────────────────────────

  getVersements(params: { commercial?: string; date?: string; statut?: string } = {}): Observable<VersementBE[]> {
    const p: Record<string, string> = {};
    if (params.commercial) p['commercial'] = params.commercial;
    if (params.date) p['date'] = params.date;
    if (params.statut) p['statut'] = params.statut;
    return this.api.get<ApiResponse<VersementBE[]>>('comptabilite/versements', p)
      .pipe(map(r => r.donnees ?? []));
  }

  getAlertes(): Observable<VersementBE[]> {
    return this.api.get<ApiResponse<VersementBE[]>>('comptabilite/versements/alertes')
      .pipe(map(r => r.donnees ?? []));
  }

  enregistrerVersement(req: {
    matriculeCommercial: string; montantAttendu: number; cashVerse: number;
    typeVersement: string; date?: string;
  }): Observable<VersementBE> {
    return this.api.post<ApiResponse<VersementBE>>('comptabilite/versements', req)
      .pipe(map(r => r.donnees!));
  }

  validerVersement(reference: string, matricule: string, codeOtp: string): Observable<VersementBE> {
    return this.api.patch<ApiResponse<VersementBE>>(
      `comptabilite/versements/${encodeURIComponent(reference)}/valider?matriculeValidateur=${encodeURIComponent(matricule)}&codeOtp=${encodeURIComponent(codeOtp)}`,
      {}
    ).pipe(map(r => r.donnees!));
  }

  justifierEcart(reference: string, justification: string): Observable<VersementBE> {
    return this.api.patch<ApiResponse<VersementBE>>(
      `comptabilite/versements/${encodeURIComponent(reference)}/justifier`,
      { justification }
    ).pipe(map(r => r.donnees!));
  }

  // ── Factures ────────────────────────────────────────────────

  getFactures(debut: string, fin: string, page?: PageParams): Observable<PageResponse<FactureBE>> {
    const params: Record<string, string> = { debut, fin };
    if (page?.page !== undefined) params['page'] = String(page.page);
    if (page?.size !== undefined) params['size'] = String(page.size);
    if (page?.sort) params['sort'] = page.sort;
    return this.api.get<ApiResponse<PageResponse<FactureBE>>>('comptabilite/factures', params)
      .pipe(map(r => r.donnees!));
  }

  emettreFacture(req: {
    codeClient: string; typeFacture: string; referenceFactureOrigine?: string;
    matriculeEmetteur: string;
    lignes: { referenceArticle: string; designation: string; quantite: number;
              prixUnitaireHT: number; tauxTVA: number; remise: number }[];
  }): Observable<FactureBE> {
    return this.api.post<ApiResponse<FactureBE>>('comptabilite/factures', req)
      .pipe(map(r => r.donnees!));
  }

  consulterFacture(numero: string): Observable<FactureBE> {
    return this.api.get<ApiResponse<FactureBE>>(`comptabilite/factures/${encodeURIComponent(numero)}`)
      .pipe(map(r => r.donnees!));
  }

  getFacturesParStatut(statut: string, page?: PageParams): Observable<PageResponse<FactureBE>> {
    const params: Record<string, string> = {};
    if (page?.page !== undefined) params['page'] = String(page.page);
    if (page?.size !== undefined) params['size'] = String(page.size);
    if (page?.sort) params['sort'] = page.sort;
    return this.api.get<ApiResponse<PageResponse<FactureBE>>>(`comptabilite/factures/statut/${statut}`, params)
      .pipe(map(r => r.donnees!));
  }

  getFacturesClient(codeClient: string, page?: PageParams): Observable<PageResponse<FactureBE>> {
    const params: Record<string, string> = {};
    if (page?.page !== undefined) params['page'] = String(page.page);
    if (page?.size !== undefined) params['size'] = String(page.size);
    if (page?.sort) params['sort'] = page.sort;
    return this.api.get<ApiResponse<PageResponse<FactureBE>>>(`comptabilite/factures/client/${codeClient}`, params)
      .pipe(map(r => r.donnees!));
  }

  payerFacture(numero: string): Observable<FactureBE> {
    return this.api.patch<ApiResponse<FactureBE>>(
      `comptabilite/factures/${encodeURIComponent(numero)}/payer`, {}
    ).pipe(map(r => r.donnees!));
  }

  annulerFacture(numero: string): Observable<FactureBE> {
    return this.api.patch<ApiResponse<FactureBE>>(
      `comptabilite/factures/${encodeURIComponent(numero)}/annuler`, {}
    ).pipe(map(r => r.donnees!));
  }

  // ── Caisse ──────────────────────────────────────────────────

  getCaisse(date: string): Observable<CaisseBE | null> {
    return this.api.get<ApiResponse<CaisseBE>>(`comptabilite/caisse/${date}`)
      .pipe(map(r => r.donnees ?? null));
  }

  ouvrirCaisse(req: { soldeInitial: number; date?: string }): Observable<CaisseBE> {
    return this.api.post<ApiResponse<CaisseBE>>('comptabilite/caisse/ouvrir', req)
      .pipe(map(r => r.donnees!));
  }

  entreeCaisse(date: string, req: {
    referenceOperation: string; montant: number; motif: string; matriculeOperateur: string;
  }): Observable<CaisseBE> {
    return this.api.post<ApiResponse<CaisseBE>>(
      `comptabilite/caisse/${date}/entree`, req
    ).pipe(map(r => r.donnees!));
  }

  sortieCaisse(date: string, req: {
    referenceOperation: string; montant: number; motif: string; matriculeOperateur: string;
  }): Observable<CaisseBE> {
    return this.api.post<ApiResponse<CaisseBE>>(
      `comptabilite/caisse/${date}/sortie`, req
    ).pipe(map(r => r.donnees!));
  }

  getCaisseParPeriode(debut: string, fin: string): Observable<CaisseBE[]> {
    return this.api.get<ApiResponse<CaisseBE[]>>('comptabilite/caisse', { debut, fin })
      .pipe(map(r => r.donnees ?? []));
  }

  // ── Décaissements ───────────────────────────────────────────

  getDecaissements(): Observable<DecaissementBE[]> {
    return this.api.get<ApiResponse<DecaissementBE[]>>('comptabilite/decaissements')
      .pipe(map(r => r.donnees ?? []));
  }

  getDecaissement(numero: string): Observable<DecaissementBE> {
    return this.api.get<ApiResponse<DecaissementBE>>(`comptabilite/decaissements/${encodeURIComponent(numero)}`)
      .pipe(map(r => r.donnees!));
  }

  getDecaissementsParPeriode(debut: string, fin: string): Observable<DecaissementBE[]> {
    return this.api.get<ApiResponse<DecaissementBE[]>>('comptabilite/decaissements/periode', { debut, fin })
      .pipe(map(r => r.donnees ?? []));
  }

  getDecaissementsParStatut(statut: string): Observable<DecaissementBE[]> {
    return this.api.get<ApiResponse<DecaissementBE[]>>(`comptabilite/decaissements/statut/${statut}`)
      .pipe(map(r => r.donnees ?? []));
  }

  proposerDecaissement(req: {
    typeDepense: string; matriculeProposant: string;
    montantFCFA: number; beneficiaire: string;
    dateDepense: string; motif: string;
  }): Observable<DecaissementBE> {
    return this.api.post<ApiResponse<DecaissementBE>>('comptabilite/decaissements', req)
      .pipe(map(r => r.donnees!));
  }

  validerDecaissementDG(numero: string, matriculeDG: string): Observable<DecaissementBE> {
    return this.api.patch<ApiResponse<DecaissementBE>>(
      `comptabilite/decaissements/${encodeURIComponent(numero)}/valider-dg?matriculeDG=${encodeURIComponent(matriculeDG)}`, {}
    ).pipe(map(r => r.donnees!));
  }

  approuverDecaissementDG(numero: string, matriculeDG: string): Observable<DecaissementBE> {
    return this.api.patch<ApiResponse<DecaissementBE>>(
      `comptabilite/decaissements/${encodeURIComponent(numero)}/approuver-dg?matriculeDG=${encodeURIComponent(matriculeDG)}`, {}
    ).pipe(map(r => r.donnees!));
  }

  executerDecaissement(numero: string, matriculeExecuteur: string): Observable<DecaissementBE> {
    return this.api.patch<ApiResponse<DecaissementBE>>(
      `comptabilite/decaissements/${encodeURIComponent(numero)}/executer?matriculeExecuteur=${encodeURIComponent(matriculeExecuteur)}`, {}
    ).pipe(map(r => r.donnees!));
  }

  annulerDecaissement(numero: string, motif: string, matricule: string): Observable<DecaissementBE> {
    return this.api.patch<ApiResponse<DecaissementBE>>(
      `comptabilite/decaissements/${encodeURIComponent(numero)}/annuler?motif=${encodeURIComponent(motif)}&matricule=${encodeURIComponent(matricule)}`, {}
    ).pipe(map(r => r.donnees!));
  }

  // ── Réconciliation ─────────────────────────────────────────

  getReconciliation(matricule: string, date: string): Observable<ReconciliationBE> {
    return this.api.get<ApiResponse<ReconciliationBE>>('comptabilite/versements/reconciliation', { matricule, date })
      .pipe(map(r => r.donnees!));
  }

  // ── Objectifs commerciaux ───────────────────────────────────

  getObjectifsParCommercial(matricule: string): Observable<ObjectifCommercialBE[]> {
    return this.api.get<ApiResponse<ObjectifCommercialBE[]>>(`comptabilite/objectifs/commercial/${encodeURIComponent(matricule)}`)
      .pipe(map(r => r.donnees ?? []));
  }

  getObjectifsParSemaine(semaineDebut: string): Observable<ObjectifCommercialBE[]> {
    return this.api.get<ApiResponse<ObjectifCommercialBE[]>>('comptabilite/objectifs/semaine', { semaineDebut })
      .pipe(map(r => r.donnees ?? []));
  }

  definirObjectif(req: {
    matriculeCommercial: string; semaineDebut: string;
    objectifGlobal: number; objectifFarines: number;
    objectifEaux: number; objectifJus: number;
    objectifSnacks: number; objectifBiscuits: number;
    objectifConfiseries: number;
  }): Observable<ObjectifCommercialBE> {
    return this.api.post<ApiResponse<ObjectifCommercialBE>>('comptabilite/objectifs', req)
      .pipe(map(r => r.donnees!));
  }
}
