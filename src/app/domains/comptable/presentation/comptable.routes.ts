import { Routes } from '@angular/router';
import { ComptableLayoutComponent } from '../../../layout/comptable-layout/comptable-layout.component';

export const COMPTABLE_ROUTES: Routes = [
  {
    path: '',
    component: ComptableLayoutComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./pages/dashboard/comptable-dashboard.component').then(m => m.ComptableDashboardComponent) },
      { path: 'commandes', loadComponent: () => import('./pages/commandes/comptable-commandes.component').then(m => m.ComptableCommandesComponent) },
      { path: 'factures', loadComponent: () => import('./pages/factures/comptable-factures.component').then(m => m.ComptableFacturesComponent) },
      { path: 'caisse', loadComponent: () => import('./pages/caisse/comptable-caisse.component').then(m => m.ComptableCaisseComponent) },
      { path: 'recouvrement', loadComponent: () => import('./pages/recouvrement/comptable-recouvrement.component').then(m => m.ComptableRecouvrementComponent) },
      { path: 'reporting', loadComponent: () => import('./pages/reporting/comptable-reporting.component').then(m => m.ComptableReportingComponent) },
      { path: 'objectifs', loadComponent: () => import('./pages/objectifs/comptable-objectifs.component').then(m => m.ComptableObjectifsComponent) },
      // Dernière étape du cycle de fin de tournée, après le rapprochement secrétaire.
      { path: 'sessions', loadComponent: () => import('./pages/sessions/comptable-sessions.component').then(m => m.ComptableSessionsComponent) },
      // Le découpage territorial conditionne les objectifs qu'il fixe : il
      // l'administre au même titre que la Chargée RP.
      { path: 'zones', loadComponent: () => import('../../commercial/presentation/pages/zones-admin/zones-admin.component').then(m => m.ZonesAdminComponent) },
    ]
  }
];
