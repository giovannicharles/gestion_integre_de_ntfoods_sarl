import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { StockMockRepository } from '../../../infrastructure/repositories/stock-mock.repository';
import { Receipt, Supplier, Warehouse } from '../../../domain/models/stock.models';

@Injectable({ providedIn: 'root' })
export class ReceiptUseCase {
  private repo = inject(StockMockRepository);
  getAll():                    Observable<Receipt[]>  { return this.repo.getReceipts(); }
  getPending():                Observable<Receipt[]>  { return this.repo.getPendingReceipts(); }
  create(d: Partial<Receipt>): Observable<Receipt>   { return this.repo.createReceipt(d); }
  validateFirst(id: number, notes: string): Observable<Receipt> { return this.repo.validateFirst(id, notes); }
  validateSecond(id: number, notes: string): Observable<Receipt> { return this.repo.validateSecond(id, notes); }
  reject(id: number, reason: string): Observable<Receipt> { return this.repo.rejectReceipt(id, reason); }
  getSuppliers(): Observable<Supplier[]> { return this.repo.getSuppliers(); }
  getWarehouses(): Observable<Warehouse[]> { return this.repo.getWarehouses(); }
}
