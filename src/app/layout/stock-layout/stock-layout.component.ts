import { Component, OnInit, signal, inject, HostListener, computed, OnDestroy } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { filter } from 'rxjs/operators';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { AuthService } from '../../core/auth/auth.service';
import { NetworkService } from '../../core/services/network.service';
import { AlertBadgeService } from '../../core/services/alert-badge.service';
import { ApiService } from '../../core/http/api.service';
import { TantybotComponent } from '../../shared/components/tantybot/tantybot.component';
import { Subject, takeUntil, timer } from 'rxjs';

registerLocaleData(localeFr);

interface NavItem { label: string; icon: string; route: string; badge?: number; badgeClass?: string; roles?: string[]; }
interface NavSection { title: string; icon: string; items: NavItem[]; }

interface NotifItem {
  id: number;
  title: string;
  message: string;
  type: string;
  priority: string;
  read: boolean;
  time: string;
  icon: string;
}

@Component({
  selector: 'app-stock-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, DatePipe, TantybotComponent],
  templateUrl: './stock-layout.component.html',
  styleUrls: ['./stock-layout.component.css']
})
export class StockLayoutComponent implements OnInit, OnDestroy {
  router = inject(Router);
  authService = inject(AuthService);
  network = inject(NetworkService);
  alertBadge = inject(AlertBadgeService);
  sidebarOpen = signal(true);
  mobileOpen = signal(false);
  currentTime = signal(new Date());
  currentPageTitle = signal('Tableau de Bord');
  alertCount = this.alertBadge.totalCount;
  criticalCount = this.alertBadge.criticalCount;
  notifCount = this.alertBadge.notifCount;
  showNotifPanel = signal(false);
  recentNotifs = signal<NotifItem[]>([]);
  private notifPollTimer: any;
  private badgePollTimer: any;
  private destroy$ = new Subject<void>();
  private api = inject(ApiService);

  // === Utilisateur dynamique depuis AuthService ===
  currentUser = computed(() => this.authService.getCurrentUser());
  userInitials = computed(() => {
    const u = this.currentUser();
    if (!u) return '??';
    return ((u.firstname?.[0] || '') + (u.lastname?.[0] || '')).toUpperCase();
  });
  userFullName = computed(() => {
    const u = this.currentUser();
    if (!u) return 'Utilisateur';
    return `${u.firstname} ${u.lastname}`;
  });
  userShortName = computed(() => {
    const u = this.currentUser();
    if (!u) return 'Utilisateur';
    return `${u.firstname} ${u.lastname?.[0]}.`;
  });
  userRoleLabel = computed(() => {
    const u = this.currentUser();
    if (!u) return '';
    const roleMap: Record<string, string> = {
      'ADMIN': 'Administrateur',
      'GESTIONNAIRE_STOCK': 'Gestionnaire de Stock',
      'COMMERCIAL': 'Commercial',
      'CHEF_PRODUCTION': 'Chef de Production',
      'CONTROLEUR_GENERAL': 'Controleur de Gestion',
      'DIRECTEUR_GENERAL': 'Direction Generale',
      'COMPTABLE': 'Comptable',
      'SECRETAIRE': 'Secretaire',
    };
    const r = u.roles?.[0] || '';
    return roleMap[r] || r;
  });

