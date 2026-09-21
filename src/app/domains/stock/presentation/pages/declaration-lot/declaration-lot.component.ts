import { Component, OnInit, signal, inject, OnDestroy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { ProductionBatchUseCase } from '../../../application/use-cases/production/production-batch.use-case';
import { StockRulesDomainService } from '../../../domain/services/stock-rules.domain.service';
import { Product } from '../../../domain/models';
import { AuthService } from '../../../../../core/auth/auth.service';

interface LotLineForm {
  uid: string;
  productId: number;
  productSku: string;
  productName: string;
  productUnit: string;
  conditioningType: string;
  conditioningQty: number;
  productionDate: string;
  notes: string;
  searchText: string;
  showDropdown: boolean;
  notFound: boolean;
}

@Component({
  selector: 'app-declaration-lot',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DecimalPipe],
  templateUrl: './declaration-lot.component.html',
  styleUrls: ['./declaration-lot.component.css']
})
export class DeclarationLotComponent implements OnInit, OnDestroy {
  private d$ = new Subject<void>();
  router = inject(Router);
  private batchUC = inject(ProductionBatchUseCase);
  private rules = inject(StockRulesDomainService);
  private auth = inject(AuthService);

  loading = signal(true);
  saving = signal(false);
  success = signal(false);
  errorMsg = signal('');
  successMsg = signal('');

  products = signal<Product[]>([]);
  lignes = signal<LotLineForm[]>([]);
  globalNotes = '';
  productCount = signal(0);

  private patchLine(uid: string, patch: Partial<LotLineForm>) {
    this.lignes.update(lines => lines.map(l => l.uid === uid ? { ...l, ...patch } : l));
  }
  private getLine(uid: string): LotLineForm | undefined {
    return this.lignes().find(l => l.uid === uid);
  }

  ngOnInit() {
    this.batchUC.getFinishedProducts().pipe(takeUntil(this.d$)).subscribe({
      next: (products) => {
        this.products.set(products);
        this.productCount.set(products.length);
        this.loading.set(false);
        this.addLine();
      },
      error: () => {
        this.errorMsg.set('Impossible de charger les produits finis. Vérifiez la connexion au serveur.');
        this.loading.set(false);
        this.addLine();
      }
    });
  }

  addLine() {
    const today = new Date().toISOString().split('T')[0];
    const newLine: LotLineForm = {
      uid: 'l' + Date.now() + Math.random(),
      productId: 0,
      productSku: '',
      productName: '',
      productUnit: '',
      conditioningType: 'CARTON',
      conditioningQty: 0,
      productionDate: today,
      notes: '',
      searchText: '',
      showDropdown: false,
      notFound: false
    };
    this.lignes.update(lines => [...lines, newLine]);
  }

  removeLine(i: number) {
    if (this.lignes().length > 1) {
      this.lignes.update(lines => lines.filter((_, idx) => idx !== i));
    }
  }

  getSearchResults(line: LotLineForm): Product[] {
    if (!line.searchText || line.searchText.length < 1) return this.products().slice(0, 20);
    const q = line.searchText.toLowerCase().replace(/[\[\]]/g, '').trim();
    if (!q) return this.products().slice(0, 20);
    return this.products()
      .filter(p =>
        (p.sku || '').toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().replace(/[-_\s]/g, '').includes(q.replace(/[-_\s]/g, '')) ||
        (p.designation || '').toLowerCase().includes(q) ||
        (p.packagingType || '').toLowerCase().includes(q)
      )
      .slice(0, 20);
  }

  onSearchFocus(line: LotLineForm) {
    this.patchLine(line.uid, { showDropdown: true });
  }

  onSearchBlur(line: LotLineForm) {
    setTimeout(() => { this.patchLine(line.uid, { showDropdown: false }); }, 200);
  }

  onSearchInput(line: LotLineForm) {
    if (line.productId > 0) {
      this.patchLine(line.uid, {
        productId: 0,
        productSku: '',
        productName: '',
        productUnit: '',
        conditioningType: 'CARTON',
        conditioningQty: 0,
        notFound: false,
        showDropdown: true
      });
    } else {
      this.patchLine(line.uid, { showDropdown: true, notFound: false });
    }

    const searchText = line.searchText || '';
    const results = this.getSearchResults(line);
    if (results.length === 0 && searchText.length >= 2) {
      this.patchLine(line.uid, { notFound: true });
    }
  }

  onSearchKeydown(event: KeyboardEvent, line: LotLineForm) {
    if (event.key === 'Enter') {
      event.preventDefault();
      const results = this.getSearchResults(line);
      if (results.length > 0) {
        this.selectProduct(line, results[0]);
      }
    } else if (event.key === 'Escape') {
      this.patchLine(line.uid, { showDropdown: false });
    }
  }

