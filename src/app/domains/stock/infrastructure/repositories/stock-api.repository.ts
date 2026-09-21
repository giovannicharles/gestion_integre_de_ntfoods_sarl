// ═══ FICHIER : src/app/domains/stock/infrastructure/repositories/stock-api.repository.ts ═══
// URLs alignées sur le backend Spring Boot (v1/stock/... et stock/...)

import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiService } from '../../../../core/http/api.service';
import {
  StockLevel, Receipt, ProductionBatch, InternalOrder,
  StockMovement, Commercial, InfoProduits, DashboardStatsResponse,
  StockAlert, Warehouse, Product, Brand, ProductLine, ProductVariant, Supplier,
  ReceptionType, ReceiptStatus,
  DotationRequest, CreateDotationRequest, DotationStatus,
  StockBatch, StockAuditLog, StockAlertEntity,
  MobileStockSummary, MobileStockRotation, SlowStockCommercial
} from '../../domain/models/stock.models';

export interface ReportData {
  id: number;
  title?: string;
  type: string;
  periodStart: string;
  periodEnd: string;
  format: string;
  generatedBy: string;
  generatedAt: string;
  status?: string;
  filePath?: string;
}

export interface GenerateReportRequest {
  type: string;
  periodStart: string;
  periodEnd: string;
  generatedBy: string;
  format: string;
}

export interface StockLocationDto {
  id: string;
  type: 'STOCK_CENTRAL' | 'STOCK_BUFFER' | 'STOCK_MOBILE' | 'MAGASIN';
  typeLabel: string;
  name: string;
  description?: string;
  managerId?: string;
  address?: string;
  phone?: string;
  email?: string;
  active?: boolean;
  itemCount?: number;
}

export interface StockThresholdDto {
  id?: number;
  locationId: string;
  productId: number;
  productSku: string;
  minimumThreshold: number;
  maximumThreshold: number;
  reorderThreshold: number;
  reorderQuantity: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BufferValuationItem {
  productSku: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalValue: number;
  priceType: string;
  currency: string;
}

export interface BufferValuationResponse {
  totalValue: number;
  itemCount: number;
  currency: string;
  items: BufferValuationItem[];
}

interface PageResponse<T> {
  content: T[];
  currentPage?: number;
  pageSize?: number;
  totalElements?: number;
}

@Injectable({ providedIn: 'root' })
export class StockApiRepository {
  private readonly api = inject(ApiService);

  private pageParams = { page: '0', size: '200' };

  // ── CATALOGUE ─────────────────────────────────────────────
  getProducts(materialType?: ReceptionType): Observable<Product[]> {
    return this.api.get<Product[]>('v1/stock/products', materialType ? { materialType } : undefined)
      .pipe(catchError(() => of([])));
  }
  getBrands(): Observable<Brand[]> {
    return this.api.get<Brand[]>('stock/product-classifications/brands').pipe(catchError(() => of([] as Brand[])));
  }
  getLines(brandId?: number): Observable<ProductLine[]> {
    return this.api.get<ProductLine[]>('stock/product-classifications/lines', brandId ? { brandId: String(brandId) } : undefined)
      .pipe(catchError(() => of([] as ProductLine[])));
  }
  getVariants(productLineId?: number): Observable<ProductVariant[]> {
    return this.api.get<ProductVariant[]>('stock/product-classifications/variants', productLineId ? { productLineId: String(productLineId) } : undefined)
      .pipe(catchError(() => of([] as ProductVariant[])));
  }
  getWarehouses(): Observable<Warehouse[]> {
    return this.api.get<any[]>('stock/locations').pipe(catchError(() => of([])));
  }
  getSuppliers(): Observable<Supplier[]> {
    return this.api.get<Supplier[]>('v1/stock/suppliers').pipe(catchError(() => of([] as Supplier[])));
  }

  // ── DASHBOARD (/api/v1/stock/dashboard/...) ───────────────
  getDashboard(): Observable<DashboardStatsResponse> {
    return this.api.get('v1/stock/dashboard/stats');
  }

  getStockLevels(): Observable<StockLevel[]> {
    return this.api.get<PageResponse<StockLevel>>('v1/stock/dashboard/stock-levels', this.pageParams).pipe(
      map(r => r.content || []),
      catchError(() => of([]))
    );
  }

  getStockLevelsByWarehouse(id: number): Observable<StockLevel[]> {
    return this.api.get<StockLevel[]>(`v1/stock/dashboard/stock-levels/warehouse/${id}`).pipe(catchError(() => of([])));
  }

  getAlerts(): Observable<StockLevel[]> {
    return this.api.get<PageResponse<StockLevel>>('v1/stock/dashboard/alerts', this.pageParams).pipe(
      map(r => r.content || []),
      catchError(() => of([]))
    );
  }

