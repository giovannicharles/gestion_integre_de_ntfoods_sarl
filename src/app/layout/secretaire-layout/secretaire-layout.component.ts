import { Component, OnInit, signal, inject, HostListener } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { filter } from 'rxjs/operators';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
registerLocaleData(localeFr);
interface NavItem { label: string; icon: string; route: string; badge?: number; badgeClass?: string; }

@Component({
  selector: 'app-secretaire-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, DatePipe],
  templateUrl: './secretaire-layout.component.html',
  styleUrls: ['../stock-layout/stock-layout.component.css']
})
export class SecretaireLayoutComponent implements OnInit {
  router = inject(Router);
  sidebarOpen = signal(true);
  mobileOpen = signal(false);
  currentTime = signal(new Date());
  currentPageTitle = signal('Tableau de Bord');
  alertCount = signal(5);

  navItems: NavItem[] = [
    { label: 'Tableau de Bord', icon: 'fa-chart-pie', route: '/secretaire/dashboard' },
    { label: 'Saisie Versements', icon: 'fa-cash-register', route: '/secretaire/versements', badge: 3, badgeClass: 'bd-orange' },
    { label: 'Validation', icon: 'fa-clipboard-check', route: '/secretaire/validation', badge: 2, badgeClass: 'bd-red' },
    { label: 'Commandes J+1', icon: 'fa-cart-plus', route: '/secretaire/commandes', badge: 3, badgeClass: 'bd-orange' },
    { label: 'Session du Jour', icon: 'fa-calendar-check', route: '/secretaire/session' },
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