  private navSections: NavSection[] = [
    {
      title: 'Pilotage', icon: 'fa-chart-pie',
      items: [
        { label: 'Tableau de Bord', icon: 'fa-chart-pie', route: '/stock/dashboard' },
        { label: 'Statistiques', icon: 'fa-chart-line', route: '/stock/statistiques' },
        { label: 'Alertes', icon: 'fa-triangle-exclamation', route: '/stock/alertes' },
      ]
    },
    {
      title: 'Intelligence Artificielle', icon: 'fa-brain',
      items: [
        { label: 'Prévisions & Ruptures', icon: 'fa-brain', route: '/stock/ia-predictions' },
        { label: 'Réapprovisionnement IA', icon: 'fa-robot', route: '/stock/ia-reappro' },
        { label: 'Optimisation Transferts', icon: 'fa-shuffle', route: '/stock/ia-transferts' },
      ]
    },
    {
      title: 'Opérations', icon: 'fa-industry',
      items: [
        { label: 'Réceptions Fournisseurs', icon: 'fa-truck-ramp-box', route: '/stock/reception', roles: ['GESTIONNAIRE_STOCK', 'ADMIN'] },
        { label: 'Validation Entrées', icon: 'fa-clipboard-check', route: '/stock/validation', roles: ['GESTIONNAIRE_STOCK', 'CONTROLEUR_GENERAL', 'ADMIN'] },
        { label: 'Lots de Production', icon: 'fa-industry', route: '/stock/production', roles: ['GESTIONNAIRE_STOCK', 'CHEF_PRODUCTION', 'ADMIN'] },
        { label: 'Commandes Production', icon: 'fa-cart-plus', route: '/stock/orders', roles: ['GESTIONNAIRE_STOCK', 'CHEF_PRODUCTION', 'ADMIN'] },
        { label: 'Dotations', icon: 'fa-hand-holding', route: '/stock/dotations', roles: ['GESTIONNAIRE_STOCK', 'COMMERCIAL', 'ADMIN'] },
        { label: 'Mouvements Stock', icon: 'fa-right-left', route: '/stock/mouvements' },
        { label: 'Session du Jour', icon: 'fa-calendar-check', route: '/stock/session', roles: ['GESTIONNAIRE_STOCK', 'COMMERCIAL', 'ADMIN'] },
      ]
    },
    {
      title: 'Gestion du Stock', icon: 'fa-warehouse',
      items: [
        { label: 'Inventaire', icon: 'fa-boxes-packing', route: '/stock/inventaire', roles: ['GESTIONNAIRE_STOCK', 'ADMIN', 'CONTROLEUR_GENERAL', 'DIRECTEUR_GENERAL'] },
        { label: 'Inventaire Physique', icon: 'fa-clipboard-check', route: '/stock/inventaire-physique', roles: ['GESTIONNAIRE_STOCK', 'ADMIN', 'DIRECTEUR_GENERAL'] },
        { label: 'Articles de Stock', icon: 'fa-boxes-stacked', route: '/stock/articles' },
        { label: 'Magasins', icon: 'fa-warehouse', route: '/stock/magasins', roles: ['GESTIONNAIRE_STOCK', 'ADMIN'] },
        { label: 'Magasin Tampon', icon: 'fa-warehouse', route: '/stock/tampon', roles: ['GESTIONNAIRE_STOCK', 'ADMIN'] },
        { label: 'Stock Mobile', icon: 'fa-truck-field', route: '/stock/mobile-stock', roles: ['GESTIONNAIRE_STOCK', 'COMMERCIAL', 'ADMIN'] },
        { label: 'Localisations', icon: 'fa-map-location-dot', route: '/stock/localisations' },
        { label: 'Seuils de Stock', icon: 'fa-ruler', route: '/stock/seuils', roles: ['GESTIONNAIRE_STOCK', 'DIRECTEUR_GENERAL', 'ADMIN'] },
      ]
    },
    {
      title: 'Catalogue & Valorisation', icon: 'fa-tags',
      items: [
        { label: 'Gestion Produits', icon: 'fa-boxes-stacked', route: '/stock/produits', roles: ['DIRECTEUR_GENERAL', 'ADMIN'] },
        { label: 'Classification ABC', icon: 'fa-tags', route: '/stock/classification' },
        { label: 'Valorisation', icon: 'fa-coins', route: '/stock/valorisation', roles: ['GESTIONNAIRE_STOCK', 'COMPTABLE', 'DIRECTEUR_GENERAL', 'ADMIN'] },
        { label: 'Matériel', icon: 'fa-screwdriver-wrench', route: '/stock/materiels' },
      ]
    },
    {
      title: 'Commercial', icon: 'fa-users',
      items: [
        { label: 'Module Commercial', icon: 'fa-users', route: '/stock/commercial', roles: ['GESTIONNAIRE_STOCK', 'COMMERCIAL', 'ADMIN'] },
      ]
    },
    {
      title: 'Rapports & Configuration', icon: 'fa-file-lines',
      items: [
        { label: 'Rapports & Documents', icon: 'fa-file-lines', route: '/stock/rapports' },
        { label: 'Notifications', icon: 'fa-bell', route: '/stock/notifications' },
        { label: 'Paramètres', icon: 'fa-gear', route: '/stock/settings' },
      ]
    },
  ];

