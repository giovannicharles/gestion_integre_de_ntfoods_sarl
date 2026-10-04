import { Component, OnInit, signal, inject, HostListener } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { filter } from 'rxjs/operators';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { AlertBadgeService } from '../../core/services/alert-badge.service';
import { ThemeService } from '../../core/services/theme.service';
registerLocaleData(localeFr);
interface NavItem { label: string; icon: string; route: string; badge?: number; badgeClass?: string; }

@Component({
  selector: 'app-comptable-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, DatePipe],
  templateUrl: './comptable-layout.component.html',
  styleUrls: ['../stock-layout/stock-layout.component.css']
})
export class ComptableLayoutComponent implements OnInit {
  router = inject(Router);
  alertBadge = inject(AlertBadgeService);
  readonly theme = inject(ThemeService);
  sidebarOpen = signal(true);
  mobileOpen = signal(false);
  currentTime = signal(new Date());
  currentPageTitle = signal('Tableau de Bord');
  alertCount = this.alertBadge.totalCount;
  criticalCount = this.alertBadge.criticalCount;

  navItems: NavItem[] = [
    { label: 'Tableau de Bord', icon: 'fa-chart-pie', route: '/comptable/dashboard' },
    { label: 'Mes validations', icon: 'fa-clipboard-check', route: '/validations' },
    { label: 'Validation Commandes', icon: 'fa-clipboard-check', route: '/comptable/commandes', badge: 4, badgeClass: 'bd-orange' },
    { label: 'Facturation', icon: 'fa-file-invoice', route: '/comptable/factures' },
    { label: 'Caisse', icon: 'fa-cash-register', route: '/comptable/caisse' },
    { label: 'Fins de Tournée', icon: 'fa-route', route: '/comptable/sessions' },
    { label: 'Recouvrement', icon: 'fa-hand-holding-dollar', route: '/comptable/recouvrement' },
    { label: 'Reporting Financier', icon: 'fa-chart-column', route: '/comptable/reporting' },
    { label: 'Objectifs', icon: 'fa-bullseye', route: '/comptable/objectifs' },
    { label: 'Primes', icon: 'fa-money-bill-trend-up', route: '/comptable/primes' },
    { label: 'Rapports', icon: 'fa-file-export', route: '/comptable/rapports' },
    { label: 'Zones de Vente', icon: 'fa-draw-polygon', route: '/comptable/zones' },
  ];

  ngOnInit() {
    setInterval(() => this.currentTime.set(new Date()), 30000);
    if (window.innerWidth < 1024) this.sidebarOpen.set(false);
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
}
