// ═══ FICHIER : reception-form.component.ts ═══
// Réécrit : l'ancienne version était branchée sur StockMockRepository (produits
// et fournisseurs factices) et construisait un payload qui ne correspondait à
// aucun endpoint réel du backend. Elle ne créait donc jamais aucune réception.
//
// Corrections de cette révision :
// 1. "Le nom du produit est requis" : productName était lu depuis l.product,
//    un cache alimenté uniquement par l'évènement (ngModelChange) du <select>.
//    Si ce cache n'était pas à jour au moment d'enregistrer, productName partait
//    vide et le backend rejetait la réception. On résout désormais le produit
//    fraîchement depuis products() au moment de la sauvegarde, sans dépendre
//    d'un état intermédiaire.
// 2. Filtrage strict par type de réception : le backend expose maintenant un
//    vrai champ materialType (MATIERE_PREMIERE/CONSOMMABLE/MATERIEL) sur
//    chaque produit. Le formulaire recharge la liste filtrée à chaque
//    changement de type, et réinitialise les lignes pour éviter qu'une ligne
//    garde un produit qui n'appartient plus au type sélectionné.
import { Component, OnInit, signal, inject, OnDestroy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { ReceiptUseCase } from '../../../application/use-cases/reception/receipt.use-case';
import { StockLocationDto } from '../../../infrastructure/repositories/stock-api.repository';
import { Product, Receipt, ReceptionType } from '../../../domain/models';

interface LineForm {
  uid: string;
  productId: number;
  packagingType: string;
  quantityPerCarton?: number;
  orderedQty: number;
  receivedQty: number;
  lot: string;
  deviationReason: string;
}

const PACKAGING_TYPES = ['SACHET', 'ETUI', 'SEAU', 'DOYPACK', 'BOUTEILLE', 'CARTON', 'SAC', 'BIDON', 'ROULEAU', 'PALETTE'];

/** Rôles requis par type de réception, à titre indicatif côté UI (l'application réelle
 *  du contrôle se fait côté backend, cf. ReceiptAggregate.getRequiredXValidatorRole). */
const ROLE_LABELS: Record<string, string> = {
  GESTIONNAIRE_STOCK: 'Gestionnaire de stock',
  CHEF_PRODUCTION: 'Responsable de production',
  COMPTABLE: 'Comptable',
  CONTROLEUR_GENERAL: 'Contrôleur Général'
};
const WORKFLOW: Record<ReceptionType, { first: string; second: string }> = {
  CONSOMMABLE: { first: 'GESTIONNAIRE_STOCK', second: 'CONTROLEUR_GENERAL' },
  MATIERE_PREMIERE: { first: 'GESTIONNAIRE_STOCK', second: 'COMPTABLE' },
  MATERIEL: { first: 'GESTIONNAIRE_STOCK', second: 'CONTROLEUR_GENERAL' }
};

@Component({
  selector: 'app-reception-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DecimalPipe],
  templateUrl: './reception-form.component.html',
  styleUrls: ['./reception-form.component.css']
})
export class ReceptionFormComponent implements OnInit, OnDestroy {
  private d$ = new Subject<void>();
  private route = inject(ActivatedRoute);
  router = inject(Router);
  private uc = inject(ReceiptUseCase);

  loading = signal(true);
  loadingProducts = signal(false);
  saving = signal(false);
  success = signal(false);
  errorMsg = signal('');
  readOnlyMode = signal(false);
  viewedReceipt = signal<Receipt | null>(null);

  locations = signal<StockLocationDto[]>([]);
  products = signal<Product[]>([]);

  destinationLocationId = '';
  sourceLabel = '';
  private _receptionType: ReceptionType = 'MATIERE_PREMIERE';
  lignes: LineForm[] = [];

  packagingTypes = PACKAGING_TYPES;
  receptionTypes: { value: ReceptionType; label: string }[] = [
    { value: 'CONSOMMABLE', label: 'Consommable' },
    { value: 'MATIERE_PREMIERE', label: 'Matière première' },
    { value: 'MATERIEL', label: 'Matériel' }
  ];

  get receptionType(): ReceptionType { return this._receptionType; }
  set receptionType(value: ReceptionType) {
    if (value === this._receptionType) return;
    this._receptionType = value;
    this.lignes = [];
    this.addLine();
    this.loadProducts();
  }

  get workflowInfo() {
    const w = WORKFLOW[this.receptionType];
    return { firstLabel: ROLE_LABELS[w.first], secondLabel: ROLE_LABELS[w.second] };
  }

  ngOnInit() {
    const routeId = this.route.snapshot.paramMap.get('id');
    if (routeId) {
      this.readOnlyMode.set(true);
      this.uc.getByNumber(routeId).pipe(takeUntil(this.d$)).subscribe({
        next: r => { this.viewedReceipt.set(r); this.loading.set(false); },
        error: () => { this.errorMsg.set('Réception introuvable.'); this.loading.set(false); }
      });
      return;
    }

    forkJoin({
      locs: this.uc.getDestinationLocations(),
      products: this.uc.getProducts(this.receptionType)
    }).pipe(takeUntil(this.d$)).subscribe({
      next: ({ locs, products }) => {
        this.locations.set(locs);
        this.products.set(products);
        this.destinationLocationId = locs[0]?.id || '';
        this.loading.set(false);
      },
      error: () => {
        this.errorMsg.set('Impossible de charger les emplacements/produits. Vérifiez la connexion au serveur.');
        this.loading.set(false);
      }
    });
    this.addLine();
  }

  /** Recharge le catalogue filtré côté serveur à chaque changement de type de réception. */
  loadProducts() {
    this.loadingProducts.set(true);
    this.uc.getProducts(this.receptionType).pipe(takeUntil(this.d$)).subscribe({
      next: products => { this.products.set(products); this.loadingProducts.set(false); },
      error: () => { this.loadingProducts.set(false); this.showLoadError(); }
    });
  }

  private showLoadError() {
    this.errorMsg.set('Impossible de charger les produits pour ce type de réception.');
  }

  getFilteredProducts(): Product[] {
    return this.products().filter(p => p.active !== false);
  }

  findProduct(productId: any): Product | undefined {
    const id = Number(productId);
    return this.products().find(p => p.id === id);
  }

  addLine() {
    this.lignes.push({
      uid: 'l' + Date.now() + Math.random(),
      productId: 0, packagingType: '', orderedQty: 0, receivedQty: 0, lot: '', deviationReason: ''
    });
  }
  removeLine(i: number) { if (this.lignes.length > 1) this.lignes.splice(i, 1); }

  onProductChange(l: LineForm) {
    const p = this.findProduct(l.productId);
    if (p) {
      l.packagingType = p.packagingType || l.packagingType;
      l.quantityPerCarton = p.quantityPerCarton ?? l.quantityPerCarton;
    }
  }

  deviation(l: LineForm): number {
    return (l.receivedQty || 0) - (l.orderedQty || 0);
  }

  hasDeviation(l: LineForm): boolean {
    return !!l.orderedQty && this.deviation(l) !== 0;
  }

  isValid(): boolean {
    return !!this.destinationLocationId
      && !!this.sourceLabel.trim()
      && this.lignes.some(l => Number(l.productId) > 0 && l.receivedQty > 0 && !!this.findProduct(l.productId));
  }

  sauvegarder() {
    if (!this.isValid() || this.saving()) return;
    this.saving.set(true);
    this.errorMsg.set('');

    const validLines = this.lignes.filter(l => Number(l.productId) > 0 && l.receivedQty > 0);
    const missing = validLines.find(l => !this.findProduct(l.productId));
    if (missing) {
      this.saving.set(false);
      this.errorMsg.set('Un produit sélectionné n\'est plus disponible pour ce type de réception. Veuillez le re-sélectionner.');
      return;
    }

    const items = validLines.map(l => {
      const p = this.findProduct(l.productId)!;
      return {
        productId: l.productId,
        productName: p.designation || p.sku,
        productSku: p.sku,
        productUnit: p.unit || 'unite',
        packagingType: l.packagingType || p.packagingType || undefined,
        quantityPerCarton: l.quantityPerCarton || undefined,
        orderedQty: l.orderedQty || l.receivedQty,
        receivedQty: l.receivedQty,
        deviationReason: this.hasDeviation(l) ? (l.deviationReason || 'Non renseigné') : undefined,
        lotNumber: l.lot || undefined
      };
    });

    const payload = {
      receptionType: this.receptionType,
      sourceLabel: this.sourceLabel,
      destinationLocationId: this.destinationLocationId,
      items
    };

    this.uc.create(payload as any).pipe(takeUntil(this.d$)).subscribe({
      next: () => {
        this.saving.set(false);
        this.success.set(true);
        setTimeout(() => this.router.navigate(['/stock/reception']), 2000);
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMsg.set(err?.error?.message || 'Erreur lors de la création de la réception. Vérifiez les champs et réessayez.');
      }
    });
  }

  ngOnDestroy() { this.d$.next(); this.d$.complete(); }
}
