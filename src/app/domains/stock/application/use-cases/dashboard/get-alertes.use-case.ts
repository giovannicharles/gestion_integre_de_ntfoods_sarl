// ═══ FICHIER : src/app/domains/stock/application/use-cases/dashboard/get-alertes.use-case.ts ═══
// REMPLACE : le fichier existant — StockMockRepository → StockApiRepository
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { StockApiRepository } from '../../../infrastructure/repositories/stock-api.repository';
import { StockAlert } from '../../../domain/models/stock.models';

@Injectable({ providedIn: 'root' })
export class GetAlertesUseCase {
  private readonly repo = inject(StockApiRepository);
  execute(): Observable<StockAlert[]> { return this.repo.getStockAlerts(); }
}