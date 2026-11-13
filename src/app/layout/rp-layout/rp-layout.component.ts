import { Component, OnInit, signal, computed, inject, HostListener, ViewChild } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { filter } from 'rxjs/operators';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { ThemeService } from '../../core/services/theme.service';
import { ClockService } from '../../core/services/clock.service';
import { AuthService } from '../../core/auth/auth.service';
import { ROLE_LABELS } from '../../core/models/user.models';
import { RpService } from '../../domains/rp/infrastructure/rp.service';
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
  selector: 'app-rp-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, DatePipe, NotificationCenterComponent, SidebarSearchComponent, HeaderSearchComponent, SignalerIncidentComponent, CommandPaletteComponent, ConfirmDialogComponent],
  templateUrl: './rp-layout.component.html',
  styleUrls: ['../stock-layout/stock-layout.component.css']
})
export class RpLayoutComponent implements OnInit {
  router = inject(Router);
  readonly theme = inject(ThemeService);
  private readonly authService = inject(AuthService);
  private readonly rpService = inject(RpService);
  private readonly clock = inject(ClockService);

  sidebarOpen = signal(true);
  mobileOpen = signal(false);
  currentTime = this.clock.now;
  currentPageTitle = signal('Tableau de Bord RP');
  /** Relances grands comptes dues, comptées en direct, pas une valeur figée. */
  alertCount = signal(0);

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
    { label: 'Tableau de Bord', icon: 'fa-chart-pie', route: '/rp/dashboard' },
    { label: 'Assistant Négociation', icon: 'fa-headset', route: '/rp/assistant' },
  ];

  /** Regroupement par thème enrichi pour la Direction RP & Commerciale. */
  navGroups: NavGroup[] = [
    {
      label: 'Analyses & Reporting', icon: 'fa-chart-line', children: [
        { label: 'Reporting Campagnes', icon: 'fa-bullhorn', route: '/rp/reporting' },
        { label: 'Statistiques Marché', icon: 'fa-chart-pie', route: '/rp/statistiques' },
        { label: 'Classement & Primes', icon: 'fa-ranking-star', route: '/rp/classement' },
        { label: 'Objectifs Vente', icon: 'fa-bullseye', route: '/rp/objectifs' },
      ]
    },
    {
      label: 'Grands Comptes & Partenaires', icon: 'fa-handshake', children: [
        { label: 'Grands Comptes VIP', icon: 'fa-building', route: '/rp/grands-comptes' },
        { label: 'Documents & Contrats', icon: 'fa-folder-open', route: '/rp/documents' },
        { label: 'Commandes VIP & WhatsApp', icon: 'fa-cart-shopping', route: '/rp/commandes-clients' },
      ]
    },
    {
      label: 'Territoire & Tarification', icon: 'fa-map-location-dot', children: [
        { label: 'Zones & Marchés', icon: 'fa-map-location-dot', route: '/rp/zones' },
        { label: 'Découpage Zones', icon: 'fa-draw-polygon', route: '/rp/zones-admin' },
        { label: 'Promotions GMS', icon: 'fa-tags', route: '/rp/promotions' },
        { label: 'Grille Tarifaire', icon: 'fa-money-check-dollar', route: '/rp/tarification' },
      ]
    },
  ];

  /** Recherche sidebar (2026-10-25, demande explicite du porteur), filtre inline léger. */
  sidebarFiltre = signal('');
  navItemsFiltres = computed(() => filtrerNavItems(this.navItems, this.sidebarFiltre()));
  navGroupsFiltres = computed(() => filtrerNavGroupes(this.navGroups, this.sidebarFiltre()));
  rechercheActive = computed(() => this.sidebarFiltre().trim().length > 0);
  expandedGroup = signal<string | null>('Analyses & Reporting');
  toggleGroup(label: string): void { this.expandedGroup.update(v => v === label ? null : label); }

  /** Palette de commandes Ctrl+K (2026-11-02, même composant que DG/Admin/Comptable). */
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
    this.rafraichirBadges();
    setInterval(() => this.rafraichirBadges(), 30000);
  }

  private rafraichirBadges(): void {
    this.rpService.getDashboard().subscribe({
      next: d => {
        this.alertCount.set(d.relancesDues);
        const gc = this.navGroups.flatMap(g => g.children).find(n => n.route === '/rp/grands-comptes');
        if (gc) {
          gc.badge = d.relancesDues > 0 ? d.relancesDues : undefined;
          gc.badgeClass = d.relancesDues > 0 ? 'bd-orange' : undefined;
        }
      },
      error: () => {},
    });
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

