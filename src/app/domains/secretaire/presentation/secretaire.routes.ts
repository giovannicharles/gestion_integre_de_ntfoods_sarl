import { Routes } from '@angular/router';
import { SecretaireLayoutComponent } from '../../../layout/secretaire-layout/secretaire-layout.component';

export const SECRETAIRE_ROUTES: Routes = [
  {
    path: '',
    component: SecretaireLayoutComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./pages/dashboard/secretaire-dashboard.component').then(m => m.SecretaireDashboardComponent) },
      { path: 'caisse', loadComponent: () => import('./pages/caisse/secretaire-caisse.component').then(m => m.SecretaireCaisseComponent) },
      { path: 'versements', loadComponent: () => import('./pages/versements/secretaire-versements.component').then(m => m.SecretaireVersementsComponent) },
      { path: 'validation', loadComponent: () => import('./pages/validation/secretaire-validation.component').then(m => m.SecretaireValidationComponent) },
      { path: 'commandes', loadComponent: () => import('./pages/commandes/secretaire-commandes.component').then(m => m.SecretaireCommandesComponent) },
      // Commandes clients hors tournée (téléphone, WhatsApp, SMS, email), écran
      // partagé (voir shared/commande-client), pas un doublon des précommandes J+1.
      { path: 'commandes-clients', loadComponent: () => import('../../../shared/commande-client/commande-client.component').then(m => m.CommandeClientComponent) },
      { path: 'session', loadComponent: () => import('./pages/session/secretaire-session.component').then(m => m.SecretaireSessionComponent) },
      { path: 'documents', loadComponent: () => import('./pages/documents/secretaire-documents.component').then(m => m.SecretaireDocumentsComponent) },
      { path: 'studio-documents', loadComponent: () => import('../../../shared/document-studio/document-studio.component').then(m => m.DocumentStudioComponent) },
      { path: 'reporting', loadComponent: () => import('./pages/reporting/secretaire-reporting.component').then(m => m.SecretaireReportingComponent) },
      { path: 'statistiques', loadComponent: () => import('./pages/statistiques/secretaire-statistiques.component').then(m => m.SecretaireStatistiquesComponent) },
      { path: 'assistant', loadComponent: () => import('./pages/assistant/secretaire-assistant.component').then(m => m.SecretaireAssistantComponent) },
      // Mon Profil, libre-service, commun à tous les layouts (2026-11-01).
      { path: 'profil', loadComponent: () => import('../../../shared/mon-profil/mon-profil.component').then(m => m.MonProfilComponent) },
    ]
  }
];
