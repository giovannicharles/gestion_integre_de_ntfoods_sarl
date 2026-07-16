import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { StockApiRepository } from '../../../infrastructure/repositories/stock-api.repository';
import { DashboardStatsResponse, StockLevel, StockMovement } from '../../../domain/models';

@Injectable({ providedIn: 'root' })
export class GetDashboardUseCase {
  private repo = inject(StockApiRepository);
  getStats(): Observable<DashboardStatsResponse> { return this.repo.getDashboard(); }
  getAlerts(): Observable<StockLevel[]>           { return this.repo.getAlerts(); }
  getMovements(): Observable<StockMovement[]>     { return this.repo.getMovements(); }
}
