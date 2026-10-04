import { Routes } from '@angular/router';
import { ControleLayoutComponent } from '../../../layout/controle-layout/controle-layout.component';

export const CONTROLE_ROUTES: Routes = [
  {
    path: '',
    component: ControleLayoutComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./pages/dashboard/controle-dashboard.component').then(m => m.ControleDashboardComponent) },
      { path: 'decaissements', loadComponent: () => import('../../dg/presentation/pages/decaissements/dg-decaissements.component').then(m => m.DgDecaissementsComponent) },
      { path: 'credits', loadComponent: () => import('./pages/credits/controle-credits.component').then(m => m.ControleCreditsComponent) },
      { path: 'marges', loadComponent: () => import('./pages/marges/controle-marges.component').then(m => m.ControleMargesComponent) },
      { path: 'valorisation', loadComponent: () => import('./pages/valorisation/controle-valorisation.component').then(m => m.ControleValorisationComponent) },
      { path: 'budget', loadComponent: () => import('./pages/budget/controle-budget.component').then(m => m.ControleBudgetComponent) },
      { path: 'variances', loadComponent: () => import('./pages/variances/controle-variances.component').then(m => m.ControleVariancesComponent) },
      { path: 'audit', loadComponent: () => import('../../admin/presentation/pages/audit/admin-audit.component').then(m => m.AdminAuditComponent) },
    ]
  }
];
