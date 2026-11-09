import { Component, OnInit, OnDestroy, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, Subject, takeUntil } from 'rxjs';
import { ReceiptUseCase } from '../../../../stock/application/use-cases/reception/receipt.use-case';
import { StockApiRepository } from '../../../../stock/infrastructure/repositories/stock-api.repository';
import { Receipt, Product, StockLevel, StockMovement } from '../../../../stock/domain/models/stock.models';
import { fCFA } from '../../../../../shared/utils/format.utils';
import { ToastService } from '../../../../../core/services/toast.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';

type ActionType = 'v2' | 'rej';

/**
 * Suivi des consommables côté Contrôle Général (2026-11-08, demande explicite du porteur :
 * « le contrôle doit pouvoir suivre tout ce qui concerne les consommables puisque c'est lui qui
 * valide les réceptions pour la deuxième fois »).
 *
 * Capacité déjà réelle côté serveur (RolePermissionMatrix : STOCK_PRODUIT_CONSULTER,
 * STOCK_NIVEAU_CONSULTER, STOCK_MOUVEMENT_CONSULTER, STOCK_ALERTE_GERER,
 * STOCK_RECEPTION_VALIDER_ETAPE2 sont déjà accordées à CONTROLEUR_GENERAL) : jamais surfacée
 * par aucun écran Contrôle jusqu'ici - la navigation de ce rôle (budget/crédits/marges/
 * valorisation/variances/décaissements) ne comportait aucune page stock. Écran propre à ce
 * module (confidentialité des modules, CLAUDE.md invariant 5) qui réutilise les mêmes
 * services/use-cases que Stock plutôt que ses repositories, filtré sur les consommables.
 */
@Component({
  selector: 'app-controle-consommables',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, FormsModule],
  templateUrl: './controle-consommables.component.html',
  styleUrls: ['./controle-consommables.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ControleConsommablesComponent implements OnInit, OnDestroy {
  private readonly d$ = new Subject<void>();
  private readonly uc = inject(ReceiptUseCase);
  private readonly repo = inject(StockApiRepository);
  private readonly toast = inject(ToastService);

  fCFA = fCFA;
  loading = signal(true);
  loadError = signal<string | null>(null);

  produits = signal<Product[]>([]);
  niveaux = signal<StockLevel[]>([]);
  mouvements = signal<StockMovement[]>([]);
  alertes = signal<StockLevel[]>([]);
  enAttenteValidation = signal<Receipt[]>([]);

  activeTab = signal<'validation' | 'niveaux' | 'mouvements' | 'alertes'>('validation');

  /** Receptions attendent la 2nde validation du Contrôle : CONSOMMABLE et MATERIEL (même rôle
   * validateur, ReceptionType.CONSOMMABLE/MATERIEL -> CONTROLEUR_GENERAL). */
  private skusConsommables = computed(() => new Set(this.produits().map(p => p.sku)));

  niveauxConsommables = computed(() => this.niveaux().filter(n => n.materialType === 'CONSOMMABLE'));
  mouvementsConsommables = computed(() => {
    const skus = this.skusConsommables();
    return this.mouvements().filter(m => m.productSku && skus.has(m.productSku)).slice(0, 30);
  });
  alertesConsommables = computed(() => this.alertes().filter(n => n.materialType === 'CONSOMMABLE'));

  valeurTotaleStock = computed(() => this.niveauxConsommables().reduce((s, n) => s + (n.stockValue ?? 0), 0));
  nbAlertesCritiques = computed(() => this.alertesConsommables().filter(n => n.alertLevel === 'CRITIQUE').length);
  nbEnAttente = computed(() => this.enAttenteValidation().length);
  nbReferences = computed(() => this.produits().length);

  // Modal de validation / rejet
  selected = signal<Receipt | null>(null);
  action = signal<ActionType | null>(null);
  notes = '';
  authCode = '';
  rejectReason = '';
  processing = signal(false);

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      produitsConsommables: this.uc.getProducts('CONSOMMABLE'),
      produitsMateriel: this.uc.getProducts('MATERIEL'),
      niveaux: this.repo.getStockLevels(),
      mouvements: this.repo.getMovements(),
      alertes: this.repo.getAlerts(),
      enAttenteConsommable: this.uc.getPendingSecondValidation('CONSOMMABLE'),
      enAttenteMateriel: this.uc.getPendingSecondValidation('MATERIEL'),
    }).pipe(takeUntil(this.d$)).subscribe({
      next: (r) => {
        this.produits.set([...r.produitsConsommables, ...r.produitsMateriel]);
        this.niveaux.set(r.niveaux);
        this.mouvements.set(r.mouvements);
        this.alertes.set(r.alertes);
        this.enAttenteValidation.set([...r.enAttenteConsommable, ...r.enAttenteMateriel]);
        this.loading.set(false);
      },
      error: e => { this.loadError.set(extractApiError(e)); this.loading.set(false); },
    });
  }

  ouvrirAction(r: Receipt, a: ActionType): void {
    this.selected.set(r);
    this.action.set(a);
    this.notes = '';
    this.authCode = '';
    this.rejectReason = '';
  }
  fermerAction(): void {
    this.selected.set(null);
    this.action.set(null);
  }

  confirmerAction(): void {
    const r = this.selected();
    const a = this.action();
    if (!r || this.processing()) return;
    this.processing.set(true);
    const obs$ = a === 'v2'
      ? this.uc.validateSecond(r.receiptNumber, this.notes, this.authCode)
      : this.uc.reject(r.receiptNumber, this.rejectReason);
    obs$.pipe(takeUntil(this.d$)).subscribe({
      next: () => {
        this.processing.set(false);
        this.fermerAction();
        this.toast.success(a === 'v2' ? 'Validation finale effectuée. Stock mis à jour.' : 'Réception rejetée.');
        this.charger();
      },
      error: e => { this.processing.set(false); this.toast.error(extractApiError(e), 'Action impossible'); },
    });
  }

  hasDeviations(r: Receipt): boolean {
    return r.items.some(i => !i.exactMatch);
  }

  ngOnDestroy(): void { this.d$.next(); this.d$.complete(); }
}
