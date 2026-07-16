import { Routes } from '@angular/router';
import { ProductionLayoutComponent } from '../../../layout/production-layout/production-layout.component';

export const PRODUCTION_ROUTES: Routes = [
  {
    path: '',
    component: ProductionLayoutComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./pages/dashboard/production-dashboard.component').then(m => m.ProductionDashboardComponent) },
      { path: 'plan', loadComponent: () => import('./pages/plan/production-plan.component').then(m => m.ProductionPlanComponent) },
      { path: 'saisie', loadComponent: () => import('./pages/saisie/production-saisie.component').then(m => m.ProductionSaisieComponent) },
      { path: 'lots', loadComponent: () => import('./pages/lots/production-lots.component').then(m => m.ProductionLotsComponent) },
      { path: 'employes', loadComponent: () => import('./pages/employes/production-employes.component').then(m => m.ProductionEmployesComponent) },
    ]
  }
];
