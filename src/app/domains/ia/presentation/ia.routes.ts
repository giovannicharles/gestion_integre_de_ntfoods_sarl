import { Routes } from '@angular/router';
import { IaHubLayoutComponent } from './layout/ia-hub-layout.component';

/**
 * 2026-11-09 (demande explicite du porteur, « construis-le pour de vrai ») : ce hub était monté en
 * route de tout premier niveau sans aucun layout (ni sidebar ni fil d'Ariane), et chacune de ses 5
 * pages était un squelette vide de 8 lignes, jamais reliée au IaService pourtant déjà complet
 * (chat/analyze/predict/suggestions/meeting-report/intelligent-report, tous câblés sur de vrais
 * endpoints backend). Enveloppé dans IaHubLayoutComponent, les 5 pages reconstruites avec de vrais
 * formulaires + appels réels.
 */
export const IA_ROUTES: Routes = [
  {
    path: '',
    component: IaHubLayoutComponent,
    children: [
      { path: '', redirectTo: 'chat', pathMatch: 'full' },
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
        loadComponent: () => import('./pages/predictions/ia-predictions.component').then(m => m.IaHubPredictionsComponent)
      },
      {
        path: 'reports',
        loadComponent: () => import('./pages/reports/ia-reports.component').then(m => m.IaReportsComponent)
      },
      {
        path: 'suggestions',
        loadComponent: () => import('./pages/suggestions/ia-suggestions.component').then(m => m.IaSuggestionsComponent)
      }
    ]
  }
];
