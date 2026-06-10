import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { StockMockRepository } from '../../../infrastructure/repositories/stock-mock.repository';
import { Commercial, InfoProduits } from '../../../domain/models/stock.models';

@Injectable({ providedIn: 'root' })
export class CommercialUseCase {
  private repo = inject(StockMockRepository);
  getCommercials(): Observable<Commercial[]>    { return this.repo.getCommercials(); }
  getInfoProduits(): Observable<InfoProduits[]> { return this.repo.getInfoProduits(); }
}
