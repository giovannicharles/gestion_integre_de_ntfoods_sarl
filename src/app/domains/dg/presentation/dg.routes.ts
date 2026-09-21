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
      { path: 'chat', loadComponent: () => import('./pages/chat/dg-chat.component').then(m => m.DgChatComponent) },
      { path: 'ia-analyse', loadComponent: () => import('./pages/ia-analyse/dg-ia-analyse.component').then(m => m.DgIaAnalyseComponent) },
      // ── Administration (rôle ADMIN fusionné avec DG) ──
      { path: 'utilisateurs', loadComponent: () => import('../../admin/presentation/pages/utilisateurs/admin-utilisateurs.component').then(m => m.AdminUtilisateursComponent) },
      { path: 'audit', loadComponent: () => import('../../admin/presentation/pages/audit/admin-audit.component').then(m => m.AdminAuditComponent) },
      { path: 'parametres', loadComponent: () => import('../../admin/presentation/pages/parametres/admin-parametres.component').then(m => m.AdminParametresComponent) },
      // ── Pages Stock accessibles au DG dans son propre layout ──
      { path: 'stock-dashboard', loadComponent: () => import('../../stock/presentation/pages/dashboard/stock-dashboard.component').then(m => m.StockDashboardComponent) },
      { path: 'inventaire', loadComponent: () => import('../../stock/presentation/pages/inventaire/inventaire.component').then(m => m.InventaireComponent) },
      { path: 'production', loadComponent: () => import('../../stock/presentation/pages/production/production.component').then(m => m.ProductionComponent) },
      { path: 'seuils', loadComponent: () => import('../../stock/presentation/pages/seuils/seuil-list.component').then(m => m.SeuilListComponent) },
      { path: 'alertes', loadComponent: () => import('../../stock/presentation/pages/alertes/alertes.component').then(m => m.AlertesComponent) },
      { path: 'produits', loadComponent: () => import('../../stock/presentation/pages/produits/produits.component').then(m => m.ProduitsComponent) },
      { path: 'statistiques', loadComponent: () => import('../../stock/presentation/pages/statistiques/statistiques.component').then(m => m.StatistiquesComponent) },
    ]
  }
];
