import { Routes } from '@angular/router';
import { StockLayoutComponent } from '../../../layout/stock-layout/stock-layout.component';

export const STOCK_ROUTES: Routes = [
  {
    path: '',
    component: StockLayoutComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./pages/dashboard/stock-dashboard.component').then(m => m.StockDashboardComponent) },
      { path: 'reception', loadComponent: () => import('./pages/reception/reception-list.component').then(m => m.ReceptionListComponent) },
      { path: 'reception/new', loadComponent: () => import('./pages/reception/reception-form.component').then(m => m.ReceptionFormComponent) },
      { path: 'reception/:id', loadComponent: () => import('./pages/reception/reception-form.component').then(m => m.ReceptionFormComponent) },
      { path: 'validation', loadComponent: () => import('./pages/validation/validation.component').then(m => m.ValidationComponent) },
      { path: 'production', loadComponent: () => import('./pages/production/production.component').then(m => m.ProductionComponent) },
      { path: 'orders', loadComponent: () => import('./pages/production/production.component').then(m => m.ProductionComponent) },
      { path: 'inventaire', loadComponent: () => import('./pages/inventaire/inventaire.component').then(m => m.InventaireComponent) },
      { path: 'mouvements', loadComponent: () => import('./pages/mouvements/mouvements.component').then(m => m.MouvementsComponent) },
      { path: 'session', loadComponent: () => import('./pages/session/session.component').then(m => m.SessionComponent) },
      { path: 'commercial', loadComponent: () => import('./pages/commercial/commercial.component').then(m => m.CommercialComponent) },
      { path: 'alertes', loadComponent: () => import('./pages/alertes/alertes.component').then(m => m.AlertesComponent) },
      { path: 'rapports', loadComponent: () => import('./pages/alertes/alertes.component').then(m => m.AlertesComponent) },
      { path: 'settings', loadComponent: () => import('./pages/settings/settings.component').then(m => m.SettingsComponent) },
      { path: 'notifications', loadComponent: () => import('./pages/notifications/notifications.component').then(m => m.NotificationsComponent) },
    ]
  }
];
