import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { StockApiRepository } from '../../../infrastructure/repositories/stock-api.repository';
import { StockLevel } from '../../../domain/models/stock.models';
@Injectable({ providedIn: 'root' })
export class AjusterStockUseCase {
  private readonly repo = inject(StockApiRepository);
  execute(stockLevelId: number, newQty: number, motif: string, par: string): Observable<StockLevel> {
    return this.repo.adjustStock(stockLevelId, newQty, motif);
  }
}
