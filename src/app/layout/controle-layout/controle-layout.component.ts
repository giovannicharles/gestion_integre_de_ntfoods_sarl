import { Component, OnInit, signal, inject, HostListener, computed, ViewChild } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { filter } from 'rxjs/operators';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { AlertBadgeService } from '../../core/services/alert-badge.service';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { ClockService } from '../../core/services/clock.service';
import { ROLE_LABELS } from '../../core/models/user.models';
import { ControleService } from '../../domains/controle/infrastructure/controle.service';
import { ReceiptUseCase } from '../../domains/stock/application/use-cases/reception/receipt.use-case';
import { forkJoin } from 'rxjs';
import { NotificationCenterComponent } from '../../shared/notification-center/notification-center.component';
import { SidebarSearchComponent } from '../../shared/sidebar-search/sidebar-search.component';
import { HeaderSearchComponent } from '../../shared/header-search/header-search.component';
import { SignalerIncidentComponent } from '../../shared/signaler-incident/signaler-incident.component';
import { CommandPaletteComponent } from '../../shared/command-palette/command-palette.component';
import { filtrerNavItems, filtrerNavGroupes } from '../../shared/utils/nav-filter.util';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
registerLocaleData(localeFr);
interface NavItem { label: string; icon: string; route: string; badge?: number; badgeClass?: string; }
interface NavGroup { label: string; icon: string; children: NavItem[]; }

