import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { StockMockRepository } from '../../../infrastructure/repositories/stock-mock.repository';
import { StockLevel } from '../../../domain/models/stock.models';
@Injectable({ providedIn: 'root' })
export class GetProduitsUseCase {
  private readonly repo = inject(StockMockRepository);
  execute(): Observable<StockLevel[]> { return this.repo.getStockLevels(); }
  executeByWarehouse(warehouseId: number): Observable<StockLevel[]> { return this.repo.getStockLevelsByWarehouse(warehouseId); }
}
