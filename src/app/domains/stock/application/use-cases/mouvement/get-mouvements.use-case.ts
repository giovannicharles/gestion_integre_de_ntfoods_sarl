import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { StockApiRepository } from '../../../infrastructure/repositories/stock-api.repository';
import { StockMovement } from '../../../domain/models/stock.models';
@Injectable({ providedIn: 'root' })
export class GetMouvementsUseCase {
  private readonly repo = inject(StockApiRepository);
  execute(): Observable<StockMovement[]> { return this.repo.getMovements(); }
  executeByProduit(produitId: number): Observable<StockMovement[]> {
    return this.repo.getMovements().pipe(map(ms => ms.filter(m => m.productId === produitId)));
  }
}
