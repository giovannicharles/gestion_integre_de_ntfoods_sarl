import { Component, OnInit, signal, inject, HostListener } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { filter } from 'rxjs/operators';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { ThemeService } from '../../core/services/theme.service';
registerLocaleData(localeFr);
interface NavItem { label: string; icon: string; route: string; badge?: number; badgeClass?: string; }

@Component({
  selector: 'app-rp-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, DatePipe],
  templateUrl: './rp-layout.component.html',
  styleUrls: ['../stock-layout/stock-layout.component.css']
})
export class RpLayoutComponent implements OnInit {
  router = inject(Router);
  readonly theme = inject(ThemeService);
  sidebarOpen = signal(true);
  mobileOpen = signal(false);
  currentTime = signal(new Date());
  currentPageTitle = signal('Tableau de Bord RP');
  alertCount = signal(3);

  navItems: NavItem[] = [
    { label: 'Tableau de Bord', icon: 'fa-chart-pie', route: '/rp/dashboard' },
    { label: 'Classement & Primes', icon: 'fa-ranking-star', route: '/rp/classement' },
    { label: 'Zones & Marchés', icon: 'fa-map-location-dot', route: '/rp/zones' },
    { label: 'Administration Zones', icon: 'fa-draw-polygon', route: '/rp/zones-admin' },
    { label: 'Objectifs', icon: 'fa-bullseye', route: '/rp/objectifs' },
    { label: 'Promotions', icon: 'fa-tags', route: '/rp/promotions' },
    { label: 'Tarification', icon: 'fa-money-check-dollar', route: '/rp/tarification' },
    { label: 'Grands Comptes', icon: 'fa-handshake', route: '/rp/grands-comptes', badge: 2, badgeClass: 'bd-orange' },
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

  toggleSidebar() {
    if (window.innerWidth < 768) this.mobileOpen.update(v => !v);
    else this.sidebarOpen.update(v => !v);
  }
  closeMobile() { this.mobileOpen.set(false); }
}
