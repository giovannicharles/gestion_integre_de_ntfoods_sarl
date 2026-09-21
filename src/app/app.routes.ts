import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';
import { redirigerRouteInconnue } from './core/auth/route-inconnue.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/auth/login', pathMatch: 'full' },
  {
    path: 'auth',
    loadChildren: () => import('./pages/auth/auth.routes').then(m => m.AUTH_ROUTES)
  },
  {
    path: 'stock',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['GESTIONNAIRE_STOCK', 'ADMIN', 'COMMERCIAL', 'CHEF_PRODUCTION', 'DIRECTEUR_GENERAL'] },
    loadChildren: () => import('./domains/stock/presentation/stock.routes').then(m => m.STOCK_ROUTES)
  },
  {
    path: 'dg',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['DIRECTEUR_GENERAL', 'ADMIN'] },
    loadChildren: () => import('./domains/dg/presentation/dg.routes').then(m => m.DG_ROUTES)
  },
  {
    path: 'rp',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['CHARGEE_RP', 'ADMIN', 'DIRECTEUR_GENERAL', 'DIRECTEUR_COMMERCIAL'] },
    loadChildren: () => import('./domains/rp/presentation/rp.routes').then(m => m.RP_ROUTES)
  },
  {
    path: 'controle',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['CONTROLEUR_GENERAL', 'ADMIN', 'DIRECTEUR_GENERAL'] },
    loadChildren: () => import('./domains/controle/presentation/controle.routes').then(m => m.CONTROLE_ROUTES)
  },
  {
    path: 'comptable',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['COMPTABLE', 'ADMIN', 'DIRECTEUR_GENERAL'] },
    loadChildren: () => import('./domains/comptable/presentation/comptable.routes').then(m => m.COMPTABLE_ROUTES)
  },
  {
    path: 'commercial',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['COMMERCIAL', 'DIRECTEUR_COMMERCIAL', 'ADMIN', 'DIRECTEUR_GENERAL', 'GESTIONNAIRE_STOCK'] },
    loadChildren: () => import('./domains/commercial/presentation/commercial.routes').then(m => m.COMMERCIAL_ROUTES)
  },
  {
    path: 'secretaire',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['SECRETAIRE', 'COMPTABLE', 'ADMIN', 'DIRECTEUR_GENERAL'] },
    loadChildren: () => import('./domains/secretaire/presentation/secretaire.routes').then(m => m.SECRETAIRE_ROUTES)
  },
  {
    path: 'production',
    canActivate: [authGuard, roleGuard],
    data: {
      roles: [
        'CHEF_PRODUCTION',
        'RESPONSABLE_SALLE',
        'AGENT_PRODUCTION',
        'CHEF_MACHINISTE',
        'MACHINISTE',
        'AGENT_DOSEUR',
        'ADMIN',
        'DIRECTEUR_GENERAL'
      ]
    },
    loadChildren: () => import('./domains/production/presentation/production.routes').then(m => m.PRODUCTION_ROUTES)
  },
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN', 'DIRECTEUR_GENERAL'] },
    loadChildren: () => import('./domains/admin/presentation/admin.routes').then(m => m.ADMIN_ROUTES)
  },
  {
    path: 'sync',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN', 'DIRECTEUR_GENERAL', 'GESTIONNAIRE_STOCK', 'COMMERCIAL'] },
    loadChildren: () => import('./domains/sync/presentation/sync.routes').then(m => m.SYNC_ROUTES)
  },
  {
    path: 'ia',
    canActivate: [authGuard, roleGuard],
    data: {
      roles: [
        'GESTIONNAIRE_STOCK',
        'CHEF_PRODUCTION',
        'DIRECTEUR_GENERAL',
        'DIRECTEUR_COMMERCIAL',
        'ADMIN',
        'COMMERCIAL',
        'CONTROLEUR_GENERAL',
        'COMPTABLE'
      ]
    },
    loadChildren: () => import('./domains/ia/presentation/ia.routes').then(m => m.IA_ROUTES)
  },
  {
    path: '**',
    redirectTo: redirigerRouteInconnue
  }
];
