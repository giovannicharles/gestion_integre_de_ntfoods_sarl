import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { ProductionService, LotBE } from '../../../infrastructure/production.service';
import { StockApiRepository } from '../../../../stock/infrastructure/repositories/stock-api.repository';
import { StockRulesDomainService } from '../../../../stock/domain/services/stock-rules.domain.service';
import { Product } from '../../../../stock/domain/models';

interface LotUI {
  id: number; productSku: string; productName: string;
  declaredQuantityKg: number; equivalentUnits: number;
  batchDate: string; statut: string; productionDate: string;
  createdAt: string; declaredBy: string; notes?: string;
  conditioningType?: string; conditioningQty?: number;
}

@Component({
  selector: 'app-production-lots',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, FormsModule],
  templateUrl: './production-lots.component.html',
  styleUrls: ['./production-lots.component.css']
})
export class ProductionLotsComponent implements OnInit {
  private readonly svc = inject(ProductionService);
  private readonly repo = inject(StockApiRepository);
  private readonly rules = inject(StockRulesDomainService);
  private readonly router = inject(Router);

  today = new Date();
  fCFA = (n: number) => new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA';
  loading = signal(false);

  lots = signal<LotUI[]>([]);
  products = signal<Product[]>([]);

  // Déclaration → page dédiée /stock/declaration-lot
  toastMsg = signal(''); toastType = signal<'success'|'error'>('success');

  nbDeclares = computed(() => this.lots().filter(l => l.statut === 'DECLARED_BY_PRODUCTION').length);
  nbValidesStock = computed(() => this.lots().filter(l => l.statut === 'VALIDATED_BY_STOCK').length);
  totalKgDeclares = computed(() => this.lots().reduce((s, l) => s + l.declaredQuantityKg, 0));
  totalUnites = computed(() => this.lots().reduce((s, l) => s + l.equivalentUnits, 0));

  ngOnInit(): void {
    this.loading.set(true);
    forkJoin({
      lots: this.svc.getLots(),
      prods: this.repo.getFinishedProducts(),
    }).pipe(finalize(() => this.loading.set(false))).subscribe({
      next: ({ lots, prods }) => {
        this.lots.set(lots.map(l => this.mapL(l)));
        this.products.set(prods);
      },
      error: () => {},
    });
  }

  // ── Déclaration lot → page dédiée ───────────────────────
  openDeclareModal() {
    this.router.navigate(['/production/declaration-lot']);
  }

  getProduitDesignation(sku: string): string {
    return this.lots().find(l => l.productSku === sku)?.productName ?? sku;
  }

  statutClass(s: string): string {
    if (s === 'VALIDATED_BY_STOCK') return 'badge bg-success';
    if (s === 'REJECTED') return 'badge bg-danger';
    return 'badge bg-orange';
  }

  statutLabel(s: string): string {
    if (s === 'VALIDATED_BY_STOCK') return 'Validé Stock';
    if (s === 'REJECTED') return 'Rejeté';
    return 'Déclaré Production';
  }

  getConditioningDisplay(l: LotUI): string {
    if (l.conditioningType && l.conditioningQty) {
      return `${l.conditioningQty} ${this.rules.getConditioningLabel(l.conditioningType)}`;
    }
    return `${l.declaredQuantityKg} kg`;
  }

  showToast(msg: string, type: 'success'|'error') {
    this.toastMsg.set(msg); this.toastType.set(type);
    setTimeout(() => this.toastMsg.set(''), 5000);
  }

  private mapL(l: LotBE): LotUI {
    return {
      id: l.id,
      productSku: l.productSku ?? '',
      productName: l.productName ?? '',
      declaredQuantityKg: l.declaredQuantityKg,
      equivalentUnits: l.equivalentUnits ?? 0,
      batchDate: l.batchDate ?? l.productionDate,
      statut: l.status,
      productionDate: l.productionDate,
      createdAt: l.createdAt,
      declaredBy: l.declaredBy ?? '',
      notes: l.notes,
      conditioningType: l.conditioningType,
      conditioningQty: l.conditioningQty,
    };
  }
}
