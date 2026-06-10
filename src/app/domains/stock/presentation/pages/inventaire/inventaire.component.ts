import { Component, OnInit, signal, inject, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { Chart, registerables } from 'chart.js';
import { StockLevelUseCase } from '../../../application/use-cases/inventaire/stock-level.use-case';
import { StockRulesDomainService } from '../../../domain/services/stock-rules.domain.service';
import { StockLevel, Warehouse } from '../../../domain/models/stock.models';
Chart.register(...registerables);

@Component({ selector: 'app-inventaire', standalone: true, imports: [CommonModule, DecimalPipe, FormsModule, RouterLink], templateUrl: './inventaire.component.html', styleUrls: ['./inventaire.component.css'] })
export class InventaireComponent implements OnInit, AfterViewInit, OnDestroy {
  private d$ = new Subject<void>();
  private uc = inject(StockLevelUseCase);
  private rules = inject(StockRulesDomainService);
  @ViewChild('valueCanvas') valueCanvas!: ElementRef<HTMLCanvasElement>;
  private chart: Chart | null = null;
  loading = signal(true); all = signal<StockLevel[]>([]); filtered = signal<StockLevel[]>([]);
  paginated = signal<StockLevel[]>([]); warehouses = signal<Warehouse[]>([]);
  selected = signal<StockLevel | null>(null); showAjust = signal(false);
  ajustId = 0; ajustQty = 0; ajustMotif = ''; ajustSaving = signal(false);
  search = ''; filterW = ''; filterA = ''; viewMode = signal<'table' | 'cards'>('table');
  Math = Math;
  ps = 10; cp = signal(1); totalPages = signal(1);
  toastMsg = signal(''); toastType = signal<'success' | 'error'>('success');
  get pages() { return Array.from({ length: this.totalPages() }, (_, i) => i + 1); }
  ngOnInit() { forkJoin({ l: this.uc.getAll(), w: this.uc.getWarehouses() }).pipe(takeUntil(this.d$)).subscribe({ next: ({ l, w }) => { this.all.set(l); this.warehouses.set(w); this.applyFilters(); this.loading.set(false); }, error: () => this.loading.set(false) }); }
  ngAfterViewInit() { if (!this.loading()) this.buildChart(); }
  applyFilters() { let r = this.all(); if (this.search) { const q = this.search.toLowerCase(); r = r.filter(sl => (sl.productName || '').toLowerCase().includes(q) || (sl.productSku || '').toLowerCase().includes(q)); } if (this.filterW) r = r.filter(sl => sl.warehouseId === +this.filterW); if (this.filterA) r = r.filter(sl => sl.alertLevel === this.filterA); this.filtered.set(r); this.cp.set(1); const t = Math.ceil(r.length / this.ps) || 1; this.totalPages.set(t); this.goTo(1); setTimeout(() => this.buildChart(), 100); }
  goTo(p: number) { const n = Math.max(1, Math.min(p, this.totalPages())); this.cp.set(n); const s = (n - 1) * this.ps; this.paginated.set(this.filtered().slice(s, s + this.ps)); }
  buildChart() { if (!this.valueCanvas) return; this.chart?.destroy(); const top = [...this.filtered()].sort((a, b) => (b.stockValue || 0) - (a.stockValue || 0)).slice(0, 8); const ctx = this.valueCanvas.nativeElement.getContext('2d')!; this.chart = new Chart(ctx, { type: 'bar', data: { labels: top.map(sl => (sl.productName || sl.productSku || '').substring(0, 14)), datasets: [{ label: 'Valeur stock (FCFA)', data: top.map(sl => sl.stockValue ?? 0), backgroundColor: top.map(sl => sl.alertLevel === 'CRITIQUE' ? 'rgba(198,40,40,.8)' : sl.alertLevel === 'FAIBLE' ? 'rgba(230,81,0,.8)' : 'rgba(26,107,42,.8)'), borderRadius: 6, borderSkipped: false }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, 
  tooltip: { callbacks: { 
    label: c => ` ${new Intl.NumberFormat('fr-CM').format(Math.round(c.parsed.y ?? 0))} FCFA` } } },
     scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,.04)' }, ticks: { font: { family: 'DM Sans', size: 11 }, callback: (v) => new Intl.NumberFormat('fr-CM', { notation: 'compact' }).format(+v) } }, x: { grid: { display: false }, ticks: { font: { family: 'DM Sans', size: 10 }, maxRotation: 30 } } } } }); }
  getTotalVal() { return this.filtered().reduce((a, sl) => a + (sl.stockValue ?? 0), 0); }
  getPct(sl: StockLevel) { const rp = Number(sl.reorderPoint || 1); return Math.min(100, Math.round((Number(sl.quantity) / (rp * 6)) * 100)); }
  getColor(sl: StockLevel) { if (sl.alertLevel === 'CRITIQUE') return '#C62828'; if (sl.alertLevel === 'FAIBLE') return '#E65100'; return '#2E7D32'; }
  getNClass(n: string) { const m: Record<string, string> = { CRITIQUE: 'badge-danger', FAIBLE: 'badge-warning', NORMAL: 'badge-success', SURPLUS: 'badge-info' }; return m[n] || 'badge-neutral'; }
  countAlert(level: string) { return this.all().filter(sl => sl.alertLevel === level).length; }
  mathMin(a: number, b: number) { return Math.min(a, b); }
  fCFA(n: number) { return new Intl.NumberFormat('fr-CM').format(Math.round(n)) + ' FCFA'; }
  openAjust(sl: StockLevel) { this.ajustId = sl.id; this.ajustQty = sl.quantity; this.ajustMotif = ''; this.showAjust.set(true); }
  closeAjust() { this.showAjust.set(false); }
  getAjustSL() { return this.all().find(sl => sl.id === this.ajustId); }
  sauverAjust() { if (!this.ajustId || !this.ajustMotif || this.ajustSaving()) return; this.ajustSaving.set(true); this.uc.adjust(this.ajustId, this.ajustQty, this.ajustMotif).pipe(takeUntil(this.d$)).subscribe({ next: () => { this.ajustSaving.set(false); this.closeAjust(); this.showToast('Ajustement enregistré.', 'success'); this.uc.getAll().pipe(takeUntil(this.d$)).subscribe(l => { this.all.set(l); this.applyFilters(); }); }, error: () => this.ajustSaving.set(false) }); }
  showToast(msg: string, type: 'success' | 'error') { this.toastMsg.set(msg); this.toastType.set(type); setTimeout(() => this.toastMsg.set(''), 4000); }
  ngOnDestroy() { this.chart?.destroy(); this.d$.next(); this.d$.complete(); }
}
