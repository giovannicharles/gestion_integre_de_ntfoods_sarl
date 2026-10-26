import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../../../core/http/api.service';
import { ApiResponse } from '../../../core/models/api-response.model';

/** Miroir de UtilisateurResponse (GET /administration/utilisateurs[/{matricule}]). */
export interface UtilisateurBE {
  id: number; matricule: string; nomComplet: string; email: string;
  role: string; roleLibelle: string; actif: boolean; dateCreation: string;
  prenom?: string; nom?: string;
  /** Bloqué automatiquement après trop d'échecs de connexion. */
  compteBloque?: boolean; tentativesEchouees?: number; sessionActive?: boolean;
  telephone?: string | null; residence?: string | null; cni?: string | null; photo?: string | null;
  dateNaissance?: string | null; lieuNaissance?: string | null; dateEmbauche?: string | null; sexe?: string | null;
}

export interface ParametresBE {
  tvaTaux: number; primeMontant: number; alerteStockSeuil: number;
  seuilClientStrategique: number;
  zones: string[]; gammeProduits: string[]; villes: string[];
}

export interface PermissionDto { code: string; libelle: string; }

/** Valeurs réelles de UtilisateurPermissionJpaEntity.TypeOverride (backend) — pas GRANT/REVOKE. */
export type TypeOverride = 'ACCORDER' | 'REFUSER';

export interface OverridePermissionBE {
  permission: string; libellePermission: string; typeOverride: TypeOverride;
  motif: string; matriculeAuteur: string; dateCreation: string;
}

export interface PermissionsEffectivesBE {
  matricule: string; role: string;
  permissionsBaseRole: string[]; permissionsEffectives: string[];
  overrides: OverridePermissionBE[];
}

export interface CodeObservationBE {
  id: number;
  code: string;
  libelle: string;
  requireQuantity: boolean;
  actif: boolean;
  ordre: number;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly api = inject(ApiService);

  getUtilisateurs(role?: string): Observable<UtilisateurBE[]> {
    const params: Record<string, string> = {};
    if (role && role !== 'TOUS') params['role'] = role;
    return this.api.get<ApiResponse<UtilisateurBE[]>>('administration/utilisateurs', params)
      .pipe(map(r => r.donnees ?? []));
  }

  activer(matricule: string): Observable<UtilisateurBE> {
    return this.api.patch<ApiResponse<UtilisateurBE>>(
      `administration/utilisateurs/${encodeURIComponent(matricule)}/activer`, {}
    ).pipe(map(r => r.donnees!));
  }

  desactiver(matricule: string): Observable<UtilisateurBE> {
    return this.api.patch<ApiResponse<UtilisateurBE>>(
      `administration/utilisateurs/${encodeURIComponent(matricule)}/desactiver`, {}
    ).pipe(map(r => r.donnees!));
  }

  changerRole(matricule: string, role: string): Observable<UtilisateurBE> {
    return this.api.patch<ApiResponse<UtilisateurBE>>(
      `administration/utilisateurs/${encodeURIComponent(matricule)}/role?role=${encodeURIComponent(role)}`, {}
    ).pipe(map(r => r.donnees!));
  }

  /** Fiche complète d'un utilisateur (identité, état du compte, informations personnelles). */
  consulterUtilisateur(matricule: string): Observable<UtilisateurBE> {
    return this.api.get<ApiResponse<UtilisateurBE>>(`administration/utilisateurs/${encodeURIComponent(matricule)}`)
      .pipe(map(r => r.donnees!));
  }

  /**
   * Réinitialise le mot de passe d'un utilisateur. Endpoint AuthController (permission
   * AUTH_USER_RESET_PASSWORD) : le mot de passe voyage dans le corps — l'équivalent sous
   * /administration le passe en paramètre d'URL, donc dans les journaux du serveur.
   * Politique serveur : 8 caractères minimum, au moins une lettre et un chiffre.
   */
  reinitialiserMotDePasse(matricule: string, nouveauMotDePasse: string): Observable<unknown> {
    return this.api.put<ApiResponse<unknown>>(
      `auth/utilisateurs/${encodeURIComponent(matricule)}/mot-de-passe`, { nouveauMotDePasse }
    ).pipe(map(r => r.donnees));
  }

  /**
   * Change le rôle d'un utilisateur — PUT /auth/utilisateurs/{matricule}/role (permission
   * AUTH_USER_CHANGER_ROLE). Le serveur refuse : son propre rôle, l'attribution / le retrait du rôle
   * ADMIN par un non-ADMIN non-DG, la rétrogradation du dernier ADMIN actif ; il trace l'opération
   * (ancien → nouveau rôle). Réponse sans corps : relire le compte pour l'afficher à jour.
   */
  changerRoleUtilisateur(matricule: string, role: string): Observable<unknown> {
    return this.api.put<ApiResponse<unknown>>(
      `auth/utilisateurs/${encodeURIComponent(matricule)}/role`, { role }
    ).pipe(map(r => r.donnees));
  }

