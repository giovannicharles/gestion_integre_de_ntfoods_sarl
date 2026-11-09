import { Component, OnInit, signal, inject, HostListener, computed, ViewChild } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { CommonModule, DatePipe, registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { ClockService } from '../../core/services/clock.service';
import { ROLE_LABELS } from '../../core/models/user.models';
import { NotificationCenterComponent } from '../../shared/notification-center/notification-center.component';
import { SignalerIncidentComponent } from '../../shared/signaler-incident/signaler-incident.component';
import { SidebarSearchComponent } from '../../shared/sidebar-search/sidebar-search.component';
import { HeaderSearchComponent } from '../../shared/header-search/header-search.component';
import { CommandPaletteComponent } from '../../shared/command-palette/command-palette.component';
import { filtrerNavItems, filtrerNavGroupes } from '../../shared/utils/nav-filter.util';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
// 2026-10-16 : seul layout sur les neuf à ne jamais enregistrer les données de
// locale 'fr', la page plantait (NG0701) à chaque rafraîchissement du relogue
// (`date:'...':'':'fr'` ci-dessous), pas seulement au premier rendu.
registerLocaleData(localeFr);

interface NavItem { label: string; icon: string; route: string; badge?: number; badgeClass?: string; }
interface NavGroup { label: string; icon: string; children: NavItem[]; }

/**
 * Coquille unique de l'espace Admin (demande explicite du porteur, 2026-10-15) :
 * "Administration" n'est pas une troisième persona, c'est un nom de package pour
 * "gestion des comptes et de l'organisation". Un seul espace visuel, avec deux
 * sections de sidebar, configuration technique (/admin-systeme/*) et comptes/
 * organisation (/admin/*), pas deux espaces distincts. Les préfixes d'URL restent
 * séparés (rien à renommer côté routes/backend), seule la coquille devient commune :
 * les deux arbres de routes (ADMIN_ROUTES, ADMIN_SYSTEME_ROUTES) se montent chacun
 * sous ce même composant (voir app.routes.ts).
 *
 * Styles réutilisés depuis stock-layout (mêmes classes .layout-root/.sidebar/.sb-item
 * que tous les autres layouts du projet), aucune nouvelle feuille de style.
 */
@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, DatePipe, NotificationCenterComponent, SignalerIncidentComponent, SidebarSearchComponent, HeaderSearchComponent, CommandPaletteComponent, ConfirmDialogComponent],
  templateUrl: './admin-layout.component.html',
  styleUrls: ['../stock-layout/stock-layout.component.css']
})
export class AdminLayoutComponent implements OnInit {
  router = inject(Router);
  authService = inject(AuthService);
  readonly theme = inject(ThemeService);
  private readonly clock = inject(ClockService);

  sidebarOpen = signal(true);
  mobileOpen = signal(false);
  currentTime = this.clock.now;
  currentPageTitle = signal('Administration');

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

  /**
   * Section « Comptes & Organisation », module backend `administration`.
   *
   * « Paramètres métier » (TVA, primes, seuils, ParametresAdminController) et « Postes
   * production » retirés d'ici le 2026-10-25, puis retirés aussi de /dg/* le 2026-11-01 sous
   * l'hypothèse qu'ils resteraient disponibles ici - jamais effectivement ré-ajoutés (régression
   * corrigée le 2026-11-09, voir admin.routes.ts). Ce ne sont pas des réglages du SYSTÈME (config
   * technique, droits d'accès, comptes) mais des référentiels d'exploitation ; l'Admin garde ici :
   * comptes, droits d'accès, incidents, audit, strictement « gestion du système » (CLAUDE.md,
   * décision actée n°9), plus ces deux référentiels faute d'un autre point d'entrée routé.
   */
  comptesNavItems: NavItem[] = [
    { label: 'Tableau de bord', icon: 'fa-gauge-high', route: '/admin/dashboard' },
  ];

