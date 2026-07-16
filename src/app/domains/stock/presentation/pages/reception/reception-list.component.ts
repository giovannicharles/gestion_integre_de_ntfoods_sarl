// ═══ FICHIER : src/app/domains/stock/presentation/pages/reception/reception-list.component.ts ═══
// Réécrit : aligné sur le nouveau contrat backend (receptionType au lieu de source,
// destinationLocationName au lieu de warehouseName, receiptNumber comme identifiant).
import { Component, OnInit, signal, inject, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { ReceiptUseCase } from '../../../application/use-cases/reception/receipt.use-case';
import { Receipt } from '../../../domain/models';

@Component({
  selector: 'app-reception-list',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, FormsModule],
  templateUrl: './reception-list.component.html',
  styleUrls: ['./reception-list.component.css']
})
export class ReceptionListComponent implements OnInit, OnDestroy {
  private d$ = new Subject<void>();
  private uc = inject(ReceiptUseCase);

  loading = signal(true);
  error = signal('');
  all = signal<Receipt[]>([]);
  filtered = signal<Receipt[]>([]);
  paginated = signal<Receipt[]>([]);
  pageSize = 10;
  currentPage = signal(1);
  totalPages = signal(1);
  search = '';
  filterStatut = '';
  filterType = '';

  toastMsg = signal('');
  toastType = signal<'success' | 'error'>('success');

  Math = Math;

  get pages() {
    return Array.from({ length: this.totalPages() }, (_, i) => i + 1);
  }

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.uc.getAll().pipe(takeUntil(this.d$)).subscribe({
      next: r => {
        this.all.set(r);
        this.applyFilters();
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Erreur de chargement des réceptions. Vérifiez la connexion au serveur.');
      }
    });
  }

  applyFilters() {
    let result = [...this.all()];

    if (this.search) {
      const s = this.search.toLowerCase();
      result = result.filter((r: Receipt) =>
        (r.receiptNumber || '').toLowerCase().includes(s) ||
        (r.sourceLabel || '').toLowerCase().includes(s) ||
        (r.destinationLocationName || '').toLowerCase().includes(s)
      );
    }

    if (this.filterStatut) {
      result = result.filter((r: Receipt) => r.status === this.filterStatut);
    }

    if (this.filterType) {
      result = result.filter((r: Receipt) => r.receptionType === this.filterType);
    }

    this.filtered.set(result);
    this.updatePag();
  }

  clearFilters() {
    this.search = '';
    this.filterStatut = '';
    this.filterType = '';
    this.applyFilters();
  }

  updatePag() {
    const t = Math.ceil(this.filtered().length / this.pageSize) || 1;
    this.totalPages.set(t);
    this.goToPage(1);
  }

  goToPage(p: number) {
    const n = Math.max(1, Math.min(p, this.totalPages()));
    this.currentPage.set(n);
    const s = (n - 1) * this.pageSize;
    this.paginated.set(this.filtered().slice(s, s + this.pageSize));
  }

  getEndIndex(): number {
    return Math.min(this.currentPage() * this.pageSize, this.filtered().length);
  }

  countStatus(s: string): number {
    return this.all().filter((r: Receipt) => r.status === s).length;
  }

  countType(t: string): number {
    return this.all().filter((r: Receipt) => r.receptionType === t).length;
  }

  sLabel(s: string) {
    const m: Record<string, string> = {
      PENDING_FIRST_VALIDATION: 'Att. 1ère validation',
      PENDING_SECOND_VALIDATION: 'Att. 2ème validation',
      VALIDATED: 'Validée',
      REJECTED: 'Rejetée'
    };
    return m[s] || s;
  }

  sClass(s: string) {
    const m: Record<string, string> = {
      PENDING_FIRST_VALIDATION: 'badge-warning',
      PENDING_SECOND_VALIDATION: 'badge-primary',
      VALIDATED: 'badge-success',
      REJECTED: 'badge-danger'
    };
    return m[s] || 'badge-neutral';
  }

  typeLabel(t: string) {
    const m: Record<string, string> = {
      CONSOMMABLE: 'Consommable',
      MATIERE_PREMIERE: 'Matière première',
      PRODUIT_FINI: 'Produit fini',
      MATERIEL: 'Matériel'
    };
    return m[t] || t;
  }

  typeClass(t: string) {
    const m: Record<string, string> = {
      CONSOMMABLE: 'badge-secondary',
      MATIERE_PREMIERE: 'badge-info',
      PRODUIT_FINI: 'badge-primary',
      MATERIEL: 'badge-info'
    };
    return m[t] || 'badge-neutral';
  }

  typeIcon(t: string) {
    const m: Record<string, string> = {
      CONSOMMABLE: 'fa-box',
      MATIERE_PREMIERE: 'fa-truck',
      PRODUIT_FINI: 'fa-industry',
      MATERIEL: 'fa-screwdriver-wrench'
    };
    return m[t] || 'fa-box';
  }

  hasEcart(r: Receipt): boolean {
    return r.items.some((item) => !!item.deviation && Math.abs(item.deviation) > 0);
  }

  showToast(msg: string, type: 'success' | 'error') {
    this.toastMsg.set(msg);
    this.toastType.set(type);
    setTimeout(() => this.toastMsg.set(''), 4000);
  }

  ngOnDestroy() {
    this.d$.next();
    this.d$.complete();
  }
}
