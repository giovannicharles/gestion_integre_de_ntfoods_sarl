// ═══ FICHIER : src/app/domains/stock/application/use-cases/production/production-batch.use-case.ts ═══
// REMPLACE : le fichier existant — StockMockRepository → StockApiRepository (connexion backend)
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { StockApiRepository } from '../../../infrastructure/repositories/stock-api.repository';
import { ProductionBatch, Product } from '../../../domain/models';

@Injectable({ providedIn: 'root' })
export class ProductionBatchUseCase {
  private repo = inject(StockApiRepository);
  getAll(): Observable<ProductionBatch[]>     { return this.repo.getBatches(); }
  getPending(): Observable<ProductionBatch[]> { return this.repo.getPendingBatches(); }
  declare(d: Partial<ProductionBatch>): Observable<ProductionBatch> { return this.repo.declareBatch(d); }
  validate(id: number, notes: string): Observable<ProductionBatch>  { return this.repo.validateBatch(id, notes); }
  reject(id: number, reason: string): Observable<ProductionBatch>   { return this.repo.rejectBatch(id, reason); }
  getFinishedProducts(): Observable<Product[]> {
    return this.repo.getFinishedProducts();
  }
  getStats(): Observable<Record<string, unknown>> {
    return this.repo.getBatchStats();
  }
}