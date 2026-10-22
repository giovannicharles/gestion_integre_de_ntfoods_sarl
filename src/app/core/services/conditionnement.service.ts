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

/**
 * Point d'entrée unique pour la saisie de quantité consciente du conditionnement (P4, 2026-10-15).
 * Un seul appel : code produit/SKU → hiérarchie complète de SA variété (GET /api/conditionnement/
 * hierarchie/{code}, backend). Ne décide rien sur la forme de la hiérarchie — certains produits n'ont
 * qu'un seul niveau aujourd'hui, d'autres pourront en avoir plusieurs chaînés (carton→gaine→sachet) une
 * fois cette donnée renseignée côté module conditionnement ; le composant partagé qui consomme ceci
 * s'adapte dans les deux cas plutôt que de supposer une profondeur fixe.
 */
@Injectable({ providedIn: 'root' })
export class ConditionnementService {
  private readonly api = inject(ApiService);

  getHierarchieParCode(code: string): Observable<ConfigurationNiveauBE[]> {
    if (!code) return new Observable(sub => { sub.next([]); sub.complete(); });
    return this.api.get<ApiResponse<ConfigurationNiveauBE[]>>(`conditionnement/hierarchie/${encodeURIComponent(code)}`)
      .pipe(map(r => r.donnees ?? []));
  }
}
