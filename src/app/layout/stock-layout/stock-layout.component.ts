import { Component, OnInit, signal, inject, HostListener } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { filter } from 'rxjs/operators';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
registerLocaleData(localeFr);
interface NavItem { label: string; icon: string; route: string; badge?: number; badgeClass?: string; }

@Component({
  selector: 'app-stock-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, DatePipe],
  templateUrl: './stock-layout.component.html',
  styleUrls: ['./stock-layout.component.css']
})
export class StockLayoutComponent implements OnInit {
  router = inject(Router);
  sidebarOpen = signal(true);
  mobileOpen = signal(false);
  currentTime = signal(new Date());
  currentPageTitle = signal('Tableau de Bord');
  alertCount = signal(4);

  navItems: NavItem[] = [
    { label: 'Tableau de Bord', icon: 'fa-chart-pie', route: '/stock/dashboard' },
    { label: 'Réceptions Fournisseurs', icon: 'fa-truck-ramp-box', route: '/stock/reception', badge: 2, badgeClass: 'bd-orange' },
    { label: 'Validation Entrées', icon: 'fa-clipboard-check', route: '/stock/validation', badge: 2, badgeClass: 'bd-red' },
    { label: 'Lots de Production', icon: 'fa-industry', route: '/stock/production', badge: 2, badgeClass: 'bd-orange' },
    { label: 'Commandes Production', icon: 'fa-cart-plus', route: '/stock/orders' },
    { label: 'Inventaire Stock', icon: 'fa-boxes-stacked', route: '/stock/inventaire' },
    { label: 'Mouvements Stock', icon: 'fa-right-left', route: '/stock/mouvements' },
    { label: 'Session du Jour', icon: 'fa-calendar-check', route: '/stock/session' },
    { label: 'Module Commercial', icon: 'fa-users', route: '/stock/commercial' },
    { label: 'Alertes & Seuils', icon: 'fa-triangle-exclamation', route: '/stock/alertes', badge: 4, badgeClass: 'bd-red' },
    { label: 'Notifications', icon: 'fa-bell', route: '/stock/notifications', badge: 2, badgeClass: 'bd-neutral' },
    { label: 'Paramètres', icon: 'fa-gear', route: '/stock/settings' },
  ];

  ngOnInit() {
    setInterval(() => this.currentTime.set(new Date()), 30000);
    if (window.innerWidth < 768) this.sidebarOpen.set(false);
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
}
