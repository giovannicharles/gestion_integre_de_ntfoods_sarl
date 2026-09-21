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
  readonly theme = inject(ThemeService);
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
        { label: 'Promotions', icon: 'fa-tags', route: '/dg/promotions' },
        { label: 'Tarification', icon: 'fa-money-check-dollar', route: '/dg/tarification' },
        { label: 'Zones de Vente', icon: 'fa-draw-polygon', route: '/dg/zones' },
      ]
    },
    {
      label: 'Financier', icon: 'fa-coins', children: [
        { label: 'Décaissements', icon: 'fa-money-bill-transfer', route: '/dg/decaissements', badge: 2, badgeClass: 'bd-red' },
        { label: 'Reporting N / N-1', icon: 'fa-chart-column', route: '/dg/reporting' },
      ]
    },
    // Les sept écrans de stock que cette version dupliquait sous /dg n'ont pas
    // été repris : le Directeur Général accède déjà au module Stock, dont les
    // routes lui sont ouvertes dans app.routes.ts. Les dupliquer aurait créé un
    // second endroit à maintenir — et, en l'état, sept entrées de menu pointant
    // vers des routes qui n'existent pas.
    {
      label: 'Stock & Production', icon: 'fa-warehouse', children: [
        { label: 'Module Stock', icon: 'fa-warehouse', route: '/stock/dashboard' },
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
    { label: 'Codes observation', icon: 'fa-clipboard-question', route: '/dg/codes-observation' },
    { label: 'Postes production', icon: 'fa-industry', route: '/dg/postes-production' },
    // Barèmes de prime, seuils de caisse, jours ouvrés, seuil de photo d'avarie :
    // les paramétrages datés, que seul le DG administre.
    { label: 'Règles métier', icon: 'fa-scale-balanced', route: '/dg/regles-metier' },
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
