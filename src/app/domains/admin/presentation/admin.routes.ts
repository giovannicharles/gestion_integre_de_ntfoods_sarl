import { Routes } from '@angular/router';

export const ADMIN_ROUTES: Routes = [
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
    path: 'parametres',
    loadComponent: () => import('./pages/parametres/admin-parametres.component').then(m => m.AdminParametresComponent)
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
    path: 'postes-production',
    loadComponent: () => import('./pages/postes-production/postes-production.component').then(m => m.PostesProductionComponent)
  },
  {
    // 2026-09-30 : jamais routé jusqu'ici (aucune entrée de menu ne pointait vers ce composant) et appelait un
    // chemin API inexistant (/api/v1/incidents) — corrigé, voir incidents.component.ts.
    path: 'incidents',
    loadComponent: () => import('./pages/incidents/incidents.component').then(m => m.IncidentsComponent)
  }
];
