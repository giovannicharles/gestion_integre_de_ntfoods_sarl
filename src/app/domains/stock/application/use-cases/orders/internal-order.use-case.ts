import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { StockMockRepository } from '../../../infrastructure/repositories/stock-mock.repository';
import { InternalOrder, Product } from '../../../domain/models/stock.models';

@Injectable({ providedIn: 'root' })
export class InternalOrderUseCase {
  private repo = inject(StockMockRepository);
  getAll(): Observable<InternalOrder[]>     { return this.repo.getOrders(); }
  getActive(): Observable<InternalOrder[]>  { return this.repo.getActiveOrders(); }
  create(d: Partial<InternalOrder>): Observable<InternalOrder> { return this.repo.createOrder(d); }
  approve(id: number): Observable<InternalOrder> { return this.repo.approveOrder(id); }
  getFinishedProducts(): Observable<Product[]> {
    return new Observable(obs => {
      this.repo.getProducts().subscribe(ps => { obs.next(ps.filter(p => p.category === 'FINISHED_PRODUCT')); obs.complete(); });
    });
  }
}