  getCriticalAlerts(): Observable<StockLevel[]> {
    return this.getAlerts().pipe(map(levels => levels.filter(sl => sl.alertLevel === 'CRITIQUE')));
  }

  adjustStock(stockLevelId: number, newQuantity: number, reason: string, requestedBy?: string): Observable<StockLevel> {
    return this.api.post('stock/items/adjust', { stockLevelId, newQuantity, reason, requestedBy });
  }

  transferToBuffer(id: number, quantity: number): Observable<void> {
    return this.api.post(`stock/levels/${id}/transfer-to-buffer?quantity=${quantity}`, {});
  }

  getAllStockItems(): Observable<unknown[]> {
    return this.api.get<unknown[]>('stock/items/all').pipe(catchError(() => of([])));
  }

  getStockItemsByLocation(locationId: string): Observable<unknown[]> {
    return this.api.get<unknown[]>(`stock/items/location/${locationId}`).pipe(catchError(() => of([])));
  }

  getPackagingsForProduct(locationId: string, productSku: string): Observable<any[]> {
    return this.api.get<any[]>(`stock/items/location/${locationId}/sku/${productSku}/packagings`).pipe(catchError(() => of([])));
  }

  replenishBuffer(productSku: string, quantity: number, requestedBy: string, notes?: string): Observable<any> {
    return this.api.post('stock/items/replenish-buffer', {
      productSku,
      quantity,
      requestedBy,
      notes
    });
  }

  addToBuffer(productSku: string, quantity: number, requestedBy: string, notes?: string): Observable<any> {
    return this.api.post('stock/items/add-to-buffer', {
      productSku,
      quantity,
      requestedBy,
      notes
    });
  }

  getBufferValuation(): Observable<BufferValuationResponse> {
    return this.api.get<BufferValuationResponse>('stock/valuation/buffer/auto').pipe(catchError(() => of({ totalValue: 0, itemCount: 0, currency: 'XAF', items: [] })));
  }

  // ── RECEPTIONS (/api/v1/stock/receptions/...) ─────────────
  // Réécrit entièrement : l'ancienne version appelait v1/stock/receipts (chemin
  // inexistant côté backend) et getReceipts() était un stub retournant toujours [],
  // masquant silencieusement le fait qu'aucune réception n'était jamais chargée.
  getReceipts(type?: ReceptionType, status?: ReceiptStatus): Observable<Receipt[]> {
    const params: Record<string, string> = {};
    if (type) params['type'] = type;
    if (status) params['status'] = status;
    return this.api.get<Receipt[]>('v1/stock/receptions', params).pipe(catchError(() => of([])));
  }
  getPendingFirstValidation(type?: ReceptionType): Observable<Receipt[]> {
    return this.api.get<Receipt[]>('v1/stock/receptions/en-attente-premiere-validation', type ? { type } : undefined)
      .pipe(catchError(() => of([])));
  }
  getPendingSecondValidation(type?: ReceptionType): Observable<Receipt[]> {
    return this.api.get<Receipt[]>('v1/stock/receptions/en-attente-seconde-validation', type ? { type } : undefined)
      .pipe(catchError(() => of([])));
  }
  getReceiptByNumber(receiptNumber: string): Observable<Receipt> {
    return this.api.get<Receipt>(`v1/stock/receptions/${receiptNumber}`);
  }
  createReceipt(data: any): Observable<Receipt> {
    return this.api.post('v1/stock/receptions', data);
  }
  validateFirst(receiptNumber: string, notes: string, authCode?: string): Observable<Receipt> {
    return this.api.post(`v1/stock/receptions/${receiptNumber}/premiere-validation`, { notes, authCode });
  }
  validateSecond(receiptNumber: string, notes: string, authCode?: string): Observable<Receipt> {
    return this.api.post(`v1/stock/receptions/${receiptNumber}/seconde-validation`, { notes, authCode });
  }
  rejectReceipt(receiptNumber: string, reason: string): Observable<Receipt> {
    return this.api.post(`v1/stock/receptions/${receiptNumber}/rejet`, { reason });
  }

  // ── STOCK LOCATIONS (/api/stock/locations/...) ─────────────
  getStockLocationsByType(type: 'STOCK_CENTRAL' | 'STOCK_BUFFER' | 'STOCK_MOBILE'): Observable<StockLocationDto[]> {
    return this.api.get<StockLocationDto[]>(`stock/locations/type/${type}`).pipe(catchError(() => of([])));
  }

