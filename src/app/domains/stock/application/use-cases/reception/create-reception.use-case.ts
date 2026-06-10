import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { StockMockRepository } from '../../../infrastructure/repositories/stock-mock.repository';
import { Receipt } from '../../../domain/models/stock.models';
@Injectable({ providedIn: 'root' })
export class CreateReceptionUseCase {
  private readonly repo = inject(StockMockRepository);
  execute(data: Partial<Receipt>): Observable<Receipt> { return this.repo.creerReceipt(data); }
}
