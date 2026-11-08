import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../http/api.service';
import { ApiResponse } from '../models/api-response.model';

/** Forme réelle de ConfigurationConditionnementResponse (backend, module conditionnement). */
export interface ConfigurationNiveauBE {
  id: number;
  varieteId: number;
  varieteNom: string;
  typeEmballageId: number;
  typeEmballageNom: string;
  codeConfiguration: string;
  niveau: number;
  quantiteUnites: number;
  poidsNetG: number | null;
  poidsBrutG: number | null;
  poidsTotalKg: number | null;
  contientNiveauInferieurId: number | null;
  contientNombreUnitesInferieur: number | null;
  referenceProduit: string | null;
  actif: boolean;
  estDefault: boolean;
}

export interface MarqueBE {
  id: number; code: string; nom: string; description: string | null; logoUrl: string | null; actif: boolean;
}
export interface MarqueRequestBE { code: string; nom: string; description?: string; logoUrl?: string; }

export interface GammeBE {
  id: number; code: string; nom: string; description: string | null; actif: boolean;
}
export interface GammeRequestBE { code: string; nom: string; description?: string; }

export interface VarieteBE {
  id: number; gammeId: number; gammeNom: string; marqueId: number | null; marqueNom: string | null;
  code: string; nom: string; description: string | null;
  poidsUnitaireG: number | null; unitePoids: string | null; actif: boolean;
}
export interface VarieteRequestBE {
  gammeId: number; marqueId?: number | null; code: string; nom: string; description?: string;
  poidsUnitaireG?: number | null; unitePoids?: string;
}

export interface TypeEmballageBE {
  id: number; code: string; nom: string; description: string | null; niveauHierarchie: number;
  poidsVideG: number | null; dimensionsLongueurMm: number | null; dimensionsLargeurMm: number | null;
  dimensionsHauteurMm: number | null; capaciteMaxKg: number | null; materiau: string | null;
  couleur: string | null; actif: boolean;
}
export interface TypeEmballageRequestBE {
  code: string; nom: string; description?: string; niveauHierarchie: number;
  poidsVideG?: number | null; dimensionsLongueurMm?: number | null; dimensionsLargeurMm?: number | null;
  dimensionsHauteurMm?: number | null; capaciteMaxKg?: number | null; materiau?: string; couleur?: string;
}

export interface ConfigurationRequestBE {
  varieteId: number; typeEmballageId: number; codeConfiguration?: string; niveau: number;
  quantiteUnites: number; poidsNetG?: number | null; contientNiveauInferieurId?: number | null;
  contientNombreUnitesInferieur?: number | null; referenceProduit?: string; codeBarres?: string;
  dureeConservationJours?: number | null; temperatureMinC?: number | null; temperatureMaxC?: number | null;
  instructionsStockage?: string; estDefault?: boolean;
}

/**
 * Point d'entrée unique pour la saisie de quantité consciente du conditionnement (P4, 2026-10-15).
 * Un seul appel : code produit/SKU → hiérarchie complète de SA variété (GET /api/conditionnement/
 * hierarchie/{code}, backend). Ne décide rien sur la forme de la hiérarchie, certains produits n'ont
 * qu'un seul niveau aujourd'hui, d'autres pourront en avoir plusieurs chaînés (carton→gaine→sachet) une
 * fois cette donnée renseignée côté module conditionnement ; le composant partagé qui consomme ceci
 * s'adapte dans les deux cas plutôt que de supposer une profondeur fixe.
 *
 * 2026-11-08 : étendu avec le CRUD complet du référentiel (marques/gammes/variétés/types
 * d'emballage/configurations) pour `ConditionnementComponent`, qui jusqu'ici appelait directement
 * `ApiService` sur des chemins inexistants (`/api/v1/conditionnement/...`, backend réel sans "v1")
 * et sans jamais désencapsuler `ApiResponse.donnees` - l'écran entier était non fonctionnel.
 */
@Injectable({ providedIn: 'root' })
export class ConditionnementService {
  private readonly api = inject(ApiService);

  getHierarchieParCode(code: string): Observable<ConfigurationNiveauBE[]> {
    if (!code) return new Observable(sub => { sub.next([]); sub.complete(); });
    return this.api.get<ApiResponse<ConfigurationNiveauBE[]>>(`conditionnement/hierarchie/${encodeURIComponent(code)}`)
      .pipe(map(r => r.donnees ?? []));
  }

