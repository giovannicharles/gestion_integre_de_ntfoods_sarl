import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ApiService } from '../../../core/http/api.service';
import { ApiResponse } from '../../../core/models/api-response.model';

export interface LotBE {
  id: number;
  productId: number;
  productSku?: string;
  productName?: string;
  productUnit?: string;
  declaredQuantityKg: number;
  equivalentUnits?: number;
  productionDate: string;
  batchDate?: string;
  status: string;
  declaredBy?: string;
  declaredByName?: string;
  stockValidator?: string;
  stockValidatorName?: string;
  createdAt: string;
  validatedAt?: string;
  notes?: string;
  conditioningType?: string;
  conditioningQty?: number;
}

export interface OFBE {
  id: string; referencePPH: string; codeProduit: string; designation: string;
  quantiteDemandee: number; quantiteRealisee: number; statut: string;
  dateCreation: string; dateDebut?: string; dateFin?: string;
}

export interface PPHBE {
  id: number; reference: string; statut: string;
  dateDebut: string; dateFin: string;
  referenceBC: string;
  matriculeCreateur: string;
  dateCreation: string;
}

export interface SessionBroyageBE {
  id: number; referencePPH: string; date: string;
  matriculeChefMachiniste: string; statut: string;
  realisations: {
    matriculeMachiniste: string; typePoudre: string;
    quantiteKg: number; dureeMin: number;
  }[];
  indicateursGlobaux?: {
    totalPoudreKg: number; tempsTotalMin: number; rendementKgH: number;
  };
}

export interface SessionDosageBE {
  id: number; referencePPH: string; date: string;
  matriculeAgentDoseur: string; statut: string;
  matieresUtilisees: { typeMatiere: string; quantiteKg: number }[];
  machines: string[];
  futsProduits: number; futsCasses: number; futsNets: number;
  justificationEcart?: string;
}

export interface FicheProductionBE {
  id: number; referencePPH: string; date: string;
  matriculeAgent: string; codeProduit: string; designation: string;
  quantiteProduite: number; unite: string;
  verrouillee: boolean; dateSaisie: string;
}

export interface AffectationBE {
  id: number; referencePPH: string; date: string;
  matriculeAgent: string; statut: string;
  postes: {
    poste: string; matricule: string; nom: string;
    productionIndividuelle: number; realise: boolean;
  }[];
  verrouillee: boolean;
}

export interface LigneRegistreBE {
  matriculeEmploye: string; nomEmploye: string; poste: string;
  present: boolean; motifAbsence: string | null;
  heureArrivee: string | null; qteRealisee: number; unite: string | null;
}

export interface RegistreProductionBE {
  id: number; referencePPH: string; date: string;
  matriculeChefProduction: string;
  lignes: LigneRegistreBE[];
  nbPresents: number; nbAbsents: number;
  dateCreation: string; dateModification: string;
}

@Injectable({ providedIn: 'root' })
export class ProductionService {
  private readonly api = inject(ApiService);

  getLots(statut?: string): Observable<LotBE[]> {
    return this.api.get<LotBE[]>('v1/stock/production/batches').pipe(
      map((list: LotBE[]) => statut ? list.filter(b => b.status === statut) : list),
      catchError(() => of([]))
    );
  }

  getOFs(statut?: string): Observable<OFBE[]> {
    const params: Record<string, string> = {};
    if (statut) params['statut'] = statut;
    return this.api.get<ApiResponse<OFBE[]>>('production/ordres-fabrication', params)
      .pipe(map(r => r.donnees ?? []), catchError(() => of([])));
  }

  declarerLot(req: {
    productId: number; productSku: string; productName: string; productUnit: string;
    declaredQuantityKg: number; equivalentUnits?: number; productionDate: string; notes?: string;
    conditioningType?: string; conditioningQty?: number;
  }): Observable<LotBE> {
    return this.api.post<LotBE>('v1/stock/production/batches/declare', req);
  }

  getLotsAValider(): Observable<LotBE[]> {
    return this.api.get<LotBE[]>('v1/stock/production/batches/pending').pipe(
      catchError(() => of([]))
    );
  }

  validerLot(id: number, notes?: string): Observable<LotBE> {
    return this.api.post<LotBE>(`v1/stock/production/batches/${id}/validate`, {}, notes ? { notes } : undefined);
  }

  rejeterLot(id: number, motif: string): Observable<LotBE> {
    return this.api.post<LotBE>(`v1/stock/production/batches/${id}/reject`, {}, { reason: motif });
  }

  getOF(idOF: string): Observable<OFBE> {
    return this.api.get<ApiResponse<OFBE>>(`production/ordres-fabrication/${encodeURIComponent(idOF)}`)
      .pipe(map(r => r.donnees!));
  }