@Component({
  selector: 'app-controle-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, DatePipe, NotificationCenterComponent, SidebarSearchComponent, HeaderSearchComponent, SignalerIncidentComponent, CommandPaletteComponent, ConfirmDialogComponent],
  templateUrl: './controle-layout.component.html',
  styleUrls: ['../stock-layout/stock-layout.component.css']
})
export class ControleLayoutComponent implements OnInit {
  router = inject(Router);
  alertBadge = inject(AlertBadgeService);
  authService = inject(AuthService);
  readonly theme = inject(ThemeService);
  private readonly clock = inject(ClockService);
  private readonly controleSvc = inject(ControleService);
  private readonly receiptUc = inject(ReceiptUseCase);
  sidebarOpen = signal(true);
  mobileOpen = signal(false);
  currentTime = this.clock.now;
  currentPageTitle = signal('Tableau de Bord Contrôle');
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
    { label: 'Tableau de Bord', icon: 'fa-magnifying-glass-chart', route: '/controle/dashboard' },
    { label: 'Mes validations', icon: 'fa-clipboard-check', route: '/controle/validations' },
  ];

  /** Regroupement par thème (2026-11-09, même motif que DG/Comptable/RP/Secrétaire/Commercial). */
  navGroups: NavGroup[] = [
    {
      label: 'Stock & Réceptions', icon: 'fa-boxes-packing', children: [
        { label: 'Suivi Consommables', icon: 'fa-boxes-packing', route: '/controle/consommables' },
        { label: 'Valorisation Stock', icon: 'fa-boxes-stacked', route: '/controle/valorisation' },
      ]
    },
    {
      label: 'Finance', icon: 'fa-money-check-dollar', children: [
        { label: 'Décaissements', icon: 'fa-money-check-dollar', route: '/controle/decaissements' },
        { label: 'Ventes à Crédit', icon: 'fa-hand-holding-dollar', route: '/controle/credits' },
        { label: 'Budget & Achats', icon: 'fa-file-invoice-dollar', route: '/controle/budget' },
      ]
    },
    {
      label: 'Coûts & Marges', icon: 'fa-chart-line', children: [
        { label: 'Marges & Coûts', icon: 'fa-chart-line', route: '/controle/marges' },
        { label: 'Variances Coûts', icon: 'fa-scale-unbalanced', route: '/controle/variances' },
      ]
    },
    {
      label: 'Audit & Commandes', icon: 'fa-fingerprint', children: [
        { label: 'Piste d\'Audit', icon: 'fa-fingerprint', route: '/controle/audit' },
        { label: 'Commandes clients', icon: 'fa-cart-shopping', route: '/controle/commandes-clients' },
      ]
    },
    {
      label: 'Études & Directives', icon: 'fa-folder-tree', children: [
        { label: 'Cadrage & Procédures', icon: 'fa-folder-tree', route: '/controle/documents' },
        { label: 'Reporting & Budgets', icon: 'fa-chart-line', route: '/controle/reporting' },
        { label: 'Calculateur Point Mort', icon: 'fa-calculator', route: '/controle/assistant' },
      ]
    },
  ];

  /** Recherche sidebar (2026-10-25, demande explicite du porteur), filtre inline léger. */
  sidebarFiltre = signal('');
  navItemsFiltres = computed(() => filtrerNavItems(this.navItems, this.sidebarFiltre()));
  navGroupsFiltres = computed(() => filtrerNavGroupes(this.navGroups, this.sidebarFiltre()));
  rechercheActive = computed(() => this.sidebarFiltre().trim().length > 0);
  expandedGroup = signal<string | null>('Stock & Réceptions');
  toggleGroup(label: string): void { this.expandedGroup.update(v => v === label ? null : label); }

  /** Palette de commandes Ctrl+K (2026-11-02, même composant que les autres layouts). */
  @ViewChild('commandPalette') commandPalette?: CommandPaletteComponent;
  commandItems = computed(() => [
    ...this.navItems,
    ...this.navGroups.flatMap(g => g.children.map(c => ({ ...c, groupe: g.label }))),
  ]);

  ngOnInit() {
    if (window.innerWidth <= 1024) this.sidebarOpen.set(false);
    this.alertBadge.startPolling(30000);
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
      const allItems = [...this.navItems, ...this.navGroups.flatMap(g => g.children)];
      const cur = allItems.find(n => this.router.url.startsWith(n.route));
      if (cur) this.currentPageTitle.set(cur.label);
      if (window.innerWidth <= 1024) this.mobileOpen.set(false);
    });

    this.rafraichirBadges();
    setInterval(() => this.rafraichirBadges(), 30000);
  }

  private rafraichirBadges(): void {
    this.controleSvc.getDashboard().subscribe({
      next: d => {
        this.setBadge('/controle/decaissements', d.decaissementsAttente, 'bd-red');
        this.setBadge('/controle/budget', d.budgetDepasse, 'bd-orange');
      },
      error: () => {},
    });

    forkJoin({
      consommable: this.receiptUc.getPendingSecondValidation('CONSOMMABLE'),
      materiel: this.receiptUc.getPendingSecondValidation('MATERIEL'),
    }).subscribe({
      next: r => this.setBadge('/controle/consommables', r.consommable.length + r.materiel.length, 'bd-orange'),
      error: () => {},
    });
  }

  private setBadge(route: string, count: number, badgeClass: string): void {
    const item = this.navGroups.flatMap(g => g.children).find(n => n.route === route);
    if (item) {
      item.badge = count > 0 ? count : undefined;
      item.badgeClass = count > 0 ? badgeClass : undefined;
    }
  }

  @HostListener('window:resize', ['$event'])
  onResize(e: Event) {
    const w = (e.target as Window).innerWidth;
    if (w <= 1024) { this.sidebarOpen.set(false); } else { this.mobileOpen.set(false); this.sidebarOpen.set(true); }
  }

  toggleSidebar() {
    if (window.innerWidth <= 1024) this.mobileOpen.update(v => !v);
    else this.sidebarOpen.update(v => !v);
  }
  closeMobile() { this.mobileOpen.set(false); }

  /** Modal de confirmation réutilisable (2026-11-09, demande explicite du porteur) : remplace
   * le confirm() natif, jamais stylé, par ConfirmDialogComponent (déjà écrit, jamais monté). */
  showLogoutConfirm = signal(false);
  logout(): void { this.showLogoutConfirm.set(true); }
  confirmerLogout(): void {
    this.showLogoutConfirm.set(false);
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }
}

