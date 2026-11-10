import { Component, OnInit, OnDestroy, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, Subject, takeUntil } from 'rxjs';
import { ReceiptUseCase } from '../../../../stock/application/use-cases/reception/receipt.use-case';
import { StockService, NiveauStockBE, MouvementBE } from '../../../../stock/infrastructure/stock.service';
import { Receipt } from '../../../../stock/domain/models/stock.models';
import { fCFA } from '../../../../../shared/utils/format.utils';
import { ToastService } from '../../../../../core/services/toast.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';

type ActionType = 'v2' | 'rej';

/**
 * Suivi des consommables côté Contrôle Général (2026-11-08, demande explicite du porteur :
 * « le contrôle doit pouvoir suivre tout ce qui concerne les consommables puisque c'est lui qui
 * valide les réceptions pour la deuxième fois »).
 *
 * Réaligné le 2026-11-10 (demande explicite du porteur, même correctif que l'écran Comptable
 * matières premières) : cet écran lisait jusqu'ici le grand livre anglais historique (StockItem,
 * via DashboardController/v1/stock/dashboard et StockMovementController/stock/movements) pour ses
 * onglets Niveaux/Mouvements/Alertes - un grand livre déconnecté du stock réel depuis la
 * centralisation NiveauStock (Lot P0/2026-09-29), donc jamais mis à jour par les vraies
 * validations de réception. Lit désormais exclusivement NiveauStockController (/api/stock/levels,
 * /alerts) et MouvementController (/api/stock/mouvements), le grand livre réellement consulté par
 * les dashboards, les seuils et les transferts.
 *
 * L'onglet Validation réutilise ReceiptUseCase (ReceiptController, /api/v1/stock/receptions),
 * déjà le bon circuit - c'est la seconde validation des réceptions CONSOMMABLE/MATERIEL que le
 * Contrôleur Général exerce (RolePermissionMatrix : STOCK_RECEPTION_VALIDER_ETAPE2).
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
  private readonly stockSvc = inject(StockService);
  private readonly toast = inject(ToastService);

  fCFA = fCFA;
  loading = signal(true);
  loadError = signal<string | null>(null);

  niveaux = signal<NiveauStockBE[]>([]);
  alertes = signal<NiveauStockBE[]>([]);
  mouvements = signal<MouvementBE[]>([]);
  enAttenteValidation = signal<Receipt[]>([]);

  activeTab = signal<'validation' | 'niveaux' | 'mouvements' | 'alertes'>('validation');

  /** Le Contrôle couvre les deux catégories qu'il valide en 2e étape : CONSOMMABLE et MATERIEL. */
  private estConsommableOuMateriel = (categorie: string | null) => categorie === 'CONSOMMABLE' || categorie === 'MATERIEL';
  niveauxConsommables = computed(() => this.niveaux().filter(n => this.estConsommableOuMateriel(n.categorie)));
  alertesConsommables = computed(() => this.alertes().filter(n => this.estConsommableOuMateriel(n.categorie)));
  /** Codes catalogue des consommables/matériel, déduits des niveaux (pas d'appel séparé au référentiel). */
  private codesConsommables = computed(() => new Set(this.niveauxConsommables().map(n => n.codeProduit)));
  mouvementsConsommables = computed(() => {
    const codes = this.codesConsommables();
    return this.mouvements().filter(m => codes.has(m.codeProduit)).slice(0, 30);
  });

  valeurTotaleStock = computed(() => this.niveauxConsommables().reduce((s, n) => s + (n.valeurStock ?? 0), 0));
  nbAlertesCritiques = computed(() => this.alertesConsommables().filter(n => n.niveauAlerte === 'CRITIQUE').length);
  nbEnAttente = computed(() => this.enAttenteValidation().length);
  nbReferences = computed(() => this.niveauxConsommables().length);

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
      niveaux: this.stockSvc.getEtatStock(),
      alertes: this.stockSvc.getStockLevelAlertes(),
      mouvements: this.stockSvc.getMouvements({}, { page: 0, size: 100, sort: 'horodatage,desc' }),
      enAttenteConsommable: this.uc.getPendingSecondValidation('CONSOMMABLE'),
      enAttenteMateriel: this.uc.getPendingSecondValidation('MATERIEL'),
    }).pipe(takeUntil(this.d$)).subscribe({
      next: (r) => {
        this.niveaux.set(r.niveaux);
        this.alertes.set(r.alertes);
        this.mouvements.set(r.mouvements.contenu ?? []);
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
