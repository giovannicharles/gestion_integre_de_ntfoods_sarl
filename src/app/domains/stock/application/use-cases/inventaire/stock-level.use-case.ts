import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { StockApiRepository, BufferValuationResponse } from '../../../infrastructure/repositories/stock-api.repository';
import { StockLevel, StockMovement, Warehouse } from '../../../domain/models';

@Injectable({ providedIn: 'root' })
export class StockLevelUseCase {
  private repo = inject(StockApiRepository);
  getAll(): Observable<StockLevel[]>   { return this.repo.getStockLevels(); }
  getAlerts(): Observable<StockLevel[]>{ return this.repo.getAlerts(); }
  getWarehouses(): Observable<Warehouse[]> { return this.repo.getWarehouses(); }
  adjust(id: number, qty: number, reason: string, requestedBy?: string): Observable<StockLevel> {
    return this.repo.adjustStock(id, qty, reason, requestedBy);
  }
  getMovements(): Observable<StockMovement[]> { return this.repo.getMovements(); }
  getAllStockItems(): Observable<unknown[]> { return this.repo.getAllStockItems(); }
  getStockItemsByLocation(locationId: string): Observable<unknown[]> { return this.repo.getStockItemsByLocation(locationId); }
  transferToBuffer(id: number, quantity: number): Observable<void> { return this.repo.transferToBuffer(id, quantity); }
  replenishBuffer(productSku: string, quantity: number, requestedBy: string, notes?: string): Observable<any> {
    return this.repo.replenishBuffer(productSku, quantity, requestedBy, notes);
  }
  getBufferValuation(): Observable<BufferValuationResponse> {
    return this.repo.getBufferValuation();
  }
}