  selectProduct(line: LotLineForm, p: Product) {
    const condTypes = this.rules.getAvailableConditioningTypes(p);
    const defaultCond = condTypes[0] || 'CARTON';

    this.patchLine(line.uid, {
      productId: p.id,
      productSku: p.sku,
      productName: p.designation || p.sku,
      productUnit: p.unit || 'unite',
      searchText: `[${p.sku}] ${p.designation || p.sku}`,
      showDropdown: false,
      notFound: false,
      conditioningType: defaultCond
    });
  }

  clearProduct(line: LotLineForm) {
    this.patchLine(line.uid, {
      productId: 0,
      productSku: '',
      productName: '',
      productUnit: '',
      searchText: '',
      conditioningType: 'CARTON',
      conditioningQty: 0,
      notes: '',
      notFound: false,
      showDropdown: false
    });
  }

  getAvailableConditioningTypes(line: LotLineForm): string[] {
    const p = this.products().find(x => x.id === line.productId);
    return p ? this.rules.getAvailableConditioningTypes(p) : [];
  }

  getConditioningLabel(type: string): string {
    return this.rules.getConditioningLabel(type);
  }

  getPreviewKg(line: LotLineForm): number {
    if (!line.conditioningQty || !line.productId) return 0;
    const p = this.products().find(x => x.id === line.productId);
    return p ? this.rules.conditioningToKg(line.conditioningQty, line.conditioningType, p) : 0;
  }

  getPreviewUnits(line: LotLineForm): number {
    if (!line.conditioningQty || !line.productId) return 0;
    const p = this.products().find(x => x.id === line.productId);
    return p ? this.rules.conditioningToUnits(line.conditioningQty, line.conditioningType, p) : 0;
  }

  getPreviewBatchDate(line: LotLineForm): string {
    if (!line.productionDate) return '—';
    return this.rules.calcBatchDate(new Date(line.productionDate)).toLocaleDateString('fr-CM', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  getUnitsPerConditioning(line: LotLineForm): number {
    const p = this.products().find(x => x.id === line.productId);
    return p ? this.rules.getUnitsPerConditioning(line.conditioningType, p) : 0;
  }

  isValid(): boolean {
    return this.lignes().some(l => Number(l.productId) > 0 && l.conditioningQty > 0);
  }

  getValidLineCount(): number {
    return this.lignes().filter(l => Number(l.productId) > 0 && l.conditioningQty > 0).length;
  }

  getTotalKg(): number {
    return this.lignes()
      .filter(l => Number(l.productId) > 0 && l.conditioningQty > 0)
      .reduce((sum, l) => sum + this.getPreviewKg(l), 0);
  }

  getTotalUnits(): number {
    return this.lignes()
      .filter(l => Number(l.productId) > 0 && l.conditioningQty > 0)
      .reduce((sum, l) => sum + this.getPreviewUnits(l), 0);
  }

  sauvegarder() {
    if (!this.isValid() || this.saving()) return;
    this.saving.set(true);
    this.errorMsg.set('');

    const user = this.auth.getCurrentUser();
    if (!user) {
      this.errorMsg.set('Session expirée. Veuillez vous reconnecter.');
      this.saving.set(false);
      return;
    }

    const validLines = this.lignes().filter(l => Number(l.productId) > 0 && l.conditioningQty > 0);

    const declarations = validLines.map(l => {
      const p = this.products().find(x => x.id === l.productId)!;
      const kg = this.getPreviewKg(l);
      const units = this.getPreviewUnits(l);
      return {
        productId: l.productId,
        productSku: l.productSku,
        productName: l.productName,
        productUnit: l.productUnit,
        declaredQuantityKg: kg,
        equivalentUnits: l.conditioningQty,
        productionDate: l.productionDate,
        notes: l.notes || this.globalNotes || undefined,
        conditioningType: l.conditioningType,
        conditioningQty: l.conditioningQty,
      };
    });

    let completed = 0;
    let hasError = false;

    for (const decl of declarations) {
      this.batchUC.declare(decl).pipe(takeUntil(this.d$)).subscribe({
        next: (b) => {
          completed++;
          if (completed === declarations.length && !hasError) {
            this.saving.set(false);
            this.success.set(true);
            this.successMsg.set(`${declarations.length} lot(s) déclaré(s). En attente de validation par le gestionnaire de stock.`);
            setTimeout(() => this.router.navigate(['/stock/production']), 2500);
          }
        },
        error: (err) => {
          if (!hasError) {
            hasError = true;
            this.saving.set(false);
            this.errorMsg.set(err?.error?.message || 'Erreur lors de la déclaration du lot.');
          }
        }
      });
    }
  }

  ngOnDestroy() { this.d$.next(); this.d$.complete(); }
}