  debloquer(matricule: string): Observable<UtilisateurBE> {
    return this.api.patch<ApiResponse<UtilisateurBE>>(
      `administration/utilisateurs/${encodeURIComponent(matricule)}/debloquer`, {}
    ).pipe(map(r => r.donnees!));
  }

  creerUtilisateur(req: {
    prenom: string; nom: string; email: string; motDePasse: string; role: string;
    telephone?: string; residence?: string; cni?: string;
    dateNaissance?: string; lieuNaissance?: string; dateEmbauche?: string; sexe?: string;
  }): Observable<unknown> {
    return this.api.post<ApiResponse<unknown>>('auth/register', req)
      .pipe(map(r => r.donnees));
  }

  // ── Paramètres système ─────────────────────────────────────

  getParametres(): Observable<ParametresBE> {
    return this.api.get<ApiResponse<ParametresBE>>('administration/parametres')
      .pipe(map(r => r.donnees!));
  }

  modifierParametres(tvaTaux: number, primeMontant: number, alerteStockSeuil: number,
                      seuilClientStrategique: number): Observable<ParametresBE> {
    const params: Record<string, string> = {
      tvaTaux: String(tvaTaux),
      primeMontant: String(primeMontant),
      alerteStockSeuil: String(alerteStockSeuil),
      seuilClientStrategique: String(seuilClientStrategique),
    };
    return this.api.put<ApiResponse<ParametresBE>>('administration/parametres', {}, params)
      .pipe(map(r => r.donnees!));
  }

  ajouterReferentiel(categorie: string, valeur: string): Observable<ParametresBE> {
    const params: Record<string, string> = { categorie, valeur };
    return this.api.post<ApiResponse<ParametresBE>>('administration/parametres/referentiel', {}, params)
      .pipe(map(r => r.donnees!));
  }

  supprimerReferentiel(categorie: string, valeur: string): Observable<ParametresBE> {
    const params: Record<string, string> = { categorie, valeur };
    return this.api.delete<ApiResponse<ParametresBE>>('administration/parametres/referentiel', params)
      .pipe(map(r => r.donnees!));
  }

  // ── Codes observation tournée ─────────────────────────────────────────────

  getCodesObservation(): Observable<CodeObservationBE[]> {
    return this.api.get<ApiResponse<CodeObservationBE[]>>('administration/codes-observation')
      .pipe(map(r => r.donnees ?? []));
  }

  creerCodeObservation(code: string, libelle: string, requireQuantity: boolean, ordre: number): Observable<CodeObservationBE> {
    const params: Record<string, string> = {
      code, libelle, requireQuantity: String(requireQuantity), ordre: String(ordre),
    };
    return this.api.post<ApiResponse<CodeObservationBE>>('administration/codes-observation', {}, params)
      .pipe(map(r => r.donnees!));
  }

  modifierCodeObservation(id: number, code: string, libelle: string, requireQuantity: boolean, actif: boolean, ordre: number): Observable<CodeObservationBE> {
    const params: Record<string, string> = {
      code, libelle, requireQuantity: String(requireQuantity), actif: String(actif), ordre: String(ordre),
    };
    return this.api.put<ApiResponse<CodeObservationBE>>(`administration/codes-observation/${id}`, {}, params)
      .pipe(map(r => r.donnees!));
  }

  supprimerCodeObservation(id: number): Observable<unknown> {
    return this.api.delete<ApiResponse<unknown>>(`administration/codes-observation/${id}`)
      .pipe(map(r => r.donnees));
  }

  // ── Permissions RBAC (PermissionController, backend) ──────────────────────
  // Déjà entièrement configurable côté serveur (matrice rôle→permission +
  // overrides par utilisateur en base, avec motif et auteur tracés) — il
  // manquait seulement l'écran. Aucun changement backend ici.

  listerPermissions(): Observable<PermissionDto[]> {
    return this.api.get<ApiResponse<PermissionDto[]>>('auth/permissions')
      .pipe(map(r => r.donnees ?? []));
  }

  consulterMatricePermissions(): Observable<Record<string, string[]>> {
    return this.api.get<ApiResponse<Record<string, string[]>>>('auth/permissions/matrice')
      .pipe(map(r => r.donnees ?? {}));
  }

  permissionsEffectives(matricule: string): Observable<PermissionsEffectivesBE> {
    return this.api.get<ApiResponse<PermissionsEffectivesBE>>(`auth/permissions/${encodeURIComponent(matricule)}`)
      .pipe(map(r => r.donnees!));
  }

  ajouterOverridePermission(matricule: string, permission: string, typeOverride: TypeOverride, motif: string): Observable<OverridePermissionBE> {
    return this.api.post<ApiResponse<OverridePermissionBE>>(
      `auth/permissions/${encodeURIComponent(matricule)}/overrides`, { permission, typeOverride, motif }
    ).pipe(map(r => r.donnees!));
  }

  supprimerOverridePermission(matricule: string, permission: string): Observable<unknown> {
    return this.api.delete<ApiResponse<unknown>>(
      `auth/permissions/${encodeURIComponent(matricule)}/overrides/${encodeURIComponent(permission)}`
    ).pipe(map(r => r.donnees));
  }
}