  // Badge counts for sidebar items
  pendingLotsCount = signal(0);
  pendingDotationsCount = signal(0);
  pendingOrdersCount = signal(0);
  pendingValidationCount = signal(0);

  // Filtrer les sections selon le role de l'utilisateur et injecter les badges
  filteredNavSections = computed(() => {
    const u = this.currentUser();
    const isAdmin = u?.roles.includes('ADMIN') ?? false;
    return this.navSections.map(section => {
      const items = section.items.map(item => {
        const badge = this.getBadgeForRoute(item.route);
        return badge > 0 ? { ...item, badge, badgeClass: this.getBadgeClassForRoute(item.route) } : item;
      });
      const filteredItems = (!u || isAdmin) ? items : items.filter(item => {
        if (!item.roles) return true;
        return u.roles.some(r => item.roles!.includes(r));
      });
      return { ...section, items: filteredItems };
    }).filter(section => section.items.length > 0);
  });

  // Backward compat: flat list for any code referencing filteredNav
  filteredNav = computed(() => {
    return this.filteredNavSections().flatMap(s => s.items);
  });

  private getBadgeForRoute(route: string): number {
    switch (route) {
      case '/stock/production': return this.pendingLotsCount();
      case '/stock/dotations': return this.pendingDotationsCount();
      case '/stock/orders': return this.pendingOrdersCount();
      case '/stock/validation': return this.pendingValidationCount();
      case '/stock/alertes': return this.alertCount();
      case '/stock/notifications': return this.notifCount();
      default: return 0;
    }
  }

  private getBadgeClassForRoute(route: string): string {
    switch (route) {
      case '/stock/production': return 'bd-orange';
      case '/stock/dotations': return 'bd-blue';
      case '/stock/orders': return 'bd-orange';
      case '/stock/validation': return 'bd-orange';
      case '/stock/alertes': return 'bd-red';
      case '/stock/notifications': return 'bd-red';
      default: return 'bd-neutral';
    }
  }

