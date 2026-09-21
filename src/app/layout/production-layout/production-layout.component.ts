import { Component, OnInit, signal, inject, HostListener, computed, OnDestroy } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { filter } from 'rxjs/operators';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { AuthService } from '../../core/auth/auth.service';
import { ApiService } from '../../core/http/api.service';
import { Subject, takeUntil } from 'rxjs';

registerLocaleData(localeFr);

interface NavItem { label: string; icon: string; route: string; badge?: number; badgeClass?: string; }

@Component({
  selector: 'app-production-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, DatePipe],
  templateUrl: './production-layout.component.html',
  styleUrls: ['../../layout/stock-layout/stock-layout.component.css']
})
export class ProductionLayoutComponent implements OnInit, OnDestroy {
  router = inject(Router);
  authService = inject(AuthService);
  private api = inject(ApiService);
  private destroy$ = new Subject<void>();
  sidebarOpen = signal(true);
  mobileOpen = signal(false);
  currentTime = signal(new Date());
  currentPageTitle = signal('Tableau de Bord');
  alertCount = signal(0);
  pendingLotsCount = signal(0);

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
      'CHEF_PRODUCTION': 'Chef de Production',
      'AGENT_PRODUCTION': 'Agent de Production',
      'CHEF_MACHINISTE': 'Chef Machiniste',
      'MACHINISTE': 'Machiniste',
      'AGENT_DOSEUR': 'Agent Doseur',
      'ADMIN': 'Administrateur',
    };
    const r = u.roles?.[0] || '';
    return roleMap[r] || r;
  });

  private baseNavItems: NavItem[] = [
    { label: 'Tableau de Bord', icon: 'fa-chart-pie', route: '/production/dashboard' },
    { label: 'Plan de Production', icon: 'fa-calendar-week', route: '/production/plan' },
    { label: 'Saisie Journalière', icon: 'fa-pen-to-square', route: '/production/saisie' },
    { label: 'Lots & Conversion', icon: 'fa-industry', route: '/production/lots' },
    { label: 'Registre Employés', icon: 'fa-users', route: '/production/employes' },
  ];

  filteredNav = computed(() => {
    return this.baseNavItems.map(item => {
      const badge = this.getBadgeForRoute(item.route);
      return badge > 0 ? { ...item, badge, badgeClass: 'bd-orange' } : item;
    });
  });

  private getBadgeForRoute(route: string): number {
    switch (route) {
      case '/production/lots': return this.pendingLotsCount();
      default: return 0;
    }
  }

  ngOnInit() {
    setInterval(() => this.currentTime.set(new Date()), 30000);
    if (window.innerWidth < 1024) this.sidebarOpen.set(false);
    this.loadPendingLots();
    setInterval(() => this.loadPendingLots(), 30000);
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
      const cur = this.baseNavItems.find(n => this.router.url.startsWith(n.route));
      if (cur) this.currentPageTitle.set(cur.label);
      if (window.innerWidth < 768) this.mobileOpen.set(false);
    });
  }

  private loadPendingLots() {
    this.api.get<any[]>('v1/stock/production/batches/pending')
      .pipe(takeUntil(this.destroy$))
      .subscribe({ next: (data) => this.pendingLotsCount.set(data?.length || 0), error: () => {} });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('window:resize', ['$event'])
  onResize(e: Event) {
    const w = (e.target as Window).innerWidth;
    if (w < 1024) { this.sidebarOpen.set(false); } else { this.mobileOpen.set(false); }
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
