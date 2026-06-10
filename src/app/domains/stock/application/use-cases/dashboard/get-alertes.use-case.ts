import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { StockMockRepository } from '../../../infrastructure/repositories/stock-mock.repository';
import { StockAlert } from '../../../domain/models/stock.models';
@Injectable({ providedIn: 'root' })
export class GetAlertesUseCase {
  private readonly repo = inject(StockMockRepository);
  execute(): Observable<StockAlert[]> { return this.repo.getAlertes(); }
}
