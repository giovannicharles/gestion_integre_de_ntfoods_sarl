import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environment/environment';

@Injectable({
  providedIn: 'root'
})
export class StockApiService {
  private apiUrl = environment.apiUrl + '/stock';

  constructor(private http: HttpClient) {}

  // ==================== DOTATION SERVICE ====================
  createDotationRequest(request: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/dotations`, request);
  }

  getDotationRequest(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/dotations/${id}`);
  }

  getAllDotationRequests(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/dotations`);
  }

  getDotationRequestsByCommercial(commercialId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/dotations/commercial/${commercialId}`);
  }

  getDotationRequestsByStatus(status: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/dotations/status/${status}`);
  }

  approveDotationRequest(id: number, notes?: string): Observable<any> {
    const params: any = {};
    if (notes) params.notes = notes;
    return this.http.put(`${this.apiUrl}/dotations/${id}/approve`, null, { params });
  }

  rejectDotationRequest(id: number, reason: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/dotations/${id}/reject`, null, { params: { reason } });
  }

  executeDotationRequest(id: number, executedBy: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/dotations/${id}/execute`, null, { params: { executedBy } });
  }

  deleteDotationRequest(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/dotations/${id}`, { responseType: 'text' });
  }

  // ==================== STOCK LOCATION SERVICE ====================
  createStockLocation(type: string, name: string, description?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/locations`, null, { params: { type, name, description: description || '' } });
  }

  getStockLocation(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/locations/${id}`);
  }

  getAllStockLocations(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/locations`);
  }

  getStockLocationsByType(type: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/locations/type/${type}`);
  }

  getMobileLocationByCommercial(commercialId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/locations/commercial/${commercialId}`);
  }

  assignCommercialToMobileLocation(id: string, commercialId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/locations/${id}/assign`, null, { params: { commercialId }, responseType: 'text' });
  }

  initializeDefaultLocations(): Observable<any> {
    return this.http.post(`${this.apiUrl}/locations/initialize`, null, { responseType: 'text' });
  }

  // ==================== STOCK ITEM SERVICE ====================
  createOrUpdateStockItem(item: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/items`, null, { params: item });
  }

  getStockItemsByLocation(locationId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/items/location/${locationId}`);
  }

  getStockItem(locationId: string, productSku: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/items/location/${locationId}/sku/${productSku}`);
  }

  addQuantity(locationId: string, productSku: string, quantityToAdd: number, updatedBy?: string): Observable<any> {
    const params: any = { quantityToAdd };
    if (updatedBy) params.updatedBy = updatedBy;
    return this.http.post<any>(`${this.apiUrl}/items/location/${locationId}/sku/${productSku}/add`, null, { params });
  }

  subtractQuantity(locationId: string, productSku: string, quantityToSubtract: number, updatedBy?: string): Observable<any> {
    const params: any = { quantityToSubtract };
    if (updatedBy) params.updatedBy = updatedBy;
    return this.http.post<any>(`${this.apiUrl}/items/location/${locationId}/sku/${productSku}/subtract`, null, { params });
  }

  getLowStockItems(locationId: string, threshold: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/items/location/${locationId}/low-stock`, { params: { threshold } });
  }

  getTotalQuantity(locationId: string): Observable<number> {
    return this.http.get<number>(`${this.apiUrl}/items/location/${locationId}/total`);
  }

  // ==================== STOCK MOVEMENT SERVICE ====================
  createMovement(movement: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/movements`, null, { params: movement });
  }

  validateMovement(id: number, validatedBy: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/movements/${id}/validate`, null, { params: { validatedBy }, responseType: 'text' });
  }

  cancelMovement(id: number, reason: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/movements/${id}/cancel`, null, { params: { reason }, responseType: 'text' });
  }

  getPendingMovements(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/movements/pending`);
  }

  getMovementsByLocation(locationId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/movements/location/${locationId}`);
  }

  getMovementsByType(type: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/movements/type/${type}`);
  }

  getMovementsByPeriod(startDate: string, endDate: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/movements/period`, { params: { startDate, endDate } });
  }

  // ==================== STOCK ALERT SERVICE ====================
  createLowStockAlert(alert: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/alerts/low-stock`, null, { params: alert });
  }

  createCriticalStockAlert(alert: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/alerts/critical-stock`, null, { params: alert });
  }

  createBufferInsufficientAlert(alert: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/alerts/buffer-insufficient`, null, { params: alert });
  }

  acknowledgeAlert(id: number, userId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/alerts/${id}/acknowledge`, null, { params: { userId } });
  }

  resolveAlert(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/alerts/${id}/resolve`, null);
  }

  getActiveAlertsByPriority(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/alerts/active/priority`);
  }

  getCriticalActiveAlerts(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/alerts/active/critical`);
  }

  getUnacknowledgedActiveAlerts(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/alerts/active/unacknowledged`);
  }

  getAlertsByLocation(locationId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/alerts/location/${locationId}`);
  }

  checkStockThresholds(): Observable<any> {
    return this.http.post(`${this.apiUrl}/alerts/check-thresholds`, null, { responseType: 'text' });
  }

  // ==================== STOCK THRESHOLD SERVICE ====================
  createThreshold(threshold: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/thresholds`, null, { params: threshold });
  }

  updateThreshold(id: number, threshold: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/thresholds/${id}`, null, { params: threshold });
  }

  getThreshold(locationId: string, productId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/thresholds/location/${locationId}/product/${productId}`);
  }

  getThresholdBySku(locationId: string, productSku: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/thresholds/location/${locationId}/sku/${productSku}`);
  }

  getThresholdsByLocation(locationId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/thresholds/location/${locationId}`);
  }

  getThresholdsByProduct(productId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/thresholds/product/${productId}`);
  }

  deleteThreshold(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/thresholds/${id}`, { responseType: 'text' });
  }

  checkAllThresholds(): Observable<any> {
    return this.http.post(`${this.apiUrl}/thresholds/check-all`, null, { responseType: 'text' });
  }

  calculateRecommendedReorderQuantity(locationId: string, productSku: string): Observable<number> {
    return this.http.get<number>(`${this.apiUrl}/thresholds/location/${locationId}/sku/${productSku}/reorder-quantity`);
  }

  // ==================== MOBILE STOCK TRACKING SERVICE ====================
  getCommercialMobileStock(commercialMatricule: string, commercialId?: string): Observable<any> {
    const params: any = {};
    if (commercialId) params.commercialId = commercialId;
    return this.http.get(`${this.apiUrl}/mobile-tracking/commercial/${commercialMatricule}`, { params });
  }

  getAllCommercialsMobileStock(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/mobile-tracking/all`);
  }

  getCommercialDotationHistory(commercialMatricule: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/mobile-tracking/commercial/${commercialMatricule}/dotation-history`);
  }

  getCommercialProductStockDetail(commercialMatricule: string, productSku: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/mobile-tracking/commercial/${commercialMatricule}/product/${productSku}`);
  }

  calculateCommercialStockRotation(commercialMatricule: string, days: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/mobile-tracking/commercial/${commercialMatricule}/rotation`, { params: { days } });
  }

  identifySlowStockCommercials(daysThreshold: number, salesThreshold: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/mobile-tracking/slow-stock`,
      { params: { daysThreshold, salesThreshold } });
  }

  // ==================== REPORT SERVICE ====================
  generateStockCentralStatusReport(report: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/reports/stock-central`, null, { params: report });
  }

  generateStockBufferStatusReport(report: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/reports/stock-buffer`, null, { params: report });
  }

  generateStockMovementsReport(report: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/reports/movements`, null, { params: report });
  }

  generateCommercialPerformanceReport(report: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/reports/commercial-performance`, null, { params: report });
  }

  generateDotationsVsSalesReport(report: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/reports/dotations-vs-sales`, null, { params: report });
  }

  generateInventoryReport(report: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/reports/inventory`, null, { params: report });
  }

  getReportById(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/reports/${id}`);
  }

  getReportsByType(type: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/reports/type/${type}`);
  }

  getReportsByUser(generatedBy: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/reports/user/${generatedBy}`);
  }

  getReportsByPeriod(startDate: string, endDate: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/reports/period`, { params: { startDate, endDate } });
  }

  deleteReport(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/reports/${id}`, { responseType: 'text' });
  }

  // ==================== EXPORT SERVICE ====================
  exportStockItemsToCSV(locationId: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/export/items/${locationId}/csv`, { responseType: 'blob' });
  }

  exportStockItemsToExcel(locationId: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/export/items/${locationId}/excel`, { responseType: 'blob' });
  }

  exportStockItemsToPDF(locationId: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/export/items/${locationId}/pdf`, { responseType: 'blob' });
  }

  exportStockMovementsToCSV(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/export/movements/csv`, { responseType: 'blob' });
  }

  exportStockMovementsToExcel(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/export/movements/excel`, { responseType: 'blob' });
  }

  exportStockMovementsToPDF(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/export/movements/pdf`, { responseType: 'blob' });
  }

  // ==================== NOTIFICATION SERVICE ====================
  createInAppNotification(notification: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/notifications/in-app`, null, { params: notification });
  }

  createEmailNotification(notification: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/notifications/email`, null, { params: notification });
  }

  createSmsNotification(notification: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/notifications/sms`, null, { params: notification });
  }

  createStockAlertNotification(notification: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/notifications/stock-alert`, null, { params: notification });
  }

  createDotationRequestNotification(notification: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/notifications/dotation-request`, null, { params: notification });
  }

  getUserNotifications(recipientId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/notifications/user/${recipientId}`);
  }

  getPendingNotifications(recipientId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/notifications/user/${recipientId}/pending`);
  }

  countPendingNotifications(recipientId: string): Observable<number> {
    return this.http.get<number>(`${this.apiUrl}/notifications/user/${recipientId}/pending/count`);
  }

  markAsRead(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/notifications/${id}/mark-read`, null, { responseType: 'text' });
  }

  markAllAsRead(recipientId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/notifications/user/${recipientId}/mark-all-read`, null, { responseType: 'text' });
  }

  deleteNotification(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/notifications/${id}`, { responseType: 'text' });
  }

  // ==================== PRODUCT CLASSIFICATION SERVICE ====================
  createClassification(classification: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/product-classifications`, null, { params: classification });
  }

  getByClassificationCode(classificationCode: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/product-classifications/code/${classificationCode}`);
  }

  getByBrand(brand: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/product-classifications/brand/${brand}`);
  }

  getByRange(range: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/product-classifications/range/${range}`);
  }

  getByVariety(variety: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/product-classifications/variety/${variety}`);
  }

  getByPackaging(packaging: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/product-classifications/packaging/${packaging}`);
  }

  getAllBrands(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/product-classifications/brands`);
  }

  getRangesByBrand(brand: string): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/product-classifications/brand/${brand}/ranges`);
  }

  getVarietiesByBrandAndRange(brand: string, range: string): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/product-classifications/brand/${brand}/range/${range}/varieties`);
  }

  getAllPackagings(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/product-classifications/packagings`);
  }

  getAllClassifications(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/product-classifications`);
  }

  deleteClassification(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/product-classifications/${id}`, { responseType: 'text' });
  }

  // ==================== PRODUCTION RECEPTION SERVICE ====================
  receiveFinishedGoods(reception: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/production-reception/receive-finished-goods`, null, { params: reception, responseType: 'text' });
  }

  updateRawMaterialConsumption(orderNumber: string, updatedBy: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/production-reception/update-raw-material-consumption`, null,
      { params: { orderNumber, updatedBy }, responseType: 'text' });
  }

  calculateProductionYield(orderNumber: string, plannedQuantity: number, actualQuantity: number): Observable<number> {
    return this.http.get<number>(`${this.apiUrl}/production-reception/calculate-yield`,
      { params: { orderNumber, plannedQuantity, actualQuantity } });
  }

  isYieldAcceptable(orderNumber: string, plannedQuantity: number, actualQuantity: number, minimumYield: number): Observable<boolean> {
    return this.http.get<boolean>(`${this.apiUrl}/production-reception/check-yield`,
      { params: { orderNumber, plannedQuantity, actualQuantity, minimumYield } });
  }

  // ==================== STOCK VALUATION SERVICE ====================
  calculateStockValue(locationId: string, unitPrices: { [key: string]: number }): Observable<number> {
    return this.http.post<number>(`${this.apiUrl}/valuation/location/${locationId}`, unitPrices);
  }

  calculateCentralStockValue(unitPrices: { [key: string]: number }): Observable<number> {
    return this.http.post<number>(`${this.apiUrl}/valuation/central`, unitPrices);
  }

  calculateBufferStockValue(unitPrices: { [key: string]: number }): Observable<number> {
    return this.http.post<number>(`${this.apiUrl}/valuation/buffer`, unitPrices);
  }

  calculateMobileStockValue(unitPrices: { [key: string]: number }): Observable<number> {
    return this.http.post<number>(`${this.apiUrl}/valuation/mobile`, unitPrices);
  }

  calculateTotalStockValue(unitPrices: { [key: string]: number }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/valuation/total`, unitPrices);
  }

  calculateValueByCategory(locationId: string, request: any): Observable<{ [key: string]: number }> {
    return this.http.post<{ [key: string]: number }>(`${this.apiUrl}/valuation/location/${locationId}/category`, request);
  }

  calculateStorageCost(locationId: string, storageCostRate: number, unitPrices: { [key: string]: number }): Observable<number> {
    return this.http.post<number>(`${this.apiUrl}/valuation/location/${locationId}/storage-cost`, unitPrices,
      { params: { storageCostRate } });
  }
}