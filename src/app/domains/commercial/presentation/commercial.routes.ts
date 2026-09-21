import { Routes } from '@angular/router';
import { CommercialLayoutComponent } from '../../../layout/commercial-layout/commercial-layout.component';
import { authGuard } from '../../../core/auth/auth.guard';

export const COMMERCIAL_ROUTES: Routes = [
  {
    path: '',
    component: CommercialLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'precommandes', pathMatch: 'full' },
      { path: 'precommandes', loadComponent: () => import('./pages/precommandes/commercial-precommandes.component').then(m => m.CommercialPrecommandesComponent) },
      { path: 'dotations', loadComponent: () => import('./pages/dotations/commercial-dotations.component').then(m => m.CommercialDotationsComponent) },
      { path: 'ventes', loadComponent: () => import('./pages/ventes/commercial-ventes.component').then(m => m.CommercialVentesComponent) },
      { path: 'carburant', loadComponent: () => import('./pages/carburant/commercial-carburant.component').then(m => m.CommercialCarburantComponent) },
      { path: 'prospects', loadComponent: () => import('./pages/prospects/commercial-prospects.component').then(m => m.CommercialProspectsComponent) },
      { path: 'recouvrement', loadComponent: () => import('./pages/recouvrement/commercial-recouvrement.component').then(m => m.CommercialRecouvrementComponent) },
      { path: 'versements', loadComponent: () => import('./pages/versements/commercial-versements.component').then(m => m.CommercialVersementsComponent) },
      { path: 'classement', loadComponent: () => import('./pages/classement/commercial-classement.component').then(m => m.CommercialClassementComponent) },
      { path: 'fiche-synthese', loadComponent: () => import('./pages/fiche-synthese/fiche-synthese.component').then(m => m.FicheSyntheseComponent) },
    ]
  }
];
