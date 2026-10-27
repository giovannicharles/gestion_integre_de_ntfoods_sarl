import { Routes } from '@angular/router';
import { AdminLayoutComponent } from '../../../layout/admin-layout/admin-layout.component';
import { authGuard } from '../../../core/auth/auth.guard';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    component: AdminLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: 'utilisateurs',
        pathMatch: 'full'
      },
      {
        path: 'utilisateurs',
        loadComponent: () => import('./pages/utilisateurs/admin-utilisateurs.component').then(m => m.AdminUtilisateursComponent)
      },
      {
        // Écran déjà écrit, fonctionnel, jamais routé jusqu'ici (2026-10-16) : aucun fichier de
        // routes ne l'importait. Corrigé en même temps que ses deux bugs réels (chemin API
        // doublé /api/api/v1/..., import d'un ApiService inexistant) — voir code-validation.service.ts.
        path: 'codes-validation',
        loadComponent: () => import('./pages/code-validation/admin-code-validation.component').then(m => m.AdminCodeValidationComponent)
      },
      {
        path: 'audit',
        loadComponent: () => import('./pages/audit/admin-audit.component').then(m => m.AdminAuditComponent)
      },
      {
        path: 'codes-observation',
        loadComponent: () => import('./pages/codes-observation/codes-observation.component').then(m => m.CodesObservationComponent)
      },
      {
        // 2026-09-30 : jamais routé jusqu'ici (aucune entrée de menu ne pointait vers ce composant) et appelait un
        // chemin API inexistant (/api/v1/incidents) — corrigé, voir incidents.component.ts.
        path: 'incidents',
        loadComponent: () => import('./pages/incidents/incidents.component').then(m => m.IncidentsComponent)
      },
      {
        // 2026-10-16 : PermissionController (matrice rôle→permission, overrides par
        // utilisateur) existait déjà entièrement côté serveur sans aucun écran.
        path: 'permissions',
        loadComponent: () => import('./pages/permissions/admin-permissions.component').then(m => m.AdminPermissionsComponent)
      }
    ]
  }
];
