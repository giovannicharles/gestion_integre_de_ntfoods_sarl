import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../../core/http/api.service';
import {
  StockLevel, Receipt, ProductionBatch, InternalOrder,
  StockMovement, Commercial, InfoProduits, DashboardStatsResponse,
  StockAlert, Warehouse, Product, Brand, ProductLine, ProductVariant, Supplier
} from '../../domain/models/stock.models';

/**
 * Repository d'infrastructure — appelle le backend Spring Boot.
 * Toutes les méthodes correspondent à un endpoint REST du backend.
 */
@Injectable({ providedIn: 'root' })
export class StockApiRepository {
  private readonly api = inject(ApiService);

  // ── CATALOGUE ─────────────────────────────────────────────
  getProducts(): Observable<Product[]> { return this.api.get('products'); }
  getBrands(): Observable<Brand[]> { return this.api.get('brands'); }
  getLines(): Observable<ProductLine[]> { return this.api.get('product-lines'); }
  getVariants(): Observable<ProductVariant[]> { return this.api.get('product-variants'); }
  getWarehouses(): Observable<Warehouse[]> { return this.api.get('warehouses'); }
  getSuppliers(): Observable<Supplier[]> { return this.api.get('suppliers'); }

  // ── DASHBOARD ─────────────────────────────────────────────
  /**
   * Récupère les statistiques du dashboard depuis le backend
   * @return Observable contenant les statistiques du dashboard
   */
  getDashboard(): Observable<DashboardStatsResponse> {
    // Appel à l'endpoint du backend pour récupérer les KPIs du dashboard stock
    return this.api.get('stock/dashboard/stats');
  }

  // ── STOCK LEVELS ──────────────────────────────────────────
  getStockLevels(): Observable<StockLevel[]> { return this.api.get('stock/levels'); }
  getStockLevelsByWarehouse(id: number): Observable<StockLevel[]> { return this.api.get(`stock/levels/warehouse/${id}`); }
  getAlerts(): Observable<StockLevel[]> { return this.api.get('stock/alerts'); }
  getCriticalAlerts(): Observable<StockLevel[]> { return this.api.get('stock/alerts/critical'); }
  adjustStock(stockLevelId: number, newQuantity: number, reason: string): Observable<StockLevel> {
    return this.api.post('stock/adjust', { stockLevelId, newQuantity, reason });
  }
  transferToBuffer(id: number, quantity: number): Observable<void> {
    return this.api.post(`stock/levels/${id}/transfer-to-buffer?quantity=${quantity}`, {});
  }

  // ── RECEIPTS ──────────────────────────────────────────────
  getReceipts(): Observable<Receipt[]> { return this.api.get('stock/receipts'); }
  getPendingReceipts(): Observable<Receipt[]> { return this.api.get('stock/receipts/pending'); }
  getReceiptById(id: number): Observable<Receipt> { return this.api.get(`stock/receipts/${id}`); }
  createReceipt(data: any): Observable<Receipt> { return this.api.post('stock/receipts', data); }
  validateFirst(id: number, notes: string): Observable<Receipt> {
    return this.api.post(`stock/receipts/${id}/validate-first`, { notes });
  }
  validateSecond(id: number, notes: string): Observable<Receipt> {
    return this.api.post(`stock/receipts/${id}/validate-second`, { notes });
  }
  rejectReceipt(id: number, reason: string): Observable<Receipt> {
    return this.api.post(`stock/receipts/${id}/reject`, { reason });
  }

  // ── PRODUCTION BATCHES ────────────────────────────────────
  getBatches(): Observable<ProductionBatch[]> { return this.api.get('production/batches'); }
  getPendingBatches(): Observable<ProductionBatch[]> { return this.api.get('production/batches/pending'); }
  getBatchById(id: number): Observable<ProductionBatch> { return this.api.get(`production/batches/${id}`); }
  declareBatch(data: any): Observable<ProductionBatch> { return this.api.post('production/batches/declare', data); }
  validateBatch(id: number, notes = ''): Observable<ProductionBatch> {
    return this.api.post(`production/batches/${id}/validate?notes=${encodeURIComponent(notes)}`, {});
  }
  rejectBatch(id: number, reason: string): Observable<ProductionBatch> {
    return this.api.post(`production/batches/${id}/reject?reason=${encodeURIComponent(reason)}`, {});
  }

  // ── INTERNAL ORDERS ───────────────────────────────────────
  getOrders(): Observable<InternalOrder[]> { return this.api.get('stock/internal-orders'); }
  getActiveOrders(): Observable<InternalOrder[]> { return this.api.get('stock/internal-orders/active'); }
  createOrder(data: any): Observable<InternalOrder> { return this.api.post('stock/internal-orders', data); }
  approveOrder(id: number): Observable<InternalOrder> { return this.api.post(`stock/internal-orders/${id}/approve`, {}); }
  cancelOrder(id: number): Observable<InternalOrder> { return this.api.post(`stock/internal-orders/${id}/cancel`, {}); }

  // ── MOVEMENTS ─────────────────────────────────────────────
  getMovements(): Observable<StockMovement[]> { return this.api.get('stock/movements'); }

  // ── COMMERCIALS ───────────────────────────────────────────
  getCommercials(): Observable<Commercial[]> { return this.api.get('stock/commercials'); }
  getInfoProduits(date?: string): Observable<InfoProduits[]> {
    return date ? this.api.get(`stock/info-produits?date=${date}`) : this.api.get('stock/info-produits');
  }
}
