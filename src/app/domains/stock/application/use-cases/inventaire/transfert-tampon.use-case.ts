import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { StockMockRepository } from '../../../infrastructure/repositories/stock-mock.repository';
import { StockLevel } from '../../../domain/models/stock.models';
@Injectable({ providedIn: 'root' })
export class TransfertTamponUseCase {
  private readonly repo = inject(StockMockRepository);
  execute(stockLevelId: number, quantite: number, par: string): Observable<StockLevel> {
    const sl = this.repo['_stockLevels']?.find((s: StockLevel) => s.id === stockLevelId);
    const newQty = (sl?.quantity || 0) - quantite;
    return this.repo.ajusterStock(stockLevelId, newQty, 'Transfert vers magasin tampon', par);
  }
}
