import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { StockMockRepository } from '../../../infrastructure/repositories/stock-mock.repository';
import { ProductionBatch } from '../../../domain/models/stock.models';
@Injectable({ providedIn: 'root' })
export class GetProductionUseCase {
  private readonly repo = inject(StockMockRepository);
  execute(): Observable<ProductionBatch[]> { return this.repo.getProductionBatches(); }
  valider(id: number): Observable<ProductionBatch> { return this.repo.validerLotProduction(id); }
}
