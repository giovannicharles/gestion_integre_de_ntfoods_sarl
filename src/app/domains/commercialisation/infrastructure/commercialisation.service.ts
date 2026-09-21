import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../../../core/http/api.service';
import { ApiResponse } from '../../../core/models/api-response.model';

/**
 * Promotions commerciales.
 *
 * Les promotions ne sont pas un simple habillage commercial : c'est le serveur
 * qui en déduit la remise acceptée sur une vente terrain. Tant qu'aucune
 * promotion active ne couvre le couple produit × segment client, toute remise
 * saisie par un commercial est refusée.
 */

export type TypePromotion = 'POURCENTAGE' | 'MONTANT_FIXE' | 'GRATUITE' | 'REMISE_VOLUME';
export type StatutPromotion = 'BROUILLON' | 'ACTIVEE' | 'SUSPENDUE' | 'EXPIREE' | 'ANNULEE';
export type SegmentClient =
  | 'DISTRIBUTEUR' | 'DETAIL' | 'GROSSISTE' | 'SEMI_GROSSISTE' | 'REVENDEUR';

export interface PromotionBE {
  id: number;
  code: string;
  libelle: string;
  description: string | null;
  type: TypePromotion;
  valeurReduction: number;
  codeProduit: string | null;
  segmentCible: SegmentClient | null;
  dateDebut: string;
  dateFin: string | null;
  statut: StatutPromotion;
  nombreUtilisations: number;
  limiteUtilisations: number;
  matriculeCreateur: string;
  dateCreation: string;
}

export interface CreerPromotionBody {
  code: string;
  libelle: string;
  description?: string;
  type: TypePromotion;
  valeurReduction: number;
  codeProduit?: string;
  segmentCible?: SegmentClient;
  dateDebut: string;
  dateFin?: string;
  limiteUtilisations: number;
}

@Injectable({ providedIn: 'root' })
export class CommercialisationService {
  private readonly api = inject(ApiService);

  // ── Promotions ────────────────────────────────────────────────

  getPromotions(filtres?: { statut?: StatutPromotion; activesSeulement?: boolean }): Observable<PromotionBE[]> {
    const params: Record<string, string> = {};
    if (filtres?.statut) params['statut'] = filtres.statut;
    if (filtres?.activesSeulement) params['activesSeulement'] = 'true';
    return this.api.get<ApiResponse<PromotionBE[]>>('commercialisation/promotions', params)
      .pipe(map(r => r.donnees ?? []));
  }

  creerPromotion(body: CreerPromotionBody): Observable<PromotionBE> {
    return this.api.post<ApiResponse<PromotionBE>>('commercialisation/promotions', body)
      .pipe(map(r => r.donnees!));
  }

  activerPromotion(code: string): Observable<PromotionBE> {
    return this.api.put<ApiResponse<PromotionBE>>(
      `commercialisation/promotions/${encodeURIComponent(code)}/activer`, {}
    ).pipe(map(r => r.donnees!));
  }

  suspendrePromotion(code: string): Observable<PromotionBE> {
    return this.api.put<ApiResponse<PromotionBE>>(
      `commercialisation/promotions/${encodeURIComponent(code)}/suspendre`, {}
    ).pipe(map(r => r.donnees!));
  }

  annulerPromotion(code: string): Observable<PromotionBE> {
    return this.api.put<ApiResponse<PromotionBE>>(
      `commercialisation/promotions/${encodeURIComponent(code)}/annuler`, {}
    ).pipe(map(r => r.donnees!));
  }
}
