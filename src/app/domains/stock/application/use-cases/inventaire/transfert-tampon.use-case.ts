import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { StockApiRepository } from '../../../infrastructure/repositories/stock-api.repository';
import { StockLevel } from '../../../domain/models/stock.models';
@Injectable({ providedIn: 'root' })
export class TransfertTamponUseCase {
  private readonly repo = inject(StockApiRepository);
  execute(stockLevelId: number, quantite: number, par: string): Observable<void> {
    return this.repo.transferToBuffer(stockLevelId, quantite);
  }
}
