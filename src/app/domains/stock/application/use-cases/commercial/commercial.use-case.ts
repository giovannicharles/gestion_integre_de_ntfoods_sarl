import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { StockApiRepository } from '../../../infrastructure/repositories/stock-api.repository';
import { Commercial, InfoProduits } from '../../../domain/models';

@Injectable({ providedIn: 'root' })
export class CommercialUseCase {
  private repo = inject(StockApiRepository);
  getCommercials(): Observable<Commercial[]>    { return this.repo.getCommercials(); }
  getInfoProduits(date?: string): Observable<InfoProduits[]> { return this.repo.getInfoProduits(date); }
}