  ngOnInit() {
    setInterval(() => this.currentTime.set(new Date()), 30000);
    if (window.innerWidth < 768) this.sidebarOpen.set(false);
    this.alertBadge.startPolling(30000);
    this.loadSidebarBadges();
    this.badgePollTimer = setInterval(() => this.loadSidebarBadges(), 30000);
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
      const cur = this.filteredNav().find(n => this.router.url.startsWith(n.route));
      if (cur) this.currentPageTitle.set(cur.label);
      if (window.innerWidth < 768) this.mobileOpen.set(false);
    });
  }

  private loadSidebarBadges() {
    // Pending production lots (DECLARED_BY_PRODUCTION)
    this.api.get<any[]>('v1/stock/production/batches/pending')
      .pipe(takeUntil(this.destroy$))
      .subscribe({ next: (data) => this.pendingLotsCount.set(data?.length || 0), error: () => {} });

    // Pending dotations — all non-completed/rejected statuses
    this.api.get<any[]>('stock/dotations')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => this.pendingDotationsCount.set(
          (data || []).filter((d: any) => !['COMPLETED', 'REJECTED'].includes(d.status)).length
        ),
        error: () => {}
      });

    // Active internal orders (not COMPLETED/CANCELLED)
    this.api.get<any[]>('stock/internal-orders/active')
      .pipe(takeUntil(this.destroy$))
      .subscribe({ next: (data) => this.pendingOrdersCount.set(data?.length || 0), error: () => {} });

    // Pending movement validations
    this.api.get<any[]>('stock/movements/pending')
      .pipe(takeUntil(this.destroy$))
      .subscribe({ next: (data) => this.pendingValidationCount.set(data?.length || 0), error: () => {} });
  }

  private loadNotifCount() {
    this.alertBadge.refresh();
  }

  toggleNotifPanel() {
    this.showNotifPanel.update(v => !v);
    if (this.showNotifPanel()) this.loadRecentNotifs();
  }

  closeNotifPanel() { this.showNotifPanel.set(false); }

  private loadRecentNotifs() {
    const user = this.authService.getCurrentUser();
    const matricule = user?.matricule || 'system';
    this.api.get<any[]>(`stock/notifications/user/${matricule}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.recentNotifs.set((data || []).slice(0, 10).map(n => this.mapNotif(n)));
        },
        error: () => {}
      });
  }

  private mapNotif(n: any): NotifItem {
    const status = (n.status || '').toUpperCase();
    const priority = (n.priority || '').toUpperCase();
    const title = n.title || '';
    let type: 'info' | 'success' | 'warning' | 'error' = 'info';
    if (title.toLowerCase().includes('erreur') || priority === 'URGENT') type = 'error';
    else if (title.toLowerCase().includes('alerte') || priority === 'HIGH') type = 'warning';
    else if (status === 'READ') type = 'success';
    const icons: Record<string, string> = { success: 'fa-check-circle', warning: 'fa-triangle-exclamation', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
    return {
      id: n.id,
      title,
      message: n.message || '',
      type,
      priority,
      read: status === 'READ' || !!n.readAt,
      time: this.formatNotifTime(n.createdAt),
      icon: icons[type] || 'fa-bell'
    };
  }

  private formatNotifTime(raw: any): string {
    if (!raw) return '';
    let d: Date;
    if (Array.isArray(raw)) {
      d = new Date(raw[0], (raw[1] || 1) - 1, raw[2] || 1, raw[3] || 0, raw[4] || 0, raw[5] || 0);
    } else {
      d = new Date(raw);
    }
    if (isNaN(d.getTime())) return '';
    const diff = Date.now() - d.getTime();
    const min = Math.floor(diff / 60000);
    const hr = Math.floor(diff / 3600000);
    const day = Math.floor(diff / 86400000);
    if (min < 1) return 'À l\'instant';
    if (min < 60) return `Il y a ${min} min`;
    if (hr < 24) return `Il y a ${hr} h`;
    if (day === 1) return 'Hier';
    if (day < 7) return `Il y a ${day} jours`;
    return d.toLocaleDateString('fr-FR');
  }

  markNotifAsRead(n: NotifItem) {
    this.api.post(`stock/notifications/${n.id}/mark-read`, {}).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.recentNotifs.update(list => list.map(x => x.id === n.id ? { ...x, read: true } : x));
        this.alertBadge.refresh();
      },
      error: () => {}
    });
  }

  markAllNotifsAsRead() {
    const user = this.authService.getCurrentUser();
    const matricule = user?.matricule || 'system';
    this.api.post(`stock/notifications/user/${matricule}/mark-all-read`, {}).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.recentNotifs.update(list => list.map(x => ({ ...x, read: true })));
        this.alertBadge.refresh();
      },
      error: () => {}
    });
  }

  @HostListener('window:resize', ['$event'])
  onResize(e: Event) {
    const w = (e.target as Window).innerWidth;
    if (w < 768) { this.sidebarOpen.set(false); } else { this.mobileOpen.set(false); }
  }

  toggleSidebar() {
    if (window.innerWidth < 768) this.mobileOpen.update(v => !v);
    else this.sidebarOpen.update(v => !v);
  }

  closeMobile() { this.mobileOpen.set(false); }

  logout() {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }

  ngOnDestroy() {
    clearInterval(this.badgePollTimer);
    this.alertBadge.stopPolling();
    this.destroy$.next();
    this.destroy$.complete();
  }
}