import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../../../core/http/api.service';
import { ApiResponse } from '../../../core/models/api-response.model';

/**
 * Zones de vente : découpage territorial et potentiel client par zone.
 *
 * Le calibrage du potentiel n'est pas décoratif — c'est le dénominateur du taux
 * d'occupation, qui désigne les zones sous-exploitées.
 */
export interface ZoneDeVenteBE {
  id: number;
  nom: string;
  type: string;
  description: string | null;
  clientsPotentiels: number;
  actif: boolean;
  dateCreation: string;
}

export interface TauxOccupationBE {
  zone: string;
  clientsPotentiels: number;
  clientsLivres: number;
  tauxOccupation: number;
  sousExploitee: boolean;
}

@Injectable({ providedIn: 'root' })
export class ZoneDeVenteService {
  private readonly api = inject(ApiService);

  getZones(actifSeulement = false): Observable<ZoneDeVenteBE[]> {
    const params: Record<string, string> = {};
    if (actifSeulement) params['actifSeulement'] = 'true';
    return this.api.get<ApiResponse<ZoneDeVenteBE[]>>('commercial/zones-vente', params)
      .pipe(map(r => r.donnees ?? []));
  }

  creerZone(body: { nom: string; type: string; description?: string; clientsPotentiels: number }):
      Observable<ZoneDeVenteBE> {
    return this.api.post<ApiResponse<ZoneDeVenteBE>>('commercial/zones-vente', body)
      .pipe(map(r => r.donnees!));
  }

  calibrer(nom: string, clientsPotentiels: number): Observable<ZoneDeVenteBE> {
    return this.api.patch<ApiResponse<ZoneDeVenteBE>>(
      `commercial/zones-vente/${encodeURIComponent(nom)}/calibrer`, {},
      { clientsPotentiels: String(clientsPotentiels) }
    ).pipe(map(r => r.donnees!));
  }

  tauxOccupation(nom: string, clientsLivres3Mois: number): Observable<TauxOccupationBE> {
    return this.api.get<ApiResponse<TauxOccupationBE>>(
      `commercial/zones-vente/${encodeURIComponent(nom)}/taux-occupation`,
      { clientsLivres3Mois: String(clientsLivres3Mois) }
    ).pipe(map(r => r.donnees!));
  }
}