  getPPHs(statut?: string): Observable<PPHBE[]> {
    const params: Record<string, string> = {};
    if (statut) params['statut'] = statut;
    return this.api.get<ApiResponse<PPHBE[]>>('production/pph', params)
      .pipe(map(r => r.donnees ?? []), catchError(() => of([])));
  }

  getPPHEnCours(): Observable<PPHBE> {
    return this.api.get<ApiResponse<PPHBE>>('production/pph/en-cours')
      .pipe(map(r => r.donnees!));
  }

  getPPH(reference: string): Observable<PPHBE> {
    return this.api.get<ApiResponse<PPHBE>>(`production/pph/${encodeURIComponent(reference)}`)
      .pipe(map(r => r.donnees!));
  }

  creerPPH(req: {
    referenceBC: string; dateDebut: string; dateFin: string;
  }): Observable<PPHBE> {
    return this.api.post<ApiResponse<PPHBE>>('production/pph', req)
      .pipe(map(r => r.donnees!));
  }

  validerPPH(reference: string): Observable<PPHBE> {
    return this.api.patch<ApiResponse<PPHBE>>(
      `production/pph/${encodeURIComponent(reference)}/valider`, {}
    ).pipe(map(r => r.donnees!));
  }

  demarrerPPH(reference: string): Observable<PPHBE> {
    return this.api.patch<ApiResponse<PPHBE>>(
      `production/pph/${encodeURIComponent(reference)}/demarrer`, {}
    ).pipe(map(r => r.donnees!));
  }

  cloturerPPH(reference: string): Observable<PPHBE> {
    return this.api.patch<ApiResponse<PPHBE>>(
      `production/pph/${encodeURIComponent(reference)}/cloturer`, {}
    ).pipe(map(r => r.donnees!));
  }

  getSessionsBroyage(params: {
    referencePPH?: string; debut?: string; fin?: string;
  } = {}): Observable<SessionBroyageBE[]> {
    const p: Record<string, string> = {};
    if (params.referencePPH) p['referencePPH'] = params.referencePPH;
    if (params.debut) p['debut'] = params.debut;
    if (params.fin) p['fin'] = params.fin;
    return this.api.get<ApiResponse<SessionBroyageBE[]>>('production/broyage/sessions', p)
      .pipe(map(r => r.donnees ?? []), catchError(() => of([])));
  }

  getSessionBroyage(id: number): Observable<SessionBroyageBE> {
    return this.api.get<ApiResponse<SessionBroyageBE>>(`production/broyage/sessions/${id}`)
      .pipe(map(r => r.donnees!));
  }

  ouvrirSessionBroyage(req: {
    referencePPH: string; date: string;
  }): Observable<SessionBroyageBE> {
    return this.api.post<ApiResponse<SessionBroyageBE>>('production/broyage/sessions', req)
      .pipe(map(r => r.donnees!));
  }

  enregistrerRealisationBroyage(req: {
    sessionId: number; matriculeMachiniste: string;
    typePoudre: string; quantiteKg: number; dureeMin: number;
  }): Observable<SessionBroyageBE> {
    return this.api.post<ApiResponse<SessionBroyageBE>>('production/broyage/sessions/realisations', req)
      .pipe(map(r => r.donnees!));
  }

  cloturerSessionBroyage(req: {
    sessionId: number;
  }): Observable<SessionBroyageBE> {
    return this.api.post<ApiResponse<SessionBroyageBE>>('production/broyage/sessions/cloturer', req)
      .pipe(map(r => r.donnees!));
  }

  ouvrirSessionDosage(req: {
    referencePPH: string; date: string; matriculeAgentDoseur: string;
  }): Observable<SessionDosageBE> {
    return this.api.post<ApiResponse<SessionDosageBE>>('production/dosage', req)
      .pipe(map(r => r.donnees!));
  }

  enregistrerMatiereDosage(id: number, typeMatiere: string, quantiteKg: number): Observable<SessionDosageBE> {
    return this.api.post<ApiResponse<SessionDosageBE>>(
      `production/dosage/${id}/matiere?typeMatiere=${encodeURIComponent(typeMatiere)}&quantiteKg=${quantiteKg}`, {}
    ).pipe(map(r => r.donnees!));
  }

  enregistrerMachineDosage(id: number, machineId: string): Observable<SessionDosageBE> {
    return this.api.post<ApiResponse<SessionDosageBE>>(
      `production/dosage/${id}/machine?machineId=${encodeURIComponent(machineId)}`, {}
    ).pipe(map(r => r.donnees!));
  }

  enregistrerFutsDosage(id: number, nbProduits: number, nbCasses: number): Observable<SessionDosageBE> {
    return this.api.post<ApiResponse<SessionDosageBE>>(
      `production/dosage/${id}/futs?nbProduits=${nbProduits}&nbCasses=${nbCasses}`, {}
    ).pipe(map(r => r.donnees!));
  }

