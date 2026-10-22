import { Component, OnInit, signal, computed, inject, HostListener } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { filter } from 'rxjs/operators';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { AuthService } from '../../core/auth/auth.service';
import { ClockService } from '../../core/services/clock.service';
import { ROLE_LABELS } from '../../core/models/user.models';
import { ComptableService } from '../../domains/comptable/infrastructure/comptable.service';
import { CommercialService } from '../../domains/commercial/infrastructure/commercial.service';
import { NotificationCenterComponent } from '../../shared/notification-center/notification-center.component';
registerLocaleData(localeFr);
interface NavItem { label: string; icon: string; route: string; badge?: number; badgeClass?: string; }

@Component({
  selector: 'app-secretaire-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, DatePipe, NotificationCenterComponent],
  templateUrl: './secretaire-layout.component.html',
  styleUrls: ['../stock-layout/stock-layout.component.css']
})
export class SecretaireLayoutComponent implements OnInit {
  router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly cptSvc = inject(ComptableService);
  private readonly comSvc = inject(CommercialService);
  private readonly clock = inject(ClockService);

  sidebarOpen = signal(true);
  mobileOpen = signal(false);
  currentTime = this.clock.now;
  currentPageTitle = signal('Tableau de Bord');
  /** Alertes rouges sur les versements du jour — comptées en direct. */
  alertCount = signal(0);
  /** Décaissements VALIDEE_DG — prêts à exécuter, badge topbar. */
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
    { label: 'Saisie Versements', icon: 'fa-cash-register', route: '/secretaire/versements' },
    { label: 'Validation', icon: 'fa-clipboard-check', route: '/secretaire/validation' },
    { label: 'Commandes J+1', icon: 'fa-cart-plus', route: '/secretaire/commandes' },
    { label: 'Commandes clients', icon: 'fa-cart-shopping', route: '/secretaire/commandes-clients' },
    { label: 'Session du Jour', icon: 'fa-calendar-check', route: '/secretaire/session' },
  ];

  ngOnInit() {
    if (window.innerWidth < 1024) this.sidebarOpen.set(false);
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
      const cur = this.navItems.find(n => this.router.url.startsWith(n.route));
      if (cur) this.currentPageTitle.set(cur.label);
      if (window.innerWidth < 768) this.mobileOpen.set(false);
    });

    this.cptSvc.getVersements().subscribe({
      next: versements => {
        this.setBadge('/secretaire/versements', versements.filter(v => v.statut === 'EN_ATTENTE').length, 'bd-orange');
        this.alertCount.set(versements.filter(v => v.alerteRouge).length);
      },
      error: () => {},
    });
    this.cptSvc.getDecaissements().subscribe({
      next: d => {
        const n = d.filter(x => x.statut === 'VALIDEE_DG').length;
        this.setBadge('/secretaire/validation', n, 'bd-red');
        this.validationBadge.set(n);
      },
      error: () => {},
    });
    this.comSvc.getPrecommandesAValider().subscribe({
      next: page => this.setBadge(
        '/secretaire/commandes',
        page.contenu.filter(c => c.statut === 'SOUMISE').length,
        'bd-orange'
      ),
      error: () => {},
    });
  }

  private setBadge(route: string, count: number, badgeClass: string): void {
    const item = this.navItems.find(n => n.route === route);
    if (item) { item.badge = count; item.badgeClass = badgeClass; }
  }

  @HostListener('window:resize', ['$event'])
  onResize(e: Event) {
    const w = (e.target as Window).innerWidth;
    if (w < 1024) { this.sidebarOpen.set(false); } else { this.mobileOpen.set(false); }
  }
  toggleSidebar() { if (window.innerWidth < 768) this.mobileOpen.update(v => !v); else this.sidebarOpen.update(v => !v); }
  closeMobile() { this.mobileOpen.set(false); }
}
