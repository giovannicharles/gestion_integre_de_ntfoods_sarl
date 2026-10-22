import { Component, OnInit, signal, computed, inject, HostListener } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { filter } from 'rxjs/operators';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { AlertBadgeService } from '../../core/services/alert-badge.service';
import { ClockService } from '../../core/services/clock.service';
import { ThemeService } from '../../core/services/theme.service';
import { AuthService } from '../../core/auth/auth.service';
import { ROLE_LABELS } from '../../core/models/user.models';
import { CommercialService } from '../../domains/commercial/infrastructure/commercial.service';
import { NotificationCenterComponent } from '../../shared/notification-center/notification-center.component';
registerLocaleData(localeFr);
interface NavItem { label: string; icon: string; route: string; badge?: number; badgeClass?: string; }

@Component({
  selector: 'app-comptable-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, DatePipe, NotificationCenterComponent],
  templateUrl: './comptable-layout.component.html',
  styleUrls: ['../stock-layout/stock-layout.component.css']
})
export class ComptableLayoutComponent implements OnInit {
  router = inject(Router);
  alertBadge = inject(AlertBadgeService);
  readonly theme = inject(ThemeService);
  private readonly authService = inject(AuthService);
  private readonly commercialService = inject(CommercialService);
  private readonly clock = inject(ClockService);

  sidebarOpen = signal(true);
  mobileOpen = signal(false);
  currentTime = this.clock.now;
  currentPageTitle = signal('Tableau de Bord');
  alertCount = this.alertBadge.totalCount;
  criticalCount = this.alertBadge.criticalCount;

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
    const r = u.roles?.[0] || '';
    return ROLE_LABELS[r as keyof typeof ROLE_LABELS] || r;
  });

  navItems: NavItem[] = [
    { label: 'Tableau de Bord', icon: 'fa-chart-pie', route: '/comptable/dashboard' },
    { label: 'Mes validations', icon: 'fa-clipboard-check', route: '/comptable/validations' },
    { label: 'Validation Commandes', icon: 'fa-clipboard-check', route: '/comptable/commandes' },
    { label: 'Facturation', icon: 'fa-file-invoice', route: '/comptable/factures' },
    { label: 'Caisse', icon: 'fa-cash-register', route: '/comptable/caisse' },
    { label: 'Fins de Tournée', icon: 'fa-route', route: '/comptable/sessions' },
    { label: 'Recouvrement', icon: 'fa-hand-holding-dollar', route: '/comptable/recouvrement' },
    { label: 'Reporting Financier', icon: 'fa-chart-column', route: '/comptable/reporting' },
    { label: 'Objectifs', icon: 'fa-bullseye', route: '/comptable/objectifs' },
    { label: 'Primes', icon: 'fa-money-bill-trend-up', route: '/comptable/primes' },
    { label: 'Rapports', icon: 'fa-file-export', route: '/comptable/rapports' },
    { label: 'Zones de Vente', icon: 'fa-draw-polygon', route: '/comptable/zones' },
    { label: 'Commandes clients', icon: 'fa-cart-shopping', route: '/comptable/commandes-clients' },
  ];

  ngOnInit() {
    if (window.innerWidth < 1024) this.sidebarOpen.set(false);
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
      const cur = this.navItems.find(n => this.router.url.startsWith(n.route));
      if (cur) this.currentPageTitle.set(cur.label);
      if (window.innerWidth < 768) this.mobileOpen.set(false);
    });
    this.commercialService.getPrecommandesAValiderComptable().subscribe({
      next: page => {
        const n = page.contenu.filter(p => p.statut === 'VALIDEE_SECRETAIRE').length;
        const item = this.navItems.find(x => x.route === '/comptable/commandes');
        if (item) { item.badge = n; item.badgeClass = 'bd-orange'; }
      },
      error: () => {},
    });
  }

  @HostListener('window:resize', ['$event'])
  onResize(e: Event) {
    const w = (e.target as Window).innerWidth;
    if (w < 1024) { this.sidebarOpen.set(false); } else { this.mobileOpen.set(false); }
  }
  toggleSidebar() { if (window.innerWidth < 768) this.mobileOpen.update(v => !v); else this.sidebarOpen.update(v => !v); }
  closeMobile() { this.mobileOpen.set(false); }
}
