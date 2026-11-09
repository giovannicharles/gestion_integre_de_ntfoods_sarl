import { Routes } from '@angular/router';
import { AdminLayoutComponent } from '../../../layout/admin-layout/admin-layout.component';
import { authGuard } from '../../../core/auth/auth.guard';

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    component: AdminLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        // 2026-11-01 : ajouté en remplacement du redirect direct vers "utilisateurs", l'espace
        // Admin n'avait jusqu'ici aucune vue d'ensemble (GitHub Org Settings, Okta, Auth0,
        // Vercel Team Settings ouvrent tous sur une synthèse, jamais directement sur le détail).
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard/admin-dashboard.component').then(m => m.AdminDashboardComponent)
      },
      {
        path: 'utilisateurs',
        loadComponent: () => import('./pages/utilisateurs/admin-utilisateurs.component').then(m => m.AdminUtilisateursComponent)
      },
      {
        // Écran déjà écrit, fonctionnel, jamais routé jusqu'ici (2026-10-16) : aucun fichier de
        // routes ne l'importait. Corrigé en même temps que ses deux bugs réels (chemin API
        // doublé /api/api/v1/..., import d'un ApiService inexistant), voir code-validation.service.ts.
        path: 'codes-validation',
        loadComponent: () => import('./pages/code-validation/admin-code-validation.component').then(m => m.AdminCodeValidationComponent)
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
        // 2026-09-30 : jamais routé jusqu'ici (aucune entrée de menu ne pointait vers ce composant) et appelait un
        // chemin API inexistant (/api/v1/incidents), corrigé, voir incidents.component.ts.
        path: 'incidents',
        loadComponent: () => import('./pages/incidents/incidents.component').then(m => m.IncidentsComponent)
      },
      {
        // 2026-10-16 : PermissionController (matrice rôle→permission, overrides par
        // utilisateur) existait déjà entièrement côté serveur sans aucun écran.
        path: 'permissions',
        loadComponent: () => import('./pages/permissions/admin-permissions.component').then(m => m.AdminPermissionsComponent)
      },
      {
        // 2026-11-08 : même motif récurrent que codes-validation/incidents ci-dessus - écran déjà
        // écrit, jamais routé, et appelait un endpoint qui n'a jamais existé côté backend
        // (ValidationWorkflowController ajouté dans la même tranche).
        path: 'validation-workflows',
        loadComponent: () => import('./pages/validation-workflows/admin-validation-workflows.component').then(m => m.AdminValidationWorkflowsComponent)
      },
      {
        // 2026-11-08 : même motif - écran déjà écrit et fonctionnel (AdminService.getParametres/
        // modifierParametres/ajouterReferentiel/supprimerReferentiel, tous réels), jamais routé.
        path: 'parametres',
        loadComponent: () => import('./pages/parametres/admin-parametres.component').then(m => m.AdminParametresComponent)
      },
      {
        // 2026-11-08 : même motif - paramétrage des règles métier datées (barème primes, caisse,
        // objectifs, règles d'avarie), 4 endpoints réels (ParametrageMetierService), jamais routé.
        path: 'parametrages-metier',
        loadComponent: () => import('./pages/parametres/parametrages-metier.component').then(m => m.ParametragesMetierComponent)
      },
      {
        // 2026-11-09 : écran déjà écrit et fonctionnel (ProductionService.getPostesProductionAdmin/
        // creerPosteProduction/modifierPosteProduction/supprimerPosteProduction, endpoints réels),
        // retiré de /dg/* le 2026-11-01 sous l'hypothèse qu'il resterait disponible sous /admin/* -
        // jamais effectivement ajouté ici, donc totalement inaccessible depuis cette date (régression,
        // pas une décision délibérée). Référentiel de configuration (postes de travail), pas une
        // action métier de Production : reste dans sa portée actuelle (admin.layout commentaire
        // corrigé en même temps).
        path: 'postes-production',
        loadComponent: () => import('./pages/postes-production/postes-production.component').then(m => m.PostesProductionComponent)
      },
      // Mon Profil, libre-service, commun à tous les layouts (2026-11-01).
      {
        path: 'profil',
        loadComponent: () => import('../../../shared/mon-profil/mon-profil.component').then(m => m.MonProfilComponent)
      }
    ]
  }
];
