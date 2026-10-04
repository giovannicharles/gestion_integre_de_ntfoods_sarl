import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/http/api.service';

/** Miroir de ValidationRecordResponse (backend, shared/validation/application/dto). */
export interface ValidationRecordDto {
  id: number;
  validateurId: number;
  validateurMatricule: string | null;
  validateurNomComplet: string | null;
  delegantId: number | null;
  delegantNomComplet: string | null;
  poidsApporte: number;
  commentaire: string | null;
  dateValidation: string;
  etape: string | null;
}

/** Miroir de ValidationRequestResponse (backend). */
export interface ValidationRequestDto {
  id: number;
  actionType: string;
  moduleSource: string;
  entityType: string | null;
  entityId: number | null;
  entityReference: string | null;
  motif: string | null;
  statut: string;
  dateCreation: string;
  dateLimite: string | null;
  dateValidation: string | null;
  seuilRequis: number;
  poidsAccumule: number;
  nombreValidations: number;
  validations: ValidationRecordDto[];
}

/** Miroir de ValideurPotentielResponse (backend). */
export interface ValideurPotentielDto {
  utilisateurId: number;
  matricule: string;
  nomComplet: string;
  role: string;
  poidsEffectif: number;
  viaDelegationDe: number | null;
  dejaValide: boolean;
}

/** Miroir de l'entité PouvoirValidation (backend — colonnes simples, pas de relation lazy). */
export interface PouvoirValidationDto {
  id: number;
  role: string | null;
  utilisateurId: number | null;
  actionType: string | null;
  poids: number;
  actif: boolean;
  attribueParId: number | null;
  dateAttribution: string;
  revoqueParId: number | null;
  dateRevocation: string | null;
  motifRevocation: string | null;
  commentaire: string | null;
}

/** Miroir de l'entité Delegation (backend). */
export interface DelegationDto {
  id: number;
  delegantId: number;
  delegataireId: number;
  actionTypes: string | null;
  dateDebut: string;
  dateFin: string;
  actif: boolean;
  motif: string | null;
  revoqueParId: number | null;
  dateRevocation: string | null;
}

/** Types d'action connus de la politique d'approbation (ValidationEngineSeeder) — pour l'affichage en clair. */
export const LIBELLES_ACTION_TYPE: Record<string, string> = {
  STOCK_AJUSTEMENT_INVENTAIRE: "Ajustement d'inventaire",
  STOCK_REAPPRO_TAMPON: 'Réapprovisionnement du tampon',
  STOCK_TRANSFERT_VERS_TAMPON: 'Transfert vers le tampon',
  STOCK_ENTREE_SORTIE_MANUELLE: 'Entrée/sortie manuelle de stock',
  TRANSFERT_CENTRAL_TAMPON: 'Transfert central → tampon',
  FORMULATION_VALIDATION: 'Validation de formulation',
};

export function libelleActionType(actionType: string): string {
  return LIBELLES_ACTION_TYPE[actionType] ?? actionType;
}

@Injectable({ providedIn: 'root' })
export class ValidationService {
  private readonly api = inject(ApiService);

  // ── Demandes ──────────────────────────────────────────────────────────
  mesDemandesEnAttente(): Observable<ValidationRequestDto[]> {
    return this.api.get<ValidationRequestDto[]>('v1/validation/demandes/en-attente-pour-moi');
  }

  consulterDemande(id: number): Observable<ValidationRequestDto> {
    return this.api.get<ValidationRequestDto>(`v1/validation/demandes/${id}`);
  }

  valider(id: number, code: string, commentaire: string): Observable<ValidationRequestDto> {
    return this.api.post<ValidationRequestDto>(`v1/validation/demandes/${id}/valider`, { code, commentaire });
  }

  rejeter(id: number, motif: string): Observable<ValidationRequestDto> {
    return this.api.post<ValidationRequestDto>(`v1/validation/demandes/${id}/rejeter`, { motif });
  }

  valideursPotentiels(id: number): Observable<ValideurPotentielDto[]> {
    return this.api.get<ValideurPotentielDto[]>(`v1/validation/demandes/${id}/valideurs-potentiels`);
  }

  // ── Pouvoirs (DG/Admin) ───────────────────────────────────────────────
  listerPouvoirs(): Observable<PouvoirValidationDto[]> {
    return this.api.get<PouvoirValidationDto[]>('v1/validation/pouvoirs');
  }

  attribuerPouvoir(body: { role?: string; utilisateurId?: number; actionType?: string; poids: number; commentaire?: string }): Observable<PouvoirValidationDto> {
    return this.api.post<PouvoirValidationDto>('v1/validation/pouvoirs', body);
  }

  revoquerPouvoir(id: number, motif: string): Observable<PouvoirValidationDto> {
    return this.api.post<PouvoirValidationDto>(`v1/validation/pouvoirs/${id}/revoquer`, {}, { motif });
  }

  // ── Délégations ───────────────────────────────────────────────────────
  mesDelegationsRecues(): Observable<DelegationDto[]> {
    return this.api.get<DelegationDto[]>('v1/validation/delegations/recues');
  }

  mesDelegationsDonnees(): Observable<DelegationDto[]> {
    return this.api.get<DelegationDto[]>('v1/validation/delegations/donnees');
  }

  creerDelegation(body: { delegataireId: number; actionTypesCsv: string | null; dateDebut: string; dateFin: string; motif: string }): Observable<DelegationDto> {
    return this.api.post<DelegationDto>('v1/validation/delegations', body);
  }

  revoquerDelegation(id: number, motif: string): Observable<DelegationDto> {
    return this.api.post<DelegationDto>(`v1/validation/delegations/${id}/revoquer`, {}, { motif });
  }
}
