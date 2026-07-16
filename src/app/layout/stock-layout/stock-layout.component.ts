import { Component, OnInit, signal, inject, HostListener, computed } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { filter } from 'rxjs/operators';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { AuthService } from '../../core/auth/auth.service';
import { NetworkService } from '../../core/services/network.service';
import { AlertBadgeService } from '../../core/services/alert-badge.service';
import { TantybotComponent } from '../../shared/components/tantybot/tantybot.component';

registerLocaleData(localeFr);

interface NavItem { label: string; icon: string; route: string; badge?: number; badgeClass?: string; roles?: string[]; }

@Component({
  selector: 'app-stock-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, DatePipe, TantybotComponent],
  templateUrl: './stock-layout.component.html',
  styleUrls: ['./stock-layout.component.css']
})
export class StockLayoutComponent implements OnInit {
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
  notifCount = signal(0);

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

  navItems: NavItem[] = [
    { label: 'Tableau de Bord', icon: 'fa-chart-pie', route: '/stock/dashboard' },
    { label: 'Statistiques', icon: 'fa-chart-line', route: '/stock/statistiques' },
    { label: 'IA Prédictions', icon: 'fa-brain', route: '/stock/ia-predictions' },
    { label: 'Receptions Fournisseurs', icon: 'fa-truck-ramp-box', route: '/stock/reception', roles: ['GESTIONNAIRE_STOCK', 'ADMIN'] },
    { label: 'Validation Entrees', icon: 'fa-clipboard-check', route: '/stock/validation', roles: ['GESTIONNAIRE_STOCK', 'CONTROLEUR_GENERAL', 'ADMIN'] },
    { label: 'Lots de Production', icon: 'fa-industry', route: '/stock/production', roles: ['GESTIONNAIRE_STOCK', 'CHEF_PRODUCTION', 'ADMIN'] },
    { label: 'Commandes Production', icon: 'fa-cart-plus', route: '/stock/orders', roles: ['GESTIONNAIRE_STOCK', 'CHEF_PRODUCTION', 'ADMIN'] },
    { label: 'Dotations', icon: 'fa-hand-holding', route: '/stock/dotations', roles: ['GESTIONNAIRE_STOCK', 'COMMERCIAL', 'ADMIN'] },
    { label: 'Localisations', icon: 'fa-map-location-dot', route: '/stock/localisations' },
    { label: 'Magasins', icon: 'fa-warehouse', route: '/stock/magasins', roles: ['GESTIONNAIRE_STOCK', 'ADMIN'] },
    { label: 'Articles de Stock', icon: 'fa-boxes-stacked', route: '/stock/articles' },
    { label: 'Magasin Tampon', icon: 'fa-warehouse', route: '/stock/tampon', roles: ['GESTIONNAIRE_STOCK', 'ADMIN'] },
    { label: 'Inventaire Stock', icon: 'fa-boxes-packing', route: '/stock/inventaire', roles: ['GESTIONNAIRE_STOCK', 'ADMIN', 'CONTROLEUR_GENERAL', 'DIRECTEUR_GENERAL'] },
    { label: 'Mouvements Stock', icon: 'fa-right-left', route: '/stock/mouvements' },
    { label: 'Seuils', icon: 'fa-ruler', route: '/stock/seuils', roles: ['GESTIONNAIRE_STOCK', 'DIRECTEUR_GENERAL', 'ADMIN'] },
    { label: 'Session du Jour', icon: 'fa-calendar-check', route: '/stock/session', roles: ['GESTIONNAIRE_STOCK', 'COMMERCIAL', 'ADMIN'] },
    { label: 'Module Commercial', icon: 'fa-users', route: '/stock/commercial', roles: ['GESTIONNAIRE_STOCK', 'COMMERCIAL', 'ADMIN'] },
    { label: 'Stock Mobile', icon: 'fa-truck-field', route: '/stock/mobile-stock', roles: ['GESTIONNAIRE_STOCK', 'COMMERCIAL', 'ADMIN'] },
    { label: 'Alertes', icon: 'fa-triangle-exclamation', route: '/stock/alertes' },
    { label: 'Rapports', icon: 'fa-file-lines', route: '/stock/rapports' },
    { label: 'Export', icon: 'fa-file-export', route: '/stock/exports' },
    { label: 'Gestion Produits', icon: 'fa-boxes-stacked', route: '/stock/produits', roles: ['DIRECTEUR_GENERAL', 'ADMIN'] },
    { label: 'Classification', icon: 'fa-tags', route: '/stock/classification' },
    { label: 'Valorisation', icon: 'fa-coins', route: '/stock/valorisation', roles: ['GESTIONNAIRE_STOCK', 'COMPTABLE', 'DIRECTEUR_GENERAL', 'ADMIN'] },
    { label: 'Notifications', icon: 'fa-bell', route: '/stock/notifications' },
    { label: 'Parametres', icon: 'fa-gear', route: '/stock/settings' },
  ];

  // Filtrer les navItems selon le role de l'utilisateur
  filteredNav = computed(() => {
    const u = this.currentUser();
    if (!u) return this.navItems;
    const isAdmin = u.roles.includes('ADMIN');
    if (isAdmin) return this.navItems;
    return this.navItems.filter(item => {
      if (!item.roles) return true;
      return u.roles.some(r => item.roles!.includes(r));
    });
  });

  ngOnInit() {
    setInterval(() => this.currentTime.set(new Date()), 30000);
    if (window.innerWidth < 768) this.sidebarOpen.set(false);
    this.alertBadge.startPolling(30000);
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
      const cur = this.navItems.find(n => this.router.url.startsWith(n.route));
      if (cur) this.currentPageTitle.set(cur.label);
      if (window.innerWidth < 768) this.mobileOpen.set(false);
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
}