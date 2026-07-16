import { Component, OnInit, signal, inject, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, forkJoin, takeUntil, catchError, of } from 'rxjs';
import { StockApiRepository } from '../../../infrastructure/repositories/stock-api.repository';
import { MobileStockSummary, MobileStockRotation, SlowStockCommercial, DotationRequest } from '../../../domain/models';

@Component({
  selector: 'app-mobile-stock',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DatePipe, DecimalPipe],
  templateUrl: './mobile-stock.component.html',
  styleUrls: ['./mobile-stock.component.css']
})
export class MobileStockComponent implements OnInit, OnDestroy {
  private d$ = new Subject<void>();
  private repo = inject(StockApiRepository);

  loading = signal(true);
  error = signal('');
  summaries = signal<MobileStockSummary[]>([]);
  rotations = signal<MobileStockRotation[]>([]);
  slowStocks = signal<SlowStockCommercial[]>([]);
  activeTab = signal<'overview' | 'rotation' | 'slow'>('overview');
  selectedSummary = signal<MobileStockSummary | null>(null);
  detailTab = signal<'stock' | 'rotation' | 'history'>('stock');
  dotationHistory = signal<DotationRequest[]>([]);
  detailLoading = signal(false);
  search = signal('');

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      s: this.repo.getMobileStockAll(),
      sl: this.repo.getSlowStockCommercials()
    }).pipe(takeUntil(this.d$)).subscribe({
      next: ({ s, sl }) => {
        this.summaries.set(s);
        this.slowStocks.set(sl);
        this.loadRotations(s);
      },
      error: () => {
        this.error.set('Erreur lors du chargement du stock mobile');
        this.loading.set(false);
      }
    });
  }

  private loadRotations(summaries: MobileStockSummary[]): void {
    if (summaries.length === 0) {
      this.rotations.set([]);
      this.loading.set(false);
      return;
    }
    const reqs = summaries.map(s => this.repo.getMobileStockRotation(s.commercialMatricule).pipe(
      catchError(() => of(null as MobileStockRotation | null))
    ));
    forkJoin(reqs).pipe(takeUntil(this.d$)).subscribe(rotations => {
      this.rotations.set(rotations.filter((r): r is MobileStockRotation => r !== null));
      this.loading.set(false);
    });
  }

  filteredSummaries() {
    const q = this.search().toLowerCase();
    return q
      ? this.summaries().filter(s => s.commercialMatricule.toLowerCase().includes(q))
      : this.summaries();
  }

  rotationFor(matricule: string) {
    return this.rotations().find(r => r.commercialMatricule === matricule);
  }

  slowFor(matricule: string) {
    return this.slowStocks().find(s => s.matricule === matricule);
  }

  openDetail(s: MobileStockSummary) {
    this.selectedSummary.set(s);
    this.detailTab.set('stock');
    this.dotationHistory.set([]);
    this.detailLoading.set(true);
    this.repo.getDotationsByCommercial(s.commercialMatricule).pipe(
      takeUntil(this.d$),
      catchError(() => of([]))
    ).subscribe(h => {
      this.dotationHistory.set(h);
      this.detailLoading.set(false);
    });
  }

  closeDetail() {
    this.selectedSummary.set(null);
  }

  getStatusClass(status: string) {
    const m: Record<string, string> = {
      DRAFT: 'badge-warning', PENDING_CASH: 'badge-primary',
      PENDING_ACCOUNTANT: 'badge-secondary', APPROVED: 'badge-success',
      REJECTED: 'badge-danger', CLOSED: 'badge-success'
    };
    return m[status] || 'badge-neutral';
  }

  getStatusLabel(status: string) {
    const m: Record<string, string> = {
      DRAFT: 'Brouillon', PENDING_CASH: 'Att. caissière',
      PENDING_ACCOUNTANT: 'Att. comptable', APPROVED: 'Approuvée',
      REJECTED: 'Rejetée', CLOSED: 'Clôturée'
    };
    return m[status] || status;
  }

  get totalStockValue() {
    return this.summaries().reduce((a, s) => a + (s.totalValue || 0), 0);
  }

  get totalItems() {
    return this.summaries().reduce((a, s) => a + (s.totalItems || 0), 0);
  }

  get totalOut() {
    return this.rotations().reduce((a, r) => a + (r.totalOut || 0), 0);
  }

  fCFA(n: number) {
    return new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA';
  }

  ngOnDestroy(): void {
    this.d$.next();
    this.d$.complete();
  }
}
