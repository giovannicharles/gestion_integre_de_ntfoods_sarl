import { Routes } from '@angular/router';
import { roleGuard } from '../../../core/auth/role.guard';

/**
 * Routes du moteur de validation (2026-09-30) — cross-module : accessible à quiconque valide quelque chose
 * ("Mes validations") ; "Pouvoirs & délégations" réservé DG/Admin (même restriction que les endpoints backend).
 */
export const VALIDATION_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../../../shared/validation-pending/validation-pending.component').then(
        (m) => m.ValidationPendingComponent
      ),
  },
  {
    path: 'pouvoirs',
    canActivate: [roleGuard],
    data: { roles: ['DIRECTEUR_GENERAL', 'ADMIN'] },
    loadComponent: () =>
      import('./pages/pouvoirs-delegations/pouvoirs-delegations.component').then(
        (m) => m.PouvoirsDelegationsComponent
      ),
  },
];
