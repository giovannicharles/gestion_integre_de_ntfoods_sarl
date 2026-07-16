import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { StockApiRepository } from '../../../infrastructure/repositories/stock-api.repository';
import { DashboardStatsResponse } from '../../../domain/models/stock.models';

/**
 * GetDashboardStatsUseCase - Use case pour récupérer les statistiques du dashboard
 * Utilise le repository API pour appeler le backend et récupérer les KPIs du dashboard
 */
@Injectable({ providedIn: 'root' })
export class GetDashboardStatsUseCase {
  // Injection du repository API pour communiquer avec le backend
  private readonly repo = inject(StockApiRepository);

  /**
   * Exécute le use case pour récupérer les statistiques du dashboard
   * @return Observable contenant les statistiques du dashboard
   */
  execute(): Observable<DashboardStatsResponse> {
    // Appel au repository API pour récupérer les statistiques depuis le backend
    return this.repo.getDashboard();
  }
}
