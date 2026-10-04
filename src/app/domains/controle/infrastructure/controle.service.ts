import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../../../core/http/api.service';
import { ApiResponse } from '../../../core/models/api-response.model';

export interface ControleDashboard {
  tresorerie: number;
  ecartsRouges: number;
  ventesCredit: number;
  margeMoyenne: number;
  valoStock: number;
  budgetEngage: number;
  budgetTotal: number;
  budgetDepasse: number;
  decaissementsAttente: number;
  anomaliesElevees: number;
  marges: MargeProduit[];
  budget: BudgetItem[];
  variances: VarianceItem[];
}

export interface MargeProduit {
  id: number;
  code: string;
  designation: string;
  prixVente: number;
  coutRevient: number;
  marge: number;
  margePct: number;
  margeTotale: number;
  ventesMois: number;
}

export interface MargeProduitRequest {
  code: string;
  designation: string;
  prixVente: number;
  coutRevient: number;
  ventesMois: number;
}

export interface BudgetItem {
  id: number;
  poste: string;
  budget: number;
  engage: number;
  realise: number;
}

export interface BudgetRequest {
  poste: string;
  budget: number;
  engage: number;
  realise: number;
}

export interface VarianceItem {
  id: number;
  poste: string;
  standard: number;
  reel: number;
  unite: string;
}

export interface VarianceRequest {
  poste: string;
  standard: number;
  reel: number;
  unite: string;
}

@Injectable({ providedIn: 'root' })
export class ControleService {
  private readonly api = inject(ApiService);

  getDashboard(): Observable<ControleDashboard> {
    return this.api.get<ApiResponse<ControleDashboard>>('controle/dashboard').pipe(map(r => r.donnees!));
  }

  getMarges(): Observable<MargeProduit[]> {
    return this.api.get<ApiResponse<MargeProduit[]>>('controle/marges').pipe(map(r => r.donnees ?? []));
  }

  creerMargeProduit(payload: MargeProduitRequest): Observable<MargeProduit> {
    return this.api.post<ApiResponse<MargeProduit>>('controle/marges', payload).pipe(map(r => r.donnees!));
  }

  modifierMargeProduit(id: number, payload: MargeProduitRequest): Observable<MargeProduit> {
    return this.api.put<ApiResponse<MargeProduit>>(`controle/marges/${id}`, payload).pipe(map(r => r.donnees!));
  }

  getBudget(): Observable<BudgetItem[]> {
    return this.api.get<ApiResponse<BudgetItem[]>>('controle/budget').pipe(map(r => r.donnees ?? []));
  }

  creerBudget(payload: BudgetRequest): Observable<BudgetItem> {
    return this.api.post<ApiResponse<BudgetItem>>('controle/budget', payload).pipe(map(r => r.donnees!));
  }

  modifierBudget(id: number, payload: BudgetRequest): Observable<BudgetItem> {
    return this.api.put<ApiResponse<BudgetItem>>(`controle/budget/${id}`, payload).pipe(map(r => r.donnees!));
  }

  getVariances(): Observable<VarianceItem[]> {
    return this.api.get<ApiResponse<VarianceItem[]>>('controle/variances').pipe(map(r => r.donnees ?? []));
  }

  creerVariance(payload: VarianceRequest): Observable<VarianceItem> {
    return this.api.post<ApiResponse<VarianceItem>>('controle/variances', payload).pipe(map(r => r.donnees!));
  }

  modifierVariance(id: number, payload: VarianceRequest): Observable<VarianceItem> {
    return this.api.put<ApiResponse<VarianceItem>>(`controle/variances/${id}`, payload).pipe(map(r => r.donnees!));
  }
}
