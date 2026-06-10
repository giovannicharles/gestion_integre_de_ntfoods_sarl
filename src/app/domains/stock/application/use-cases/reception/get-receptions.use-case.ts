import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { StockMockRepository } from '../../../infrastructure/repositories/stock-mock.repository';
import { Receipt } from '../../../domain/models/stock.models';
@Injectable({ providedIn: 'root' })
export class GetReceptionsUseCase {
  private readonly repo = inject(StockMockRepository);
  execute(): Observable<Receipt[]> { return this.repo.getReceipts(); }
  executeEnAttente(): Observable<Receipt[]> { return this.repo.getReceiptsEnAttente(); }
}
