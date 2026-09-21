import { inject } from '@angular/core';
import { RedirectFunction, Router, UrlTree } from '@angular/router';
import { AuthService } from './auth.service';
import { ROLE_HOMES, UserRole } from '../models/user.models';

/**
 * Destination d'une URL qui ne correspond à aucune route.
 *
 * Le caractère générique renvoyait tout le monde vers `/auth/login`. Pour un
 * visiteur anonyme c'est juste ; pour un utilisateur connecté c'était trompeur :
 * une adresse mal saisie, un lien périmé ou un signet obsolète le déposaient sur
 * l'écran de connexion, ce qui se lit comme une session perdue alors que la
 * session est intacte. Il ne lui restait qu'à se reconnecter sans raison.
 *
 * On distingue donc les deux cas : connecté, l'utilisateur est ramené à son
 * accueil ; anonyme, il va se connecter. Le `COMMERCIAL` n'a pas d'accueil web —
 * `ROLE_HOMES` pointe volontairement vers la connexion pour lui, `authGuard` le
 * refusant sur le web — et retombe donc au bon endroit sans cas particulier.
 */
export const redirigerRouteInconnue: RedirectFunction = (): UrlTree => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return router.parseUrl('/auth/login');
  }

  return router.parseUrl(ROLE_HOMES[auth.role() as UserRole] ?? '/auth/login');
};
