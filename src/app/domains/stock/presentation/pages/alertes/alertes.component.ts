import { Component, OnInit, signal, inject, OnDestroy, computed } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, forkJoin, takeUntil, interval, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { StockLevelUseCase } from '../../../application/use-cases/inventaire/stock-level.use-case';
import { StockApiRepository } from '../../../infrastructure/repositories/stock-api.repository';
import { StockLevel, StockAlertEntity, AlertType } from '../../../domain/models';
import { AuthService } from '../../../../../core/auth/auth.service';
import { AlertBadgeService } from '../../../../../core/services/alert-badge.service';
import { StockRulesDomainService } from '../../../domain/services/stock-rules.domain.service';

@Component({
  selector: 'app-alertes',
  standalone: true,
  imports: [CommonModule, DecimalPipe, DatePipe, FormsModule],
  templateUrl: './alertes.component.html',
  styleUrls: ['./alertes.component.css']
})
export class AlertesComponent implements OnInit, OnDestroy {
  private rules = inject(StockRulesDomainService);
  private d$ = new Subject<void>();
  private uc = inject(StockLevelUseCase);
  private repo = inject(StockApiRepository);
  private auth = inject(AuthService);
  private alertBadge = inject(AlertBadgeService);
  private router = inject(Router);

  loading = signal(true);
  alerts = signal<StockLevel[]>([]);
  backendAlerts = signal<StockAlertEntity[]>([]);
  filter = signal<'TOUS' | 'CRITIQUE' | 'FAIBLE'>('TOUS');
  source = signal<'dashboard' | 'backend'>('dashboard');
  typeFilter = signal<AlertType | 'ALL'>('ALL');
  lastCheck = signal<Date | null>(null);
  actionMsg = signal<string | null>(null);
  resolvingId = signal<number | null>(null);
  orderingId = signal<number | null>(null);
  ackedLevelIds = signal<Set<number>>(new Set());
  resolvedLevelIds = signal<Set<number>>(new Set());
  orderedAlertIds = signal<Set<number>>(new Set());
  Math = Math;

  canManageAlerts = computed(() => this.auth.hasAnyRole(['GESTIONNAIRE_STOCK', 'ADMIN']));
  isReadOnly = computed(() => !this.canManageAlerts());

  cartonsFor(sl: StockLevel): number {
    const qpc = sl.quantityPerCarton || 1;
    return Math.floor((sl.quantity || 0) / qpc);
  }
  reorderCartonsFor(sl: StockLevel): number {
    const qpc = sl.quantityPerCarton || 1;
    return Math.floor((sl.reorderPoint || 0) / qpc);
  }
  safetyCartonsFor(sl: StockLevel): number {
    const qpc = sl.quantityPerCarton || 1;
    return Math.floor((sl.safetyStock || 0) / qpc);
  }
  remainingUnits(sl: StockLevel): number {
    const qpc = sl.quantityPerCarton || 1;
    return (sl.quantity || 0) % qpc;
  }
  pkgLabel(sl: StockLevel): string {
    const pkg = sl.packagingType?.toUpperCase();
    if (pkg) return this.rules.getConditioningLabel(pkg);
    return sl.productUnit || 'unités';
  }
  private pluralMap: Record<string, string> = {
    'CARTON': 'cartons', 'CARTON_ASSORTI': 'cartons d\'assortis',
    'SEAU': 'seaux', 'SEAU_1L': 'seaux 1L', 'SEAU_2L': 'seaux 2L', 'SEAU_5L': 'seaux 5L', 'SEAU_10L': 'seaux 10L',
    'SACHET': 'sachets', 'SACHET_42G': 'sachets 42g', 'SACHET_60G': 'sachets 60g', 'SACHET_62G': 'sachets 62g',
    'ETUI': 'étuis', 'BOITE': 'boîtes', 'BOUTEILLE': 'bouteilles', 'BIDON': 'bidons',
    'DOYPACK': 'doypacks', 'DOYPACK_80G': 'doypacks 80g', 'DOYPACK_140G': 'doypacks 140g', 'DOYPACK_350G': 'doypacks 350g',
    'SAC': 'sacs', 'GAINE': 'gaines',
  };
  pkgLabelPlural(sl: StockLevel): string {
    const pkg = sl.packagingType?.toUpperCase();
    if (pkg && this.pluralMap[pkg]) return this.pluralMap[pkg];
    if (pkg) {
      const label = this.rules.getConditioningLabel(pkg).toLowerCase();
      return label + 's';
    }
    return sl.productUnit || 'unités';
  }
  private centralLocationIds = signal<string[]>([]);
  private bufferLocationIds = signal<string[]>([]);

