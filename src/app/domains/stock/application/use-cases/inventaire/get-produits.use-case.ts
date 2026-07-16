import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { StockApiRepository } from '../../../infrastructure/repositories/stock-api.repository';
import { StockLevel } from '../../../domain/models/stock.models';
@Injectable({ providedIn: 'root' })
export class GetProduitsUseCase {
  private readonly repo = inject(StockApiRepository);
  execute(): Observable<StockLevel[]> { return this.repo.getStockLevels(); }
  executeByWarehouse(warehouseId: number): Observable<StockLevel[]> { return this.repo.getStockLevelsByWarehouse(warehouseId); }
}
