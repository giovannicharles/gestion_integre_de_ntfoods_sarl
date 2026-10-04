import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../../../core/http/api.service';
import { ApiResponse } from '../../../core/models/api-response.model';

export interface RpDashboard {
  nbEligibles: number;
  totalPrimes: number;
  occupationMoyenne: number;
  grandsComptesActifs: number;
  relancesDues: number;
  caGrandsComptes: number;
  primes: PrimeResponse[];
  gammes: PerformanceGammeResponse[];
  occupation: OccupationMarcheResponse[];
  grandsComptes: GrandCompteResponse[];
}

export interface PrimeResponse {
  commercialId: string;
  nom: string;
  tauxGlobal: number;
  gammesValidees: number;
  gammesTotal: number;
  eligible: boolean;
  montant: number;
}

export interface PerformanceGammeResponse {
  gamme: string;
  ca: number;
  objectif: number;
  marge: number;
  stock: string;
}

export interface OccupationMarcheResponse {
  zone: string;
  commercialId: string;
  livrees: number;
  repertoriees: number;
  potentiel: string;
}

export interface GrandCompteResponse {
  id: number;
  nom: string;
  type: string;
  contact: string;
  telephone: string;
  caMensuel: number;
  derniereCommande: string;
  prochaineRelance: string;
  statut: string;
}

export interface GrandCompteRequest {
  nom: string;
  type: string;
  contact: string;
  telephone: string;
  caMensuel: number;
  derniereCommande: string | null;
  prochaineRelance: string | null;
  statut: string;
}

@Injectable({ providedIn: 'root' })
export class RpService {
  private readonly api = inject(ApiService);

  getDashboard(): Observable<RpDashboard> {
    return this.api.get<ApiResponse<RpDashboard>>('rp/dashboard').pipe(map(r => r.donnees!));
  }

  getPrimes(): Observable<PrimeResponse[]> {
    return this.api.get<ApiResponse<PrimeResponse[]>>('rp/primes').pipe(map(r => r.donnees ?? []));
  }

  getGrandsComptes(): Observable<GrandCompteResponse[]> {
    return this.api.get<ApiResponse<GrandCompteResponse[]>>('rp/grands-comptes').pipe(map(r => r.donnees ?? []));
  }

  creerGrandCompte(payload: GrandCompteRequest): Observable<GrandCompteResponse> {
    return this.api.post<ApiResponse<GrandCompteResponse>>('rp/grands-comptes', payload).pipe(map(r => r.donnees!));
  }

  modifierGrandCompte(id: number, payload: GrandCompteRequest): Observable<GrandCompteResponse> {
    return this.api.put<ApiResponse<GrandCompteResponse>>(`rp/grands-comptes/${id}`, payload).pipe(map(r => r.donnees!));
  }

  archiverGrandCompte(id: number): Observable<void> {
    return this.api.delete<ApiResponse<GrandCompteResponse>>(`rp/grands-comptes/${id}`).pipe(map(() => undefined));
  }

  getOccupation(): Observable<OccupationMarcheResponse[]> {
    return this.api.get<ApiResponse<OccupationMarcheResponse[]>>('rp/occupation').pipe(map(r => r.donnees ?? []));
  }
}
