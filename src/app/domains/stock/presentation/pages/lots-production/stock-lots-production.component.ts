import { Component, OnInit, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ProductionService, LotBE } from '../../../../production/infrastructure/production.service';
import { HasPermissionDirective } from '../../../../../shared/directives/has-permission.directive';
import { extractApiError } from '../../../../../core/http/api-error-parser';
import { ToastService } from '../../../../../core/services/toast.service';

/**
 * Écran Stock — « Lots de Production » (NTFOODS SARL).
 *
 * Permet au Gestionnaire de Stock de contrôler, valider physiquement ou rejeter
 * les lots déclarés par le Chef de Production.
 * La validation intègre automatiquement les quantités au Stock Central (Magasin Central PF),
 * génère le Bon d'Entrée Magasin (BEM) et met à jour l'arbre de traçabilité.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-stock-lots-production',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, FormsModule, HasPermissionDirective],
  templateUrl: './stock-lots-production.component.html',
  styleUrls: ['./stock-lots-production.component.css'],
})
export class StockLotsProductionComponent implements OnInit {
  private readonly svc = inject(ProductionService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  loading = signal(false);
  lots = signal<LotBE[]>([]);
  lotsAValider = signal<LotBE[]>([]);
  showRejeter = signal<LotBE | null>(null);
  lotAConfirmer = signal<LotBE | null>(null);
  validatingLot = signal<string | null>(null);
  lotDetails = signal<LotBE | null>(null);
  lotBonEntree = signal<LotBE | null>(null);
  dernierLotValide = signal<LotBE | null>(null);

  motifRejet = '';
  message = signal('');
  erreurAction = signal<string | null>(null);
  searchQuery = signal('');
  filtreStatut = signal<'TOUS' | 'A_VALIDER' | 'VALIDATED_BY_STOCK' | 'REJETE'>('TOUS');

  page = signal(1);
  pageSize = 10;

  lotsFiltres = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const st = this.filtreStatut();
    let list = this.lots();

    if (st !== 'TOUS' && st !== 'A_VALIDER') {
      list = list.filter(l => l.statut === st);
    }

    if (!q) return list;
    return list.filter(l =>
      (l.numeroLot || '').toLowerCase().includes(q) ||
      (l.productSku || '').toLowerCase().includes(q) ||
      (l.productName || '').toLowerCase().includes(q) ||
      (l.referencePPH || '').toLowerCase().includes(q) ||
      (l.matriculeChefProduction || '').toLowerCase().includes(q) ||
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
  totalKgDeclares = computed(() => this.lots().reduce((s, l) => s + (l.declaredQuantityKg || 0), 0));
  totalCartonsDeclares = computed(() => this.lots().reduce((s, l) => s + (l.equivalentUnits || 0), 0));

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['search']) {
        this.searchQuery.set(params['search']);
      }
      if (params['filter']) {
        const f = params['filter'];
        if (['TOUS', 'A_VALIDER', 'VALIDATED_BY_STOCK', 'REJETE'].includes(f)) {
          this.filtreStatut.set(f as any);
        }
      }
    });

    this.chargerLots();
    this.chargerLotsAValider();
  }

  chargerLots(): void {
    this.loading.set(true);
    this.svc.getLots().subscribe({
      next: list => {
        this.lots.set(list || []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.set('Erreur lors du chargement des lots.');
      },
    });
  }

  chargerLotsAValider(): void {
    this.svc.getLotsAValider().subscribe({
      next: list => this.lotsAValider.set(list || []),
      error: () => {},
    });
  }

  setFiltreStatut(statut: 'TOUS' | 'A_VALIDER' | 'VALIDATED_BY_STOCK' | 'REJETE'): void {
    this.filtreStatut.set(statut);
    this.page.set(1);
    if (statut === 'A_VALIDER') {
      const el = document.getElementById('lots-en-attente-card');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  ouvrirValiderLot(lot: LotBE): void {
    this.lotAConfirmer.set(lot);
  }

  annulerValidation(): void {
    this.lotAConfirmer.set(null);
  }

  confirmerValidationLot(): void {
    const lot = this.lotAConfirmer();
    if (!lot) return;
    this.validatingLot.set(lot.numeroLot);
    this.erreurAction.set(null);
    this.svc.validerLot(lot.numeroLot).subscribe({
      next: l => {
        this.validatingLot.set(null);
        this.lotAConfirmer.set(null);
        this.remplacerLot(l);
        this.lotsAValider.update(list => list.filter(x => x.numeroLot !== l.numeroLot));
        this.dernierLotValide.set(l);
        const msg = `Lot ${l.numeroLot} validé avec succès et intégré au Stock Central.`;
        this.message.set(msg);
        this.toast.success(msg, 'Validation Stock Central');
        this.chargerLots();
        this.chargerLotsAValider();
      },
      error: (err) => {
        this.validatingLot.set(null);
        const msg = extractApiError(err);
        this.erreurAction.set(msg);
        this.toast.error(msg, 'Échec validation lot');
      },
    });
  }

  validerLot(lot: LotBE): void {
    this.ouvrirValiderLot(lot);
  }

  ouvrirDetails(lot: LotBE): void {
    this.lotDetails.set(lot);
  }

  fermerDetails(): void {
    this.lotDetails.set(null);
  }

  ouvrirBonEntree(lot: LotBE): void {
    this.lotBonEntree.set(lot);
  }

  fermerBonEntree(): void {
    this.lotBonEntree.set(null);
  }

  imprimerBon(): void {
    window.print();
  }

  voirEnStock(sku: string): void {
    this.router.navigate(['/stock/articles'], { queryParams: { sku, search: sku } });
  }

  voirTracabilite(numeroLot: string): void {
    this.router.navigate(['/stock/lots/trace'], { queryParams: { lot: numeroLot } });
  }

  voirMouvements(numeroLot: string): void {
    this.router.navigate(['/stock/mouvements'], { queryParams: { search: numeroLot } });
  }

  exportLotsCsv(): void {
    const list = this.lotsFiltres();
    if (list.length === 0) {
      this.toast.warning('Aucun lot à exporter.', 'Export CSV');
      return;
    }
    const headers = ['Numéro Lot', 'Produit', 'SKU', 'PPH/Réf', 'Qté Déclarée (Kg)', 'Cartons Équivalents', 'Date Production', 'DLC', 'Chef Production', 'Statut'];
    const rows = list.map(l => [
      `"${l.numeroLot || ''}"`,
      `"${(l.productName || '').replace(/"/g, '""')}"`,
      `"${l.productSku || ''}"`,
      `"${l.referencePPH || ''}"`,
      l.declaredQuantityKg ?? 0,
      l.equivalentUnits ?? 0,
      `"${l.dateProduction ? l.dateProduction.substring(0, 10) : ''}"`,
      `"${l.dlc ? l.dlc.substring(0, 10) : ''}"`,
      `"${l.matriculeChefProduction || ''}"`,
      `"${l.statut || ''}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `lots_production_stock_${new Date().toISOString().substring(0, 10)}.csv`);
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
        this.message.set(`Lot ${l.numeroLot} rejeté.`);
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
    this.lots.update(list => {
      const idx = list.findIndex(x => x.numeroLot === l.numeroLot);
      if (idx >= 0) {
        const copy = [...list];
        copy[idx] = l;
        return copy;
      }
      return [l, ...list];
    });
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
    if (s === 'VALIDATED_BY_STOCK') return 'badge badge-success';
    if (s === 'REJETE') return 'badge badge-danger';
    if (s === 'RECEPTIONNE_STOCK') return 'badge badge-warning';
    return 'badge badge-neutral';
  }

  statutLabel(s: string): string {
    const map: Record<string, string> = {
      DECLARE: 'Déclaré Production',
      RECEPTIONNE_STOCK: 'En attente contrôle',
      VALIDATED_BY_STOCK: 'Validé Stock Central',
      REJETE: 'Rejeté non conforme',
    };
    return map[s] ?? s;
  }
}
