import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { StockMockRepository } from '../../../infrastructure/repositories/stock-mock.repository';
import { Receipt } from '../../../domain/models/stock.models';
@Injectable({ providedIn: 'root' })
export class ValidateReceptionUseCase {
  private readonly repo = inject(StockMockRepository);
  executeGestionnaire(id: string, obs?: string): Observable<Receipt> { return this.repo.validerPremiere(id, obs); }
  executeChefProduction(id: string, obs?: string): Observable<Receipt> { return this.repo.validerSeconde(id, obs); }
  executeRejet(id: string, motif: string): Observable<Receipt> { return this.repo.rejeterReceipt(id, motif); }
}
