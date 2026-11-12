import { Component, OnInit, signal, computed, inject, ChangeDetectionStrategy} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductionService, LotBE } from '../../../../production/infrastructure/production.service';
import { HasPermissionDirective } from '../../../../../shared/directives/has-permission.directive';
import { extractApiError } from '../../../../../core/http/api-error-parser';
import { ToastService } from '../../../../../core/services/toast.service';

/**
 * Écran Stock, « Lots de Production » (2026-10-01, demande explicite du porteur).
 *
 * Volontairement séparé de `ProductionLotsComponent` (module Production) : le Gestionnaire de
 * Stock ne doit JAMAIS être renvoyé dans le tableau de bord / la navigation du module Production
 *, chaque module garde sa propre interface, même quand les deux consultent la même ressource
 * backend. Cet écran réutilise `ProductionService` (simple injectable partagé, pas une frontière
 * de module) pour les mêmes appels déjà autorisés au Gestionnaire de Stock côté API
 * (`PRODUCTION_LOT_VALIDER_STOCK`, `LotController.java`), mais s'affiche entièrement sous le
 * layout Stock.
 *
 * Volontairement SANS la déclaration de lot (réservée au Chef de Production) : seule la
 * consultation et la validation/rejet, le rôle réel du Gestionnaire de Stock dans ce circuit.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-stock-lots-production',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, HasPermissionDirective],
  templateUrl: './stock-lots-production.component.html',
  styleUrls: ['./stock-lots-production.component.css'],
})
export class StockLotsProductionComponent implements OnInit {
  private readonly svc = inject(ProductionService);
  private readonly toast = inject(ToastService);

  loading = signal(false);
  lots = signal<LotBE[]>([]);
  lotsAValider = signal<LotBE[]>([]);
  showRejeter = signal<LotBE | null>(null);
  lotAConfirmer = signal<LotBE | null>(null);
  motifRejet = '';
  message = signal('');
  erreurAction = signal<string | null>(null);
  searchQuery = signal('');
  page = signal(1);
  pageSize = 10;

  lotsFiltres = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const list = this.lots();
    if (!q) return list;
    return list.filter(l =>
      (l.numeroLot || '').toLowerCase().includes(q) ||
      (l.productSku || '').toLowerCase().includes(q) ||
      (l.productName || '').toLowerCase().includes(q) ||
      (l.statut || '').toLowerCase().includes(q)
    );
  });

  totalPages = computed(() => Math.max(1, Math.ceil(this.lotsFiltres().length / this.pageSize)));

  lotsPaginees = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.lotsFiltres().slice(start, start + this.pageSize);
  });

  nbAValider = computed(() => this.lotsAValider().length);
  nbValidesStock = computed(() => this.lots().filter(l => l.statut === 'VALIDATED_BY_STOCK').length);
  nbRejetes = computed(() => this.lots().filter(l => l.statut === 'REJETE').length);
  totalKgDeclares = computed(() => this.lots().reduce((s, l) => s + l.declaredQuantityKg, 0));

  ngOnInit(): void {
    this.chargerLots();
    this.chargerLotsAValider();
  }

  chargerLots(): void {
    this.loading.set(true);
    this.svc.getLots().subscribe({
      next: list => { this.lots.set(list); this.loading.set(false); },
      error: () => { this.loading.set(false); this.message.set('Erreur lors du chargement des lots'); },
    });
  }

  chargerLotsAValider(): void {
    this.svc.getLotsAValider().subscribe({
      next: list => this.lotsAValider.set(list),
      error: () => {},
    });
  }

  /** Ouvre le modal de confirmation personnalisé (remplace le confirm natif). */
  ouvrirValiderLot(lot: LotBE): void {
    this.lotAConfirmer.set(lot);
  }

  annulerValidation(): void {
    this.lotAConfirmer.set(null);
  }

  /** Validation physique par le Gestionnaire de Stock, déclenche le verrouillage de la fiche. */
  confirmerValidationLot(): void {
    const lot = this.lotAConfirmer();
    if (!lot) return;
    this.lotAConfirmer.set(null);
    this.erreurAction.set(null);
    this.svc.validerLot(lot.numeroLot).subscribe({
      next: l => {
        this.remplacerLot(l);
        this.lotsAValider.update(list => list.filter(x => x.numeroLot !== l.numeroLot));
        const msg = `Lot ${l.numeroLot} validé et intégré au stock central.`;
        this.message.set(msg);
        this.toast.success(msg, 'Validation Lot Stock');
      },
      error: (err) => {
        const msg = extractApiError(err);
        this.erreurAction.set(msg);
        this.toast.error(msg, 'Échec validation lot');
      },
    });
  }

  validerLot(lot: LotBE): void {
    this.ouvrirValiderLot(lot);
  }

  exportLotsCsv(): void {
    const list = this.lotsFiltres();
    if (list.length === 0) {
      this.toast.warning('Aucun lot à exporter.', 'Export CSV');
      return;
    }
    const headers = ['Numéro Lot', 'Produit', 'PPH/Réf', 'Qté Déclarée (Kg)', 'Date Création', 'Statut'];
    const rows = list.map(l => [
      `"${l.numeroLot || ''}"`,
      `"${l.productSku || l.productName || ''}"`,
      `"${l.referencePPH || ''}"`,
      l.declaredQuantityKg ?? 0,
      `"${l.createdAt ? l.createdAt.substring(0, 10) : ''}"`,
      `"${l.statut || ''}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `lots_production_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.toast.success(`${list.length} lot(s) exporté(s) en CSV.`, 'Export CSV');
  }

  ouvrirRejeter(lot: LotBE): void {
    this.motifRejet = '';
    this.showRejeter.set(lot);
  }

  confirmerRejet(): void {
    const lot = this.showRejeter();
    if (!lot || !this.motifRejet.trim()) return;
    this.erreurAction.set(null);
    this.svc.rejeterLot(lot.numeroLot, this.motifRejet.trim()).subscribe({
      next: l => {
        this.remplacerLot(l);
        this.lotsAValider.update(list => list.filter(x => x.numeroLot !== l.numeroLot));
        this.showRejeter.set(null);
        this.message.set('Lot rejeté');
        this.toast.warning(`Lot ${l.numeroLot} rejeté.`, 'Lot rejeté');
      },
      error: (err) => {
        const msg = extractApiError(err);
        this.erreurAction.set(msg);
        this.toast.error(msg, 'Échec rejet lot');
      },
    });
  }

  fermerRejeter(): void {
    this.showRejeter.set(null);
  }

  private remplacerLot(l: LotBE): void {
    this.lots.update(list => list.map(x => x.numeroLot === l.numeroLot ? l : x));
  }

  pagePrecedente(): void {
    if (this.page() > 1) {
      this.page.set(this.page() - 1);
    }
  }

  pageSuivante(): void {
    if (this.page() < this.totalPages()) {
      this.page.set(this.page() + 1);
    }
  }

  statutClass(s: string): string {
    if (s === 'VALIDATED_BY_STOCK') return 'badge bg-success';
    if (s === 'REJETE') return 'badge bg-red';
    if (s === 'RECEPTIONNE_STOCK') return 'badge bg-neutral';
    return 'badge bg-orange';
  }

  statutLabel(s: string): string {
    const map: Record<string, string> = {
      DECLARE: 'Déclaré Production',
      RECEPTIONNE_STOCK: 'Réceptionné Stock',
      VALIDATED_BY_STOCK: 'Validé Stock',
      REJETE: 'Rejeté',
    };
    return map[s] ?? s;
  }
}
