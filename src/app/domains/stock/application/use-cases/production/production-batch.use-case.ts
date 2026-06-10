import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { StockMockRepository } from '../../../infrastructure/repositories/stock-mock.repository';
import { ProductionBatch, Product } from '../../../domain/models/stock.models';

@Injectable({ providedIn: 'root' })
export class ProductionBatchUseCase {
  private repo = inject(StockMockRepository);
  getAll(): Observable<ProductionBatch[]>    { return this.repo.getBatches(); }
  getPending(): Observable<ProductionBatch[]>{ return this.repo.getPendingBatches(); }
  declare(d: Partial<ProductionBatch>): Observable<ProductionBatch> { return this.repo.declareBatch(d); }
  validate(id: number, notes: string): Observable<ProductionBatch>  { return this.repo.validateBatch(id, notes); }
  reject(id: number, reason: string): Observable<ProductionBatch>   { return this.repo.rejectBatch(id, reason); }
  getFinishedProducts(): Observable<Product[]> {
    return new Observable(obs => {
      this.repo.getProducts().subscribe(ps => { obs.next(ps.filter(p => p.category === 'FINISHED_PRODUCT')); obs.complete(); });
    });
  }
}
