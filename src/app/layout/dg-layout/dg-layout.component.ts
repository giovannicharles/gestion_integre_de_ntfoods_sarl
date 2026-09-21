import { Component, OnInit, signal, inject, HostListener } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { filter } from 'rxjs/operators';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { AlertBadgeService } from '../../core/services/alert-badge.service';
registerLocaleData(localeFr);
interface NavItem { label: string; icon: string; route: string; badge?: number; badgeClass?: string; }
interface NavGroup { label: string; icon: string; children: NavItem[]; }

@Component({
  selector: 'app-dg-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, DatePipe],
  templateUrl: './dg-layout.component.html',
  styleUrls: ['../stock-layout/stock-layout.component.css']
})
export class DgLayoutComponent implements OnInit {
  router = inject(Router);
  alertBadge = inject(AlertBadgeService);
  sidebarOpen = signal(true);
  mobileOpen = signal(false);
  currentTime = signal(new Date());
  currentPageTitle = signal('Tableau de Bord DG');
  alertCount = this.alertBadge.totalCount;
  criticalCount = this.alertBadge.criticalCount;

  navItems: NavItem[] = [
    { label: 'Tableau de Bord', icon: 'fa-chart-line', route: '/dg/dashboard' },
  ];

  navGroups: NavGroup[] = [
    {
      label: 'Intelligence IA', icon: 'fa-brain', children: [
        { label: 'Assistant IA Chat', icon: 'fa-comments', route: '/dg/chat' },
        { label: 'Analyse IA 360°', icon: 'fa-magnifying-glass-chart', route: '/dg/ia-analyse' },
      ]
    },
    {
      label: 'Commercial', icon: 'fa-handshake', children: [
        { label: 'Classement & Primes', icon: 'fa-ranking-star', route: '/dg/classement' },
        { label: 'Objectifs CA', icon: 'fa-bullseye', route: '/dg/objectifs' },
        { label: 'Arbitrage Prix', icon: 'fa-scale-balanced', route: '/dg/arbitrage', badge: 3, badgeClass: 'bd-orange' },
      ]
    },
    {
      label: 'Financier', icon: 'fa-coins', children: [
        { label: 'Décaissements', icon: 'fa-money-bill-transfer', route: '/dg/decaissements', badge: 2, badgeClass: 'bd-red' },
        { label: 'Reporting N / N-1', icon: 'fa-chart-column', route: '/dg/reporting' },
      ]
    },
    {
      label: 'Stock & Production', icon: 'fa-warehouse', children: [
        { label: 'Stock Central', icon: 'fa-warehouse', route: '/dg/stock-dashboard' },
        { label: 'Inventaire', icon: 'fa-boxes-packing', route: '/dg/inventaire' },
        { label: 'Lots Production', icon: 'fa-industry', route: '/dg/production' },
        { label: 'Seuils Stock', icon: 'fa-ruler', route: '/dg/seuils' },
        { label: 'Alertes', icon: 'fa-triangle-exclamation', route: '/dg/alertes' },
        { label: 'Produits', icon: 'fa-boxes-stacked', route: '/dg/produits' },
        { label: 'Statistiques', icon: 'fa-chart-line', route: '/dg/statistiques' },
      ]
    },
    {
      label: 'Système', icon: 'fa-gears', children: [
        { label: 'Synchronisation', icon: 'fa-rotate', route: '/dg/sync' },
        { label: 'Archivage', icon: 'fa-folder-open', route: '/dg/documents' },
      ]
    },
  ];

  adminItems: NavItem[] = [
    { label: 'Utilisateurs', icon: 'fa-users-gear', route: '/dg/utilisateurs' },
    { label: 'Journal d\'Audit', icon: 'fa-clipboard-list', route: '/dg/audit' },
    { label: 'Paramètres', icon: 'fa-sliders', route: '/dg/parametres' },
  ];

  expandedGroup = signal<string | null>('Intelligence IA');
  showNotifPanel = signal(false);

  ngOnInit() {
    setInterval(() => this.currentTime.set(new Date()), 30000);
    if (window.innerWidth < 1024) this.sidebarOpen.set(false);
    this.alertBadge.startPolling(30000);
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
      const allItems = [...this.navItems, ...this.adminItems, ...this.navGroups.flatMap(g => g.children)];
      const cur = allItems.find(n => this.router.url.startsWith(n.route));
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
  toggleGroup(label: string) { this.expandedGroup.update(v => v === label ? null : label); }
  toggleNotifPanel() { this.showNotifPanel.update(v => !v); }
  closeNotifPanel() { this.showNotifPanel.set(false); }
}