  // ── PRODUCTION BATCHES ───────────────────────────────────
  getBatches(): Observable<ProductionBatch[]> {
    return this.api.get<ProductionBatch[]>('v1/stock/production/batches').pipe(catchError(() => of([])));
  }
  getPendingBatches(): Observable<ProductionBatch[]> {
    return this.api.get<ProductionBatch[]>('v1/stock/production/batches/pending').pipe(catchError(() => of([])));
  }
  getBatchById(id: number): Observable<ProductionBatch> { return this.api.get(`v1/stock/production/batches/${id}`); }
  declareBatch(data: any): Observable<ProductionBatch> { return this.api.post('v1/stock/production/batches/declare', data); }
  validateBatch(id: number, notes = ''): Observable<ProductionBatch> {
    return this.api.post(`v1/stock/production/batches/${id}/validate`, {}, { notes });
  }
  rejectBatch(id: number, reason: string): Observable<ProductionBatch> {
    return this.api.post(`v1/stock/production/batches/${id}/reject`, {}, { reason });
  }
  getBatchStats(): Observable<Record<string, unknown>> {
    return this.api.get<Record<string, unknown>>('v1/stock/production/batches/stats').pipe(catchError(() => of({})));
  }

  // ── INTERNAL ORDERS (/api/stock/internal-orders) ────────
  getOrders(): Observable<InternalOrder[]> {
    return this.api.get<InternalOrder[]>('stock/internal-orders').pipe(catchError(() => of([])));
  }
  getActiveOrders(): Observable<InternalOrder[]> {
    return this.api.get<InternalOrder[]>('stock/internal-orders/active').pipe(catchError(() => of([])));
  }
  getOrderById(id: number): Observable<InternalOrder> {
    return this.api.get<InternalOrder>(`stock/internal-orders/${id}`);
  }
  createOrder(data: any): Observable<InternalOrder> {
    return this.api.post('stock/internal-orders', data);
  }
  approveOrder(id: number, approverId: string, approverName: string): Observable<InternalOrder> {
    return this.api.post(`stock/internal-orders/${id}/approve`, { approverId, approverName });
  }
  cancelOrder(id: number, cancelledBy: string, reason: string): Observable<InternalOrder> {
    return this.api.post(`stock/internal-orders/${id}/cancel`, { cancelledBy, reason });
  }
  deliverOrder(id: number, productId: number, deliveredQty: number): Observable<InternalOrder> {
    return this.api.post(`stock/internal-orders/${id}/deliver`, { productId, deliveredQty });
  }

  // ── MOVEMENTS (/api/stock/movements/...) ──────────────────
  getMovements(): Observable<StockMovement[]> {
    return this.api.get<StockMovement[]>('stock/movements').pipe(catchError(() => of([])));
  }

  // ── COMMERCIALS ───────────────────────────────────────────
  getCommercials(): Observable<Commercial[]> {
    return this.api.get<MobileStockSummary[]>('stock/mobile-tracking/all').pipe(
      catchError(() => of([] as MobileStockSummary[])),
      map(list => list.map(s => ({
        id: this.matriculeToId(s.commercialMatricule),
        matricule: s.commercialMatricule,
        name: s.commercialName || s.commercialMatricule,
        phone: s.phone || '',
        vehicle: s.vehicle || '',
        active: true
      })))
    );
  }

  getInfoProduits(date?: string): Observable<InfoProduits[]> {
    const fallback = catchError<InfoProduits[], Observable<InfoProduits[]>>(() => of([]));
    return date
      ? this.api.get<InfoProduits[]>(`stock/info-produits?date=${date}`).pipe(fallback)
      : this.api.get<InfoProduits[]>('stock/info-produits').pipe(fallback);
  }

  // ── MOBILE STOCK TRACKING ───────────────────────────────────
  getMobileStockAll(): Observable<MobileStockSummary[]> {
    return this.api.get<MobileStockSummary[]>('stock/mobile-tracking/all').pipe(catchError(() => of([])));
  }

  getMobileStockByCommercial(matricule: string): Observable<MobileStockSummary> {
    return this.api.get<MobileStockSummary>(`stock/mobile-tracking/commercial/${matricule}`);
  }

  getMobileStockRotation(matricule: string, days = 30): Observable<MobileStockRotation> {
    return this.api.get<MobileStockRotation>(`stock/mobile-tracking/commercial/${matricule}/rotation`, { days: String(days) });
  }

  getSlowStockCommercials(daysThreshold = 30, salesThreshold = 10): Observable<SlowStockCommercial[]> {
    return this.api.get<SlowStockCommercial[]>('stock/mobile-tracking/slow-stock', {
      daysThreshold: String(daysThreshold),
      salesThreshold: String(salesThreshold)
    }).pipe(catchError(() => of([])));
  }

