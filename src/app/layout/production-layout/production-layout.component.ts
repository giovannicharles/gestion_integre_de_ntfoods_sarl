import { Component, OnInit, signal, computed, inject, HostListener } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { filter } from 'rxjs/operators';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { ProductionService } from '../../domains/production/infrastructure/production.service';
import { ProductionRoleService } from '../../domains/production/infrastructure/production-role.service';
import { PRODUCTION_ROLE_CONFIG, PRODUCTION_NAV_PAR_DEFAUT, ProductionNavItem } from '../../domains/production/infrastructure/production-role-config';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/services/theme.service';
registerLocaleData(localeFr);

@Component({
  selector: 'app-production-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, DatePipe],
  templateUrl: './production-layout.component.html',
  styleUrls: ['../stock-layout/stock-layout.component.css']
})
export class ProductionLayoutComponent implements OnInit {
  router = inject(Router);
  private readonly prodSvc = inject(ProductionService);
  private readonly roleSvc = inject(ProductionRoleService);
  private readonly authSvc = inject(AuthService);
  readonly theme = inject(ThemeService);

  sidebarOpen = signal(true);
  mobileOpen = signal(false);
  currentTime = signal(new Date());
  currentPageTitle = signal('Tableau de Bord');

  /** Nom complet de l'utilisateur connecté (session réelle). */
  nomUtilisateur = computed(() => this.authSvc.user()?.nomComplet ?? 'Utilisateur');

  /** Initiales pour l'avatar (ex: "Essama Paul" → "EP"). */
  initiales = computed(() => {
    const parts = this.nomUtilisateur().trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '—';
    return parts.length === 1 ? parts[0].substring(0, 2).toUpperCase()
      : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  });

  /** Étiquette de rôle affichée dans le bloc utilisateur de la sidebar. */
  libelleRole = computed(() => {
    const r = this.roleSvc.roleActuel();
    return r ? PRODUCTION_ROLE_CONFIG[r].libelleRole : 'Utilisateur';
  });

  /** Menu strictement cloisonné aux actions du rôle connecté. */
  navItems = computed<ProductionNavItem[]>(() => {
    const r = this.roleSvc.roleActuel();
    return r ? PRODUCTION_ROLE_CONFIG[r].navItems : PRODUCTION_NAV_PAR_DEFAUT;
  });

  /** Nombre d'expressions de besoin en attente (GET /production/besoins?statut=EN_ATTENTE). */
  besoinsEnAttente = signal(0);

  ngOnInit() {
    setInterval(() => this.currentTime.set(new Date()), 30000);
    if (window.innerWidth < 1024) this.sidebarOpen.set(false);
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
      const cur = this.navItems().find(n => this.router.url.startsWith(n.route));
      if (cur) this.currentPageTitle.set(cur.label);
      if (window.innerWidth < 768) this.mobileOpen.set(false);
    });
    this.chargerBadges();
  }

  private chargerBadges(): void {
    // Ne charge que les compteurs réellement affichés dans le menu du rôle courant.
    const routes = this.navItems().map(n => n.route);
    if (routes.includes('/production/besoins')) {
      this.prodSvc.getBesoins('EN_ATTENTE').subscribe({
        next: list => this.besoinsEnAttente.set(list.length),
        error: () => this.besoinsEnAttente.set(0)
      });
    }
  }

  /** Badge dynamique affiché sur un item de nav, calculé à partir de données réelles. */
  badgeFor(item: ProductionNavItem): number | undefined {
    if (item.badgeKey === 'besoinsEnAttente') return this.besoinsEnAttente() > 0 ? this.besoinsEnAttente() : undefined;
    return undefined;
  }

  @HostListener('window:resize', ['$event'])
  onResize(e: Event) {
    const w = (e.target as Window).innerWidth;
    if (w < 1024) { this.sidebarOpen.set(false); } else { this.mobileOpen.set(false); }
  }
  toggleSidebar() { if (window.innerWidth < 768) this.mobileOpen.update(v => !v); else this.sidebarOpen.update(v => !v); }
  closeMobile() { this.mobileOpen.set(false); }

  deconnexion(): void {
    this.authSvc.logout();
    this.router.navigate(['/auth/login']);
  }
}
