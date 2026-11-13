import { Component, OnInit, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ProductionService, LotBE, PPHBE } from '../../../infrastructure/production.service';
import { StockApiRepository } from '../../../../stock/infrastructure/repositories/stock-api.repository';
import { Product } from '../../../../stock/domain/models/stock.models';
import { ProductSearchComponent } from '../../../../../shared/components/product-search/product-search.component';
import { ConditioningQuantityComponent, LigneConditionnement } from '../../../../../shared/components/conditioning-quantity/conditioning-quantity.component';
import { HasPermissionDirective } from '../../../../../shared/directives/has-permission.directive';
import { extractApiError } from '../../../../../core/http/api-error-parser';
import { ToastService } from '../../../../../core/services/toast.service';

interface LotFormLigne {
  referencePPH: string;
  product: Product | null;
  productLabel: string;
  declaredQuantityKg: number;
  /** Décomposition par conditionnement, [0] alimente conditioningType/conditioningQty/equivalentUnits. */
  lignesConditionnement: LigneConditionnement[];
  dlc: string;
  notes: string;
}

@Component({
  selector: 'app-production-lots',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, FormsModule, ProductSearchComponent, ConditioningQuantityComponent, HasPermissionDirective],
  templateUrl: './production-lots.component.html',
  styleUrls: ['./production-lots.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductionLotsComponent implements OnInit {
  private readonly svc = inject(ProductionService);
  private readonly stockRepo = inject(StockApiRepository);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  today = new Date();
  loading = signal(false);

  lots = signal<LotBE[]>([]);
  lotsAValider = signal<LotBE[]>([]);
  pphs = signal<PPHBE[]>([]);
  produits = signal<Product[]>([]);

  showDeclarerLot = signal(false);
  showRejeter = signal<LotBE | null>(null);
  lotAConfirmer = signal<LotBE | null>(null);
  lotDetails = signal<LotBE | null>(null);
  lotBonEntree = signal<LotBE | null>(null);

  motifRejet = '';
  message = signal('');
  erreurAction = signal<string | null>(null);
  erreurDeclaration = signal<string | null>(null);

  searchQuery = signal('');
  filtreStatut = signal<'TOUS' | 'DECLARE' | 'VALIDATED_BY_STOCK' | 'REJETE'>('TOUS');
  filtrePPH = signal('');

  page = signal(1);
  pageSize = 10;

  dateProduction = this.formatDate(new Date());
  lignesLot: LotFormLigne[] = [];

  nbDeclares = computed(() => this.lots().filter(l => l.statut === 'DECLARE').length);
  nbValidesStock = computed(() => this.lots().filter(l => l.statut === 'VALIDATED_BY_STOCK').length);
  nbRejetes = computed(() => this.lots().filter(l => l.statut === 'REJETE').length);
  totalKgDeclares = computed(() => this.lots().reduce((s, l) => s + (l.declaredQuantityKg || 0), 0));
  totalCartons = computed(() => this.lots().reduce((s, l) => s + (l.equivalentUnits || 0), 0));

  lotsFiltres = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const st = this.filtreStatut();
    const pph = this.filtrePPH().trim();
    let list = this.lots();

    if (st !== 'TOUS') {
      list = list.filter(l => l.statut === st);
    }
    if (pph) {
      list = list.filter(l => l.referencePPH === pph);
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

  ngOnInit(): void {
    this.chargerLots();
    this.chargerLotsAValider();
    this.svc.getPPHs().subscribe({
      next: p => this.pphs.set(p || []),
      error: () => this.message.set('Impossible de charger la liste des PPH')
    });
    this.stockRepo.getFinishedProducts().subscribe({
      next: p => this.produits.set(p || []),
      error: () => this.message.set('Impossible de charger le catalogue des produits finis')
    });
  }

  chargerLots(): void {
    this.loading.set(true);
    this.svc.getLots().subscribe({
      next: list => { this.lots.set(list || []); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  chargerLotsAValider(): void {
    this.svc.getLotsAValider().subscribe({
      next: list => this.lotsAValider.set(list || []),
      error: () => {},
    });
  }

  setFiltreStatut(statut: 'TOUS' | 'DECLARE' | 'VALIDATED_BY_STOCK' | 'REJETE'): void {
    this.filtreStatut.set(statut);
    this.page.set(1);
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

  exportLotsCsv(): void {
    const list = this.lotsFiltres();
    if (list.length === 0) {
      this.toast.warning('Aucun lot à exporter.', 'Export CSV');
      return;
    }
    const headers = ['N° Lot', 'Produit', 'SKU', 'PPH', 'Date Production', 'DLC', 'Qté Déclarée (kg)', 'Cartons', 'Chef Production', 'Statut'];
    const rows = list.map(l => [
      `"${l.numeroLot || ''}"`,
      `"${(l.productName || '').replace(/"/g, '""')}"`,
      `"${l.productSku || ''}"`,
      `"${l.referencePPH || ''}"`,
      `"${l.dateProduction ? l.dateProduction.substring(0, 10) : ''}"`,
      `"${l.dlc ? l.dlc.substring(0, 10) : ''}"`,
      l.declaredQuantityKg ?? 0,
      l.equivalentUnits ?? 0,
      `"${l.matriculeChefProduction || ''}"`,
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

  declarerLot(): void {
    this.erreurDeclaration.set(null);
    const valides = this.lignesLot.filter(l =>
      l.product && l.referencePPH && l.declaredQuantityKg > 0 && l.dlc && l.lignesConditionnement.length > 0
    );
    if (valides.length === 0) {
      this.erreurDeclaration.set('Chaque ligne doit avoir un produit sélectionné, un PPH, une quantité positive, un conditionnement et une DLC valide.');
      return;
    }
    const requests = valides.map(l => {
      const principal = l.lignesConditionnement[0];
      return {
        referencePPH: l.referencePPH,
        productSku: l.product!.sku,
        productName: l.product!.designation || l.product!.sku,
        productUnit: l.product!.unit,
        declaredQuantityKg: l.declaredQuantityKg,
        equivalentUnits: principal.quantite,
        conditioningType: principal.typeEmballageNom || undefined,
        conditioningQty: principal.quantite,
        dateProduction: this.dateProduction,
        dlc: l.dlc,
        notes: l.notes || undefined,
      };
    });
    forkJoin(requests.map(r => this.svc.declarerLot(r))).subscribe({
      next: crees => {
        this.lots.update(list => [...crees, ...list]);
        this.chargerLotsAValider();
        this.showDeclarerLot.set(false);
        this.lignesLot = [];
        const msg = `${crees.length} lot(s) déclaré(s) avec succès, transmis au Stock Central pour validation.`;
        this.message.set(msg);
        this.toast.success(msg, 'Déclaration de lot');
      },
      error: (err) => {
        const detail = err?.error?.erreur || err?.error?.message || extractApiError(err);
        this.erreurDeclaration.set(detail || 'Erreur lors de la déclaration des lots');
        this.toast.error(detail || 'Erreur lors de la déclaration des lots', 'Échec déclaration');
      }
    });
  }

  ouvrirDeclarerLot(): void {
    this.dateProduction = this.formatDate(new Date());
    this.erreurDeclaration.set(null);
    this.lignesLot = [this.ligneVide()];
    this.showDeclarerLot.set(true);
  }

  ajouterLigne(): void {
    this.lignesLot = [...this.lignesLot, this.ligneVide()];
  }

  supprimerLigne(i: number): void {
    this.lignesLot = this.lignesLot.filter((_, idx) => idx !== i);
  }

  surSelectionProduit(ligne: LotFormLigne, produit: Product): void {
    ligne.product = produit;
    ligne.lignesConditionnement = [];
  }

  surEffacementProduit(ligne: LotFormLigne): void {
    ligne.product = null;
    ligne.lignesConditionnement = [];
  }

  surLignesConditionnement(ligne: LotFormLigne, lignes: LigneConditionnement[]): void {
    ligne.lignesConditionnement = lignes;
  }

  private ligneVide(): LotFormLigne {
    return { referencePPH: '', product: null, productLabel: '', declaredQuantityKg: 0, lignesConditionnement: [], dlc: '', notes: '' };
  }

  private formatDate(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
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
      }
    });
  }

  validerLot(lot: LotBE): void {
    this.ouvrirValiderLot(lot);
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
      }
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

  private remplacerLot(l: LotBE): void {
    this.lots.update(list => list.map(x => x.numeroLot === l.numeroLot ? l : x));
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
