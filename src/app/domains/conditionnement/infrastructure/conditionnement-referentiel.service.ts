import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../../../core/http/api.service';
import { ApiResponse } from '../../../core/models/api-response.model';

/** Miroir de TypeEmballageResponse (GET /conditionnement/types-emballage). */
export interface TypeEmballageBE {
  id: number;
  code: string;
  nom: string;
  description: string | null;
  /** 1 = unité de base … 10 = niveau le plus englobant (palette). */
  niveauHierarchie: number;
  poidsVideG: number | null;
  dimensionsLongueurMm: number | null;
  dimensionsLargeurMm: number | null;
  dimensionsHauteurMm: number | null;
  capaciteMaxKg: number | null;
  materiau: string | null;
  couleur: string | null;
  actif: boolean;
}

/** Corps de TypeEmballageRequest (création et modification). */
export interface TypeEmballageRequestBE {
  code: string;
  nom: string;
  description: string | null;
  niveauHierarchie: number;
  poidsVideG: number | null;
  dimensionsLongueurMm: number | null;
  dimensionsLargeurMm: number | null;
  dimensionsHauteurMm: number | null;
  capaciteMaxKg: number | null;
  materiau: string | null;
  couleur: string | null;
}

/** Miroir de VarieteResponse (GET /conditionnement/varietes). */
export interface VarieteBE {
  id: number; gammeId: number; gammeNom: string; marqueId: number; marqueNom: string;
  code: string; nom: string; description: string | null;
  poidsUnitaireG: number | null; unitePoids: string | null; actif: boolean;
}

/** Miroir de ConfigurationConditionnementResponse (GET /conditionnement/varietes/{id}/configurations). */
export interface ConfigurationConditionnementBE {
  id: number; varieteId: number; varieteNom: string; typeEmballageId: number; typeEmballageNom: string;
  codeConfiguration: string; niveau: number; quantiteUnites: number; poidsNetG: number | null; poidsBrutG: number | null;
  poidsTotalKg: number | null; contientNiveauInferieurId: number | null; contientNombreUnitesInferieur: number | null;
  referenceProduit: string | null; codeBarres: string | null; dureeConservationJours: number | null;
  temperatureMinC: number | null; temperatureMaxC: number | null; instructionsStockage: string | null;
  actif: boolean; estDefault: boolean;
}

/**
 * Référentiel du module conditionnement (ConditionnementController, /api/conditionnement).
 * Écritures soumises à STOCK_CONDITIONNEMENT_GERER ; lectures ouvertes à tout utilisateur connecté.
 */
@Injectable({ providedIn: 'root' })
export class ConditionnementReferentielService {
  private readonly api = inject(ApiService);

  // ── Types d'emballage ─────────────────────────────────────────────────────

  /** Types d'emballage ACTIFS (un type désactivé n'est plus renvoyé). */
  listerTypesEmballage(): Observable<TypeEmballageBE[]> {
    return this.api.get<ApiResponse<TypeEmballageBE[]>>('conditionnement/types-emballage')
      .pipe(map(r => r.donnees ?? []));
  }

  creerTypeEmballage(req: TypeEmballageRequestBE): Observable<TypeEmballageBE> {
    return this.api.post<ApiResponse<TypeEmballageBE>>('conditionnement/types-emballage', req)
      .pipe(map(r => r.donnees!));
  }

  modifierTypeEmballage(id: number, req: TypeEmballageRequestBE): Observable<TypeEmballageBE> {
    return this.api.put<ApiResponse<TypeEmballageBE>>(`conditionnement/types-emballage/${id}`, req)
      .pipe(map(r => r.donnees!));
  }

  /** Suppression logique : le type passe inactif et disparaît de la liste (aucune réactivation exposée). */
  desactiverTypeEmballage(id: number): Observable<TypeEmballageBE> {
    return this.api.delete<ApiResponse<TypeEmballageBE>>(`conditionnement/types-emballage/${id}`)
      .pipe(map(r => r.donnees!));
  }

  // ── Calcul de poids d'une configuration ───────────────────────────────────

  listerVarietes(): Observable<VarieteBE[]> {
    return this.api.get<ApiResponse<VarieteBE[]>>('conditionnement/varietes')
      .pipe(map(r => r.donnees ?? []));
  }

  listerConfigurationsVariete(varieteId: number): Observable<ConfigurationConditionnementBE[]> {
    return this.api.get<ApiResponse<ConfigurationConditionnementBE[]>>(`conditionnement/varietes/${varieteId}/configurations`)
      .pipe(map(r => r.donnees ?? []));
  }

  /** Poids total (kg) de `nombreUnites` unités de ce niveau de conditionnement (au moins 1). */
  calculerPoidsTotal(configurationId: number, nombreUnites: number): Observable<number> {
    return this.api.get<ApiResponse<number>>(`conditionnement/configurations/${configurationId}/poids-total`,
      { nombreUnites: String(nombreUnites) })
      .pipe(map(r => Number(r.donnees ?? 0)));
  }
}
