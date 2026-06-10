import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { StockMockRepository } from '../../../infrastructure/repositories/stock-mock.repository';
import { Supplier } from '../../../domain/models/stock.models';
@Injectable({ providedIn: 'root' })
export class GetFournisseursUseCase {
  private readonly repo = inject(StockMockRepository);
  execute(): Observable<Supplier[]> { return this.repo.getSuppliers(); }
}
