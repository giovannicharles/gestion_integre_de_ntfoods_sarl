import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { StockApiRepository, StockLocationDto } from '../../../infrastructure/repositories/stock-api.repository';
import { Receipt, ReceptionType, ReceiptStatus } from '../../../domain/models/stock.models';

/**
 * ReceiptUseCase - Point d'entrée unique pour toutes les opérations de réception.
 * Consolide 5 use-cases fragmentés trouvés dans le code repris (dont 3 reliés à
 * StockMockRepository, qui retournait des données factices sans jamais toucher
 * l'API réelle) en un seul, entièrement branché sur le backend réécrit.
 */
@Injectable({ providedIn: 'root' })
export class ReceiptUseCase {
  private repo = inject(StockApiRepository);

  getAll(type?: ReceptionType, status?: ReceiptStatus): Observable<Receipt[]> {
    return this.repo.getReceipts(type, status);
  }
  getPendingFirstValidation(type?: ReceptionType): Observable<Receipt[]> {
    return this.repo.getPendingFirstValidation(type);
  }
  getPendingSecondValidation(type?: ReceptionType): Observable<Receipt[]> {
    return this.repo.getPendingSecondValidation(type);
  }
  getByNumber(receiptNumber: string): Observable<Receipt> {
    return this.repo.getReceiptByNumber(receiptNumber);
  }
  create(data: Partial<Receipt>): Observable<Receipt> {
    return this.repo.createReceipt(data);
  }
  validateFirst(receiptNumber: string, notes: string, authCode?: string): Observable<Receipt> {
    return this.repo.validateFirst(receiptNumber, notes, authCode);
  }
  validateSecond(receiptNumber: string, notes: string, authCode?: string): Observable<Receipt> {
    return this.repo.validateSecond(receiptNumber, notes, authCode);
  }
  reject(receiptNumber: string, reason: string): Observable<Receipt> {
    return this.repo.rejectReceipt(receiptNumber, reason);
  }
  getDestinationLocations(): Observable<StockLocationDto[]> {
    return this.repo.getStockLocationsByType('STOCK_CENTRAL');
  }
  getProducts(receptionType?: ReceptionType) {
    return this.repo.getProducts(receptionType);
  }
}
