import { Routes } from '@angular/router';
import { RpLayoutComponent } from '../../../layout/rp-layout/rp-layout.component';

export const RP_ROUTES: Routes = [
  {
    path: '',
    component: RpLayoutComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./pages/dashboard/rp-dashboard.component').then(m => m.RpDashboardComponent) },
      { path: 'classement', loadComponent: () => import('../../commercial/presentation/pages/classement/commercial-classement.component').then(m => m.CommercialClassementComponent) },
      { path: 'zones', loadComponent: () => import('./pages/zones/rp-zones.component').then(m => m.RpZonesComponent) },
      // Administration du découpage territorial. L'écran ci-dessus constate la
      // sous-exploitation ; celui-ci permet d'en corriger le calibrage.
      { path: 'zones-admin', loadComponent: () => import('../../commercial/presentation/pages/zones-admin/zones-admin.component').then(m => m.ZonesAdminComponent) },
      // Les promotions conditionnent les remises acceptées sur les ventes terrain.
      { path: 'promotions', loadComponent: () => import('../../commercialisation/presentation/pages/promotions/promotions.component').then(m => m.PromotionsComponent) },
      { path: 'objectifs', loadComponent: () => import('../../dg/presentation/pages/objectifs/dg-objectifs.component').then(m => m.DgObjectifsComponent) },
      { path: 'tarification', loadComponent: () => import('../../commercial/presentation/pages/tarification/tarification.component').then(m => m.TarificationComponent) },
      { path: 'grands-comptes', loadComponent: () => import('./pages/grands-comptes/rp-grands-comptes.component').then(m => m.RpGrandsComptesComponent) },
    ]
  }
];
