import { Component, OnInit, signal, inject, HostListener } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { filter } from 'rxjs/operators';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { AlertBadgeService } from '../../core/services/alert-badge.service';
registerLocaleData(localeFr);
interface NavItem { label: string; icon: string; route: string; badge?: number; badgeClass?: string; }

@Component({
  selector: 'app-controle-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, DatePipe],
  templateUrl: './controle-layout.component.html',
  styleUrls: ['../stock-layout/stock-layout.component.css']
})
export class ControleLayoutComponent implements OnInit {
  router = inject(Router);
  alertBadge = inject(AlertBadgeService);
  sidebarOpen = signal(true);
  mobileOpen = signal(false);
  currentTime = signal(new Date());
  currentPageTitle = signal('Tableau de Bord Contrôle');
  alertCount = this.alertBadge.totalCount;
  criticalCount = this.alertBadge.criticalCount;

  navItems: NavItem[] = [
    { label: 'Tableau de Bord', icon: 'fa-magnifying-glass-chart', route: '/controle/dashboard' },
    { label: 'Décaissements', icon: 'fa-money-check-dollar', route: '/controle/decaissements', badge: 2, badgeClass: 'bd-red' },
    { label: 'Ventes à Crédit', icon: 'fa-hand-holding-dollar', route: '/controle/credits' },
    { label: 'Marges & Coûts', icon: 'fa-chart-line', route: '/controle/marges' },
    { label: 'Valorisation Stock', icon: 'fa-boxes-stacked', route: '/controle/valorisation' },
    { label: 'Budget & Achats', icon: 'fa-file-invoice-dollar', route: '/controle/budget', badge: 2, badgeClass: 'bd-orange' },
    { label: 'Piste d\'Audit', icon: 'fa-fingerprint', route: '/controle/audit' },
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

  toggleSidebar() {
    if (window.innerWidth < 768) this.mobileOpen.update(v => !v);
    else this.sidebarOpen.update(v => !v);
  }
  closeMobile() { this.mobileOpen.set(false); }
}
