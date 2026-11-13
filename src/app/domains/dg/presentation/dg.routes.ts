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
      // Même composant, scope réduit (2026-11-03) : le menu "Synthèse Stock & Production"
      // pointait vers /dg/supervision sans distinction, donc affichait toujours la vue
      // complète (financier/incidents/contrôle de gestion compris) au lieu de se limiter
      // à Production + Stock.
      { path: 'supervision/stock-production', loadComponent: () => import('./pages/supervision/dg-supervision.component').then(m => m.DgSupervisionComponent), data: { scope: 'stock-production' } },
      { path: 'seuils', loadComponent: () => import('./pages/seuils/dg-seuils.component').then(m => m.DgSeuilsComponent) },
      { path: 'securite', loadComponent: () => import('./pages/securite/dg-securite.component').then(m => m.DgSecuriteComponent) },
      { path: 'sync', loadComponent: () => import('./pages/sync/dg-sync.component').then(m => m.DgSyncComponent) },
      { path: 'documents', loadComponent: () => import('./pages/documents/dg-documents.component').then(m => m.DgDocumentsComponent) },
      // Journal d'audit, écran DG propre (2026-11-01), GET /dg/audit (filtres matricule/module/
      // typeAction/période déjà supportés côté backend). Remplace l'alias direct vers
      // admin-audit.component retiré le même jour en même temps que les 5 autres écrans
      // d'administration système : contrairement à ceux-là, celui-ci N'EST PAS un doublon admin,
      // le DG a son propre point d'entrée backend (« le DG voit TOUTES les actions tracées »,
      // commentaire du contrôleur), juste jamais eu son propre écran avant aujourd'hui.
      { path: 'audit', loadComponent: () => import('./pages/audit/dg-audit.component').then(m => m.DgAuditComponent) },
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
      // Mon Profil, libre-service, commun à tous les layouts (2026-11-01, demande explicite du
      // porteur). Les 6 écrans d'administration système (utilisateurs, audit, paramètres, codes
      // d'observation, postes production, règles métier) qui vivaient ici sous /dg/* ont été
      // retirés le même jour (même demande) : ce sont des écrans ADMIN (gestion du système),
      // pas des écrans DG, ils restent accessibles sous /admin/* pour qui a ce rôle.
      { path: 'profil', loadComponent: () => import('../../../shared/mon-profil/mon-profil.component').then(m => m.MonProfilComponent) },
      // Administration commerciale. Les promotions déterminent les remises que le
      // serveur accepte sur les ventes terrain, la grille les prix opposables.
      { path: 'promotions', loadComponent: () => import('../../commercialisation/presentation/pages/promotions/promotions.component').then(m => m.PromotionsComponent) },
      { path: 'tarification', loadComponent: () => import('../../commercial/presentation/pages/tarification/tarification.component').then(m => m.TarificationComponent) },
      { path: 'zones', loadComponent: () => import('../../commercial/presentation/pages/zones-admin/zones-admin.component').then(m => m.ZonesAdminComponent) },
      // Commandes clients grands comptes & WhatsApp
      { path: 'commandes-clients', loadComponent: () => import('../../../shared/commande-client/commande-client.component').then(m => m.CommandeClientComponent) },
    ]
  }
];
