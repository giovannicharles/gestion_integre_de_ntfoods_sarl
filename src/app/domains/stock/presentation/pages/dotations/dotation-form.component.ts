import { Component, OnInit, signal, inject, OnDestroy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { DotationUseCase } from '../../../application/use-cases/dotation/dotation.use-case';
import { Product, Commercial, DotationRequest, StockLevel } from '../../../domain/models';

interface LineForm {
  uid: string;
  productId: number;
  skuInput: string;
  packagingType: string;
  quantityPerCarton?: number;
  requestedQty: number;
  notes: string;
}

const PACKAGING_TYPES = ['SACHET', 'ETUI', 'SEAU', 'DOYPACK', 'BOUTEILLE', 'CARTON', 'SAC', 'BIDON'];

@Component({
  selector: 'app-dotation-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DecimalPipe],
  templateUrl: './dotation-form.component.html',
  styleUrls: ['./dotation-form.component.css']
})
export class DotationFormComponent implements OnInit, OnDestroy {
  private d$ = new Subject<void>();
  router = inject(Router);
  private uc = inject(DotationUseCase);

  loading = signal(true);
  saving = signal(false);
  success = signal(false);
  errorMsg = signal('');

  products = signal<Product[]>([]);
  commercials = signal<Commercial[]>([]);
  stockLevels = signal<StockLevel[]>([]);

  selectedCommercialMatricule = '';
  selectedCommercialName = '';
  justification = '';
  lignes: LineForm[] = [];

  commercialSearch = signal('');
  commercialDropdownOpen = signal(false);
  commercialDotations = signal<DotationRequest[]>([]);
  checkingDotations = signal(false);

  packagingTypes = PACKAGING_TYPES;

  ngOnInit() {
    forkJoin({
      products: this.uc.getProducts(),
      commercials: this.uc.getCommercials(),
      stockLevels: this.uc.getStockLevels()
    }).pipe(takeUntil(this.d$)).subscribe({
      next: ({ products, commercials, stockLevels }) => {
        this.products.set(products);
        this.commercials.set(commercials);
        this.stockLevels.set(stockLevels || []);
        this.loading.set(false);
      },
      error: () => {
        this.errorMsg.set('Impossible de charger les données. Vérifiez la connexion au serveur.');
        this.loading.set(false);
      }
    });
    this.addLine();
  }

  getFilteredProducts(): Product[] {
    return this.products().filter(p => p.active !== false);
  }

  findProduct(productId: any): Product | undefined {
    const id = Number(productId);
    return this.products().find(p => p.id === id);
  }

  findProductBySku(sku: string): Product | undefined {
    return this.products().find(p => p.sku?.toLowerCase() === sku?.toLowerCase().trim());
  }

  isBufferLevel(level: StockLevel): boolean {
    return level.warehouse?.isBuffer === true
      || (level.warehouseName || '').toLowerCase().includes('tampon')
      || (level.warehouseType || '').toLowerCase().includes('buffer');
  }

  getBufferStock(sku: string): number {
    const levels = this.stockLevels().filter(sl => this.isBufferLevel(sl) && sl.productSku?.toLowerCase() === sku?.toLowerCase().trim());
    return levels.reduce((sum, sl) => sum + (sl.availableQty ?? sl.quantity ?? 0), 0);
  }

  getBufferStockForLine(l: LineForm): number {
    const p = this.findProduct(l.productId);
    if (!p) return 0;
    return this.getBufferStock(p.sku);
  }

  isStockInsufficient(l: LineForm): boolean {
    if (!l.productId || !l.requestedQty) return false;
    const available = this.getBufferStockForLine(l);
    return l.requestedQty > available;
  }

  hasInsufficientStock(): boolean {
    return this.lignes.some(l => this.isStockInsufficient(l));
  }

  getCommercialMatricule(c: Commercial): string {
    return (c as any).commercialMatricule || (c as any).matricule || '';
  }

  getCommercialName(c: Commercial): string {
    return (c as any).locationName || c.name || this.getCommercialMatricule(c);
  }

  onCommercialChange(matricule: string) {
    const c = this.commercials().find(c => this.getCommercialMatricule(c) === matricule);
    if (c) {
      this.selectedCommercialMatricule = this.getCommercialMatricule(c);
      this.selectedCommercialName = this.getCommercialName(c);
      this.loadCommercialDotations(this.selectedCommercialMatricule);
    }
  }

  loadCommercialDotations(matricule: string) {
    if (!matricule) return;
    this.checkingDotations.set(true);
    this.uc.getByCommercial(matricule).pipe(takeUntil(this.d$)).subscribe({
      next: dotations => {
        this.commercialDotations.set(dotations);
        this.checkingDotations.set(false);
      },
      error: () => this.checkingDotations.set(false)
    });
  }

  hasPendingDotation(): boolean {
    return this.commercialDotations().some(d => d.status === 'PENDING');
  }

  filteredCommercials(): Commercial[] {
    const search = this.commercialSearch().toLowerCase().trim();
    if (!search) return this.commercials();
    return this.commercials().filter(c => {
      const name = this.getCommercialName(c).toLowerCase();
      const mat = this.getCommercialMatricule(c).toLowerCase();
      return name.includes(search) || mat.includes(search);
    });
  }

  selectCommercial(c: Commercial) {
    this.selectedCommercialMatricule = this.getCommercialMatricule(c);
    this.selectedCommercialName = this.getCommercialName(c);
    this.commercialSearch.set(this.getCommercialName(c));
    this.commercialDropdownOpen.set(false);
    this.loadCommercialDotations(this.selectedCommercialMatricule);
  }

  onCommercialSearchFocus() {
    this.commercialDropdownOpen.set(true);
  }

  onCommercialSearchBlur() {
    setTimeout(() => this.commercialDropdownOpen.set(false), 200);
  }

  clearCommercialSelection() {
    this.selectedCommercialMatricule = '';
    this.selectedCommercialName = '';
    this.commercialSearch.set('');
  }

  addLine() {
    this.lignes.push({
      uid: 'l' + Date.now() + Math.random(),
      productId: 0, skuInput: '', packagingType: '', requestedQty: 0, notes: ''
    });
  }

  removeLine(i: number) { if (this.lignes.length > 1) this.lignes.splice(i, 1); }

  onProductChange(l: LineForm) {
    const p = this.findProduct(l.productId);
    if (p) {
      l.skuInput = p.sku;
      l.packagingType = p.packagingType || l.packagingType;
      l.quantityPerCarton = p.quantityPerCarton ?? l.quantityPerCarton;
    } else {
      l.skuInput = '';
    }
  }

  onSkuInput(l: LineForm, sku: string) {
    l.skuInput = sku;
    if (!sku) { l.productId = 0; return; }
    const p = this.findProductBySku(sku);
    if (p) {
      l.productId = p.id;
      l.packagingType = p.packagingType || l.packagingType;
      l.quantityPerCarton = p.quantityPerCarton ?? l.quantityPerCarton;
    }
  }

  isValid(): boolean {
    return !!this.selectedCommercialMatricule
      && this.lignes.some(l => Number(l.productId) > 0 && l.requestedQty > 0 && !!this.findProduct(l.productId))
      && !this.hasInsufficientStock();
  }

  getDuplicateProducts(): string[] {
    const seen = new Set<number>();
    const dups = new Set<string>();
    for (const l of this.lignes) {
      if (!l.productId) continue;
      const p = this.findProduct(l.productId);
      if (!p) continue;
      if (seen.has(p.id)) dups.add(p.sku);
      else seen.add(p.id);
    }
    return Array.from(dups);
  }

  get validLineCount(): number {
    return this.lignes.filter(l => Number(l.productId) > 0).length;
  }

  goBack(): void {
    this.router.navigate(['/stock/dotations']);
  }

  sauvegarder() {
    if (this.saving() || this.hasPendingDotation()) return;
    this.errorMsg.set('');

    if (!this.selectedCommercialMatricule) {
      this.errorMsg.set('Veuillez sélectionner un commercial.');
      return;
    }

    const validLines = this.lignes.filter(l => Number(l.productId) > 0 && l.requestedQty > 0);
    if (validLines.length === 0) {
      this.errorMsg.set('Veuillez ajouter au moins une ligne de produit avec une quantité.');
      return;
    }

    const missing = validLines.find(l => !this.findProduct(l.productId));
    if (missing) {
      this.errorMsg.set('Un produit sélectionné n\'est plus disponible. Veuillez le re-sélectionner.');
      return;
    }

    const dups = this.getDuplicateProducts();
    if (dups.length > 0) {
      this.errorMsg.set(`Produit(s) dupliqué(s) dans la demande : ${dups.join(', ')}.`);
      return;
    }

    const insufficient = validLines.filter(l => this.isStockInsufficient(l));
    if (insufficient.length > 0) {
      const details = insufficient.map(l => {
        const p = this.findProduct(l.productId);
        const available = this.getBufferStockForLine(l);
        return `${p?.sku || 'Produit'} (demandé ${l.requestedQty}, dispo ${available})`;
      }).join('; ');
      this.errorMsg.set(`Stock tampon insuffisant : ${details}`);
      return;
    }

    this.saving.set(true);

    const items = validLines.map(l => {
      const p = this.findProduct(l.productId)!;
      return {
        productId: l.productId,
        productSku: p.sku,
        productName: p.designation || p.sku,
        packagingType: l.packagingType || p.packagingType || undefined,
        quantityPerCarton: l.quantityPerCarton || undefined,
        requestedQuantity: l.requestedQty,
        notes: l.notes || undefined
      };
    });

    const payload = {
      commercialId: this.selectedCommercialMatricule,
      commercialMatricule: this.selectedCommercialMatricule,
      commercialName: this.selectedCommercialName,
      justification: this.justification,
      items
    };

    this.uc.create(payload as any).pipe(takeUntil(this.d$)).subscribe({
      next: () => {
        this.saving.set(false);
        this.success.set(true);
        setTimeout(() => this.router.navigate(['/stock/dotations']), 2000);
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMsg.set(err?.error?.message || 'Erreur lors de la création de la dotation.');
      }
    });
  }

  ngOnDestroy() { this.d$.next(); this.d$.complete(); }
}
