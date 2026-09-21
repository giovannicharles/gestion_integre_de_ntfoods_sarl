import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Bloque l'accès aux routes protégées si l'utilisateur n'est pas connecté. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    router.navigate(['/auth/login']);
    return false;
  }

  // A9/A10: COMMERCIAL is a mobile-only role — show explicit message on web
  const role = auth.role();
  if (role === 'COMMERCIAL') {
    auth.logout();
    router.navigate(['/auth/login'], {
      queryParams: { reason: 'mobile-only' },
    });
    return false;
  }

  return true;
};
