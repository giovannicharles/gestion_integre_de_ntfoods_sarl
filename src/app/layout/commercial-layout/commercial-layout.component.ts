import { Component, OnInit, signal, inject, HostListener, computed, ViewChild } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { filter } from 'rxjs/operators';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { AuthService } from '../../core/auth/auth.service';
import { AlertBadgeService } from '../../core/services/alert-badge.service';
import { ThemeService } from '../../core/services/theme.service';
import { ClockService } from '../../core/services/clock.service';
import { NotificationCenterComponent } from '../../shared/notification-center/notification-center.component';
import { SidebarSearchComponent } from '../../shared/sidebar-search/sidebar-search.component';
import { HeaderSearchComponent } from '../../shared/header-search/header-search.component';
import { SignalerIncidentComponent } from '../../shared/signaler-incident/signaler-incident.component';
import { CommandPaletteComponent } from '../../shared/command-palette/command-palette.component';
import { filtrerNavItems, filtrerNavGroupes } from '../../shared/utils/nav-filter.util';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { TantybotComponent } from '../../shared/components/tantybot/tantybot.component';
registerLocaleData(localeFr);

interface NavItem { label: string; icon: string; route: string; badge?: number; badgeClass?: string; }
interface NavGroup { label: string; icon: string; children: NavItem[]; }

@Component({
  selector: 'app-commercial-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, DatePipe, NotificationCenterComponent, SidebarSearchComponent, HeaderSearchComponent, SignalerIncidentComponent, CommandPaletteComponent, ConfirmDialogComponent, TantybotComponent],
  templateUrl: './commercial-layout.component.html',
  styleUrls: ['../stock-layout/stock-layout.component.css']
})
export class CommercialLayoutComponent implements OnInit {
  router = inject(Router);
  authService = inject(AuthService);
  alertBadge = inject(AlertBadgeService);
  readonly theme = inject(ThemeService);
  private readonly clock = inject(ClockService);
  sidebarOpen = signal(true);
  mobileOpen = signal(false);
  currentTime = this.clock.now;
  currentPageTitle = signal('Précommandes');
  alertCount = this.alertBadge.totalCount;
  userPhoto = signal<string | null>(null);

  currentUser = computed(() => this.authService.getCurrentUser());
  userInitials = computed(() => {
    const u = this.currentUser();
    if (!u) return '??';
    return ((u.firstname?.[0] || '') + (u.lastname?.[0] || '')).toUpperCase();
  });
  userShortName = computed(() => {
    const u = this.currentUser();
    if (!u) return 'Utilisateur';
    return `${u.firstname} ${u.lastname?.[0]}.`;
  });

  // Prospects retiré : hors périmètre depuis le 16/08. Dotations retiré : la
  // route n'existe pas dans commercial.routes.ts, l'entrée menait nulle part.
  navItems: NavItem[] = [
    { label: 'Précommandes J+1', icon: 'fa-cart-plus', route: '/commercial/precommandes' },
  ];

  /** Regroupement par thème (2026-11-09, même motif que DG/Comptable/RP/Secrétaire). */
  navGroups: NavGroup[] = [
    {
      label: 'Terrain', icon: 'fa-cash-register', children: [
        { label: 'Ventes', icon: 'fa-cash-register', route: '/commercial/ventes' },
        { label: 'Commandes WhatsApp & Directes', icon: 'fa-cart-shopping', route: '/commercial/commandes-clients' },
        { label: 'Carburant', icon: 'fa-gas-pump', route: '/commercial/carburant' },
      ]
    },
    {
      label: 'Finance Commerciale', icon: 'fa-hand-holding-dollar', children: [
        { label: 'Recouvrement', icon: 'fa-hand-holding-dollar', route: '/commercial/recouvrement' },
        { label: 'Versements', icon: 'fa-money-bill-wave', route: '/commercial/versements' },
        { label: 'Classement & Primes', icon: 'fa-ranking-star', route: '/commercial/classement' },
        { label: 'Fiche Synthèse', icon: 'fa-file-lines', route: '/commercial/fiche-synthese' },
      ]
    },
    {
      label: 'Pilotage & Outils', icon: 'fa-chart-pie', children: [
        { label: 'Documents & Catalogues', icon: 'fa-folder-open', route: '/commercial/documents' },
        { label: 'Grille Tarifaire', icon: 'fa-tags', route: '/commercial/tarification' },
        { label: 'Zones de Vente', icon: 'fa-map-location-dot', route: '/commercial/zones' },
        { label: 'Rapports de Tournée', icon: 'fa-clipboard-list', route: '/commercial/reporting' },
        { label: 'Statistiques & Ventes', icon: 'fa-chart-column', route: '/commercial/statistiques' },
        { label: 'Assistant Vente & Marge', icon: 'fa-calculator', route: '/commercial/assistant' },
      ]
    },
  ];

  /** Recherche sidebar (2026-10-25, demande explicite du porteur), filtre inline léger. */
  sidebarFiltre = signal('');
  navItemsFiltres = computed(() => filtrerNavItems(this.navItems, this.sidebarFiltre()));
  navGroupsFiltres = computed(() => filtrerNavGroupes(this.navGroups, this.sidebarFiltre()));
  rechercheActive = computed(() => this.sidebarFiltre().trim().length > 0);
  expandedGroup = signal<string | null>('Terrain');
  toggleGroup(label: string): void { this.expandedGroup.update(v => v === label ? null : label); }

  @ViewChild('commandPalette') commandPalette?: CommandPaletteComponent;
  commandItems = computed(() => [
    ...this.navItems,
    ...this.navGroups.flatMap(g => g.children.map(c => ({ ...c, groupe: g.label }))),
  ]);

  ngOnInit() {
    if (typeof window !== 'undefined') {
      this.userPhoto.set(localStorage.getItem('tanty_user_photo'));
      window.addEventListener('tanty_profile_photo_updated', (e: any) => {
        this.userPhoto.set(e.detail || null);
      });
    }
    if (window.innerWidth <= 1024) this.sidebarOpen.set(false);
    this.alertBadge.startPolling(30000);
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
      const allItems = [...this.navItems, ...this.navGroups.flatMap(g => g.children)];
      const cur = allItems.find(n => this.router.url.startsWith(n.route));
      if (cur) this.currentPageTitle.set(cur.label);
      if (window.innerWidth <= 1024) this.mobileOpen.set(false);
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
  logout() { this.showLogoutConfirm.set(true); }
  confirmerLogout(): void {
    this.showLogoutConfirm.set(false);
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }
}

