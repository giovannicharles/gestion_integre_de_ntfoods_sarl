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
 * Suivi des matières premières côté Comptable (2026-11-10, demande explicite du porteur :
 * symétrique à l'écran consommables du Contrôleur Général, « il le faut »).
 *
 * À la différence de l'écran Contrôle (ControleConsommablesComponent), qui lit encore le grand
 * livre anglais historique (StockItem, via DashboardController/v1/stock/dashboard) pour ses
 * onglets Niveaux/Mouvements/Alertes - un grand livre déconnecté du stock réel depuis la
 * centralisation NiveauStock (Lot P0/2026-09-29) -, celui-ci lit exclusivement NiveauStockController
 * (/api/stock/levels, /alerts) et MouvementController (/api/stock/mouvements), le grand livre
 * réellement consulté par les dashboards, les seuils et les transferts. « Synchro et à jour »
 * signifie concrètement : ces deux endpoints, pas le dashboard historique.
 *
 * L'onglet Validation réutilise ReceiptUseCase (ReceiptController, /api/v1/stock/receptions),
 * déjà le bon circuit - c'est la seconde validation des réceptions MATIERE_PREMIERE que le
 * Comptable exerce (RolePermissionMatrix : STOCK_RECEPTION_VALIDER_ETAPE2).
 */
@Component({
  selector: 'app-comptable-mp',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, FormsModule],
  templateUrl: './comptable-mp.component.html',
  styleUrls: ['./comptable-mp.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComptableMpComponent implements OnInit, OnDestroy {
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

  niveauxMP = computed(() => this.niveaux().filter(n => n.categorie === 'MATIERE_PREMIERE'));
  alertesMP = computed(() => this.alertes().filter(n => n.categorie === 'MATIERE_PREMIERE'));
  /** Codes catalogue des MP, déduits des niveaux (pas d'appel séparé au référentiel produits). */
  private codesMp = computed(() => new Set(this.niveauxMP().map(n => n.codeProduit)));
  mouvementsMP = computed(() => {
    const codes = this.codesMp();
    return this.mouvements().filter(m => codes.has(m.codeProduit)).slice(0, 30);
  });

  valeurTotaleStock = computed(() => this.niveauxMP().reduce((s, n) => s + (n.valeurStock ?? 0), 0));
  nbAlertesCritiques = computed(() => this.alertesMP().filter(n => n.niveauAlerte === 'CRITIQUE').length);
  nbEnAttente = computed(() => this.enAttenteValidation().length);
  nbReferences = computed(() => this.niveauxMP().length);

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
      enAttente: this.uc.getPendingSecondValidation('MATIERE_PREMIERE'),
    }).pipe(takeUntil(this.d$)).subscribe({
      next: (r) => {
        this.niveaux.set(r.niveaux);
        this.alertes.set(r.alertes);
        this.mouvements.set(r.mouvements.contenu ?? []);
        this.enAttenteValidation.set(r.enAttente);
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
