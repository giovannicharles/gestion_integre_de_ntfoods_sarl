import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, signal, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chart, registerables } from 'chart.js';
import { ApiService } from '../../../../../core/http/api.service';

Chart.register(...registerables);

interface ValuationSummary {
  centralValue: number;
  bufferValue: number;
  mobileValue: number;
  totalValue: number;
}

interface BufferValuationItem {
  productSku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalValue: number;
  priceType: string;
  currency: string;
}

interface BufferValuationResponse {
  totalValue: number;
  itemCount: number;
  currency: string;
  items: BufferValuationItem[];
}

@Component({
  selector: 'app-valorisation',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe],
  templateUrl: './valorisation.component.html',
  styleUrls: ['./valorisation.component.css']
})
export class ValorisationComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly api = inject(ApiService);

  @ViewChild('doughnutCanvas') doughnutCanvas!: ElementRef<HTMLCanvasElement>;
  private chart?: Chart;

  loading = signal(true);
  calculating = signal(false);
  error = signal('');
  toastMsg = signal('');
  toastType = signal<'success' | 'error'>('success');
  showPricePanel = signal(false);

  summary = signal<ValuationSummary | null>(null);
  bufferAuto = signal<BufferValuationResponse | null>(null);
  centralAuto = signal<BufferValuationResponse | null>(null);
  mobileAuto = signal<BufferValuationResponse | null>(null);
  perTypeValue = signal<{ type: string; label: string; value: number } | null>(null);
  selectedDetailLocation = signal<'buffer' | 'central' | 'mobile'>('buffer');

  unitPricesArray: { sku: string; price: number }[] = [{ sku: '', price: 0 }];

  Math = Math;

  ngOnInit(): void {
    this.loadAllAuto();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.buildChart(), 500);
  }

  private loadAllAuto() {
    this.loading.set(true);
    this.api.get<ValuationSummary>('stock/valuation/total/auto').subscribe({
      next: (summary) => {
        this.summary.set(summary);
        this.loading.set(false);
        this.buildChart();
      },
      error: () => {
        this.loading.set(false);
      }
    });
    this.api.get<BufferValuationResponse>('stock/valuation/buffer/auto').subscribe({
      next: (data) => this.bufferAuto.set(data),
      error: () => {}
    });
    this.api.get<BufferValuationResponse>('stock/valuation/central/auto').subscribe({
      next: (data) => this.centralAuto.set(data),
      error: () => {}
    });
    this.api.get<BufferValuationResponse>('stock/valuation/mobile/auto').subscribe({
      next: (data) => this.mobileAuto.set(data),
      error: () => {}
    });
  }

  get currentDetail(): BufferValuationResponse | null {
    const loc = this.selectedDetailLocation();
    if (loc === 'central') return this.centralAuto();
    if (loc === 'mobile') return this.mobileAuto();
    return this.bufferAuto();
  }

  addPriceRow(): void {
    this.unitPricesArray.push({ sku: '', price: 0 });
  }

  removePriceRow(index: number): void {
    this.unitPricesArray.splice(index, 1);
  }

  private buildUnitPrices(): { [key: string]: number } {
    const prices: { [key: string]: number } = {};
    this.unitPricesArray.forEach(row => {
      if (row.sku) prices[row.sku] = row.price;
    });
    return prices;
  }

  calculateTotal(): void {
    this.calculating.set(true);
    this.error.set('');
    this.api.post<ValuationSummary>('stock/valuation/total', { unitPrices: this.buildUnitPrices() }).subscribe({
      next: (data) => {
        this.summary.set(data);
        this.calculating.set(false);
        this.showToast('Valorisation totale calculée', 'success');
        this.buildChart();
      },
      error: () => {
        this.error.set('Erreur calcul valorisation');
        this.calculating.set(false);
        this.showToast('Erreur calcul valorisation', 'error');
      }
    });
  }

  calculateByType(type: string): void {
    this.calculating.set(true);
    this.error.set('');
    const labels: Record<string, string> = { central: 'Stock Central', buffer: 'Stock Tampon', mobile: 'Stock Mobile' };
    this.api.post<number>(`stock/valuation/${type}`, this.buildUnitPrices()).subscribe({
      next: (value) => {
        const numValue = typeof value === 'number' ? value : (value as any)?.value || 0;
        this.perTypeValue.set({ type, label: labels[type] || type, value: numValue });
        this.calculating.set(false);
        this.showToast(`${labels[type]}: ${this.fCFA(numValue)}`, 'success');
      },
      error: () => {
        this.error.set('Erreur calcul');
        this.calculating.set(false);
        this.showToast('Erreur calcul', 'error');
      }
    });
  }

  togglePricePanel(): void {
    this.showPricePanel.update(v => !v);
  }

  fCFA(n: number): string {
    return new Intl.NumberFormat('fr-CM').format(Math.round(n || 0)) + ' FCFA';
  }

  private buildChart(): void {
    if (this.chart) { this.chart.destroy(); this.chart = undefined; }
    if (!this.doughnutCanvas?.nativeElement) return;

    const s = this.summary();
    const buffer = this.bufferAuto();

    let labels: string[] = [];
    let data: number[] = [];

    if (s) {
      labels = ['Stock Central', 'Stock Tampon', 'Stock Mobile'];
      data = [s.centralValue, s.bufferValue, s.mobileValue];
    } else if (buffer) {
      labels = ['Stock Tampon (Auto)'];
      data = [buffer.totalValue];
    } else {
      return;
    }

    this.chart = new Chart(this.doughnutCanvas.nativeElement.getContext('2d')!, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: ['#1A6B2A', '#FFD700', '#2196F3'],
          borderWidth: 0,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { padding: 14, font: { size: 12 } } },
          tooltip: {
            callbacks: {
              label: (ctx: any) => {
                const total = (ctx.dataset.data as number[]).reduce((a, v) => a + v, 0);
                const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : '0';
                return ` ${ctx.label}: ${new Intl.NumberFormat('fr-CM').format(Math.round(ctx.parsed))} FCFA (${pct}%)`;
              }
            }
          }
        },
        cutout: '62%'
      }
    });
  }

  private showToast(msg: string, type: 'success' | 'error'): void {
    this.toastMsg.set(msg);
    this.toastType.set(type);
    setTimeout(() => this.toastMsg.set(''), 4000);
  }

  ngOnDestroy(): void {
    if (this.chart) this.chart.destroy();
  }
}
