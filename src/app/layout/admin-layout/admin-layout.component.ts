import { Component, OnInit, signal, inject, HostListener, computed } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { CommonModule, DatePipe, registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { ClockService } from '../../core/services/clock.service';
import { ROLE_LABELS } from '../../core/models/user.models';
import { NotificationCenterComponent } from '../../shared/notification-center/notification-center.component';
// 2026-10-16 : seul layout sur les neuf à ne jamais enregistrer les données de
// locale 'fr' — la page plantait (NG0701) à chaque rafraîchissement du relogue
// (`date:'...':'':'fr'` ci-dessous), pas seulement au premier rendu.
registerLocaleData(localeFr);

interface NavItem { label: string; icon: string; route: string; }

/**
 * Coquille unique de l'espace Admin (demande explicite du porteur, 2026-10-15) :
 * "Administration" n'est pas une troisième persona, c'est un nom de package pour
 * "gestion des comptes et de l'organisation". Un seul espace visuel, avec deux
 * sections de sidebar — configuration technique (/admin-systeme/*) et comptes/
 * organisation (/admin/*) — pas deux espaces distincts. Les préfixes d'URL restent
 * séparés (rien à renommer côté routes/backend), seule la coquille devient commune :
 * les deux arbres de routes (ADMIN_ROUTES, ADMIN_SYSTEME_ROUTES) se montent chacun
 * sous ce même composant (voir app.routes.ts).
 *
 * Styles réutilisés depuis stock-layout (mêmes classes .layout-root/.sidebar/.sb-item
 * que tous les autres layouts du projet) — aucune nouvelle feuille de style.
 */
@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, DatePipe, NotificationCenterComponent],
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

  /** Section « Comptes & Organisation » — module backend `administration`. */
  comptesNavItems: NavItem[] = [
    { label: 'Utilisateurs', icon: 'fa-users-gear', route: '/admin/utilisateurs' },
    { label: 'Paramètres métier', icon: 'fa-sliders', route: '/admin/parametres' },
    { label: 'Codes observation', icon: 'fa-clipboard-question', route: '/admin/codes-observation' },
    { label: 'Postes production', icon: 'fa-industry', route: '/admin/postes-production' },
    { label: 'Incidents', icon: 'fa-triangle-exclamation', route: '/admin/incidents' },
    { label: "Journal d'audit", icon: 'fa-clipboard-list', route: '/admin/audit' },
    { label: 'Codes de validation', icon: 'fa-key', route: '/admin/codes-validation' },
    { label: 'Permissions & RBAC', icon: 'fa-user-shield', route: '/admin/permissions' },
  ];

  /** Section « Configuration technique » — module backend `admin` (ParametreSysteme). */
  systemeNavItems: NavItem[] = [
    { label: 'Paramètres système', icon: 'fa-gears', route: '/admin-systeme/parametres' },
    { label: 'Suivi', icon: 'fa-chart-line', route: '/admin-systeme/suivi' },
    { label: 'Corbeille', icon: 'fa-trash-can', route: '/admin-systeme/corbeille' },
    { label: 'Sauvegardes', icon: 'fa-database', route: '/admin-systeme/sauvegardes' },
  ];

  private allNavItems(): NavItem[] { return [...this.comptesNavItems, ...this.systemeNavItems]; }

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

  logout() {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }
}
