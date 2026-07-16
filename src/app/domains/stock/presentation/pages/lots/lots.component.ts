import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { StockApiRepository } from '../../../infrastructure/repositories/stock-api.repository';
import { StockBatch, BatchStatus } from '../../../domain/models/stock.models';

@Component({
  selector: 'app-lots',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, DecimalPipe],
  templateUrl: './lots.component.html',
  styleUrls: ['./lots.component.css']
})
export class LotsComponent implements OnInit {
  private repo = inject(StockApiRepository);
  private d$ = new Subject<void>();

  batches = signal<StockBatch[]>([]);
  loading = signal(true);
  filter = signal<'TOUS'|'AVAILABLE'|'EXPIRED'>('TOUS');
  showForm = signal(false);

  newBatch: Partial<StockBatch> = {};

  ngOnInit() { this.loadAll(); }

  filtered() {
    const f = this.filter();
    if (f === 'TOUS') return this.batches();
    return this.batches().filter(b => b.status === f);
  }

  canCreate() {
    return this.newBatch.batchNumber && this.newBatch.productId && this.newBatch.productSku && this.newBatch.initialQuantity;
  }

  loadAll() {
    this.loading.set(true);
    this.repo.getStockBatches().pipe(takeUntil(this.d$)).subscribe({
      next: r => { this.batches.set(r); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  loadExpiringSoon() {
    this.loading.set(true);
    this.repo.getExpiringSoonBatches(30).pipe(takeUntil(this.d$)).subscribe({
      next: r => { this.batches.set(r); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  loadExpired() {
    this.loading.set(true);
    this.repo.getExpiredBatches().pipe(takeUntil(this.d$)).subscribe({
      next: r => { this.batches.set(r); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  createBatch() {
    const data = {
      ...this.newBatch,
      status: 'AVAILABLE' as BatchStatus
    };
    this.repo.createStockBatch(data).pipe(takeUntil(this.d$)).subscribe({
      next: () => { this.newBatch = {}; this.showForm.set(false); this.loadAll(); }
    });
  }

  setStatus(id: number, status: BatchStatus) {
    this.repo.updateStockBatchStatus(id, status).pipe(takeUntil(this.d$)).subscribe({
      next: () => this.loadAll()
    });
  }

  ngOnDestroy() { this.d$.next(); this.d$.complete(); }
}
