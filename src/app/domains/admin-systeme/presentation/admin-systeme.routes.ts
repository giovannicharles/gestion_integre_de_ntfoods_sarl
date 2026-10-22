import { Routes } from '@angular/router';
import { AdminLayoutComponent } from '../../../layout/admin-layout/admin-layout.component';
import { authGuard } from '../../../core/auth/auth.guard';

/**
 * Configuration technique de la plateforme (module `admin` backend) — section interne
 * de l'espace Admin unique, distincte de `domains/admin` (comptes/organisation,
 * module `administration` backend). Les deux partagent désormais la même coquille
 * visuelle (AdminLayoutComponent, deux sections de sidebar) : ce n'est plus "deux
 * espaces" côté frontend, seuls les préfixes d'URL et les modules backend restent
 * distincts (demande explicite du porteur, 2026-10-15 — annule la décision du
 * 2026-09-23 qui gardait ces deux arbres de routes totalement séparés).
 */
export const ADMIN_SYSTEME_ROUTES: Routes = [
  {
    path: '',
    component: AdminLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: 'parametres',
        pathMatch: 'full'
      },
      {
        path: 'parametres',
        loadComponent: () => import('./pages/parametres/admin-systeme-parametres.component').then(m => m.AdminSystemeParametresComponent)
      },
      {
        path: 'suivi',
        loadComponent: () => import('./pages/suivi/admin-systeme-suivi.component').then(m => m.AdminSystemeSuiviComponent)
      },
      {
        path: 'corbeille',
        loadComponent: () => import('./pages/corbeille/admin-systeme-corbeille.component').then(m => m.AdminSystemeCorbeilleComponent)
      },
      {
        path: 'sauvegardes',
        loadComponent: () => import('./pages/sauvegardes/admin-systeme-sauvegardes.component').then(m => m.AdminSystemeSauvegardesComponent)
      }
    ]
  }
];
