import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { StockApiRepository, ReportData, GenerateReportRequest } from '../../../infrastructure/repositories/stock-api.repository';

@Injectable({ providedIn: 'root' })
export class ReportUseCase {
  private repo = inject(StockApiRepository);

  getAll(): Observable<ReportData[]> {
    return this.repo.getAllReports();
  }

  getByUser(generatedBy: string): Observable<ReportData[]> {
    return this.repo.getReportsByUser(generatedBy);
  }

  getByType(type: string): Observable<ReportData[]> {
    return this.repo.getReportsByType(type);
  }

  getById(id: number): Observable<ReportData> {
    return this.repo.getReportById(id);
  }

  generate(data: GenerateReportRequest): Observable<ReportData> {
    return this.repo.generateReport(data);
  }

  delete(id: number): Observable<void> {
    return this.repo.deleteReport(id);
  }
}
