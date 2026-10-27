import { Injectable, computed, inject } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';

/**
 * Rôles du module Production réellement gérés par ce cloisonnement.
 *
 * GESTIONNAIRE_STOCK existe côté backend (et dans `AuthService.role`) mais
 * n'est PAS géré ici — cet espace est pris en charge ailleurs dans l'application.
 * Si un utilisateur avec ce rôle atterrit malgré tout sur une route
 * `/production/*`, `roleActuel()` renverra `null` (rôle non reconnu par ce
 * module) et le menu de repli minimal s'affichera.
 *
 * MACHINISTE reste un simple exécutant (référencé par matricule dans les
 * saisies) — il ne s'authentifie jamais et n'a donc pas d'espace applicatif
 * ici.
 *
 * AGENT_PRODUCTION, lui, s'authentifie bel et bien (cf. BACKEND_ROLE_MAP) et
 * dispose de deux permissions backend de consultation
 * (AGENT_PRODUCTION, PRODUCTION_OF_CONSULTER) : son espace est
 * donc géré ici, en lecture seule (dashboard, OF, registres, fiches).
 */
export type RoleProduction =
  | 'CHEF_PRODUCTION'
  | 'RESPONSABLE_SALLE'
  | 'CHEF_MACHINISTE'
  | 'AGENT_DOSEUR'
  | 'AGENT_PRODUCTION'
  | 'DIRECTEUR_GENERAL'
  | 'ADMIN';

const ROLES_GERES: readonly RoleProduction[] = [
  'CHEF_PRODUCTION', 'RESPONSABLE_SALLE', 'CHEF_MACHINISTE', 'AGENT_DOSEUR',
  'AGENT_PRODUCTION', 'DIRECTEUR_GENERAL', 'ADMIN',
];

/**
 * Adapte `AuthService.role()` (source de vérité de l'application) au
 * cloisonnement propre au module Production. Ne contient aucune logique
 * de lecture de token — tout est délégué au vrai service d'authentification.
 */
@Injectable({ providedIn: 'root' })
export class ProductionRoleService {
  private readonly auth = inject(AuthService);

  readonly roleActuel = computed<RoleProduction | null>(() => {
    const r = this.auth.role();
    if (!r) return null;
    return (ROLES_GERES as readonly string[]).includes(r) ? (r as unknown as RoleProduction) : null;
  });

  hasRole(...roles: RoleProduction[]): boolean {
    const r = this.roleActuel();
    return r !== null && roles.includes(r);
  }

  /** Rôles "superviseurs" ayant vocation à tout consulter dans le module. */
  estSuperviseur(): boolean {
    return this.hasRole('DIRECTEUR_GENERAL', 'ADMIN');
  }
}
