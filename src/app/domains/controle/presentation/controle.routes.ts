import { Routes } from '@angular/router';
import { ControleLayoutComponent } from '../../../layout/controle-layout/controle-layout.component';

export const CONTROLE_ROUTES: Routes = [
  {
    path: '',
    component: ControleLayoutComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./pages/dashboard/controle-dashboard.component').then(m => m.ControleDashboardComponent) },
      // Révisé le 2026-10-16 (confidentialité des modules) : pointait vers DgDecaissementsComponent
      // (espace DG, boutons "Valider/Approuver DG" que le Contrôleur Général n'a pas le droit
      // d'actionner). Écran propre, qui ne montre que Proposer/Annuler — son rôle réel ici.
      { path: 'decaissements', loadComponent: () => import('./pages/decaissements/controle-decaissements.component').then(m => m.ControleDecaissementsComponent) },
      { path: 'credits', loadComponent: () => import('./pages/credits/controle-credits.component').then(m => m.ControleCreditsComponent) },
      { path: 'marges', loadComponent: () => import('./pages/marges/controle-marges.component').then(m => m.ControleMargesComponent) },
      { path: 'valorisation', loadComponent: () => import('./pages/valorisation/controle-valorisation.component').then(m => m.ControleValorisationComponent) },
      { path: 'budget', loadComponent: () => import('./pages/budget/controle-budget.component').then(m => m.ControleBudgetComponent) },
      { path: 'variances', loadComponent: () => import('./pages/variances/controle-variances.component').then(m => m.ControleVariancesComponent) },
      { path: 'audit', loadComponent: () => import('../../admin/presentation/pages/audit/admin-audit.component').then(m => m.AdminAuditComponent) },
      // Commandes clients hors tournée (téléphone, WhatsApp, SMS, email) — écran
      // partagé (voir shared/commande-client).
      { path: 'commandes-clients', loadComponent: () => import('../../../shared/commande-client/commande-client.component').then(m => m.CommandeClientComponent) },
      // Moteur de validation générique, réutilisé sans quitter la coquille Contrôle (même
      // correction que DG, 2026-10-16) : le sidebar pointait vers /validations, route de
      // premier niveau sans aucun layout.
      { path: 'validations', loadComponent: () => import('../../../shared/validation-pending/validation-pending.component').then(m => m.ValidationPendingComponent) },
    ]
  }
];