  /** Regroupement par thème (2026-11-09, même motif que les autres layouts) : les 10 items de
   * « Comptes & Organisation » passent de liste plate à 3 groupes dépliables. */
  comptesNavGroups: NavGroup[] = [
    {
      label: 'Comptes & Sécurité', icon: 'fa-users-gear', children: [
        { label: 'Utilisateurs', icon: 'fa-users-gear', route: '/admin/utilisateurs' },
        { label: 'Permissions & RBAC', icon: 'fa-user-shield', route: '/admin/permissions' },
        { label: 'Codes de validation', icon: 'fa-key', route: '/admin/codes-validation' },
      ]
    },
    {
      label: 'Conformité & Suivi', icon: 'fa-clipboard-list', children: [
        { label: 'Codes observation', icon: 'fa-clipboard-question', route: '/admin/codes-observation' },
        { label: 'Incidents', icon: 'fa-triangle-exclamation', route: '/admin/incidents' },
        { label: "Journal d'audit", icon: 'fa-clipboard-list', route: '/admin/audit' },
        { label: 'Workflows de validation', icon: 'fa-diagram-project', route: '/admin/validation-workflows' },
      ]
    },
    {
      // Distinct de "Paramètres système" (/admin-systeme/parametres, AdminSystemeService, déjà
      // routé) : celui-ci couvre TVA/prime/seuil d'alerte + référentiels zones/gammes/villes
      // (AdminService), jamais le même écran malgré le nom proche - vérifié avant d'ajouter.
      label: 'Référentiels', icon: 'fa-sliders', children: [
        { label: 'Paramètres métier (TVA, zones...)', icon: 'fa-sliders', route: '/admin/parametres' },
        { label: 'Règles métier datées (primes, caisse...)', icon: 'fa-scale-balanced', route: '/admin/parametrages-metier' },
        { label: 'Postes de production', icon: 'fa-industry', route: '/admin/postes-production' },
      ]
    },
  ];

  /** Section « Configuration technique », module backend `admin` (ParametreSysteme). */
  systemeNavItems: NavItem[] = [
    { label: 'Paramètres système', icon: 'fa-gears', route: '/admin-systeme/parametres' },
    { label: 'Suivi', icon: 'fa-chart-line', route: '/admin-systeme/suivi' },
    { label: 'Corbeille', icon: 'fa-trash-can', route: '/admin-systeme/corbeille' },
    { label: 'Sauvegardes', icon: 'fa-database', route: '/admin-systeme/sauvegardes' },
  ];

  private allNavItems(): NavItem[] {
    return [...this.comptesNavItems, ...this.comptesNavGroups.flatMap(g => g.children), ...this.systemeNavItems];
  }

  /** Palette de commandes Ctrl+K (2026-11-01, même composant que le module DG). */
  @ViewChild('commandPalette') commandPalette?: CommandPaletteComponent;
  commandItems = computed(() => [
    ...this.comptesNavItems.map(i => ({ ...i, groupe: 'Comptes & Organisation' })),
    ...this.comptesNavGroups.flatMap(g => g.children.map(c => ({ ...c, groupe: g.label }))),
    ...this.systemeNavItems.map(i => ({ ...i, groupe: 'Configuration technique' })),
  ]);

  /** Recherche sidebar (2026-10-25, demande explicite du porteur), filtre inline léger. */
  sidebarFiltre = signal('');
  comptesNavItemsFiltres = computed(() => filtrerNavItems(this.comptesNavItems, this.sidebarFiltre()));
  comptesNavGroupsFiltres = computed(() => filtrerNavGroupes(this.comptesNavGroups, this.sidebarFiltre()));
  systemeNavItemsFiltres = computed(() => filtrerNavItems(this.systemeNavItems, this.sidebarFiltre()));
  rechercheActive = computed(() => this.sidebarFiltre().trim().length > 0);
  expandedGroup = signal<string | null>('Comptes & Sécurité');
  toggleGroup(label: string): void { this.expandedGroup.update(v => v === label ? null : label); }
  tousLesItems = computed(() => this.allNavItems());

  ngOnInit() {
    if (window.innerWidth < 1024) this.sidebarOpen.set(false);
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
      const cur = this.allNavItems().find(n => this.router.url.startsWith(n.route));
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
