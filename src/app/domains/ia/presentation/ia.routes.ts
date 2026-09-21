import { Routes } from '@angular/router';

export const IA_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'chat',
    pathMatch: 'full'
  },
  {
    path: 'chat',
    loadComponent: () => import('./pages/chat/ia-chat.component').then(m => m.IaChatComponent)
  },
  {
    path: 'analyze',
    loadComponent: () => import('./pages/analyze/ia-analyze.component').then(m => m.IaAnalyzeComponent)
  },
  {
    path: 'predictions',
    loadComponent: () => import('./pages/predictions/ia-predictions.component').then(m => m.IaPredictionsComponent)
  },
  {
    path: 'reports',
    loadComponent: () => import('./pages/reports/ia-reports.component').then(m => m.IaReportsComponent)
  },
  {
    path: 'suggestions',
    loadComponent: () => import('./pages/suggestions/ia-suggestions.component').then(m => m.IaSuggestionsComponent)
  }
];
