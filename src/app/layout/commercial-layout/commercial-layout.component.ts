import { Component, OnInit, signal, inject, HostListener, computed } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { filter } from 'rxjs/operators';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { AuthService } from '../../core/auth/auth.service';
import { AlertBadgeService } from '../../core/services/alert-badge.service';
import { ThemeService } from '../../core/services/theme.service';
registerLocaleData(localeFr);

interface NavItem { label: string; icon: string; route: string; badge?: number; badgeClass?: string; }

@Component({
  selector: 'app-commercial-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, DatePipe],
  templateUrl: './commercial-layout.component.html',
  styleUrls: ['../stock-layout/stock-layout.component.css']
})
export class CommercialLayoutComponent implements OnInit {
  router = inject(Router);
  authService = inject(AuthService);
  alertBadge = inject(AlertBadgeService);
  readonly theme = inject(ThemeService);
  sidebarOpen = signal(true);
  mobileOpen = signal(false);
  currentTime = signal(new Date());
  currentPageTitle = signal('Précommandes');
  alertCount = this.alertBadge.totalCount;

  currentUser = computed(() => this.authService.getCurrentUser());
  userInitials = computed(() => {
    const u = this.currentUser();
    if (!u) return '??';
    return ((u.firstname?.[0] || '') + (u.lastname?.[0] || '')).toUpperCase();
  });
  userShortName = computed(() => {
    const u = this.currentUser();
    if (!u) return 'Utilisateur';
    return `${u.firstname} ${u.lastname?.[0]}.`;
  });

  // Prospects retiré : hors périmètre depuis le 16/08. Dotations retiré : la
  // route n'existe pas dans commercial.routes.ts — l'entrée menait nulle part.
  navItems: NavItem[] = [
    { label: 'Précommandes J+1', icon: 'fa-cart-plus', route: '/commercial/precommandes' },
    { label: 'Ventes', icon: 'fa-cash-register', route: '/commercial/ventes' },
    { label: 'Carburant', icon: 'fa-gas-pump', route: '/commercial/carburant' },
    { label: 'Recouvrement', icon: 'fa-hand-holding-dollar', route: '/commercial/recouvrement' },
    { label: 'Versements', icon: 'fa-money-bill-wave', route: '/commercial/versements' },
    { label: 'Classement & Primes', icon: 'fa-ranking-star', route: '/commercial/classement' },
    { label: 'Fiche Synthèse', icon: 'fa-file-lines', route: '/commercial/fiche-synthese' },
  ];

  ngOnInit() {
    setInterval(() => this.currentTime.set(new Date()), 30000);
    if (window.innerWidth < 1024) this.sidebarOpen.set(false);
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
    if (w < 1024) { this.sidebarOpen.set(false); } else { this.mobileOpen.set(false); }
  }
  toggleSidebar() { if (window.innerWidth < 768) this.mobileOpen.update(v => !v); else this.sidebarOpen.update(v => !v); }
  closeMobile() { this.mobileOpen.set(false); }

  logout() {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }
}
