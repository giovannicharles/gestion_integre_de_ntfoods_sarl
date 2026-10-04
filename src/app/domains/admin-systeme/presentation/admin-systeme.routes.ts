import { Routes } from '@angular/router';

/**
 * Configuration technique de la plateforme (module `admin` backend) — espace de routage
 * distinct de `domains/admin` (qui sert en réalité le module `administration` : comptes,
 * paramètres métier). Ne jamais fusionner ces deux espaces — décision actée,
 * docs/PROGRESS.md 2026-09-23.
 */
export const ADMIN_SYSTEME_ROUTES: Routes = [
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
];