  private matriculeToId(matricule: string): number {
    let hash = 0;
    for (let i = 0; i < matricule.length; i++) {
      hash = ((hash << 5) - hash) + matricule.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  getFinishedProducts(): Observable<Product[]> {
    return this.getProducts().pipe(
      map(ps => ps.filter((p: Product) => p.materialType === 'PRODUIT_FINI')),
      catchError(() => of([]))
    );
  }

  // ── DOTATIONS (/api/stock/dotations/...) ─────────────────
  getDotations(): Observable<DotationRequest[]> {
    return this.api.get<DotationRequest[]>('stock/dotations').pipe(catchError(() => of([])));
  }
  getDotationById(id: number): Observable<DotationRequest> {
    return this.api.get<DotationRequest>(`stock/dotations/${id}`);
  }
  getPendingDotations(): Observable<DotationRequest[]> {
    return this.api.get<DotationRequest[]>('stock/dotations/pending').pipe(catchError(() => of([])));
  }
  getPaymentVerifiedDotations(): Observable<DotationRequest[]> {
    return this.api.get<DotationRequest[]>('stock/dotations/payment-verified').pipe(catchError(() => of([])));
  }
  getQuantityValidatedDotations(): Observable<DotationRequest[]> {
    return this.api.get<DotationRequest[]>('stock/dotations/quantity-validated').pipe(catchError(() => of([])));
  }
  getReviewedDotations(): Observable<DotationRequest[]> {
    return this.api.get<DotationRequest[]>('stock/dotations/reviewed').pipe(catchError(() => of([])));
  }
  getDotationsByCommercial(matricule: string): Observable<DotationRequest[]> {
    return this.api.get<DotationRequest[]>(`stock/dotations/commercial/${matricule}`).pipe(catchError(() => of([])));
  }
  createDotation(data: CreateDotationRequest): Observable<DotationRequest> {
    return this.api.post('stock/dotations', data);
  }
  verifyPayment(id: number, verifierId: string): Observable<DotationRequest> {
    return this.api.put(`stock/dotations/${id}/verify-payment`, {}, { verifierId });
  }
  validateQuantities(id: number, validatorId: string, comments: string, items?: any[]): Observable<DotationRequest> {
    return this.api.put(`stock/dotations/${id}/validate-quantities`, { validatorId, comments, items });
  }
  reviewDotation(id: number, reviewerId: string, reviewComments: string, items?: any[]): Observable<DotationRequest> {
    return this.api.put(`stock/dotations/${id}/review`, { reviewerId, reviewComments, items });
  }
  approveDotation(id: number, approverId: string): Observable<DotationRequest> {
    return this.api.put(`stock/dotations/${id}/approve`, {}, { approverId });
  }
  reviewAndApproveDotation(id: number, managerId: string, reviewComments: string, items?: any[]): Observable<DotationRequest> {
    return this.api.put(`stock/dotations/${id}/review-and-approve`, { managerId, reviewComments, items });
  }
  rejectDotation(id: number, rejecterId: string, reason: string): Observable<DotationRequest> {
    return this.api.put(`stock/dotations/${id}/reject`, {}, { rejecterId, reason });
  }
  executeDotation(id: number, executorId: string): Observable<DotationRequest> {
    return this.api.put(`stock/dotations/${id}/execute`, {}, { executorId });
  }
  deleteDotation(id: number): Observable<void> {
    return this.api.delete(`stock/dotations/${id}`);
  }

  // ── REPORTS (/api/stock/reports/...) ──────────────────────
  getAllReports(): Observable<ReportData[]> {
    return this.api.get<ReportData[]>('stock/reports').pipe(catchError(() => of([])));
  }
  getReportsByUser(generatedBy: string): Observable<ReportData[]> {
    return this.api.get<ReportData[]>(`stock/reports/user/${generatedBy}`).pipe(catchError(() => of([])));
  }
  getReportsByType(type: string): Observable<ReportData[]> {
    return this.api.get<ReportData[]>(`stock/reports/type/${type}`).pipe(catchError(() => of([])));
  }
  getReportById(id: number): Observable<ReportData> {
    return this.api.get<ReportData>(`stock/reports/${id}`);
  }
  generateReport(data: GenerateReportRequest): Observable<ReportData> {
    return this.api.post('stock/reports/generate', data);
  }
  deleteReport(id: number): Observable<void> {
    return this.api.delete(`stock/reports/${id}`);
  }
  downloadReportFile(id: number): Observable<Blob> {
    return this.api.getBlob(`stock/reports/${id}/download`);
  }

  // ── EXPORTS PDF (/api/stock/export/...) ───────────────────
  exportFicheSyntheseStock(locationType: string, motif?: string): Observable<Blob> {
    return this.api.getBlob('stock/export/fiche-synthese/stock/' + locationType, motif ? { motif } : undefined);
  }

  exportFicheSyntheseSorties(periodStart: string, periodEnd: string, motif?: string): Observable<Blob> {
    return this.api.getBlob('stock/export/fiche-synthese/sorties', { periodStart, periodEnd, ...(motif ? { motif } : {}) });
  }

  exportFicheSyntheseEntrees(periodStart: string, periodEnd: string, motif?: string): Observable<Blob> {
    return this.api.getBlob('stock/export/fiche-synthese/entrees', { periodStart, periodEnd, ...(motif ? { motif } : {}) });
  }

  exportFicheSyntheseGlobale(periodStart: string, periodEnd: string, motif?: string): Observable<Blob> {
    return this.api.getBlob('stock/export/fiche-synthese/globale', { periodStart, periodEnd, ...(motif ? { motif } : {}) });
  }

  exportFicheSyntheseNTFoods(motif?: string, nom?: string, ville?: string, zone?: string, nombreColis?: number): Observable<Blob> {
    const params: Record<string, string> = {};
    if (motif) params['motif'] = motif;
    if (nom) params['nom'] = nom;
    if (ville) params['ville'] = ville;
    if (zone) params['zone'] = zone;
    if (nombreColis != null) params['nombreColis'] = String(nombreColis);
    return this.api.getBlob('stock/export/fiche-synthese/ntfoods', params);
  }

  exportStockItems(locationId: string, format: string): Observable<Blob> {
    return this.api.getBlob(`stock/export/items/${locationId}/${format}`);
  }

  exportStockMovements(format: string): Observable<Blob> {
    return this.api.getBlob(`stock/export/movements/${format}`);
  }

  exportRapportValorisation(locationType: string, motif?: string): Observable<Blob> {
    return this.api.getBlob(`stock/export/valorisation/${locationType}`, motif ? { motif } : undefined);
  }

  exportRapportAlertes(locationType: string): Observable<Blob> {
    return this.api.getBlob(`stock/export/alertes/${locationType}`);
  }

  exportInventaireComplet(locationType: string, motif?: string): Observable<Blob> {
    return this.api.getBlob(`stock/export/inventaire/${locationType}`, motif ? { motif } : undefined);
  }

  exportRapportRotation(locationType: string, periodStart: string, periodEnd: string, motif?: string): Observable<Blob> {
    return this.api.getBlob(`stock/export/rotation/${locationType}`, { periodStart, periodEnd, ...(motif ? { motif } : {}) });
  }

  // ── NOUVEAUX RAPPORTS (réceptions, dotations, réappro, transferts) ──
  exportRapportReceptions(periodStart: string, periodEnd: string, motif?: string): Observable<Blob> {
    return this.api.getBlob('stock/export/receptions', { periodStart, periodEnd, ...(motif ? { motif } : {}) });
  }

  exportRapportDotations(periodStart: string, periodEnd: string, motif?: string): Observable<Blob> {
    return this.api.getBlob('stock/export/dotations', { periodStart, periodEnd, ...(motif ? { motif } : {}) });
  }

  exportRapportReapprovisionnement(motif?: string): Observable<Blob> {
    return this.api.getBlob('stock/export/reapprovisionnement', motif ? { motif } : undefined);
  }

  exportRapportTransferts(locationType: string, periodStart: string, periodEnd: string, motif?: string): Observable<Blob> {
    return this.api.getBlob(`stock/export/transferts/${locationType}`, { periodStart, periodEnd, ...(motif ? { motif } : {}) });
  }

  // ── FICHE HEBDOMADAIRE ────────────────────────────────────
  exportFicheHebdomadaire(locationType: string, periodStart: string, periodEnd: string): Observable<Blob> {
    return this.api.getBlob(`stock/export/fiche-hebdomadaire/${locationType}`, { periodStart, periodEnd });
  }

  // ── RAPPORTS AUTOMATIQUES (manual trigger) ────────────────
  triggerAutoWeekly(locationType: string, periodStart: string, periodEnd: string): Observable<any> {
    return this.api.post(`stock/export/auto/weekly/${locationType}`, null, { periodStart, periodEnd });
  }

  triggerAutoDaily(locationType: string, periodStart: string, periodEnd: string): Observable<any> {
    return this.api.post(`stock/export/auto/daily/${locationType}`, null, { periodStart, periodEnd });
  }

  // ── EXPORTS EXCEL WITH CHARTS (/api/stock/export/excel/...) ──
  exportExcelItems(locationType: string): Observable<Blob> {
    return this.api.getBlob(`stock/export/excel/items/${locationType}`);
  }

  exportExcelMovements(): Observable<Blob> {
    return this.api.getBlob('stock/export/excel/movements');
  }

  exportExcelValorisation(locationType: string): Observable<Blob> {
    return this.api.getBlob(`stock/export/excel/valorisation/${locationType}`);
  }

  exportExcelGlobal(locationType: string, periodStart: string, periodEnd: string): Observable<Blob> {
    return this.api.getBlob(`stock/export/excel/global/${locationType}`, { periodStart, periodEnd });
  }

  // ── LOCATIONS (/api/stock/locations) ──────────────────────
  getLocations(): Observable<StockLocationDto[]> {
    return this.api.get<StockLocationDto[]>('stock/locations').pipe(catchError(() => of([])));
  }

  getStockAlerts(): Observable<StockAlert[]> {
    return this.getAlerts().pipe(
      map(levels => levels.map((sl: StockLevel) => ({
        produitId: sl.productId,
        designation: sl.productName || sl.productSku || '',
        magasin: sl.warehouseName || '',
        stockActuel: sl.quantity,
        stockMinimum: sl.reorderPoint,
        niveau: sl.alertLevel || 'NORMAL',
        leadTimeDays: sl.leadTimeDays
      })))
    );
  }

  // ── BATCHES / LOTS (/api/stock/batches/...) ───────────────
  getStockBatches(): Observable<StockBatch[]> {
    return this.api.get<StockBatch[]>('stock/batches').pipe(catchError(() => of([])));
  }

  getStockBatchById(id: number): Observable<StockBatch> {
    return this.api.get<StockBatch>(`stock/batches/${id}`);
  }

  getStockBatchesByProduct(productId: number): Observable<StockBatch[]> {
    return this.api.get<StockBatch[]>(`stock/batches/product/${productId}`).pipe(catchError(() => of([])));
  }

  getStockBatchesBySku(productSku: string): Observable<StockBatch[]> {
    return this.api.get<StockBatch[]>(`stock/batches/sku/${productSku}`).pipe(catchError(() => of([])));
  }

  getStockBatchesByLocation(locationId: string): Observable<StockBatch[]> {
    return this.api.get<StockBatch[]>(`stock/batches/location/${locationId}`).pipe(catchError(() => of([])));
  }

  getExpiringSoonBatches(days = 30): Observable<StockBatch[]> {
    return this.api.get<StockBatch[]>(`stock/batches/expiring-soon`, { days: String(days) }).pipe(catchError(() => of([])));
  }

  getExpiredBatches(): Observable<StockBatch[]> {
    return this.api.get<StockBatch[]>('stock/batches/expired').pipe(catchError(() => of([])));
  }

  createStockBatch(data: Partial<StockBatch>): Observable<StockBatch> {
    return this.api.post('stock/batches', data);
  }

  consumeBatchQuantity(payload: { productSku: string; locationId: string; quantity: number }): Observable<void> {
    return this.api.post('stock/batches/consume', payload);
  }

  updateStockBatchStatus(id: number, status: string): Observable<StockBatch> {
    return this.api.patch(`stock/batches/${id}/status?status=${encodeURIComponent(status)}`, null);
  }

  deleteStockBatch(id: number): Observable<void> {
    return this.api.delete(`stock/batches/${id}`);
  }

  // ── AUDIT LOGS (/api/stock/audit-logs/...) ────────────────
  getAuditLogs(): Observable<StockAuditLog[]> {
    return this.api.get<StockAuditLog[]>('stock/audit-logs').pipe(catchError(() => of([])));
  }

  getAuditLogsForEntity(entityType: string, entityId: string): Observable<StockAuditLog[]> {
    return this.api.get<StockAuditLog[]>(`stock/audit-logs/entity/${entityType}/${entityId}`).pipe(catchError(() => of([])));
  }

  getAuditLogsByEntityType(entityType: string): Observable<StockAuditLog[]> {
    return this.api.get<StockAuditLog[]>(`stock/audit-logs/entity-type/${entityType}`).pipe(catchError(() => of([])));
  }

  getAuditLogsByUser(userMatricule: string): Observable<StockAuditLog[]> {
    return this.api.get<StockAuditLog[]>(`stock/audit-logs/user/${userMatricule}`).pipe(catchError(() => of([])));
  }

  getAuditLogsByAction(action: string): Observable<StockAuditLog[]> {
    return this.api.get<StockAuditLog[]>(`stock/audit-logs/action/${action}`).pipe(catchError(() => of([])));
  }

  createAuditLog(data: Partial<StockAuditLog>): Observable<StockAuditLog> {
    return this.api.post('stock/audit-logs', data);
  }

  // ── BACKEND ALERTS (/api/stock/alerts/...) ────────────────
  getBackendAlerts(): Observable<StockAlertEntity[]> {
    return this.api.get<StockAlertEntity[]>('stock/alerts/active/priority').pipe(catchError(() => of([])));
  }

  getCriticalBackendAlerts(): Observable<StockAlertEntity[]> {
    return this.api.get<StockAlertEntity[]>('stock/alerts/active/critical').pipe(catchError(() => of([])));
  }

  getUnacknowledgedBackendAlerts(): Observable<StockAlertEntity[]> {
    return this.api.get<StockAlertEntity[]>('stock/alerts/active/unacknowledged').pipe(catchError(() => of([])));
  }

  acknowledgeBackendAlert(id: number, userId: string): Observable<StockAlertEntity> {
    return this.api.post(`stock/alerts/${id}/acknowledge?userId=${encodeURIComponent(userId)}`, null);
  }

  resolveBackendAlert(id: number): Observable<StockAlertEntity> {
    return this.api.post(`stock/alerts/${id}/resolve`, {});
  }

  resolveAlertsByProduct(productId: number): Observable<number> {
    return this.api.post<number>(`stock/alerts/resolve-by-product?productId=${productId}`, null);
  }

  resolveAlertsByProductSku(productSku: string): Observable<number> {
    return this.api.post<number>(`stock/alerts/resolve-by-sku?productSku=${encodeURIComponent(productSku)}`, null);
  }

  triggerAlertChecks(): Observable<void> {
    return this.api.post('stock/alerts/check-thresholds', {});
  }

  getPerformanceStats(): Observable<Record<string, unknown>> {
    return this.api.get<Record<string, unknown>>('stock/alerts/performance').pipe(catchError(() => of({})));
  }

  // ── THRESHOLDS (/api/stock/items/...) ─────────────────────
  setThresholds(locationId: string, productSku: string, reorderPoint: number, safetyStock: number, maxStock?: number): Observable<unknown> {
    return this.api.put(`stock/items/location/${locationId}/sku/${encodeURIComponent(productSku)}/thresholds`, { reorderPoint, safetyStock, maxStock });
  }

  setDefaultThresholds(locationId: string, reorderPoint: number, safetyStock: number, maxStock?: number): Observable<unknown> {
    return this.api.put(`stock/items/location/${locationId}/thresholds/batch`, { reorderPoint, safetyStock, maxStock });
  }

  getItemsWithThresholds(locationId: string): Observable<unknown[]> {
    return this.api.get<unknown[]>(`stock/items/location/${locationId}/thresholds`).pipe(catchError(() => of([])));
  }

  // ── THRESHOLDS (/api/stock/thresholds) ───────────────────
  getAllThresholds(): Observable<StockThresholdDto[]> {
    return this.api.get<StockThresholdDto[]>('stock/thresholds').pipe(catchError(() => of([])));
  }
  getThresholdsByLocation(locationId: string): Observable<StockThresholdDto[]> {
    return this.api.get<StockThresholdDto[]>(`stock/thresholds/location/${locationId}`).pipe(catchError(() => of([])));
  }
  createThreshold(data: Partial<StockThresholdDto>): Observable<StockThresholdDto> {
    return this.api.post<StockThresholdDto>('stock/thresholds', data);
  }
  updateThreshold(id: number, data: Partial<StockThresholdDto>): Observable<StockThresholdDto> {
    return this.api.put<StockThresholdDto>(`stock/thresholds/${id}`, data);
  }
  deleteThreshold(id: number): Observable<unknown> {
    return this.api.delete(`stock/thresholds/${id}`);
  }
  checkAllThresholds(): Observable<unknown> {
    return this.api.post('stock/thresholds/check', {});
  }

  // ── PHYSICAL INVENTORY (/api/stock/physical-inventory) ────
  createPhysicalInventory(locationId: string, countedBy: string, notes?: string): Observable<PhysicalInventory> {
    return this.api.post<PhysicalInventory>('stock/physical-inventory', { locationId, countedBy, notes });
  }

  getPhysicalInventories(status?: string, countedBy?: string): Observable<PhysicalInventory[]> {
    let url = 'stock/physical-inventory';
    const params: string[] = [];
    if (status) params.push(`status=${encodeURIComponent(status)}`);
    if (countedBy) params.push(`countedBy=${encodeURIComponent(countedBy)}`);
    if (params.length) url += '?' + params.join('&');
    return this.api.get<PhysicalInventory[]>(url).pipe(catchError(() => of([])));
  }

  getPhysicalInventory(id: number): Observable<PhysicalInventory> {
    return this.api.get<PhysicalInventory>(`stock/physical-inventory/${id}`);
  }

  getPhysicalInventoryItems(id: number): Observable<PhysicalInventoryItem[]> {
    return this.api.get<PhysicalInventoryItem[]>(`stock/physical-inventory/${id}/items`).pipe(catchError(() => of([])));
  }

  getPhysicalInventoryDiscrepancies(id: number): Observable<PhysicalInventoryItem[]> {
    return this.api.get<PhysicalInventoryItem[]>(`stock/physical-inventory/${id}/discrepancies`).pipe(catchError(() => of([])));
  }

  getPhysicalInventorySummary(id: number): Observable<PhysicalInventorySummary> {
    return this.api.get<PhysicalInventorySummary>(`stock/physical-inventory/${id}/summary`);
  }

  countPhysicalInventoryItem(itemId: number, countedQuantity: number, notes?: string): Observable<PhysicalInventoryItem> {
    return this.api.put<PhysicalInventoryItem>(`stock/physical-inventory/items/${itemId}/count`, { countedQuantity, notes });
  }

  completePhysicalInventory(id: number): Observable<PhysicalInventory> {
    return this.api.put<PhysicalInventory>(`stock/physical-inventory/${id}/complete`, {});
  }

  validatePhysicalInventory(id: number, validatedBy: string, applyCorrections: boolean): Observable<PhysicalInventory> {
    return this.api.put<PhysicalInventory>(`stock/physical-inventory/${id}/validate`, { validatedBy, applyCorrections });
  }

  // ── CUSTOM REPORT (/api/stock/reports/custom) ──────────────
  generateCustomReport(criteria: CustomReportCriteriaDto): Observable<ReportData> {
    return this.api.post<ReportData>('stock/reports/custom', criteria);
  }

  // ── Physical Inventory ──
  // createPhysicalInventory(locationId: string, countedBy: string, notes?: string): Observable<PhysicalInventory> {
  //   return this.api.post<PhysicalInventory>('stock/physical-inventory', { locationId, countedBy, notes: notes || '' });
  // }

  getAllPhysicalInventories(status?: string): Observable<PhysicalInventory[]> {
    const params = status ? `?status=${status}` : '';
    return this.api.get<PhysicalInventory[]>(`stock/physical-inventory${params}`);
  }

  // getPhysicalInventory(id: number): Observable<PhysicalInventory> {
  //   return this.api.get<PhysicalInventory>(`stock/physical-inventory/${id}`);
  // }

  // getPhysicalInventoryItems(id: number): Observable<PhysicalInventoryItem[]> {
  //   return this.api.get<PhysicalInventoryItem[]>(`stock/physical-inventory/${id}/items`);
  // }

  // getPhysicalInventoryDiscrepancies(id: number): Observable<PhysicalInventoryItem[]> {
  //   return this.api.get<PhysicalInventoryItem[]>(`stock/physical-inventory/${id}/discrepancies`);
  // }

  // getPhysicalInventorySummary(id: number): Observable<PhysicalInventorySummary> {
  //   return this.api.get<PhysicalInventorySummary>(`stock/physical-inventory/${id}/summary`);
  // }

  countInventoryItem(itemId: number, countedQuantity: number, notes?: string): Observable<PhysicalInventoryItem> {
    return this.api.put<PhysicalInventoryItem>(`stock/physical-inventory/items/${itemId}/count`, { countedQuantity, notes });
  }

  // completePhysicalInventory(id: number): Observable<PhysicalInventory> {
  //   return this.api.put<PhysicalInventory>(`stock/physical-inventory/${id}/complete`, {});
  // }

  // validatePhysicalInventory(id: number, validatedBy: string, applyCorrections: boolean): Observable<PhysicalInventory> {
  //   return this.api.put<PhysicalInventory>(`stock/physical-inventory/${id}/validate`, { validatedBy, applyCorrections });
  // }
}

export interface PhysicalInventory {
  id: number;
  reference: string;
  locationId: string;
  locationName: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'VALIDATED';
  countedBy: string;
  validatedBy?: string;
  startedAt: string;
  completedAt?: string;
  validatedAt?: string;
  totalItems?: number;
  countedItems?: number;
  discrepancyCount?: number;
  notes?: string;
}

export interface PhysicalInventoryItem {
  id: number;
  inventoryId: number;
  stockItemId?: number;
  productId: number;
  productSku: string;
  productName: string;
  packagingType: string;
  systemQuantity: number;
  countedQuantity?: number;
  discrepancy?: number;
  status: 'PENDING' | 'COUNTED' | 'VALIDATED';
  countedAt?: string;
  notes?: string;
}

export interface PhysicalInventorySummary {
  inventoryId: number;
  reference: string;
  status: string;
  totalItems: number;
  countedItems: number;
  pendingItems: number;
  positiveDiscrepancies: number;
  negativeDiscrepancies: number;
  totalDiscrepancies: number;
  discrepancyValue: number;
}

export interface CustomReportCriteriaDto {
  locationTypes?: string[];
  materialTypes?: string[];
  alertLevels?: string[];
  productSku?: string;
  productName?: string;
  minQuantity?: number;
  maxQuantity?: number;
  minValue?: number;
  maxValue?: number;
  periodStart?: string;
  periodEnd?: string;
  generatedBy: string;
  format?: string;
}
