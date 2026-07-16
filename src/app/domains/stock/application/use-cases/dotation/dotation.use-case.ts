import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { StockApiRepository } from '../../../infrastructure/repositories/stock-api.repository';
import {
  DotationRequest, CreateDotationRequest, DotationStatus,
  Commercial, Product, StockLevel
} from '../../../domain/models';

@Injectable({ providedIn: 'root' })
export class DotationUseCase {
  private repo = inject(StockApiRepository);

  getAll(): Observable<DotationRequest[]> {
    return this.repo.getDotations();
  }

  getPending(): Observable<DotationRequest[]> {
    return this.repo.getPendingDotations();
  }

  getPaymentVerified(): Observable<DotationRequest[]> {
    return this.repo.getPaymentVerifiedDotations();
  }

  getQuantityValidated(): Observable<DotationRequest[]> {
    return this.repo.getQuantityValidatedDotations();
  }

  getReviewed(): Observable<DotationRequest[]> {
    return this.repo.getReviewedDotations();
  }

  getById(id: number): Observable<DotationRequest> {
    return this.repo.getDotationById(id);
  }

  getByCommercial(matricule: string): Observable<DotationRequest[]> {
    return this.repo.getDotationsByCommercial(matricule);
  }

  create(data: CreateDotationRequest): Observable<DotationRequest> {
    return this.repo.createDotation(data);
  }

  verifyPayment(id: number, verifierId: string): Observable<DotationRequest> {
    return this.repo.verifyPayment(id, verifierId);
  }

  validateQuantities(id: number, validatorId: string, comments: string, items?: any[]): Observable<DotationRequest> {
    return this.repo.validateQuantities(id, validatorId, comments, items);
  }

  review(id: number, reviewerId: string, reviewComments: string, items?: any[]): Observable<DotationRequest> {
    return this.repo.reviewDotation(id, reviewerId, reviewComments, items);
  }

  approve(id: number, approverId: string): Observable<DotationRequest> {
    return this.repo.approveDotation(id, approverId);
  }

  reviewAndApprove(id: number, managerId: string, reviewComments: string, items?: any[]): Observable<DotationRequest> {
    return this.repo.reviewAndApproveDotation(id, managerId, reviewComments, items);
  }

  reject(id: number, rejecterId: string, reason: string): Observable<DotationRequest> {
    return this.repo.rejectDotation(id, rejecterId, reason);
  }

  execute(id: number, executorId: string): Observable<DotationRequest> {
    return this.repo.executeDotation(id, executorId);
  }

  delete(id: number): Observable<void> {
    return this.repo.deleteDotation(id);
  }

  getCommercials(): Observable<Commercial[]> {
    return this.repo.getCommercials();
  }

  getProducts(): Observable<Product[]> {
    return this.repo.getProducts();
  }

  getStockLevels(): Observable<StockLevel[]> {
    return this.repo.getStockLevels();
  }
}
