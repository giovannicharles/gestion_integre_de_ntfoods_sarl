import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { StockApiRepository } from '../../../infrastructure/repositories/stock-api.repository';
import { ProductionBatch } from '../../../domain/models/stock.models';
@Injectable({ providedIn: 'root' })
export class GetProductionUseCase {
  private readonly repo = inject(StockApiRepository);
  execute(): Observable<ProductionBatch[]> { return this.repo.getBatches(); }
  valider(id: number): Observable<ProductionBatch> { return this.repo.validateBatch(id); }
}
