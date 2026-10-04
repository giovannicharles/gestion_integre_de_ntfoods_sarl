import { Routes } from '@angular/router';
import { StockLayoutComponent } from '../../../layout/stock-layout/stock-layout.component';
import { authGuard } from '../../../core/auth/auth.guard';

export const STOCK_ROUTES: Routes = [
  {
    path: '',
    component: StockLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./pages/dashboard/stock-dashboard.component').then(m => m.StockDashboardComponent) },
      { path: 'statistiques', loadComponent: () => import('./pages/statistiques/statistiques.component').then(m => m.StatistiquesComponent) },
      { path: 'ia-predictions', loadComponent: () => import('./pages/ia-predictions/ia-predictions.component').then(m => m.IaPredictionsComponent) },
      { path: 'ia-reappro', loadComponent: () => import('./pages/ia-reappro/ia-reappro.component').then(m => m.IaReapproComponent) },
      { path: 'ia-transferts', loadComponent: () => import('./pages/ia-transferts/ia-transferts.component').then(m => m.IaTransfertsComponent) },
      { path: 'reception', loadComponent: () => import('./pages/reception/reception-list.component').then(m => m.ReceptionListComponent) },
      { path: 'reception/new', loadComponent: () => import('./pages/reception/reception-form.component').then(m => m.ReceptionFormComponent) },
      { path: 'reception/:id', loadComponent: () => import('./pages/reception/reception-form.component').then(m => m.ReceptionFormComponent) },
      { path: 'validation', loadComponent: () => import('./pages/validation/validation.component').then(m => m.ValidationComponent) },
      // Revu le 2026-10-01 (demande explicite du porteur, confidentialité des modules) : le
      // Gestionnaire de Stock ne doit jamais être envoyé dans le module Production (sa
      // navigation, son tableau de bord) même pour une action qu'il a le droit de faire côté
      // API. /stock/lots-production est un écran Stock à part entière (StockLayoutComponent),
      // qui appelle les mêmes endpoints que ProductionLotsComponent mais ne charge jamais son
      // layout. Ces deux anciens alias redirigent ici au lieu de /production/lots.
      { path: 'production', redirectTo: '/stock/lots-production', pathMatch: 'full' },
      { path: 'lots-production', loadComponent: () => import('./pages/lots-production/stock-lots-production.component').then(m => m.StockLotsProductionComponent) },
      { path: 'commande-production', loadComponent: () => import('./pages/commande-production/commande-production.component').then(m => m.CommandeProductionComponent) },
      { path: 'declaration-lot', redirectTo: '/stock/lots-production', pathMatch: 'full' },
      { path: 'orders', redirectTo: 'commande-production', pathMatch: 'full' },
      { path: 'inventaire', loadComponent: () => import('./pages/inventaire/inventaire.component').then(m => m.InventaireComponent) },
      { path: 'inventaire-physique', loadComponent: () => import('./pages/inventaire-physique/inventaire-physique.component').then(m => m.InventairePhysiqueComponent) },
      { path: 'mouvements', loadComponent: () => import('./pages/mouvements/mouvements.component').then(m => m.MouvementsComponent) },
      { path: 'session', loadComponent: () => import('./pages/session/session.component').then(m => m.SessionComponent) },
      { path: 'commercial', loadComponent: () => import('./pages/commercial/commercial.component').then(m => m.CommercialComponent) },
      { path: 'mobile-stock', loadComponent: () => import('./pages/mobile-stock/mobile-stock.component').then(m => m.MobileStockComponent) },
      { path: 'alertes', loadComponent: () => import('./pages/alertes/alertes.component').then(m => m.AlertesComponent) },
      { path: 'lots', loadComponent: () => import('./pages/lots/lots.component').then(m => m.LotsComponent) },
      // Parcours d'un lot (2026-09-30) : distinct de 'lots' ci-dessus — celui-ci lit LotStock (le grand livre de
      // traçabilité réellement alimenté par les réceptions/entrées de production), pas StockBatch (stock/batches).
      { path: 'lots/trace', loadComponent: () => import('./pages/lots/trace-lot.component').then(m => m.TraceLotComponent) },
      { path: 'audit', loadComponent: () => import('./pages/audit/audit.component').then(m => m.AuditComponent) },
      { path: 'rapports', loadComponent: () => import('./pages/rapports/rapport-list.component').then(m => m.RapportListComponent) },
      { path: 'dotations', loadComponent: () => import('./pages/dotations/dotation-list.component').then(m => m.DotationListComponent) },
      { path: 'dotations/new', loadComponent: () => import('./pages/dotations/dotation-form.component').then(m => m.DotationFormComponent) },
      { path: 'localisations', loadComponent: () => import('./pages/localisations/localisation-list.component').then(m => m.LocalisationListComponent) },
      { path: 'magasins', loadComponent: () => import('./pages/magasins/magasin-list.component').then(m => m.MagasinListComponent) },
      { path: 'articles', loadComponent: () => import('./pages/articles/article-list.component').then(m => m.ArticleListComponent) },
      { path: 'tampon', loadComponent: () => import('./pages/buffer/buffer.component').then(m => m.BufferComponent) },
      // Demande de transfert central → tampon (2026-09-30) : le seul chemin qui déplaçait réellement le stock
      // (transfer-to-buffer) n'était appelé par aucun écran ; celui-ci passe par le moteur de demandes (invariant 1).
      { path: 'transferts', loadComponent: () => import('./pages/transferts/demande-transfert.component').then(m => m.DemandeTransfertComponent) },
      { path: 'seuils', loadComponent: () => import('./pages/seuils/seuil-list.component').then(m => m.SeuilListComponent) },
      { path: 'exports', redirectTo: 'rapports', pathMatch: 'full' },
      { path: 'classification', loadComponent: () => import('./pages/classification/classification-list.component').then(m => m.ClassificationListComponent) },
      { path: 'materiels', loadComponent: () => import('./pages/materiels/materiel-list.component').then(m => m.MaterielListComponent) },
      { path: 'produits', loadComponent: () => import('./pages/produits/produits.component').then(m => m.ProduitsComponent) },
      { path: 'valorisation', loadComponent: () => import('./pages/valorisation/valorisation.component').then(m => m.ValorisationComponent) },
      { path: 'settings', loadComponent: () => import('./pages/settings/settings.component').then(m => m.SettingsComponent) },
      { path: 'notifications', loadComponent: () => import('./pages/notifications/notifications.component').then(m => m.NotificationsComponent) },
    ]
  }
];