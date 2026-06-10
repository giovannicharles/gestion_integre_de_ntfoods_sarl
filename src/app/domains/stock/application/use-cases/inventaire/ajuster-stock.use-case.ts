import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { StockMockRepository } from '../../../infrastructure/repositories/stock-mock.repository';
import { StockLevel } from '../../../domain/models/stock.models';
@Injectable({ providedIn: 'root' })
export class AjusterStockUseCase {
  private readonly repo = inject(StockMockRepository);
  execute(stockLevelId: number, newQty: number, motif: string, par: string): Observable<StockLevel> {
    return this.repo.ajusterStock(stockLevelId, newQty, motif, par);
  }
}
