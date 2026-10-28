import { Component, OnInit, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ProductionService, LotBE, PPHBE } from '../../../infrastructure/production.service';
import { StockApiRepository } from '../../../../stock/infrastructure/repositories/stock-api.repository';
import { Product } from '../../../../stock/domain/models/stock.models';
import { ProductSearchComponent } from '../../../../../shared/components/product-search/product-search.component';
import { ConditioningQuantityComponent, LigneConditionnement } from '../../../../../shared/components/conditioning-quantity/conditioning-quantity.component';
import { HasPermissionDirective } from '../../../../../shared/directives/has-permission.directive';

interface LotFormLigne {
  referencePPH: string;
  product: Product | null;
  productLabel: string;
  declaredQuantityKg: number;
  /** Décomposition par conditionnement (P4) — [0] alimente conditioningType/conditioningQty/equivalentUnits. */
  lignesConditionnement: LigneConditionnement[];
  dlc: string;
  notes: string;
}

@Component({
  selector: 'app-production-lots',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, ProductSearchComponent, ConditioningQuantityComponent, HasPermissionDirective],
  templateUrl: './production-lots.component.html',
  styleUrls: ['./production-lots.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductionLotsComponent implements OnInit {
  private readonly svc = inject(ProductionService);
  private readonly stockRepo = inject(StockApiRepository);

  today = new Date();
  loading = signal(false);

  lots = signal<LotBE[]>([]);
  lotsAValider = signal<LotBE[]>([]);
  pphs = signal<PPHBE[]>([]);
  /**
   * Produits finis réels (module conditionnement, projetés dans le catalogue opérationnel
   * — voir CatalogueOperationnelSeeder/ProduitsFinisOperationnelSeeder, backend) : même
   * source que le combobox de Stock (StockApiRepository.getFinishedProducts), réutilisée
   * ici plutôt que ressaisie en texte libre (P3, 2026-10-15 — cause du 400 systématique
   * corrigée dans la même tranche, voir production.service.ts : LotBE).
   */
  produits = signal<Product[]>([]);
  showDeclarerLot = signal(false);
  showRejeter = signal<LotBE | null>(null);
  motifRejet = '';
  message = signal('');
  erreurDeclaration = signal<string | null>(null);

  dateProduction = this.formatDate(new Date());
  lignesLot: LotFormLigne[] = [];

  nbDeclares = computed(() => this.lots().filter(l => l.statut === 'DECLARE').length);
  nbValidesStock = computed(() => this.lots().filter(l => l.statut === 'VALIDATED_BY_STOCK').length);
  nbRejetes = computed(() => this.lots().filter(l => l.statut === 'REJETE').length);
  totalKgDeclares = computed(() => this.lots().reduce((s, l) => s + l.declaredQuantityKg, 0));
  totalCartons = computed(() => this.lots().reduce((s, l) => s + l.equivalentUnits, 0));

  ngOnInit(): void {
    this.chargerLots();
    this.chargerLotsAValider();
    this.svc.getPPHs().subscribe({
      next: p => this.pphs.set(p),
      error: () => this.message.set('Impossible de charger la liste des PPH')
    });
    this.stockRepo.getFinishedProducts().subscribe({
      next: p => this.produits.set(p),
      error: () => this.message.set('Impossible de charger le catalogue des produits finis')
    });
  }

  chargerLots(): void {
    this.loading.set(true);
    this.svc.getLots().subscribe({
      next: list => { this.lots.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  /** Lots déclarés en attente de validation par le Gestionnaire de Stock. */
  chargerLotsAValider(): void {
    this.svc.getLotsAValider().subscribe({
      next: list => this.lotsAValider.set(list),
      error: () => {},
    });
  }

  declarerLot(): void {
    this.erreurDeclaration.set(null);
    const valides = this.lignesLot.filter(l =>
      l.product && l.referencePPH && l.declaredQuantityKg > 0 && l.dlc && l.lignesConditionnement.length > 0
    );
    if (valides.length === 0) {
      this.erreurDeclaration.set('Chaque ligne doit avoir un produit sélectionné (dans la liste, pas un code tapé au hasard), un PPH, une quantité (kg) positive, un conditionnement et une DLC.');
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
        this.message.set(`${crees.length} lot(s) déclaré(s) — en attente de validation stock`);
      },
      error: (err) => {
        const detail = err?.error?.erreur || err?.error?.message;
        this.erreurDeclaration.set(detail || 'Erreur lors de la déclaration des lots');
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

  /** Validation physique par le Gestionnaire de Stock — déclenche le verrouillage de la fiche. */
  validerLot(lot: LotBE): void {
    if (!confirm(`Valider le lot ${lot.numeroLot} et l'intégrer au stock central ?`)) return;
    this.svc.validerLot(lot.numeroLot).subscribe({
      next: l => {
        this.remplacerLot(l);
        this.lotsAValider.update(list => list.filter(x => x.numeroLot !== l.numeroLot));
        this.message.set('Lot validé — fiche de production verrouillée');
      },
      error: () => this.message.set('Erreur lors de la validation du lot')
    });
  }

  ouvrirRejeter(lot: LotBE): void {
    this.motifRejet = '';
    this.showRejeter.set(lot);
  }

  confirmerRejet(): void {
    const lot = this.showRejeter();
    if (!lot || !this.motifRejet.trim()) return;
    this.svc.rejeterLot(lot.numeroLot, this.motifRejet.trim()).subscribe({
      next: l => {
        this.remplacerLot(l);
        this.lotsAValider.update(list => list.filter(x => x.numeroLot !== l.numeroLot));
        this.showRejeter.set(null);
        this.message.set('Lot rejeté');
      },
      error: () => this.message.set('Erreur lors du rejet du lot')
    });
  }

  private remplacerLot(l: LotBE): void {
    this.lots.update(list => list.map(x => x.numeroLot === l.numeroLot ? l : x));
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
