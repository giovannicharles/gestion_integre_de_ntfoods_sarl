import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { StockMockRepository } from '../../../infrastructure/repositories/stock-mock.repository';
import { DashboardStatsResponse, StockLevel, StockMovement } from '../../../domain/models/stock.models';

@Injectable({ providedIn: 'root' })
export class GetDashboardUseCase {
  private repo = inject(StockMockRepository);
  getStats(): Observable<DashboardStatsResponse> { return this.repo.getDashboard(); }
  getAlerts(): Observable<StockLevel[]>           { return this.repo.getAlerts(); }
  getMovements(): Observable<StockMovement[]>     { return this.repo.getMovements(); }
}
