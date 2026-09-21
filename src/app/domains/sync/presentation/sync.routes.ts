import { Routes } from '@angular/router';

export const SYNC_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'status',
    pathMatch: 'full'
  },
  {
    path: 'status',
    loadComponent: () => import('./pages/sync-status/sync-status.component').then(m => m.SyncStatusComponent)
  },
  {
    path: 'queue',
    loadComponent: () => import('./pages/sync-queue/sync-queue.component').then(m => m.SyncQueueComponent)
  },
  {
    path: 'history',
    loadComponent: () => import('./pages/sync-history/sync-history.component').then(m => m.SyncHistoryComponent)
  }
];
