import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../http/api.service';
import { ApiResponse } from '../models/api-response.model';

/** Forme réelle de PerteOperation (backend, record). */
export interface PerteOperationBE {
  operation: string;
  mode: 'POURCENTAGE' | 'ABSOLU';
  valeur: number;
}

/** Forme réelle de LigneFormulation (backend, getters Jackson). */
export interface LigneFormulationBE {
  id: number | null;
  codeMP: string;
  nomMP: string;
  quantiteUnite: number;
  unite: string;
  pertePct: number;
  raisonPerte: string | null;
  pertes: PerteOperationBE[];
  quantiteAvecPerte: number;
}

export type FormulationStatutBE = 'BROUILLON' | 'VALIDEE' | 'OBSOLETE';

/** Forme réelle de Formulation (backend, getters Jackson). */
export interface FormulationBE {
  id: number;
  codeFormulation: string;
  codeProduit: string;
  sku: string | null;
  designation: string | null;
  codeConditionnement: string | null;
  niveauConditionnement: string | null;
  quantiteUnite: number;
  unite: string;
  statut: FormulationStatutBE;
  dateDebutValidite: string;
  dateFinValidite: string | null;
  version: string;
  creePar: string;
  validePar: string | null;
  dateValidation: string | null;
  dateCreation: string;
  dateModification: string | null;
  versionOptimistic: number;
  lignes: LigneFormulationBE[];
}

export interface BesoinProductionBE {
  codeMP: string;
  nomMP: string;
  unite: string;
  quantiteTotale: number;
  pertePct: number;
  quantiteTheorique: number;
}

export interface CapaciteMpBE {
  codeMP: string;
  nomMP: string;
  unite: string;
  quantiteDisponible: number;
  quantiteRequiseParUnite: number;
  capaciteUnites: number;
}

export interface FacteurLimitantBE {
  codeMP: string;
  nomMP: string;
  quantiteDisponible: number;
  quantiteRequiseParUnite: number;
  capaciteUnites: number;
}

export interface CapaciteProductionBE {
  codeProduit: string;
  sku: string | null;
  designation: string | null;
  niveauConditionnement: string | null;
  capaciteUnites: number;
  capacitesMP: CapaciteMpBE[];
  facteurLimitant: FacteurLimitantBE | null;
}

export interface CapaciteFormulationBE {
  codeFormulation: string;
  codeProduit: string;
  designation: string | null;
  capacite: CapaciteProductionBE;
}

export interface DemandeFormulationResponse {
  demandeId: number;
  actionType: string;
  statut: string;
  seuilRequis: number | null;
}

export interface CreerFormulationPayload {
  codeFormulation: string;
  codeProduit: string;
  sku?: string;
  designation?: string;
  codeConditionnement?: string;
  niveauConditionnement?: string;
  quantiteUnite: number;
  unite: string;
  version: string;
  lignes: Array<{
    codeMP: string;
    nomMP: string;
    quantiteUnite: number;
    unite: string;
    pertePct: number;
    raisonPerte?: string;
    pertes?: PerteOperationBE[];
  }>;
}

/**
 * Service, formulations (nomenclature de production : matières premières nécessaires par produit fini,
 * quantités en kg, pertes par opération). Backend : modules/stock/presentation/controller/FormulationController,
 * voir plan validé le 2026-11-10.
 */
@Injectable({ providedIn: 'root' })
export class FormulationService {
  private readonly api = inject(ApiService);

  lister(params: { statut?: FormulationStatutBE; codeProduit?: string } = {}): Observable<FormulationBE[]> {
    const p: Record<string, string> = {};
    if (params.statut) p['statut'] = params.statut;
    if (params.codeProduit) p['codeProduit'] = params.codeProduit;
    return this.api.get<FormulationBE[]>('v1/formulations', p);
  }

  consulter(codeFormulation: string): Observable<FormulationBE> {
    return this.api.get<FormulationBE>(`v1/formulations/${codeFormulation}`);
  }

  creer(payload: CreerFormulationPayload): Observable<FormulationBE> {
    return this.api.post<FormulationBE>('v1/formulations', payload);
  }

  ajouterLigne(codeFormulation: string, ligne: {
    codeMP: string; nomMP: string; quantiteUnite: number; unite: string;
    pertePct: number; raisonPerte?: string; pertes?: PerteOperationBE[];
  }): Observable<FormulationBE> {
    return this.api.post<FormulationBE>(`v1/formulations/${codeFormulation}/lignes`, ligne);
  }

  modifierLigne(codeFormulation: string, codeMP: string, payload: {
    quantiteUnite: number; pertePct: number; raisonPerte?: string; pertes?: PerteOperationBE[];
  }): Observable<FormulationBE> {
    return this.api.patch<FormulationBE>(`v1/formulations/${codeFormulation}/lignes/${codeMP}`, payload);
  }

  supprimerLigne(codeFormulation: string, codeMP: string): Observable<FormulationBE> {
    return this.api.delete<FormulationBE>(`v1/formulations/${codeFormulation}/lignes/${codeMP}`);
  }

  nouvelleVersion(codeFormulation: string, nouveauCodeFormulation: string, version: string): Observable<FormulationBE> {
    return this.api.post<FormulationBE>(`v1/formulations/${codeFormulation}/nouvelle-version`, {
      codeFormulation: nouveauCodeFormulation, version,
    });
  }

  valider(codeFormulation: string): Observable<DemandeFormulationResponse> {
    return this.api.post<ApiResponse<DemandeFormulationResponse>>(`v1/formulations/${codeFormulation}/valider`, {})
      .pipe(map(r => r.donnees!));
  }

  calculerBesoin(codeFormulation: string, nombreUnites: number, niveauConditionnement?: string): Observable<BesoinProductionBE[]> {
    return this.api.post<BesoinProductionBE[]>(`v1/formulations/${codeFormulation}/calculer-besoin`, {
      nombreUnites, niveauConditionnement,
    });
  }

  predireProduction(codeFormulation: string, niveauConditionnement?: string): Observable<CapaciteProductionBE> {
    return this.api.post<CapaciteProductionBE>(`v1/formulations/${codeFormulation}/predire-production`, {
      niveauConditionnement,
    });
  }

  capacites(niveau?: string): Observable<CapaciteFormulationBE[]> {
    const p: Record<string, string> = {};
    if (niveau) p['niveau'] = niveau;
    return this.api.get<CapaciteFormulationBE[]>('v1/formulations/capacites', p);
  }
}