  critiques() { return this.alerts().filter(sl => sl.alertLevel === 'CRITIQUE'); }
  faibles() { return this.alerts().filter(sl => sl.alertLevel === 'FAIBLE'); }
  getFiltered() {
    const f = this.filter();
    return f === 'TOUS' ? this.alerts() : this.alerts().filter(sl => sl.alertLevel === f);
  }

  getFilteredBackend(): StockAlertEntity[] {
    const tf = this.typeFilter();
    if (tf === 'ALL') return this.backendAlerts();
    return this.backendAlerts().filter(a => a.type === tf);
  }

  countByType(type: AlertType): number {
    return this.backendAlerts().filter(a => a.type === type).length;
  }

  countByPriority(priority: string): number {
    return this.backendAlerts().filter(a => a.priority === priority).length;
  }

  getUnackCount(): number {
    return this.backendAlerts().filter(a => !a.acknowledged).length;
  }

  getFilteredDashboard(): StockLevel[] {
    const f = this.filter();
    const resolved = this.resolvedLevelIds();
    const backendAlerts = this.backendAlerts();
    let list = f === 'TOUS' ? this.alerts() : this.alerts().filter(sl => sl.alertLevel === f);
    return list.filter(sl => {
      if (resolved.has(sl.id)) return false;
      // Exclure aussi si l'alerte backend correspondante est RESOLVED
      const backend = backendAlerts.find(a => a.productId === sl.productId);
      if (backend && backend.status === 'RESOLVED') return false;
      return true;
    });
  }

  isLevelAcked(id: number): boolean {
    if (this.ackedLevelIds().has(id)) return true;
    // Vérifier aussi l'état backend: si une alerte ACKNOWLEDGED ou RESOLVED existe pour ce productId
    const sl = this.alerts().find(s => s.id === id);
    if (sl) {
      const backend = this.backendAlerts().find(a => a.productId === sl.productId);
      if (backend && (backend.status === 'ACKNOWLEDGED' || backend.status === 'RESOLVED')) return true;
    }
    return false;
  }
  isLevelResolved(id: number): boolean {
    if (this.resolvedLevelIds().has(id)) return true;
    // Vérifier aussi l'état backend
    const sl = this.alerts().find(s => s.id === id);
    if (sl) {
      const backend = this.backendAlerts().find(a => a.productId === sl.productId);
      if (backend && backend.status === 'RESOLVED') return true;
    }
    return false;
  }

