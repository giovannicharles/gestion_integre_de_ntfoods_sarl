import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { NetworkService } from '../../core/services/network.service';
import { AlertBadgeService } from '../../core/services/alert-badge.service';

interface NavItem {
  route: string;
  label: string;
  icon: string;
  badge?: number;
  badgeClass?: string;
}

interface NavGroup {
  label: string;
  icon: string;
  children: NavItem[];
}

@Component({
  selector: 'app-app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app-shell.component.html',
  styleUrls: ['./app-shell.component.css']
})
export class AppShellComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly theme = inject(ThemeService);
  private readonly network = inject(NetworkService);
  private readonly alertBadge = inject(AlertBadgeService);

  readonly user = this.auth.user;
  readonly network = this.network;
  readonly theme = this.theme;

  // Sidebar state
  private readonly _sidebarOpen = signal(true);
  readonly sidebarOpen = this._sidebarOpen.asReadonly();

  private readonly _mobileOpen = signal(false);
  readonly mobileOpen = this._mobileOpen.asReadonly();

  // Notification panel
  private readonly _showNotifPanel = signal(false);
  readonly showNotifPanel = this._showNotifPanel.asReadonly();

  // Current time
  private readonly _currentTime = signal(new Date());
  readonly currentTime = this._currentTime.asReadonly();

  // Alerts
  readonly alertCount = this.alertBadge.alertCount;
  readonly criticalCount = this.alertBadge.criticalCount;

  // Computed user info
  readonly userInitials = computed(() => {
    const user = this.user();
    if (!user) return '??';
    const names = (user.firstname + ' ' + user.lastname).split(' ').filter(n => n.length > 0);
    return names.slice(0, 2).map(n => n[0].toUpperCase()).join('');
  });

  readonly userShortName = computed(() => {
    const user = this.user();
    if (!user) return '';
    return user.firstname + ' ' + user.lastname.split(' ')[0]?.[0] + '.';
  });

  readonly userFullName = computed(() => {
    const user = this.user();
    return user ? user.nomComplet : '';
  });

  readonly userRoleLabel = computed(() => {
    const role = this.user()?.role;
    const labels: Record<string, string> = {
      GESTIONNAIRE_STOCK: 'Gestionnaire Stock',
      DIRECTEUR_GENERAL: 'Directeur Général',
      COMMERCIAL: 'Commercial',
      COMPTABLE: 'Comptable',
      CHEF_PRODUCTION: 'Chef Production',
      CONTROLEUR_GENERAL: 'Contrôleur Général',
      CHARGEE_RP: 'Chargée RP',
      SECRETAIRE: 'Secrétaire',
      ADMIN: 'Administrateur'
    };
    return labels[role || ''] || role || '';
  });

  // Navigation items based on role
  readonly navItems = computed<NavItem[]>(() => {
    const role = this.user()?.role;
    const items: NavItem[] = [];

    switch (role) {
      case 'GESTIONNAIRE_STOCK':
        items.push(
          { route: '/stock/dashboard', label: 'Tableau de bord', icon: 'fa-chart-line' },
          { route: '/stock/produits', label: 'Produits', icon: 'fa-box' },
          { route: '/stock/mouvements', label: 'Mouvements', icon: 'fa-exchange-alt' },
          { route: '/stock/receptions', label: 'Réceptions', icon: 'fa-truck-loading' },
          { route: '/stock/inventaire', label: 'Inventaire', icon: 'fa-clipboard-list' },
          { route: '/stock/alertes', label: 'Alertes', icon: 'fa-bell', badge: this.alertCount() }
        );
        break;
      case 'DIRECTEUR_GENERAL':
        items.push(
          { route: '/dg/dashboard', label: 'Tableau de bord', icon: 'fa-chart-line' },
          { route: '/dg/arbitrage', label: 'Arbitrages', icon: 'fa-scale-balanced' },
          { route: '/dg/alertes', label: 'Alertes', icon: 'fa-bell', badge: this.alertCount() },
          { route: '/dg/kpis', label: 'KPIs', icon: 'fa-chart-pie' }
        );
        break;
      case 'COMMERCIAL':
        items.push(
          { route: '/commercial/dashboard', label: 'Tableau de bord', icon: 'fa-chart-line' },
          { route: '/commercial/ventes', label: 'Ventes', icon: 'fa-shopping-cart' },
          { route: '/commercial/clients', label: 'Clients', icon: 'fa-users' },
          { route: '/commercial/tournees', label: 'Tournées', icon: 'fa-route' }
        );
        break;
      case 'COMPTABLE':
        items.push(
          { route: '/comptable/dashboard', label: 'Tableau de bord', icon: 'fa-chart-line' },
          { route: '/comptable/caisse', label: 'Caisse', icon: 'fa-cash-register' },
          { route: '/comptable/versements', label: 'Versements', icon: 'fa-hand-holding-dollar' },
          { route: '/comptable/factures', label: 'Factures', icon: 'fa-file-invoice-dollar' }
        );
        break;
      case 'CHEF_PRODUCTION':
        items.push(
          { route: '/production/dashboard', label: 'Tableau de bord', icon: 'fa-chart-line' },
          { route: '/production/pph', label: 'Planning PPH', icon: 'fa-calendar-alt' },
          { route: '/production/of', label: 'Ordres Fabrication', icon: 'fa-cogs' },
          { route: '/production/lots', label: 'Lots', icon: 'fa-boxes' }
        );
        break;
      default:
        items.push({ route: '/dashboard', label: 'Tableau de bord', icon: 'fa-home' });
    }

    return items;
  });

  // Admin items (shown for ADMIN and DG)
  readonly adminItems = computed<NavItem[]>(() => {
    const role = this.user()?.role;
    if (role !== 'ADMIN' && role !== 'DIRECTEUR_GENERAL') return [];

    return [
      { route: '/admin/utilisateurs', label: 'Utilisateurs', icon: 'fa-users-cog' },
      { route: '/admin/parametres', label: 'Paramètres', icon: 'fa-cog' },
      { route: '/admin/audit', label: 'Journal d\'audit', icon: 'fa-history' }
    ];
  });

  // Configuration technique de la plateforme (module `admin` backend) — distinct
  // d'ADMINISTRATION ci-dessus, ne pas fusionner (docs/PROGRESS.md 2026-09-23).
  readonly adminSystemeItems = computed<NavItem[]>(() => {
    const role = this.user()?.role;
    if (role !== 'ADMIN' && role !== 'DIRECTEUR_GENERAL') return [];

    return [
      { route: '/admin-systeme/parametres', label: 'Paramètres système', icon: 'fa-sliders' },
      { route: '/admin-systeme/suivi', label: 'Suivi plateforme', icon: 'fa-heart-pulse' },
      { route: '/admin-systeme/corbeille', label: 'Corbeille', icon: 'fa-trash-can-arrow-up' },
      { route: '/admin-systeme/sauvegardes', label: 'Sauvegardes', icon: 'fa-database' }
    ];
  });

  constructor() {
    // Update time every minute
    setInterval(() => this._currentTime.set(new Date()), 60000);

    // Close notification panel when clicking outside
    document.addEventListener('click', (e) => {
      const panel = document.querySelector('.notif-panel');
      const button = document.querySelector('.tb-notif-wrap button');
      if (this._showNotifPanel() && panel && !panel.contains(e.target as Node) && !button?.contains(e.target as Node)) {
        this._showNotifPanel.set(false);
      }
    });
  }

  toggleSidebar(): void {
    this._sidebarOpen.update(v => !v);
  }

  toggleMobile(): void {
    this._mobileOpen.update(v => !v);
  }

  closeMobile(): void {
    this._mobileOpen.set(false);
  }

  toggleNotifPanel(): void {
    this._showNotifPanel.update(v => !v);
  }

  closeNotifPanel(): void {
    this._showNotifPanel.set(false);
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/auth/login']);
  }

  readonly currentPageTitle = computed(() => {
    const url = this.router.url;
    const parts = url.split('/').filter(p => p);
    if (parts.length === 0) return 'Accueil';
    return parts[parts.length - 1].charAt(0).toUpperCase() + parts[parts.length - 1].slice(1);
  });
}
