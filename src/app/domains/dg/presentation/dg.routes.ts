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
      { path: 'supervision', loadComponent: () => import('./pages/supervision/dg-supervision.component').then(m => m.DgSupervisionComponent) },
      { path: 'seuils', loadComponent: () => import('./pages/seuils/dg-seuils.component').then(m => m.DgSeuilsComponent) },
      // Même écran que /stock/types-emballage : le DG détient STOCK_CONDITIONNEMENT_GERER et reste dans sa propre coquille.
      { path: 'types-emballage', loadComponent: () => import('../../conditionnement/presentation/pages/types-emballage/types-emballage.component').then(m => m.TypesEmballageComponent) },
      { path: 'sync', loadComponent: () => import('./pages/sync/dg-sync.component').then(m => m.DgSyncComponent) },
      { path: 'documents', loadComponent: () => import('./pages/documents/dg-documents.component').then(m => m.DgDocumentsComponent) },
      // Assistance IA. Les miroirs des écrans stock que portait la version
      // actualisée sous /dg ne sont pas repris : le Directeur Général accède
      // déjà à /stock, et les dupliquer n'ajoutait rien qu'un second endroit à
      // maintenir.
      { path: 'chat', loadComponent: () => import('./pages/chat/dg-chat.component').then(m => m.DgChatComponent) },
      { path: 'ia-analyse', loadComponent: () => import('./pages/ia-analyse/dg-ia-analyse.component').then(m => m.DgIaAnalyseComponent) },
      // Moteur de validation générique, réutilisé SANS changer de coquille (demande explicite
      // du porteur, 2026-10-16) : auparavant le lien du sidebar DG pointait vers /validations
      // (route de tout premier niveau, sans aucun layout), ce qui éjectait le DG hors de son
      // propre tableau de bord vers une page nue. Même composant, monté ici sous /dg/*.
      { path: 'validations', loadComponent: () => import('../../../shared/validation-pending/validation-pending.component').then(m => m.ValidationPendingComponent) },
      { path: 'pouvoirs', loadComponent: () => import('../../validation/presentation/pages/pouvoirs-delegations/pouvoirs-delegations.component').then(m => m.PouvoirsDelegationsComponent) },
      // ── Administration (rôle ADMIN fusionné avec DG) ──
      { path: 'utilisateurs', loadComponent: () => import('../../admin/presentation/pages/utilisateurs/admin-utilisateurs.component').then(m => m.AdminUtilisateursComponent) },
      { path: 'audit', loadComponent: () => import('../../admin/presentation/pages/audit/admin-audit.component').then(m => m.AdminAuditComponent) },
      // Incidents : même composant que /admin/incidents, monté ici pour que le DG ne quitte
      // jamais sa propre coquille (sidebar/topbar) en cliquant ce lien.
      { path: 'incidents', loadComponent: () => import('../../admin/presentation/pages/incidents/incidents.component').then(m => m.IncidentsComponent) },
      { path: 'parametres', loadComponent: () => import('../../admin/presentation/pages/parametres/admin-parametres.component').then(m => m.AdminParametresComponent) },
      { path: 'codes-observation', loadComponent: () => import('../../admin/presentation/pages/codes-observation/codes-observation.component').then(m => m.CodesObservationComponent) },
      { path: 'postes-production', loadComponent: () => import('../../admin/presentation/pages/postes-production/postes-production.component').then(m => m.PostesProductionComponent) },
      // Règles métier datées : chaque version est conservée, si bien qu'un calcul
      // passé reste justifiable par la règle en vigueur à sa date.
      { path: 'regles-metier', loadComponent: () => import('../../admin/presentation/pages/parametres/parametrages-metier.component').then(m => m.ParametragesMetierComponent) },
      // Administration commerciale. Les promotions déterminent les remises que le
      // serveur accepte sur les ventes terrain, la grille les prix opposables.
      { path: 'promotions', loadComponent: () => import('../../commercialisation/presentation/pages/promotions/promotions.component').then(m => m.PromotionsComponent) },
      { path: 'tarification', loadComponent: () => import('../../commercial/presentation/pages/tarification/tarification.component').then(m => m.TarificationComponent) },
      { path: 'zones', loadComponent: () => import('../../commercial/presentation/pages/zones-admin/zones-admin.component').then(m => m.ZonesAdminComponent) },
    ]
  }
];
