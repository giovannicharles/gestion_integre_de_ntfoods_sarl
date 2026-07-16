import { Routes } from '@angular/router';
import { DgLayoutComponent } from '../../../layout/dg-layout/dg-layout.component';

export const DG_ROUTES: Routes = [
  {
    path: '',
    component: DgLayoutComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./pages/dashboard/dg-dashboard.component').then(m => m.DgDashboardComponent) },
      { path: 'classement', loadComponent: () => import('./pages/classement/dg-classement.component').then(m => m.DgClassementComponent) },
      { path: 'arbitrage', loadComponent: () => import('./pages/arbitrage/dg-arbitrage.component').then(m => m.DgArbitrageComponent) },
      { path: 'decaissements', loadComponent: () => import('./pages/decaissements/dg-decaissements.component').then(m => m.DgDecaissementsComponent) },
      { path: 'objectifs', loadComponent: () => import('./pages/objectifs/dg-objectifs.component').then(m => m.DgObjectifsComponent) },
      { path: 'reporting', loadComponent: () => import('./pages/reporting/dg-reporting.component').then(m => m.DgReportingComponent) },
      { path: 'sync', loadComponent: () => import('./pages/sync/dg-sync.component').then(m => m.DgSyncComponent) },
      { path: 'documents', loadComponent: () => import('./pages/documents/dg-documents.component').then(m => m.DgDocumentsComponent) },
      // ── Administration (rôle ADMIN fusionné avec DG) ──
      { path: 'utilisateurs', loadComponent: () => import('../../admin/presentation/pages/utilisateurs/admin-utilisateurs.component').then(m => m.AdminUtilisateursComponent) },
      { path: 'audit', loadComponent: () => import('../../admin/presentation/pages/audit/admin-audit.component').then(m => m.AdminAuditComponent) },
      { path: 'parametres', loadComponent: () => import('../../admin/presentation/pages/parametres/admin-parametres.component').then(m => m.AdminParametresComponent) },
    ]
  }
];