  ngOnInit() {
    this.loading.set(true);
    // Load dashboard + backend alerts directly.
    // Do NOT call triggerAlertChecks() here — it recreates resolved alerts on every refresh.
    // The scheduled task (@Scheduled in StockAlertService) handles threshold checks automatically.
    forkJoin({
      dashboard: this.uc.getAlerts(),
      backend: this.repo.getBackendAlerts()
    }).pipe(takeUntil(this.d$)).subscribe({
      next: r => {
        this.alerts.set(r.dashboard);
        this.backendAlerts.set(r.backend);
        this.syncLevelStatesFromBackend(r.dashboard, r.backend);
        this.lastCheck.set(new Date());
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });

    interval(60000).pipe(takeUntil(this.d$)).subscribe(() => this.refreshBackend());

    // Charger les IDs de localisations pour distinguer stock central vs tampon
    forkJoin({
      central: this.repo.getStockLocationsByType('STOCK_CENTRAL'),
      buffer: this.repo.getStockLocationsByType('STOCK_BUFFER')
    }).pipe(takeUntil(this.d$)).subscribe({
      next: r => {
        this.centralLocationIds.set(r.central.map(l => l.id));
        this.bufferLocationIds.set(r.buffer.map(l => l.id));
      },
      error: () => {}
    });
  }

  refreshBackend() {
    forkJoin({
      dashboard: this.uc.getAlerts(),
      backend: this.repo.getBackendAlerts()
    }).pipe(takeUntil(this.d$)).subscribe({
      next: r => {
        this.alerts.set(r.dashboard);
        this.backendAlerts.set(r.backend);
        this.syncLevelStatesFromBackend(r.dashboard, r.backend);
        this.lastCheck.set(new Date());
      },
      error: () => {}
    });
  }

  /**
   * Synchronise les signaux ackedLevelIds et resolvedLevelIds depuis l'état réel des alertes backend.
   * Permet de restaurer l'état après actualisation de la page.
   */
  private syncLevelStatesFromBackend(dashboard: StockLevel[], backend: StockAlertEntity[]) {
    const acked = new Set<number>();
    const resolved = new Set<number>();
    for (const sl of dashboard) {
      const match = backend.find(a => a.productId === sl.productId);
      if (match) {
        if (match.status === 'ACKNOWLEDGED' || match.status === 'RESOLVED') {
          acked.add(sl.id);
        }
        if (match.status === 'RESOLVED') {
          resolved.add(sl.id);
        }
      }
    }
    // Fusionner avec les états locaux (actions en cours non encore synchronisées)
    this.ackedLevelIds().forEach(id => acked.add(id));
    this.resolvedLevelIds().forEach(id => resolved.add(id));
    this.ackedLevelIds.set(acked);
    this.resolvedLevelIds.set(resolved);
  }

  triggerCheck() {
    this.repo.triggerAlertChecks().pipe(takeUntil(this.d$)).subscribe({
      next: () => {
        this.lastCheck.set(new Date());
        this.refreshBackend();
        this.alertBadge.refresh();
      },
      error: () => this.flashMsg('Erreur lors de la vérification des seuils', true)
    });
  }

  acknowledge(id: number) {
    const userId = this.auth.getCurrentUser()?.matricule || 'system';
    this.repo.acknowledgeBackendAlert(id, userId).pipe(takeUntil(this.d$)).subscribe({
      next: () => {
        this.refreshBackend();
        this.alertBadge.refresh();
        this.flashMsg('Alerte acquittée avec succès');
      },
      error: () => this.flashMsg('Erreur lors de l\'acquittement', true)
    });
  }

  resolve(id: number) {
    this.repo.resolveBackendAlert(id).pipe(takeUntil(this.d$)).subscribe({
      next: () => {
        this.refreshBackend();
        this.alertBadge.refresh();
        this.flashMsg('Alerte résolue avec succès');
      },
      error: () => this.flashMsg('Erreur lors de la résolution', true)
    });
  }

  /**
   * Détermine si une locationId correspond au stock central
   */
  isCentralLocation(locationId: string): boolean {
    return this.centralLocationIds().includes(locationId);
  }

  /**
   * Détermine si une locationId correspond au stock tampon
   */
  isBufferLocation(locationId: string): boolean {
    return this.bufferLocationIds().includes(locationId);
  }

  /**
   * Commander un produit en rupture depuis une alerte backend.
   * - Stock central → acquitte l'alerte en base puis redirige vers le formulaire de commande à la production
   * - Stock tampon → acquitte l'alerte en base puis redirige vers la page tampon pour réapprovisionnement
   */
  orderProduct(a: StockAlertEntity) {
    const isCentral = this.isCentralLocation(a.locationId);
    const userId = this.auth.getCurrentUser()?.matricule || 'system';

    // 1. Acquitter l'alerte en base
    this.repo.acknowledgeBackendAlert(a.id, userId).pipe(takeUntil(this.d$)).subscribe({
      next: () => {
        this.orderedAlertIds.update(s => { const n = new Set(s); n.add(a.id); return n; });
        this.refreshBackend();
        this.alertBadge.refresh();

        if (isCentral) {
          // 2. Stock central → rediriger vers le formulaire de commande à la production
          const qtyToOrder = Math.max(a.threshold - a.currentQuantity, a.threshold);
          this.router.navigate(['/stock/commande-production'], {
            queryParams: { productId: a.productId, qty: qtyToOrder, alertId: a.id }
          });
        } else {
          // 2. Stock tampon → rediriger vers la page tampon pour réapprovisionnement
          this.router.navigate(['/stock/tampon'], {
            queryParams: { productId: a.productId, alertId: a.id }
          });
        }
      },
      error: () => this.flashMsg('Erreur lors de l\'acquittement de l\'alerte', true)
    });
  }

  /**
   * Commander un produit en rupture depuis une alerte dashboard (niveau de stock).
   * - Stock central → acquitte l'alerte backend puis redirige vers le formulaire de commande à la production
   * - Stock tampon → acquitte l'alerte backend puis redirige vers la page tampon pour réapprovisionnement
   */
  orderLevel(sl: StockLevel) {
    const isCentral = (sl.warehouseType || '').toUpperCase().includes('CENTRAL');
    const userId = this.auth.getCurrentUser()?.matricule || 'system';
    const qtyToOrder = Math.max(sl.reorderPoint - sl.quantity, sl.reorderPoint);

    // 1. Déclencher la vérification pour créer les alertes manquantes
    this.repo.triggerAlertChecks().pipe(
      takeUntil(this.d$),
      catchError(() => of(void 0))
    ).subscribe(() => {
      // 2. Trouver et acquitter l'alerte backend correspondante
      this.repo.getBackendAlerts().pipe(takeUntil(this.d$)).subscribe({
        next: (alerts) => {
          this.backendAlerts.set(alerts);
          const match = alerts.find(a => a.productId === sl.productId && a.status === 'ACTIVE' && !a.acknowledged);
          if (match) {
            this.repo.acknowledgeBackendAlert(match.id, userId).pipe(takeUntil(this.d$)).subscribe({
              next: () => {
                this.orderedAlertIds.update(s => { const n = new Set(s); n.add(sl.id); return n; });
                this.refreshBackend();
                this.alertBadge.refresh();
                this.redirectAfterAlertAction(sl, isCentral, qtyToOrder, match.id);
              },
              error: () => {
                this.orderedAlertIds.update(s => { const n = new Set(s); n.add(sl.id); return n; });
                this.redirectAfterAlertAction(sl, isCentral, qtyToOrder, match.id);
              }
            });
          } else {
            this.orderedAlertIds.update(s => { const n = new Set(s); n.add(sl.id); return n; });
            this.redirectAfterAlertAction(sl, isCentral, qtyToOrder);
          }
        },
        error: () => {
          this.orderedAlertIds.update(s => { const n = new Set(s); n.add(sl.id); return n; });
          this.redirectAfterAlertAction(sl, isCentral, qtyToOrder);
        }
      });
    });
  }

  isAlertOrdered(id: number): boolean { return this.orderedAlertIds().has(id); }

  /**
   * Acquitter une alerte de niveau de stock côté backend.
   * 1. Récupère les alertes backend et trouve celle correspondant au productId
   * 2. Appelle acknowledge sur cette alerte
   * 3. Met à jour l'UI
   */
  acknowledgeLevel(sl: StockLevel) {
    const userId = this.auth.getCurrentUser()?.matricule || 'system';
    // D'abord déclencher la vérification pour créer les alertes manquantes
    this.repo.triggerAlertChecks().pipe(
      takeUntil(this.d$),
      catchError(() => of(void 0))
    ).subscribe(() => {
      this.repo.getBackendAlerts().pipe(takeUntil(this.d$)).subscribe({
        next: (alerts) => {
          this.backendAlerts.set(alerts);
          // Chercher une alerte ACTIVE non acquittée pour ce produit
          const match = alerts.find(a => a.productId === sl.productId && a.status === 'ACTIVE' && !a.acknowledged);
          if (match) {
            this.repo.acknowledgeBackendAlert(match.id, userId).pipe(takeUntil(this.d$)).subscribe({
              next: () => {
                this.ackedLevelIds.update(s => { const n = new Set(s); n.add(sl.id); return n; });
                this.refreshBackend();
                this.alertBadge.refresh();
                this.flashMsg(`Alerte acquittée : ${sl.productName}`);
              },
              error: () => this.flashMsg('Erreur lors de l\'acquittement', true)
            });
          } else {
            // Aucune alerte backend active trouvée → acquitter localement
            this.ackedLevelIds.update(s => { const n = new Set(s); n.add(sl.id); return n; });
            this.alertBadge.refresh();
            this.flashMsg(`Niveau de stock acquitté : ${sl.productName}`);
          }
        },
        error: () => this.flashMsg('Erreur lors de la récupération des alertes', true)
      });
    });
  }

  /**
   * Résoudre une alerte de niveau de stock côté backend.
   * Marque l'alerte comme résolue sans rediriger. L'utilisateur a déjà pris
   * une action (commande, réappro) ou a traité manuellement le problème.
   */
  resolveLevel(sl: StockLevel) {
    this.resolvingId.set(sl.id);

    // D'abord déclencher la vérification pour créer les alertes manquantes
    this.repo.triggerAlertChecks().pipe(
      takeUntil(this.d$),
      catchError(() => of(void 0))
    ).subscribe(() => {
      // Trouver et résoudre l'alerte backend correspondante
      this.repo.getBackendAlerts().pipe(takeUntil(this.d$)).subscribe({
        next: (alerts) => {
          this.backendAlerts.set(alerts);
          const match = alerts.find(a => a.productId === sl.productId && a.status !== 'RESOLVED');
          if (match) {
            this.repo.resolveBackendAlert(match.id).pipe(takeUntil(this.d$)).subscribe({
              next: () => {
                this.resolvedLevelIds.update(s => { const n = new Set(s); n.add(sl.id); return n; });
                this.ackedLevelIds.update(s => { const n = new Set(s); n.add(sl.id); return n; });
                this.resolvingId.set(null);
                this.refreshBackend();
                this.alertBadge.refresh();
                this.flashMsg(`Alerte résolue : ${sl.productName}`);
              },
              error: () => {
                this.resolvingId.set(null);
                this.flashMsg('Erreur lors de la résolution', true);
              }
            });
          } else {
            this.resolvedLevelIds.update(s => { const n = new Set(s); n.add(sl.id); return n; });
            this.ackedLevelIds.update(s => { const n = new Set(s); n.add(sl.id); return n; });
            this.resolvingId.set(null);
            this.alertBadge.refresh();
            this.flashMsg(`Alerte résolue : ${sl.productName}`);
          }
        },
        error: () => {
          this.resolvingId.set(null);
          this.flashMsg('Erreur lors de la récupération des alertes', true);
        }
      });
    });
  }

  /**
   * Redirige vers la page appropriée après une action d'alerte (commande/réappro).
   * - Stock central → /stock/commande-production avec productId, qty et alertId
   * - Stock tampon → /stock/tampon avec productId et alertId
   */
  private redirectAfterAlertAction(sl: StockLevel, isCentral: boolean, qtyToOrder: number, alertId?: number) {
    const queryParams: any = { productId: sl.productId };
    if (isCentral) {
      queryParams.qty = qtyToOrder;
      if (alertId) queryParams.alertId = alertId;
      this.router.navigate(['/stock/commande-production'], { queryParams });
    } else {
      if (alertId) queryParams.alertId = alertId;
      this.router.navigate(['/stock/tampon'], { queryParams });
    }
  }

  private flashMsg(msg: string, isError = false) {
    this.actionMsg.set(msg);
    setTimeout(() => this.actionMsg.set(null), 3000);
  }

  getTypeIcon(t: AlertType): string {
    const m: Record<AlertType, string> = {
      LOW_STOCK: 'fa-arrow-down', CRITICAL_STOCK: 'fa-circle-exclamation',
      OVERSTOCK: 'fa-arrow-up', EXPIRATION_SOON: 'fa-clock',
      EXPIRED: 'fa-skull-crossbones', SLOW_ROTATION: 'fa-rotate',
      REORDER_NEEDED: 'fa-cart-shopping', BUFFER_INSUFFICIENT: 'fa-layer-group'
    };
    return m[t] || 'fa-bell';
  }

  getTypeLabel(t: AlertType): string {
    const m: Record<AlertType, string> = {
      LOW_STOCK: 'Stock bas', CRITICAL_STOCK: 'Stock critique',
      OVERSTOCK: 'Surstock', EXPIRATION_SOON: 'Péremption imminente',
      EXPIRED: 'Produit expiré', SLOW_ROTATION: 'Rotation lente',
      REORDER_NEEDED: 'Réappro requis', BUFFER_INSUFFICIENT: 'Tampon insuffisant'
    };
    return m[t] || t;
  }

  getTypeColor(t: AlertType): string {
    if (t === 'CRITICAL_STOCK' || t === 'EXPIRED') return 'var(--r)';
    if (t === 'LOW_STOCK' || t === 'EXPIRATION_SOON' || t === 'BUFFER_INSUFFICIENT') return 'var(--o)';
    if (t === 'OVERSTOCK' || t === 'SLOW_ROTATION') return '#7C3AED';
    return 'var(--y-d)';
  }

  getPriorityClass(p: string): string {
    if (p === 'CRITICAL') return 'badge-danger';
    if (p === 'HIGH') return 'badge-warning';
    if (p === 'MEDIUM') return 'badge-secondary';
    return 'badge-neutral';
  }

  getNiveauClass(n: string | undefined): string { return n === 'CRITIQUE' ? 'badge-danger' : 'badge-warning'; }

  getStockPct(al: any): number {
    if (!al.stockMinimum || al.stockMinimum === 0) return 0;
    return Math.min(100, Math.round((al.stockActuel / al.stockMinimum) * 100));
  }

  needsUrgentOrder(al: any): boolean { return (al.leadTimeDays || 0) >= 90; }
  getMagasinLabel(m: string): string { return m || '—'; }
  getValeurStockAlert(al: any): number { return al.valeurStock || 0; }

  formatCFA(n: number) { return new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA'; }
  fCFA(n: number) { return this.formatCFA(n); }

  // Inline reappro for buffer alerts
  showReappro = signal(false);
  reapproSku = signal('');
  reapproName = signal('');
  reapproQty = signal(0);
  reapproCentralQty = signal(0);
  reapproUnit = signal('');
  reapproSaving = signal(false);
  reapproProductId = signal(0);

  reapproBufferQty = signal(0);

  openInlineReappro(sl: StockLevel) {
    this.reapproSku.set(sl.productSku || '');
    this.reapproName.set(sl.productName || '');
    this.reapproUnit.set(this.pkgLabel(sl));
    this.reapproProductId.set(sl.productId || 0);
    this.reapproBufferQty.set(sl.quantity || 0);
    const recommended = Math.max(0, (sl.reorderPoint || 0) - (sl.quantity || 0));
    this.reapproQty.set(recommended > 0 ? recommended : 10);
    const centralIds = this.centralLocationIds();
    this.uc.getAllStockItems().pipe(takeUntil(this.d$)).subscribe({
      next: (items: any[]) => {
        const central = items.find(i =>
          i.productSku === sl.productSku && centralIds.includes(i.locationId)
        );
        this.reapproCentralQty.set(Number(central?.quantity || 0));
      },
      error: () => this.reapproCentralQty.set(0)
    });
    this.showReappro.set(true);
  }

  closeInlineReappro() {
    this.showReappro.set(false);
    this.reapproSku.set('');
    this.reapproName.set('');
    this.reapproQty.set(0);
    this.reapproCentralQty.set(0);
    this.reapproBufferQty.set(0);
    this.reapproProductId.set(0);
  }

  confirmInlineReappro() {
    const sku = this.reapproSku();
    const qty = this.reapproQty();
    if (!sku || qty <= 0 || this.reapproSaving()) return;
    if (qty > this.reapproCentralQty()) {
      this.flashMsg(`Stock central insuffisant: ${this.reapproCentralQty()} ${this.reapproUnit()} disponibles`, true);
      return;
    }
    this.reapproSaving.set(true);
    const userId = this.auth.getCurrentUser()?.matricule || 'system';
    this.uc.replenishBuffer(sku, qty, userId, `Réappro tampon depuis alerte - ${this.reapproName()} (${sku})`)
      .pipe(takeUntil(this.d$)).subscribe({
        next: () => {
          // Résoudre les alertes backend pour ce produit après le réappro
          const productId = this.reapproProductId();
          const productSku = this.reapproSku();
          if (productId > 0) {
            this.repo.resolveAlertsByProduct(productId).pipe(takeUntil(this.d$)).subscribe({
              next: (resolvedCount) => {
                console.log(`[Alertes] ${resolvedCount} alerte(s) résolue(s) pour productId=${productId}`);
                this.refreshBackend();
                this.alertBadge.refresh();
              },
              error: () => {
                this.refreshBackend();
                this.alertBadge.refresh();
              }
            });
          } else if (productSku) {
            this.repo.resolveAlertsByProductSku(productSku).pipe(takeUntil(this.d$)).subscribe({
              next: (resolvedCount) => {
                console.log(`[Alertes] ${resolvedCount} alerte(s) résolue(s) pour productSku=${productSku}`);
                this.refreshBackend();
                this.alertBadge.refresh();
              },
              error: () => {
                this.refreshBackend();
                this.alertBadge.refresh();
              }
            });
          } else {
            this.refreshBackend();
            this.alertBadge.refresh();
          }
          this.reapproSaving.set(false);
          this.flashMsg(`Réapprovisionnement effectué: ${qty} ${this.reapproUnit()} transférés du central vers le tampon`);
          this.closeInlineReappro();
        },
        error: (err) => {
          this.reapproSaving.set(false);
          const msg = err?.error?.message || 'Erreur lors du réapprovisionnement';
          this.flashMsg(msg, true);
        }
      });
  }

  ngOnDestroy() { this.d$.next(); this.d$.complete(); }
}
