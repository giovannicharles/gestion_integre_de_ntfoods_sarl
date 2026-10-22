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
import { DgService } from '../../domains/dg/infrastructure/dg.service';
import { ComptableService } from '../../domains/comptable/infrastructure/comptable.service';
import { NotificationCenterComponent } from '../../shared/notification-center/notification-center.component';
registerLocaleData(localeFr);
interface NavItem { label: string; icon: string; route: string; badge?: number; badgeClass?: string; }
interface NavGroup { label: string; icon: string; children: NavItem[]; }

@Component({
  selector: 'app-dg-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, DatePipe, NotificationCenterComponent],
  templateUrl: './dg-layout.component.html',
  styleUrls: ['../stock-layout/stock-layout.component.css']
})
export class DgLayoutComponent implements OnInit {
  router = inject(Router);
  alertBadge = inject(AlertBadgeService);
  readonly theme = inject(ThemeService);
  private readonly authService = inject(AuthService);
  private readonly dgService = inject(DgService);
  private readonly cptSvc = inject(ComptableService);
  private readonly clock = inject(ClockService);

  sidebarOpen = signal(true);
  mobileOpen = signal(false);
  currentTime = this.clock.now;
  currentPageTitle = signal('Tableau de Bord DG');
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
    { label: 'Tableau de Bord', icon: 'fa-chart-line', route: '/dg/dashboard' },
    { label: 'Vue Consolidée', icon: 'fa-gauge-high', route: '/dg/supervision' },
    { label: 'Mes validations', icon: 'fa-clipboard-check', route: '/dg/validations' },
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
        { label: 'Arbitrage Prix', icon: 'fa-scale-balanced', route: '/dg/arbitrage' },
        { label: 'Promotions', icon: 'fa-tags', route: '/dg/promotions' },
        { label: 'Tarification', icon: 'fa-money-check-dollar', route: '/dg/tarification' },
        { label: 'Zones de Vente', icon: 'fa-draw-polygon', route: '/dg/zones' },
      ]
    },
    {
      label: 'Financier', icon: 'fa-coins', children: [
        { label: 'Décaissements', icon: 'fa-money-bill-transfer', route: '/dg/decaissements' },
        { label: 'Reporting N / N-1', icon: 'fa-chart-column', route: '/dg/reporting' },
      ]
    },
    // Révisé (confidentialité des modules, demande explicite du porteur) : ce lien pointait
    // vers /stock/dashboard, l'écran de TRAVAIL du Gestionnaire de Stock (StockLayoutComponent).
    // Le DG ne doit jamais atterrir dans un espace opérationnel d'un autre module, même avec un
    // accès complet par ailleurs : il consulte une synthèse en lecture seule, il ne saisit pas de
    // réception ni de lot. /dg/supervision agrège déjà financier + production + stock en lecture
    // seule (DgSupervisionComponent, DashboardStockDgBE) : c'est la bonne destination, pas une
    // nouvelle page à créer.
    {
      label: 'Stock & Production', icon: 'fa-warehouse', children: [
        { label: 'Synthèse Stock & Production', icon: 'fa-warehouse', route: '/dg/supervision' },
        { label: 'Seuils de réapprovisionnement', icon: 'fa-gauge-high', route: '/dg/seuils' },
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
    { label: 'Incidents', icon: 'fa-triangle-exclamation', route: '/dg/incidents' },
    { label: 'Pouvoirs & délégations', icon: 'fa-user-shield', route: '/dg/pouvoirs' },
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
    if (window.innerWidth < 1024) this.sidebarOpen.set(false);
    this.alertBadge.startPolling(30000);
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
      const allItems = [...this.navItems, ...this.adminItems, ...this.navGroups.flatMap(g => g.children)];
      const cur = allItems.find(n => this.router.url.startsWith(n.route));
      if (cur) this.currentPageTitle.set(cur.label);
      if (window.innerWidth < 768) this.mobileOpen.set(false);
    });

    this.dgService.getValidationsEnAttente().subscribe({
      next: v => this.setBadge('/dg/arbitrage', v.length, 'bd-orange'),
      error: () => {},
    });
    this.cptSvc.getDecaissements().subscribe({
      next: d => this.setBadge(
        '/dg/decaissements',
        d.filter(x => x.statut === 'PROPOSE' || x.statut === 'VALIDEE_CG').length,
        'bd-red'
      ),
      error: () => {},
    });
  }

  private setBadge(route: string, count: number, badgeClass: string): void {
    const item = this.navGroups.flatMap(g => g.children).find(n => n.route === route);
    if (item) { item.badge = count; item.badgeClass = badgeClass; }
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
