// ═══ FICHIER : src/app/domains/stock/application/use-cases/orders/internal-order.use-case.ts ═══
// REMPLACE : le fichier existant — StockMockRepository → StockApiRepository (connexion backend)
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { StockApiRepository } from '../../../infrastructure/repositories/stock-api.repository';
import { InternalOrder, Product } from '../../../domain/models';

@Injectable({ providedIn: 'root' })
export class InternalOrderUseCase {
  private repo = inject(StockApiRepository);
  getAll(): Observable<InternalOrder[]>     { return this.repo.getOrders(); }
  getActive(): Observable<InternalOrder[]>  { return this.repo.getActiveOrders(); }
  create(d: Partial<InternalOrder>): Observable<InternalOrder> { return this.repo.createOrder(d); }
  approve(id: number, approverId: string, approverName: string): Observable<InternalOrder> {
    return this.repo.approveOrder(id, approverId, approverName);
  }
  cancel(id: number, cancelledBy: string, reason: string): Observable<InternalOrder> {
    return this.repo.cancelOrder(id, cancelledBy, reason);
  }
  deliver(id: number, productId: number, deliveredQty: number): Observable<InternalOrder> {
    return this.repo.deliverOrder(id, productId, deliveredQty);
  }
  getFinishedProducts(): Observable<Product[]> {
    return this.repo.getFinishedProducts();
  }
}