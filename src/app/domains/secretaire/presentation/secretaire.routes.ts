import { Routes } from '@angular/router';
import { SecretaireLayoutComponent } from '../../../layout/secretaire-layout/secretaire-layout.component';

export const SECRETAIRE_ROUTES: Routes = [
  {
    path: '',
    component: SecretaireLayoutComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./pages/dashboard/secretaire-dashboard.component').then(m => m.SecretaireDashboardComponent) },
      { path: 'versements', loadComponent: () => import('./pages/versements/secretaire-versements.component').then(m => m.SecretaireVersementsComponent) },
      { path: 'validation', loadComponent: () => import('./pages/validation/secretaire-validation.component').then(m => m.SecretaireValidationComponent) },
      { path: 'commandes', loadComponent: () => import('./pages/commandes/secretaire-commandes.component').then(m => m.SecretaireCommandesComponent) },
      { path: 'session', loadComponent: () => import('./pages/session/secretaire-session.component').then(m => m.SecretaireSessionComponent) },
    ]
  }
];
