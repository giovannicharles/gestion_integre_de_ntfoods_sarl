import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { ROLE_HOMES, UserRole } from '../../core/models/user.models';

export const roleGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isLoggedIn()) {
    router.navigate(['/auth/login']);
    return false;
  }

  const requiredRoles = route.data?.['roles'] as string[] | undefined;
  if (!requiredRoles || requiredRoles.length === 0) {
    return true;
  }

  if (authService.hasAnyRole(requiredRoles)) {
    return true;
  }

  const user = authService.getCurrentUser();
  const primaryRole = user?.roles?.[0] as UserRole ?? 'GESTIONNAIRE_STOCK';
  const homeRoute = ROLE_HOMES[primaryRole] ?? '/auth/login';
  router.navigate([homeRoute]);
  return false;
};
