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
import { filtrerNavItems } from '../../shared/utils/nav-filter.util';
registerLocaleData(localeFr);
interface NavItem { label: string; icon: string; route: string; badge?: number; badgeClass?: string; }

@Component({
  selector: 'app-controle-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, DatePipe, NotificationCenterComponent, SidebarSearchComponent, HeaderSearchComponent, SignalerIncidentComponent, CommandPaletteComponent],
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
    { label: 'Suivi Consommables', icon: 'fa-boxes-packing', route: '/controle/consommables' },
    { label: 'Décaissements', icon: 'fa-money-check-dollar', route: '/controle/decaissements' },
    { label: 'Ventes à Crédit', icon: 'fa-hand-holding-dollar', route: '/controle/credits' },
    { label: 'Marges & Coûts', icon: 'fa-chart-line', route: '/controle/marges' },
    { label: 'Valorisation Stock', icon: 'fa-boxes-stacked', route: '/controle/valorisation' },
    { label: 'Budget & Achats', icon: 'fa-file-invoice-dollar', route: '/controle/budget' },
    { label: 'Variances Coûts', icon: 'fa-scale-unbalanced', route: '/controle/variances' },
    { label: 'Piste d\'Audit', icon: 'fa-fingerprint', route: '/controle/audit' },
    { label: 'Commandes clients', icon: 'fa-cart-shopping', route: '/controle/commandes-clients' },
  ];

  /** Recherche sidebar (2026-10-25, demande explicite du porteur), filtre inline léger. */
  sidebarFiltre = signal('');
  navItemsFiltres = computed(() => filtrerNavItems(this.navItems, this.sidebarFiltre()));

  /** Palette de commandes Ctrl+K (2026-11-02, même composant que les autres layouts). */
  @ViewChild('commandPalette') commandPalette?: CommandPaletteComponent;
  commandItems = computed(() => this.navItems);

  ngOnInit() {
    if (window.innerWidth < 1024) this.sidebarOpen.set(false);
    this.alertBadge.startPolling(30000);
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
      const cur = this.navItems.find(n => this.router.url.startsWith(n.route));
      if (cur) this.currentPageTitle.set(cur.label);
      if (window.innerWidth < 768) this.mobileOpen.set(false);
    });

    // 2026-11-02 : les badges "Décaissements"/"Budget & Achats" étaient des littéraux fixes
    // (toujours "2"), jamais recalculés, même défaut que dg-layout (décaissements) corrigé le
    // 2026-11-01. ControleDashboardService expose déjà decaissementsAttente/budgetDepasse.
    this.controleSvc.getDashboard().subscribe({
      next: d => {
        this.setBadge('/controle/decaissements', d.decaissementsAttente, 'bd-red');
        this.setBadge('/controle/budget', d.budgetDepasse, 'bd-orange');
      },
      error: () => {},
    });

    // 2026-11-08 : nouvel écran Consommables, badge sur le nombre de réceptions en attente de
    // la 2e validation (consommables + matériel), même motif que les badges ci-dessus.
    forkJoin({
      consommable: this.receiptUc.getPendingSecondValidation('CONSOMMABLE'),
      materiel: this.receiptUc.getPendingSecondValidation('MATERIEL'),
    }).subscribe({
      next: r => this.setBadge('/controle/consommables', r.consommable.length + r.materiel.length, 'bd-orange'),
      error: () => {},
    });
  }

  private setBadge(route: string, count: number, badgeClass: string): void {
    const item = this.navItems.find(n => n.route === route);
    if (item && count > 0) { item.badge = count; item.badgeClass = badgeClass; }
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

  logout(): void {
    if (!confirm('Se déconnecter ?')) return;
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }
}
