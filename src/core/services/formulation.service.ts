import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Formulation {
  id?: number;
  codeFormulation: string;
  codeProduit: string;
  sku?: string;
  designation?: string;
  codeConditionnement?: string;
  niveauConditionnement?: string;
  quantiteUnite: number;
  unite: string;
  statut: string;
  dateDebutValidite: string;
  dateFinValidite?: string;
  version: string;
  creePar: string;
  validePar?: string;
  dateValidation?: string;
  lignes?: LigneFormulation[];
}

export interface LigneFormulation {
  id?: number;
  codeMP: string;
  nomMP: string;
  quantiteUnite: number;
  unite: string;
  pertePct: number;
  raisonPerte?: string;
}

export interface BesoinProduction {
  codeMP: string;
  nomMP: string;
  unite: string;
  quantiteTotale: number;
  pertePct: number;
  quantiteTheorique: number;
}

export interface CapaciteProduction {
  codeProduit: string;
  sku?: string;
  designation?: string;
  niveauConditionnement: string;
  capaciteUnites: number;
  capacitesMP: CapaciteMP[];
  facteurLimitant: FacteurLimitant;
}

export interface CapaciteMP {
  codeMP: string;
  nomMP: string;
  unite: string;
  quantiteDisponible: number;
  quantiteRequiseParUnite: number;
  capaciteUnites: number;
}

export interface FacteurLimitant {
  codeMP: string;
  nomMP: string;
  quantiteDisponible: number;
  quantiteRequiseParUnite: number;
  capaciteUnites: number;
}

@Injectable({
  providedIn: 'root'
})
export class FormulationService {
  private apiUrl = '/api/v1/formulations';

  constructor(private http: HttpClient) {}

  creer(formulation: Omit<Formulation, 'id'>): Observable<Formulation> {
    return this.http.post<Formulation>(this.apiUrl, formulation);
  }

  valider(codeFormulation: string, validePar: string): Observable<Formulation> {
    return this.http.post<Formulation>(`${this.apiUrl}/${codeFormulation}/valider`, { validePar });
  }

  calculerBesoin(codeFormulation: string, nombreUnites: number, niveauConditionnement: string): Observable<BesoinProduction[]> {
    return this.http.post<BesoinProduction[]>(`${this.apiUrl}/${codeFormulation}/calculer-besoin`, {
      nombreUnites,
      niveauConditionnement
    });
  }

  predireProduction(codeFormulation: string, niveauConditionnement: string): Observable<CapaciteProduction> {
    return this.http.post<CapaciteProduction>(`${this.apiUrl}/${codeFormulation}/predire-production`, {
      niveauConditionnement
    });
  }
}
