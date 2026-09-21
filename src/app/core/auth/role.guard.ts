import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { UserRole } from '../models/user.models';

/**
 * Restreint une route à certains rôles.
 * Usage : `{ path: '...', canActivate: [authGuard, roleGuard], data: { roles: ['ADMIN'] } }`
 */
export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const allowed = (route.data?.['roles'] as UserRole[] | undefined) ?? [];
  const currentRole = auth.role();

  if (allowed.length === 0 || auth.hasAnyRole(allowed)) {
    return true;
  }

  console.warn(
    `[roleGuard] Accès refusé sur '${route.routeConfig?.path ?? route.url.join('/')}'. ` +
    `Rôle courant : ${currentRole ?? '<non connecté>'}. ` +
    `Rôles attendus : [${allowed.join(', ')}]`
  );
  router.navigate(['/auth/forbidden']);
  return false;
};
