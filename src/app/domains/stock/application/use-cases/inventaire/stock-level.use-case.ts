import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { StockMockRepository } from '../../../infrastructure/repositories/stock-mock.repository';
import { StockLevel, StockMovement, Warehouse } from '../../../domain/models/stock.models';

@Injectable({ providedIn: 'root' })
export class StockLevelUseCase {
  private repo = inject(StockMockRepository);
  getAll(): Observable<StockLevel[]>   { return this.repo.getStockLevels(); }
  getAlerts(): Observable<StockLevel[]>{ return this.repo.getAlerts(); }
  getWarehouses(): Observable<Warehouse[]> { return this.repo.getWarehouses(); }
  adjust(id: number, qty: number, reason: string): Observable<StockLevel> { return this.repo.adjustStock(id, qty, reason); }
  getMovements(): Observable<StockMovement[]> { return this.repo.getMovements(); }
}
