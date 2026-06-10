import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { StockMockRepository } from '../../../infrastructure/repositories/stock-mock.repository';
import { StockMovement } from '../../../domain/models/stock.models';
@Injectable({ providedIn: 'root' })
export class GetMouvementsUseCase {
  private readonly repo = inject(StockMockRepository);
  execute(): Observable<StockMovement[]> { return this.repo.getMovements(); }
  executeByProduit(produitId: number): Observable<StockMovement[]> {
    return new Observable(obs => {
      this.repo.getMovements().subscribe(ms => {
        obs.next(ms.filter(m => m.product.id === produitId));
        obs.complete();
      });
    });
  }
}
