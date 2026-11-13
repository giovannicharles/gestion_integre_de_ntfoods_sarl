import { Component, OnInit, signal, computed, inject, HostListener, ViewChild } from '@angular/core';
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
import { CommercialService } from '../../domains/commercial/infrastructure/commercial.service';
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
  selector: 'app-comptable-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, DatePipe, NotificationCenterComponent, SidebarSearchComponent, HeaderSearchComponent, SignalerIncidentComponent, CommandPaletteComponent, ConfirmDialogComponent],
  templateUrl: './comptable-layout.component.html',
  styleUrls: ['../stock-layout/stock-layout.component.css']
})
export class ComptableLayoutComponent implements OnInit {
  router = inject(Router);
  alertBadge = inject(AlertBadgeService);
  readonly theme = inject(ThemeService);
  private readonly authService = inject(AuthService);
  private readonly commercialService = inject(CommercialService);
  private readonly clock = inject(ClockService);

  sidebarOpen = signal(true);
  mobileOpen = signal(false);
  currentTime = this.clock.now;
  currentPageTitle = signal('Tableau de Bord');
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
    { label: 'Tableau de Bord', icon: 'fa-chart-pie', route: '/comptable/dashboard' },
    { label: 'Mes validations', icon: 'fa-clipboard-check', route: '/comptable/validations' },
  ];

  /** Regroupement par thème (2026-11-09, même motif que DG) : la liste plate de 13 items est
   * remplacée par 4 groupes dépliables, plus lisible qu'une longue colonne sans hiérarchie. */
  navGroups: NavGroup[] = [
    {
      label: 'Validations & Facturation', icon: 'fa-file-invoice', children: [
        { label: 'Validation Commandes', icon: 'fa-clipboard-check', route: '/comptable/commandes' },
        { label: 'Facturation', icon: 'fa-file-invoice', route: '/comptable/factures' },
        // 2026-11-10 (demande explicite du porteur) : suivi des matières premières, symétrique
        // à l'écran consommables du Contrôleur Général.
        { label: 'Matières Premières', icon: 'fa-wheat-awn', route: '/comptable/matieres-premieres' },
      ]
    },
    {
      label: 'Caisse & Tournées', icon: 'fa-cash-register', children: [
        { label: 'Caisse', icon: 'fa-cash-register', route: '/comptable/caisse' },
        { label: 'Fins de Tournée', icon: 'fa-route', route: '/comptable/sessions' },
        { label: 'Recouvrement', icon: 'fa-hand-holding-dollar', route: '/comptable/recouvrement' },
      ]
    },
    {
      label: 'Pilotage Commercial', icon: 'fa-bullseye', children: [
        { label: 'Objectifs', icon: 'fa-bullseye', route: '/comptable/objectifs' },
        { label: 'Primes', icon: 'fa-money-bill-trend-up', route: '/comptable/primes' },
        { label: 'Zones de Vente', icon: 'fa-draw-polygon', route: '/comptable/zones' },
        { label: 'Commandes clients', icon: 'fa-cart-shopping', route: '/comptable/commandes-clients' },
      ]
    },
    {
      label: 'Rapports', icon: 'fa-file-export', children: [
        { label: 'Reporting Financier', icon: 'fa-chart-column', route: '/comptable/reporting' },
        { label: 'Rapports', icon: 'fa-file-export', route: '/comptable/rapports' },
      ]
    },
  ];

  /** Recherche sidebar (2026-10-25, demande explicite du porteur), filtre inline léger. */
  sidebarFiltre = signal('');
  navItemsFiltres = computed(() => filtrerNavItems(this.navItems, this.sidebarFiltre()));
  navGroupsFiltres = computed(() => filtrerNavGroupes(this.navGroups, this.sidebarFiltre()));
  rechercheActive = computed(() => this.sidebarFiltre().trim().length > 0);
  expandedGroup = signal<string | null>('Validations & Facturation');
  toggleGroup(label: string): void { this.expandedGroup.update(v => v === label ? null : label); }

  /** Palette de commandes Ctrl+K (2026-11-02, même composant que DG/Admin). */
  @ViewChild('commandPalette') commandPalette?: CommandPaletteComponent;
  commandItems = computed(() => [
    ...this.navItems,
    ...this.navGroups.flatMap(g => g.children.map(c => ({ ...c, groupe: g.label }))),
  ]);

  ngOnInit() {
    if (window.innerWidth <= 1024) this.sidebarOpen.set(false);
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
      const allItems = [...this.navItems, ...this.navGroups.flatMap(g => g.children)];
      const cur = allItems.find(n => this.router.url.startsWith(n.route));
      if (cur) this.currentPageTitle.set(cur.label);
      if (window.innerWidth <= 1024) this.mobileOpen.set(false);
    });
    this.commercialService.getPrecommandesAValiderComptable().subscribe({
      next: page => {
        const n = page.contenu.filter(p => p.statut === 'VALIDEE_SECRETAIRE').length;
        const item = this.navGroups.flatMap(g => g.children).find(x => x.route === '/comptable/commandes');
        if (item) { item.badge = n; item.badgeClass = 'bd-orange'; }
      },
      error: () => {},
    });
  }

  @HostListener('window:resize', ['$event'])
  onResize(e: Event) {
    const w = (e.target as Window).innerWidth;
    if (w <= 1024) { this.sidebarOpen.set(false); } else { this.mobileOpen.set(false); this.sidebarOpen.set(true); }
  }
  toggleSidebar() { if (window.innerWidth <= 1024) this.mobileOpen.update(v => !v); else this.sidebarOpen.update(v => !v); }
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

