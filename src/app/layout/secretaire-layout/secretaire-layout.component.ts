import { Component, OnInit, OnDestroy, signal, computed, inject, HostListener, ViewChild } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { filter } from 'rxjs/operators';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { AuthService } from '../../core/auth/auth.service';
import { ClockService } from '../../core/services/clock.service';
import { ThemeService } from '../../core/services/theme.service';
import { ROLE_LABELS } from '../../core/models/user.models';
import { ComptableService } from '../../domains/comptable/infrastructure/comptable.service';
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
  selector: 'app-secretaire-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, DatePipe, NotificationCenterComponent, SidebarSearchComponent, HeaderSearchComponent, SignalerIncidentComponent, CommandPaletteComponent, ConfirmDialogComponent],
  templateUrl: './secretaire-layout.component.html',
  styleUrls: ['../stock-layout/stock-layout.component.css']
})
export class SecretaireLayoutComponent implements OnInit, OnDestroy {
  router = inject(Router);
  readonly theme = inject(ThemeService);
  private readonly authService = inject(AuthService);
  private readonly cptSvc = inject(ComptableService);
  private readonly comSvc = inject(CommercialService);
  private readonly clock = inject(ClockService);
  private badgeInterval: any = null;

  sidebarOpen = signal(true);
  mobileOpen = signal(false);
  currentTime = this.clock.now;
  currentPageTitle = signal('Tableau de Bord');

  /** Badges dynamiques réactifs actualisés en direct */
  pendingVersementsCount = signal(0);
  pendingDecaissementsCount = signal(0);
  pendingPrecommandesCount = signal(0);
  pendingCommandesClientsCount = signal(0);
  alertCount = signal(0);
  validationBadge = signal(0);

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
    { label: 'Tableau de Bord', icon: 'fa-chart-pie', route: '/secretaire/dashboard' },
  ];

  /** Regroupement réactif avec badges synchronisés */
  navGroups = computed<NavGroup[]>(() => [
    {
      label: 'Opérations', icon: 'fa-cash-register', children: [
        { label: 'Petite caisse & micro-stock', icon: 'fa-cookie-bite', route: '/secretaire/caisse' },
        {
          label: 'Saisie Versements',
          icon: 'fa-cash-register',
          route: '/secretaire/versements',
          badge: this.pendingVersementsCount(),
          badgeClass: 'bd-orange'
        },
        {
          label: 'Validation Décaissements',
          icon: 'fa-clipboard-check',
          route: '/secretaire/validation',
          badge: this.pendingDecaissementsCount(),
          badgeClass: 'bd-red'
        },
      ]
    },
    {
      label: 'Commandes', icon: 'fa-cart-shopping', children: [
        {
          label: 'Commandes J+1 (Tournées)',
          icon: 'fa-cart-plus',
          route: '/secretaire/commandes',
          badge: this.pendingPrecommandesCount(),
          badgeClass: 'bd-orange'
        },
        {
          label: 'Commandes Clients & WhatsApp',
          icon: 'fa-cart-shopping',
          route: '/secretaire/commandes-clients',
          badge: this.pendingCommandesClientsCount(),
          badgeClass: 'bd-gold'
        },
        { label: 'Session du Jour', icon: 'fa-calendar-check', route: '/secretaire/session' },
      ]
    },
    {
      label: 'Gestion Administrative', icon: 'fa-folder-closed', children: [
        { label: 'Courriers & Documents', icon: 'fa-envelopes-bulk', route: '/secretaire/documents' },
        { label: 'Reporting & Caisse', icon: 'fa-receipt', route: '/secretaire/reporting' },
        { label: 'Statistiques & Délais', icon: 'fa-chart-pie', route: '/secretaire/statistiques' },
        { label: 'Assistant Administratif', icon: 'fa-pen-nib', route: '/secretaire/assistant' },
      ]
    },
  ]);

  /** Recherche sidebar, filtre inline */
  sidebarFiltre = signal('');
  navItemsFiltres = computed(() => filtrerNavItems(this.navItems, this.sidebarFiltre()));
  navGroupsFiltres = computed(() => filtrerNavGroupes(this.navGroups(), this.sidebarFiltre()));
  rechercheActive = computed(() => this.sidebarFiltre().trim().length > 0);
  expandedGroup = signal<string | null>('Opérations');
  toggleGroup(label: string): void { this.expandedGroup.update(v => v === label ? null : label); }

  @ViewChild('commandPalette') commandPalette?: CommandPaletteComponent;
  commandItems = computed(() => [
    ...this.navItems,
    ...this.navGroups().flatMap(g => g.children.map(c => ({ ...c, groupe: g.label }))),
  ]);

  ngOnInit() {
    if (window.innerWidth <= 1024) this.sidebarOpen.set(false);
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
      const allItems = [...this.navItems, ...this.navGroups().flatMap(g => g.children)];
      const cur = allItems.find(n => this.router.url.startsWith(n.route));
      if (cur) this.currentPageTitle.set(cur.label);
      if (window.innerWidth <= 1024) this.mobileOpen.set(false);
    });

    this.rafraichirBadges();
    this.badgeInterval = setInterval(() => this.rafraichirBadges(), 30000);
  }

  ngOnDestroy(): void {
    if (this.badgeInterval) {
      clearInterval(this.badgeInterval);
      this.badgeInterval = null;
    }
  }

  rafraichirBadges(): void {
    this.cptSvc.getVersements().subscribe({
      next: versements => {
        const attente = versements.filter(v => v.statut === 'EN_ATTENTE').length;
        this.pendingVersementsCount.set(attente);
        this.alertCount.set(versements.filter(v => v.alerteRouge).length);
      },
      error: () => {},
    });

    this.cptSvc.getDecaissements().subscribe({
      next: d => {
        const n = d.filter(x => x.statut === 'VALIDEE_DG').length;
        this.pendingDecaissementsCount.set(n);
        this.validationBadge.set(n);
      },
      error: () => {},
    });

    this.comSvc.getPrecommandesAValider().subscribe({
      next: page => {
        const n = (page?.contenu ?? []).filter(c => c.statut === 'SOUMISE').length;
        this.pendingPrecommandesCount.set(n);
      },
      error: () => {},
    });

    this.comSvc.getCommandesDistance().subscribe({
      next: list => {
        const n = (list ?? []).filter(c => c.statut === 'RECUE').length;
        this.pendingCommandesClientsCount.set(n);
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

  showLogoutConfirm = signal(false);
  logout(): void { this.showLogoutConfirm.set(true); }
  confirmerLogout(): void {
    this.showLogoutConfirm.set(false);
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }
}