  justifierEcartDosage(id: number, justification: string): Observable<SessionDosageBE> {
    return this.api.post<ApiResponse<SessionDosageBE>>(
      `production/dosage/${id}/justifier?justification=${encodeURIComponent(justification)}`, {}
    ).pipe(map(r => r.donnees!));
  }

  validerSessionDosage(id: number): Observable<SessionDosageBE> {
    return this.api.patch<ApiResponse<SessionDosageBE>>(
      `production/dosage/${id}/valider`, {}
    ).pipe(map(r => r.donnees!));
  }

  getSessionsDosageParPPH(reference: string): Observable<SessionDosageBE[]> {
    return this.api.get<ApiResponse<SessionDosageBE[]>>(`production/dosage/pph/${encodeURIComponent(reference)}`)
      .pipe(map(r => r.donnees ?? []), catchError(() => of([])));
  }

  getSessionsDosageParDate(date: string): Observable<SessionDosageBE[]> {
    return this.api.get<ApiResponse<SessionDosageBE[]>>(`production/dosage/date/${date}`)
      .pipe(map(r => r.donnees ?? []), catchError(() => of([])));
  }

  getFichesParPPH(referencePPH: string): Observable<FicheProductionBE[]> {
    return this.api.get<ApiResponse<FicheProductionBE[]>>(`production/fiches/pph/${encodeURIComponent(referencePPH)}`)
      .pipe(map(r => r.donnees ?? []), catchError(() => of([])));
  }

  getFiche(referencePPH: string, date: string): Observable<FicheProductionBE> {
    return this.api.get<ApiResponse<FicheProductionBE>>(
      `production/fiches/pph/${encodeURIComponent(referencePPH)}/date/${date}`
    ).pipe(map(r => r.donnees!));
  }

  enregistrerFiche(req: {
    referencePPH: string; date: string; codeProduit: string;
    designation: string; quantiteProduite: number; unite: string;
  }): Observable<FicheProductionBE> {
    return this.api.post<ApiResponse<FicheProductionBE>>('production/fiches', req)
      .pipe(map(r => r.donnees!));
  }

  modifierFiche(referencePPH: string, date: string, req: {
    quantiteProduite: number; unite: string;
  }): Observable<FicheProductionBE> {
    return this.api.patch<ApiResponse<FicheProductionBE>>(
      `production/fiches/pph/${encodeURIComponent(referencePPH)}/date/${date}`, req
    ).pipe(map(r => r.donnees!));
  }

  getAffectations(params: {
    referencePPH?: string; debut?: string; fin?: string;
  } = {}): Observable<AffectationBE[]> {
    const p: Record<string, string> = {};
    if (params.referencePPH) p['referencePPH'] = params.referencePPH;
    if (params.debut) p['debut'] = params.debut;
    if (params.fin) p['fin'] = params.fin;
    return this.api.get<ApiResponse<AffectationBE[]>>('production/affectations', p)
      .pipe(map(r => r.donnees ?? []), catchError(() => of([])));
  }

  getAffectation(id: number): Observable<AffectationBE> {
    return this.api.get<ApiResponse<AffectationBE>>(`production/affectations/${id}`)
      .pipe(map(r => r.donnees!));
  }

  getAffectationDuJour(referencePPH: string): Observable<AffectationBE> {
    return this.api.get<ApiResponse<AffectationBE>>(
      `production/affectations/aujourd-hui?referencePPH=${encodeURIComponent(referencePPH)}`
    ).pipe(map(r => r.donnees!));
  }

  creerAffectation(req: {
    referencePPH: string; date: string;
    postes: { poste: string; matricule: string }[];
  }): Observable<AffectationBE> {
    return this.api.post<ApiResponse<AffectationBE>>('production/affectations', req)
      .pipe(map(r => r.donnees!));
  }

  saisirRealisationPoste(req: {
    affectationId: number; poste: string;
    productions: { matricule: string; quantite: number }[];
  }): Observable<AffectationBE> {
    return this.api.post<ApiResponse<AffectationBE>>('production/affectations/realisations', req)
      .pipe(map(r => r.donnees!));
  }

  validerAffectation(id: number): Observable<AffectationBE> {
    return this.api.patch<ApiResponse<AffectationBE>>(
      `production/affectations/${id}/valider`, {}
    ).pipe(map(r => r.donnees!));
  }

  getRegistres(params: { referencePPH?: string; debut?: string; fin?: string } = {}): Observable<RegistreProductionBE[]> {
    const p: Record<string, string> = {};
    if (params.referencePPH) p['referencePPH'] = params.referencePPH;
    if (params.debut) p['debut'] = params.debut;
    if (params.fin) p['fin'] = params.fin;
    return this.api.get<ApiResponse<RegistreProductionBE[]>>('production/registres', p)
      .pipe(map(r => r.donnees ?? []), catchError(() => of([])));
  }
}
