import { Component, OnInit, OnDestroy, inject, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../core/http/api.service';
import { ApiResponse } from '../../core/models/api-response.model';
import { extractApiError } from '../../core/http/api-error-parser';
import { ToastService } from '../../core/services/toast.service';
import { AuthService } from '../../core/auth/auth.service';
import { AlertBadgeService } from '../../core/services/alert-badge.service';
import { NotificationWebSocketService, NotificationTempsReel } from '../../core/services/notification-websocket.service';

export interface NotificationItem {
  id: number;
  typeNotification: string;
  titre: string;
  message: string;
  destinataireRole: string | null;
  matriculeDestinataire: string | null;
  canal: string;
  priorite: string;
  referenceLiee: string | null;
  lu: boolean;
  dateCreation: string;
  dateLecture: string | null;
}

export interface ActionRequiseItem {
  id: string;
  titre: string;
  description: string;
  icone: string;
  priorite: 'critique' | 'haute' | 'normale';
  route: string;
  count: number;
}

const COULEUR_PRIORITE: Record<string, string> = {
  CRITIQUE: 'prio-critique', HAUTE: 'prio-haute', URGENTE: 'prio-critique',
  MOYENNE: 'prio-moyenne', NORMALE: 'prio-moyenne', BASSE: 'prio-basse', FAIBLE: 'prio-basse',
};

/**
 * Centre de notifications unifié TANTY :
 * 1. Onglet « Actions requises » : tâches métier en attente selon le rôle connecté (validations, décaissements, précommandes, lots, réceptions, incidents, alertes stock).
 * 2. Onglet « Alertes & Système » : flux temps réel WebSocket (`/topic/notifications`) + historique backend (`/stock/notifications/historique`).
 * 3. Onglet « Activité » : journal en direct des actions réalisées dans la session (`ToastService.history`).
 */
@Component({
  selector: 'app-notification-center',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notification-center.component.html',
  styleUrls: ['./notification-center.component.css'],
})
export class NotificationCenterComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly ws = inject(NotificationWebSocketService);
  readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  private readonly alertBadge = inject(AlertBadgeService);
  private readonly router = inject(Router);

  ouvert = signal(false);
  ongletActif = signal<'actions' | 'systeme' | 'activite'>('actions');
  chargement = signal(false);
  chargementActions = signal(false);
  erreur = signal<string | null>(null);
  notifications = signal<NotificationItem[]>([]);
  nonLues = signal(0);
  actionsRequises = signal<ActionRequiseItem[]>([]);

  totalBadge = computed(() => {
    const nbActions = this.actionsRequises().reduce((acc, a) => acc + (a.count || 1), 0);
    return nbActions + this.nonLues();
  });

  private desabonner: (() => void) | null = null;

  ngOnInit() {
    this.chargerActionsRequises();
    this.chargerHistorique();
    this.ws.connecter();
    this.desabonner = this.ws.surNotification((n) => this.surNouvelleNotification(n));
  }

  ngOnDestroy() {
    this.desabonner?.();
  }

  @HostListener('document:click')
  fermerAuClicExterieur() {
    this.ouvert.set(false);
  }

  toggle(event: MouseEvent) {
    event.stopPropagation();
    this.ouvert.update((v) => !v);
    if (this.ouvert()) {
      this.chargerActionsRequises();
      this.chargerHistorique();
    }
  }

  changerOnglet(onglet: 'actions' | 'systeme' | 'activite', event: MouseEvent) {
    event.stopPropagation();
    this.ongletActif.set(onglet);
    if (onglet === 'activite') {
      this.toast.markAllHistoryRead();
    }
  }

  allerVersAction(action: ActionRequiseItem, event: MouseEvent) {
    event.stopPropagation();
    this.ouvert.set(false);
    this.router.navigateByUrl(action.route);
  }

  private upsertAction(item: ActionRequiseItem) {
    this.actionsRequises.update((list) => {
      const filtered = list.filter((x) => x.id !== item.id);
      if (item.count <= 0) return filtered;
      return [...filtered, item];
    });
  }

  chargerActionsRequises() {
    const user = this.auth.getCurrentUser();
    const role = (user?.roles?.[0] || user?.role || '').toUpperCase();
    this.chargementActions.set(true);

    // 1. Demandes génériques de validation pour l'utilisateur courant
    const valRoute = this.getValidationRouteForRole(role);
    if (valRoute) {
      this.api.get<any[]>('/v1/validation/demandes/en-attente-pour-moi').subscribe({
        next: (res) => {
          const count = Array.isArray(res) ? res.length : 0;
          this.upsertAction({
            id: 'generic-validations',
            titre: `${count} demande(s) de validation`,
            description: 'Approbations en attente de votre décision',
            icone: 'fa-clipboard-check',
            priorite: 'haute',
            route: valRoute,
            count,
          });
          this.chargementActions.set(false);
        },
        error: () => this.chargementActions.set(false),
      });
    } else {
      this.chargementActions.set(false);
    }

    // 2. Actions spécifiques par rôle
    if (role.includes('DIRECTEUR_GENERAL') || role === 'DG') {
      const alertes = this.alertBadge.totalCount();
      if (alertes > 0) {
        this.upsertAction({
          id: 'dg-stock-alertes',
          titre: `${alertes} alerte(s) stock sous seuil`,
          description: 'Produits critiques nécessitant une supervision',
          icone: 'fa-triangle-exclamation',
          priorite: 'critique',
          route: '/dg/supervision',
          count: alertes,
        });
      }
      this.api.get<any>('/dg/validations').subscribe({
        next: (r) => {
          const list = r?.donnees ?? r ?? [];
          const count = Array.isArray(list) ? list.length : 0;
          this.upsertAction({
            id: 'dg-arbitrage',
            titre: `${count} arbitrage(s) tarifaire(s)`,
            description: 'Demandes de dérogation de prix à trancher',
            icone: 'fa-scale-balanced',
            priorite: 'haute',
            route: '/dg/arbitrage',
            count,
          });
        },
        error: () => {},
      });
      this.api.get<any>('/comptabilite/decaissements').subscribe({
        next: (r) => {
          const list = r?.donnees ?? r ?? [];
          const count = Array.isArray(list)
            ? list.filter((x: any) => x.statut === 'PROPOSE' || x.statut === 'VALIDEE_CG').length
            : 0;
          this.upsertAction({
            id: 'dg-decaissements',
            titre: `${count} décaissement(s) à approuver`,
            description: 'Sorties de trésorerie en attente de signature DG',
            icone: 'fa-money-bill-transfer',
            priorite: 'critique',
            route: '/dg/decaissements',
            count,
          });
        },
        error: () => {},
      });
    } else if (role.includes('COMPTABLE')) {
      this.api.get<any>('/commercial/precommandes/a-valider-comptable').subscribe({
        next: (r) => {
          const page = r?.donnees ?? r;
          const contenu = page?.contenu ?? (Array.isArray(page) ? page : []);
          const count = contenu.filter((p: any) => p.statut === 'VALIDEE_SECRETAIRE').length;
          this.upsertAction({
            id: 'cpt-commandes',
            titre: `${count} précommande(s) à valider`,
            description: 'Commandes J+1 validées par le secrétariat',
            icone: 'fa-file-invoice',
            priorite: 'haute',
            route: '/comptable/commandes',
            count,
          });
        },
        error: () => {},
      });
      this.api.get<any>('/comptable/versements').subscribe({
        next: (r) => {
          const list = r?.donnees ?? r ?? [];
          const count = Array.isArray(list) ? list.filter((v: any) => v.statut === 'EN_ATTENTE').length : 0;
          this.upsertAction({
            id: 'cpt-versements',
            titre: `${count} versement(s) à contrôler`,
            description: 'Encaissements commerciaux en attente de rapprochement',
            icone: 'fa-cash-register',
            priorite: 'normale',
            route: '/comptable/caisse',
            count,
          });
        },
        error: () => {},
      });
    } else if (role.includes('CONTROLEUR')) {
      this.api.get<any>('/controle/dashboard').subscribe({
        next: (r) => {
          const d = r?.donnees ?? r;
          if (d?.decaissementsAttente > 0) {
            this.upsertAction({
              id: 'cg-decaissements',
              titre: `${d.decaissementsAttente} décaissement(s) à contrôler`,
              description: 'Vérification budgétaire avant transmission au DG',
              icone: 'fa-money-check-dollar',
              priorite: 'critique',
              route: '/controle/decaissements',
              count: d.decaissementsAttente,
            });
          }
          if (d?.budgetDepasse > 0) {
            this.upsertAction({
              id: 'cg-budget',
              titre: `${d.budgetDepasse} alerte(s) de dépassement budgétaire`,
              description: 'Lignes budgétaires ayant franchi le seuil autorisé',
              icone: 'fa-file-invoice-dollar',
              priorite: 'haute',
              route: '/controle/budget',
              count: d.budgetDepasse,
            });
          }
        },
        error: () => {},
      });
    } else if (role.includes('SECRETAIRE')) {
      this.api.get<any>('/comptabilite/decaissements').subscribe({
        next: (r) => {
          const list = r?.donnees ?? r ?? [];
          const count = Array.isArray(list) ? list.filter((x: any) => x.statut === 'VALIDEE_DG').length : 0;
          this.upsertAction({
            id: 'sec-decaissements',
            titre: `${count} décaissement(s) validé(s) DG à exécuter`,
            description: 'Prêts pour décaissement effectif en caisse',
            icone: 'fa-hand-holding-dollar',
            priorite: 'critique',
            route: '/secretaire/validation',
            count,
          });
        },
        error: () => {},
      });
      this.api.get<any>('/comptable/versements').subscribe({
        next: (r) => {
          const list = r?.donnees ?? r ?? [];
          const count = Array.isArray(list) ? list.filter((v: any) => v.statut === 'EN_ATTENTE').length : 0;
          this.upsertAction({
            id: 'sec-versements',
            titre: `${count} versement(s) en attente`,
            description: 'Saisies de versements commerciaux à compléter',
            icone: 'fa-cash-register',
            priorite: 'haute',
            route: '/secretaire/versements',
            count,
          });
        },
        error: () => {},
      });
    } else if (role.includes('RP') || role.includes('CHARGEE')) {
      this.api.get<any>('/rp/dashboard').subscribe({
        next: (r) => {
          const d = r?.donnees ?? r;
          if (d?.relancesDues > 0) {
            this.upsertAction({
              id: 'rp-relances',
              titre: `${d.relancesDues} relance(s) Grands Comptes dues`,
              description: 'Supermarchés ou partenaires GMS à recontacter rapidement',
              icone: 'fa-handshake',
              priorite: 'haute',
              route: '/rp/grands-comptes',
              count: d.relancesDues,
            });
          }
        },
        error: () => {},
      });
      this.api.get<any>('/commercial/commandes-clients').subscribe({
        next: (r) => {
          const list = r?.donnees ?? r ?? [];
          const count = Array.isArray(list) ? list.filter((c: any) => c.statut === 'EN_ATTENTE' || c.statut === 'A_VALIDER').length : 0;
          if (count > 0) {
            this.upsertAction({
              id: 'rp-commandes-vip',
              titre: `${count} commande(s) VIP en attente`,
              description: 'Commandes hors-tournée WhatsApp/téléphone à traiter',
              icone: 'fa-cart-shopping',
              priorite: 'haute',
              route: '/rp/commandes-clients',
              count,
            });
          }
        },
        error: () => {},
      });
    } else if (role.includes('PRODUCTION')) {
      this.api.get<any>('/production/besoins?statut=EN_ATTENTE').subscribe({
        next: (r) => {
          const list = r?.donnees ?? r ?? [];
          const count = Array.isArray(list) ? list.length : 0;
          this.upsertAction({
            id: 'prod-besoins',
            titre: `${count} expression(s) de besoin en attente`,
            description: 'Demandes de matières premières à traiter',
            icone: 'fa-boxes-packing',
            priorite: 'haute',
            route: '/production/besoins',
            count,
          });
        },
        error: () => {},
      });
    } else if (role.includes('STOCK')) {
      const alertes = this.alertBadge.totalCount();
      if (alertes > 0) {
        this.upsertAction({
          id: 'stock-alertes',
          titre: `${alertes} alerte(s) de stock actives`,
          description: 'Articles sous le seuil minimum ou en rupture',
          icone: 'fa-triangle-exclamation',
          priorite: 'critique',
          route: '/stock/alertes',
          count: alertes,
        });
      }
      this.api.get<any>('/production/lots/a-valider').subscribe({
        next: (r) => {
          const list = r?.donnees ?? r ?? [];
          const count = Array.isArray(list) ? list.length : 0;
          this.upsertAction({
            id: 'stock-lots',
            titre: `${count} lot(s) de production à réceptionner`,
            description: 'Transferts de produits finis vers le magasin',
            icone: 'fa-boxes-stacked',
            priorite: 'haute',
            route: '/stock/lots-production',
            count,
          });
        },
        error: () => {},
      });
      this.api.get<any[]>('/v1/stock/receptions/en-attente-premiere-validation').subscribe({
        next: (res) => {
          const count = Array.isArray(res) ? res.length : 0;
          this.upsertAction({
            id: 'stock-receptions',
            titre: `${count} réception(s) à valider`,
            description: 'Livraisons fournisseurs en attente de validation',
            icone: 'fa-truck-ramp-box',
            priorite: 'haute',
            route: '/stock/validation',
            count,
          });
        },
        error: () => {},
      });
    } else if (role.includes('ADMIN')) {
      this.api.get<any>('/incidents').subscribe({
        next: (r) => {
          const list = r?.donnees?.contenu ?? r?.donnees ?? r ?? [];
          const count = Array.isArray(list)
            ? list.filter((i: any) => i.statut === 'OUVERT' || i.statut === 'EN_COURS').length
            : 0;
          this.upsertAction({
            id: 'admin-incidents',
            titre: `${count} incident(s) ouvert(s)`,
            description: 'Signalements utilisateurs en attente de traitement',
            icone: 'fa-screwdriver-wrench',
            priorite: 'haute',
            route: '/admin/incidents',
            count,
          });
        },
        error: () => {},
      });
    }
  }

  private getValidationRouteForRole(role: string): string | null {
    if (role.includes('DIRECTEUR_GENERAL') || role === 'DG') return '/dg/validations';
    if (role.includes('COMPTABLE')) return '/comptable/validations';
    if (role.includes('CONTROLEUR')) return '/controle/validations';
    if (role.includes('STOCK')) return '/stock/mes-validations';
    if (role.includes('SECRETAIRE')) return '/secretaire/validation';
    return null;
  }

  private chargerHistorique() {
    this.chargement.set(true);
    this.erreur.set(null);
    this.api.get<ApiResponse<NotificationItem[]>>('/stock/notifications/historique').subscribe({
      next: (r) => {
        const items = r.donnees ?? [];
        this.notifications.set(items.slice(0, 30));
        this.nonLues.set(items.filter((n) => !n.lu).length);
        this.chargement.set(false);
      },
      error: (err) => {
        this.erreur.set(extractApiError(err));
        this.chargement.set(false);
      },
    });
  }

  private surNouvelleNotification(n: NotificationTempsReel) {
    this.nonLues.update((v) => v + 1);
    this.notifications.update((items) => [
      {
        id: -Date.now(),
        typeNotification: n.typeNotification,
        titre: n.titre,
        message: n.message,
        destinataireRole: n.destinataireRole,
        matriculeDestinataire: n.matriculeDestinataire,
        canal: n.canal,
        priorite: n.priorite,
        referenceLiee: n.referenceLiee,
        lu: false,
        dateCreation: n.dateCreation,
        dateLecture: null,
      },
      ...items,
    ]);
    this.toast.info(n.message || n.titre, n.titre || 'Nouvelle notification');
    this.chargerActionsRequises();
  }

  marquerLu(item: NotificationItem, event: MouseEvent) {
    event.stopPropagation();
    if (item.lu || item.id < 0) return;
    this.api.patch<ApiResponse<NotificationItem>>(`/stock/notifications/historique/${item.id}/lu`, {}).subscribe({
      next: () => {
        item.lu = true;
        this.notifications.update((items) => [...items]);
        this.nonLues.update((v) => Math.max(0, v - 1));
      },
      error: (err) => this.toast.error(extractApiError(err), 'Impossible de marquer comme lu'),
    });
  }

  toutMarquerLu() {
    const nonLues = this.notifications().filter((n) => !n.lu && n.id > 0);
    if (nonLues.length === 0) return;
    nonLues.forEach((n) => this.marquerLu(n, new MouseEvent('click')));
  }

  classePriorite(priorite: string): string {
    return COULEUR_PRIORITE[priorite?.toUpperCase()] ?? 'prio-moyenne';
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
