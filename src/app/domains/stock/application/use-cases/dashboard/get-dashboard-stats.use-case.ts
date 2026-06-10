import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { StockMockRepository } from '../../../infrastructure/repositories/stock-mock.repository';
import { DashboardStockStats } from '../../../domain/models/stock.models';
@Injectable({ providedIn: 'root' })
export class GetDashboardStatsUseCase {
  private readonly repo = inject(StockMockRepository);
  execute(): Observable<DashboardStockStats> { return this.repo.getDashboardStats(); }
}