  // ── Marques ──
  getMarques(): Observable<MarqueBE[]> {
    return this.api.get<ApiResponse<MarqueBE[]>>('conditionnement/marques').pipe(map(r => r.donnees ?? []));
  }
  creerMarque(req: MarqueRequestBE): Observable<MarqueBE> {
    return this.api.post<ApiResponse<MarqueBE>>('conditionnement/marques', req).pipe(map(r => r.donnees!));
  }
  modifierMarque(id: number, req: MarqueRequestBE): Observable<MarqueBE> {
    return this.api.put<ApiResponse<MarqueBE>>(`conditionnement/marques/${id}`, req).pipe(map(r => r.donnees!));
  }
  desactiverMarque(id: number): Observable<MarqueBE> {
    return this.api.delete<ApiResponse<MarqueBE>>(`conditionnement/marques/${id}`).pipe(map(r => r.donnees!));
  }

  // ── Gammes ──
  getGammes(): Observable<GammeBE[]> {
    return this.api.get<ApiResponse<GammeBE[]>>('conditionnement/gammes').pipe(map(r => r.donnees ?? []));
  }
  creerGamme(req: GammeRequestBE): Observable<GammeBE> {
    return this.api.post<ApiResponse<GammeBE>>('conditionnement/gammes', req).pipe(map(r => r.donnees!));
  }
  modifierGamme(id: number, req: GammeRequestBE): Observable<GammeBE> {
    return this.api.put<ApiResponse<GammeBE>>(`conditionnement/gammes/${id}`, req).pipe(map(r => r.donnees!));
  }
  desactiverGamme(id: number): Observable<GammeBE> {
    return this.api.delete<ApiResponse<GammeBE>>(`conditionnement/gammes/${id}`).pipe(map(r => r.donnees!));
  }

  // ── Variétés ──
  getVarietes(gammeId?: number, marqueId?: number): Observable<VarieteBE[]> {
    const params: Record<string, string> = {};
    if (gammeId != null) params['gammeId'] = String(gammeId);
    if (marqueId != null) params['marqueId'] = String(marqueId);
    return this.api.get<ApiResponse<VarieteBE[]>>('conditionnement/varietes', params).pipe(map(r => r.donnees ?? []));
  }
  creerVariete(req: VarieteRequestBE): Observable<VarieteBE> {
    return this.api.post<ApiResponse<VarieteBE>>('conditionnement/varietes', req).pipe(map(r => r.donnees!));
  }
  modifierVariete(id: number, req: VarieteRequestBE): Observable<VarieteBE> {
    return this.api.put<ApiResponse<VarieteBE>>(`conditionnement/varietes/${id}`, req).pipe(map(r => r.donnees!));
  }
  desactiverVariete(id: number): Observable<VarieteBE> {
    return this.api.delete<ApiResponse<VarieteBE>>(`conditionnement/varietes/${id}`).pipe(map(r => r.donnees!));
  }

  // ── Types d'emballage ──
  getTypesEmballage(): Observable<TypeEmballageBE[]> {
    return this.api.get<ApiResponse<TypeEmballageBE[]>>('conditionnement/types-emballage').pipe(map(r => r.donnees ?? []));
  }
  creerTypeEmballage(req: TypeEmballageRequestBE): Observable<TypeEmballageBE> {
    return this.api.post<ApiResponse<TypeEmballageBE>>('conditionnement/types-emballage', req).pipe(map(r => r.donnees!));
  }
  modifierTypeEmballage(id: number, req: TypeEmballageRequestBE): Observable<TypeEmballageBE> {
    return this.api.put<ApiResponse<TypeEmballageBE>>(`conditionnement/types-emballage/${id}`, req).pipe(map(r => r.donnees!));
  }
  desactiverTypeEmballage(id: number): Observable<TypeEmballageBE> {
    return this.api.delete<ApiResponse<TypeEmballageBE>>(`conditionnement/types-emballage/${id}`).pipe(map(r => r.donnees!));
  }

  // ── Configurations (pas de liste globale côté backend : toujours par variété) ──
  getConfigurationsVariete(varieteId: number): Observable<ConfigurationNiveauBE[]> {
    return this.api.get<ApiResponse<ConfigurationNiveauBE[]>>(`conditionnement/varietes/${varieteId}/configurations`)
      .pipe(map(r => r.donnees ?? []));
  }
  creerConfiguration(req: ConfigurationRequestBE): Observable<ConfigurationNiveauBE> {
    return this.api.post<ApiResponse<ConfigurationNiveauBE>>('conditionnement/configurations', req).pipe(map(r => r.donnees!));
  }
  modifierConfiguration(id: number, req: ConfigurationRequestBE): Observable<ConfigurationNiveauBE> {
    return this.api.put<ApiResponse<ConfigurationNiveauBE>>(`conditionnement/configurations/${id}`, req).pipe(map(r => r.donnees!));
  }
}
