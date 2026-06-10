import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: '/auth/login', pathMatch: 'full' },
  {
    path: 'auth',
    loadChildren: () => import('./pages/auth/auth.routes').then(m => m.AUTH_ROUTES)
  },
  {
    path: 'stock',
    loadChildren: () => import('./domains/stock/presentation/stock.routes').then(m => m.STOCK_ROUTES)
  },
  { path: '**', redirectTo: '/auth/login' }
];
