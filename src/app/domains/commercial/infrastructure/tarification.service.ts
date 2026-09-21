import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../../../core/http/api.service';
import { ApiResponse } from '../../../core/models/api-response.model';

/**
 * Grille tarifaire homologuée et dérogations.
 *
 * Le prix homologué par couple produit × segment est opposable : une vente
 * saisie à un autre prix est refusée, sauf déblocage exceptionnel référencé.
 */
export type SegmentClient =
  | 'DISTRIBUTEUR' | 'DETAIL' | 'GROSSISTE' | 'SEMI_GROSSISTE' | 'REVENDEUR';

export interface GrilleTarifaireBE {
  id: number;
  codeProduit: string;
  segment: string;
  prixHomologueFCFA: number;
  actif: boolean;
  matriculeAuteur: string;
  dateModification: string;
}

export interface PrixExceptionnelBE {
  id: number;
  reference: string;
  codeProduit: string;
  codeClient: string;
  prixHomologueFCFA: number;
  prixAppliqueFCFA: number;
  ecartFCFA: number;
  motif: string;
  matriculeAutorisateur: string;
  referenceVenteCible: string | null;
  dateAutorisation: string;
}

@Injectable({ providedIn: 'root' })
export class TarificationService {
  private readonly api = inject(ApiService);

  getGrille(filtres?: { codeProduit?: string; segment?: SegmentClient }): Observable<GrilleTarifaireBE[]> {
    const params: Record<string, string> = {};
    if (filtres?.codeProduit) params['codeProduit'] = filtres.codeProduit;
    if (filtres?.segment) params['segment'] = filtres.segment;
    return this.api.get<ApiResponse<GrilleTarifaireBE[]>>('commercial/tarification/grille', params)
      .pipe(map(r => r.donnees ?? []));
  }

  definirPrix(body: { codeProduit: string; segment: SegmentClient; prixHomologueFCFA: number }):
      Observable<GrilleTarifaireBE> {
    return this.api.post<ApiResponse<GrilleTarifaireBE>>('commercial/tarification/grille', body)
      .pipe(map(r => r.donnees!));
  }

  /**
   * Accorde un prix exceptionnel. Ne nécessite plus de code OTP : l'octroi
   * est réservé au DG, au Directeur Commercial, à la Chargée RP & Commercial
   * et au Comptable via leur session authentifiée.
   */
  accorderPrixExceptionnel(body: {
    codeProduit: string; codeClient: string; prixAppliqueFCFA: number;
    motif: string; referenceVenteCible?: string;
  }): Observable<PrixExceptionnelBE> {
    return this.api.post<ApiResponse<PrixExceptionnelBE>>('commercial/tarification/prix-exceptionnel', body)
      .pipe(map(r => r.donnees!));
  }

  /**
   * Dérogations accordées sur une période. Sert la surveillance : un prix
   * exceptionnel est une entorse à la grille, elle doit rester visible.
   */
  getDerogations(debut: string, fin: string): Observable<PrixExceptionnelBE[]> {
    return this.api.get<ApiResponse<PrixExceptionnelBE[]>>(
      'commercial/tarification/prix-exceptionnel/periode', { debut, fin }
    ).pipe(map(r => r.donnees ?? []));
  }
}
