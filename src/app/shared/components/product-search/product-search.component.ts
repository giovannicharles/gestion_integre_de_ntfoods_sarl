import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Product } from '../../../domains/stock/domain/models/stock.models';

/**
 * Champ de saisie de code produit avec suggestions en direct (combobox).
 *
 * Généralisé depuis la logique déjà écrite et éprouvée dans
 * `domains/stock/presentation/pages/commande-production/commande-production.component.ts`
 * (recherche par SKU exact/normalisé puis par désignation/type d'emballage) — reprise ici
 * à l'identique plutôt que réécrite une deuxième fois (P3, 2026-10-15). L'écran Stock
 * d'origine n'a pas été retouché pour rester sur un diff minimal ; il peut adopter ce
 * composant partagé dans une tranche séparée s'il faut unifier complètement les deux.
 *
 * Usage : `<app-product-search [products]="produits()" (productSelected)="onSelect($event)" />`.
 * Le parent fournit la liste de produits déjà chargée (filtrée par materialType si besoin) ;
 * ce composant ne fait aucun appel réseau lui-même.
 */
@Component({
  selector: 'app-product-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './product-search.component.html',
  styleUrls: ['./product-search.component.css']
})
export class ProductSearchComponent implements OnChanges {
  @Input() products: Product[] = [];
  @Input() placeholder = 'Code ou désignation du produit…';
  /** Pré-remplit le champ (ex. ligne existante en édition) sans déclencher de recherche. */
  @Input() initialLabel = '';
  @Output() productSelected = new EventEmitter<Product>();
  /** Émis quand le champ est vidé ou que la sélection est invalidée par une nouvelle saisie. */
  @Output() cleared = new EventEmitter<void>();

  searchText = signal('');
  showDropdown = signal(false);
  notFound = signal(false);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialLabel'] && !changes['initialLabel'].firstChange) {
      this.searchText.set(this.initialLabel);
    } else if (changes['initialLabel']?.firstChange && this.initialLabel) {
      this.searchText.set(this.initialLabel);
    }
  }

  getSearchResults(): Product[] {
    const raw = this.searchText();
    if (!raw || raw.length < 1) return this.products.slice(0, 20);
    const q = raw.toLowerCase().replace(/[\[\]]/g, '').trim();
    if (!q) return this.products.slice(0, 20);
    return this.products
      .filter(p =>
        (p.sku || '').toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().replace(/[-_\s]/g, '').includes(q.replace(/[-_\s]/g, '')) ||
        (p.designation || '').toLowerCase().includes(q) ||
        (p.packagingType || '').toLowerCase().includes(q)
      )
      .slice(0, 20);
  }

  onFocus(): void {
    this.showDropdown.set(true);
  }

  onBlur(): void {
    setTimeout(() => this.showDropdown.set(false), 200);
  }

  onInput(value: string): void {
    this.searchText.set(value);
    this.notFound.set(false);
    this.showDropdown.set(true);
    if (!value.trim()) {
      this.cleared.emit();
      return;
    }
    // Correspondance exacte par SKU (normalisée) : sélection immédiate, pas d'attente d'Entrée.
    const clean = value.replace(/[\[\]]/g, '').trim().toUpperCase();
    const normalized = clean.replace(/[-_\s]/g, '');
    const found = this.products.find(p => (p.sku || '').toUpperCase().replace(/[-_\s]/g, '') === normalized);
    if (found) {
      this.select(found);
      return;
    }
    if (this.getSearchResults().length === 0 && value.length >= 2) {
      this.notFound.set(true);
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      const results = this.getSearchResults();
      if (results.length > 0) this.select(results[0]);
    } else if (event.key === 'Escape') {
      this.showDropdown.set(false);
    }
  }

  select(p: Product): void {
    this.searchText.set(`[${p.sku}] ${p.designation || p.sku}`);
    this.showDropdown.set(false);
    this.notFound.set(false);
    this.productSelected.emit(p);
  }
}
