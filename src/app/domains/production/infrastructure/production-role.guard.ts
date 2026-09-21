import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ProductionRoleService } from './production-role.service';
import { PRODUCTION_ROLE_CONFIG } from './production-role-config';

/**
 * Redirige `/production` vers le tableau de bord propre au rôle de l'utilisateur connecté.
 * Si le rôle n'est pas résolu (cas de repli), laisse passer vers le dashboard générique.
 */
export const productionHomeRedirectGuard: CanActivateFn = () => {
  const roleSvc = inject(ProductionRoleService);
  const router = inject(Router);
  const role = roleSvc.roleActuel();
  const accueil = role ? PRODUCTION_ROLE_CONFIG[role].accueil : '/production/dashboard';
  return router.parseUrl(accueil);
};

/**
 * Protection douce : empêche un rôle opérationnel (Chef Machiniste, Agent Doseur, etc.)
 * d'accéder à une page qui n'est pas dans SA liste d'actions autorisées, et le renvoie
 * vers son propre tableau de bord plutôt que d'afficher une interface qui ne le concerne pas.
 *
 * Ne bloque jamais si le rôle est inconnu (repli JWT non résolu) : le backend reste
 * de toute façon la source de vérité pour l'autorisation réelle (403 si non habilité).
 */
export const productionRoleGuard: CanActivateFn = (route) => {
  const roleSvc = inject(ProductionRoleService);
  const router = inject(Router);
  const role = roleSvc.roleActuel();

  if (!role || roleSvc.estSuperviseur()) return true;

  const config = PRODUCTION_ROLE_CONFIG[role];
  const chemin = '/production/' + route.routeConfig?.path;
  const autorise = config.navItems.some(item => item.route === chemin);

  return autorise ? true : router.parseUrl(config.accueil);
};
