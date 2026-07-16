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
  code: string;
  designation: string;
  prixVente: number;
  coutRevient: number;
  marge: number;
  margePct: number;
  margeTotale: number;
  ventesMois: number;
}

export interface BudgetItem {
  poste: string;
  budget: number;
  engage: number;
  realise: number;
}

export interface VarianceItem {
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

  getBudget(): Observable<BudgetItem[]> {
    return this.api.get<ApiResponse<BudgetItem[]>>('controle/budget').pipe(map(r => r.donnees ?? []));
  }

  getVariances(): Observable<VarianceItem[]> {
    return this.api.get<ApiResponse<VarianceItem[]>>('controle/variances').pipe(map(r => r.donnees ?? []));
  }
}
