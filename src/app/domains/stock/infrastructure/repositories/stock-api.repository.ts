// ═══ FICHIER : src/app/domains/stock/infrastructure/repositories/stock-api.repository.ts ═══
// URLs alignées sur le backend Spring Boot (v1/stock/... et stock/...)

import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiService } from '../../../../core/http/api.service';
import {
  StockLevel, Receipt, ProductionBatch, InternalOrder,
  StockMovement, Commercial, InfoProduits, InfoProduitsLine, DashboardStatsResponse,
  StockAlert, Warehouse, Product, Brand, ProductLine, ProductVariant, Supplier,
  ReceptionType, ReceiptStatus,
  DotationRequest, CreateDotationRequest, DotationStatus,
  StockBatch, StockAuditLog, StockAlertEntity,
  MobileStockSummary, MobileStockRotation, SlowStockCommercial
} from '../../domain/models/stock.models';

/** Forme réelle de StockMobileController.StockMobileResponse (backend). */
interface StockMobileResponseDto {
  id: number;
  matriculeCommercial: string;
  dateSession: string;
  totalVentes: number;
  totalRestant: number;
  totalAvaries: number;
  dateModification?: string;
  lignes: Array<{
    codeProduit: string;
    designation: string;
    conditionnement: string;
    quantiteDisponible: number;
    quantiteInitiale: number;
    quantiteVendue: number;
    quantiteAvariee: number;
    quantiteDonnee: number;
  }>;
}

/** Voir le commentaire de getInfoProduits : approximation documentée, pas un double de la vérité backend. */
function toInfoProduits(sm: StockMobileResponseDto): InfoProduits {
  const lines: InfoProduitsLine[] = (sm.lignes || []).map((l, idx) => ({
    id: idx,
    productId: 0,
    takenQty: l.quantiteInitiale,
    soldQty: l.quantiteVendue,
    returnedQty: l.quantiteDisponible,
  }));
  return {
    id: sm.id,
    commercialId: sm.matriculeCommercial,
    commercialMatricule: sm.matriculeCommercial,
    date: sm.dateSession,
    status: 'DRAFT',
    preparedBy: 0,
    createdAt: sm.dateModification || sm.dateSession,
    lines,
  };
}

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
  /**
   * Backend : ProductClassificationController./brands renvoie une liste de noms de marque
   * (String), pas des objets {id,name,code,active} — corrigé le 2026-10-15 (P5). La ressource
   * Brand{id,name,code,active} existe à une URL différente : /api/products/brands
   * (ProductManagementController), pas sous ce contrôleur-ci.
   */
  getBrands(): Observable<string[]> {
    return this.api.get<string[]>('stock/product-classifications/brands').pipe(catchError(() => of([] as string[])));
  }
  /** Corrigé le 2026-10-15 (P5) : l'ancienne URL stock/product-classifications/lines n'existe pas (404). */
  getLines(brandId?: number): Observable<ProductLine[]> {
    return this.api.get<ProductLine[]>('products/product-lines', brandId ? { brandId: String(brandId) } : undefined)
      .pipe(catchError(() => of([] as ProductLine[])));
  }
  /** Corrigé le 2026-10-15 (P5) : l'ancienne URL stock/product-classifications/variants n'existe pas (404). */
  getVariants(productLineId?: number): Observable<ProductVariant[]> {
    return this.api.get<ProductVariant[]>('products/product-variants', productLineId ? { productLineId: String(productLineId) } : undefined)
      .pipe(catchError(() => of([] as ProductVariant[])));
  }
  /** @deprecated forme `Warehouse` fausse (id numérique, isBuffer inexistants côté serveur) — utiliser {@link getLocations} (StockLocationDto, déjà correct). Conservé pour compatibilité, aucun appelant réel aujourd'hui. */
  getWarehouses(): Observable<Warehouse[]> {
    return this.getLocations().pipe(
      map(locs => locs.map(l => ({ id: 0, name: l.name, type: l.type as unknown as Warehouse['type'], isBuffer: l.type === 'STOCK_BUFFER' })))
    );
  }
  /**
   * Corrigé le 2026-10-15 (P5) : l'ancienne URL v1/stock/suppliers n'existe pas (404) ; la vraie
   * ressource est FournisseurController (/api/stock/fournisseurs), enveloppée ApiResponse, avec
   * des noms de champ différents (raisonSociale, pas name ; pas de leadTimeDays/pays).
   */
  getSuppliers(): Observable<Supplier[]> {
    return this.api.get<{ donnees?: Array<{ id: number; code: string; raisonSociale: string; telephone?: string; email?: string; adresse?: string; actif: boolean }> }>('stock/fournisseurs')
      .pipe(
        map(r => (r.donnees ?? []).map(f => ({ id: f.id, name: f.raisonSociale, leadTimeDays: 0, pays: f.adresse, telephone: f.telephone, email: f.email }))),
        catchError(() => of([] as Supplier[]))
      );
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

  /**
   * Corrigé le 2026-10-15 (P5) : l'ancienne URL v1/stock/dashboard/stock-levels/warehouse/{id}
   * n'existe pas (404) ; le vrai endpoint par entrepôt est NiveauStockController, enveloppé
   * ApiResponse, avec une forme différente (NiveauStockDetailResponse) — reconverti ici vers
   * `StockLevel` pour ne pas changer la signature publique de cette méthode.
   */
  getStockLevelsByWarehouse(id: number): Observable<StockLevel[]> {
    return this.api.get<{ donnees?: Array<{
      id: number; produitId: number; codeProduit: string; sku: string; designation: string;
      entrepotId: number; quantite: number; seuilReapprovisionnement: number; valeurStock: number;
    }> }>(`stock/levels/warehouse/${id}`).pipe(
      map(r => (r.donnees ?? []).map(n => ({
        id: n.id, productId: n.produitId, productSku: n.sku, productName: n.designation,
        warehouseId: n.entrepotId, quantity: n.quantite, reservedQty: 0,
        reorderPoint: n.seuilReapprovisionnement, safetyStock: 0, unitPriceAmount: n.valeurStock,
      } as unknown as StockLevel))),
      catchError(() => of([]))
    );
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

  /**
   * Corrigé le 2026-10-15 (P5) : le vrai endpoint (StockItemController./adjust) renvoie une
   * ValidationRequest (ajustement = action approuvable), pas un StockLevel — aucun appelant
   * actuel ne lit de champ sur le résultat, mais le type ne doit pas mentir sur la forme réelle.
   */
  adjustStock(stockLevelId: number, newQuantity: number, reason: string, requestedBy?: string): Observable<unknown> {
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
  // Lecture seule depuis le 2026-09-22 (docs/PROGRESS.md) : la déclaration/
  // validation/rejet d'un lot passe désormais uniquement par le module
  // Production (/production/lots) — le backend a retiré les 3 endpoints
  // d'écriture correspondants. Ne reste que la lecture, pour l'historique
  // déjà en base.
  // ProductionBatchController est monté sur /api/stock/production/batches (pas de préfixe /v1/,
  // contrairement à ReceiptController) — "v1/" ici donnait un 404 sur les 4 appels.
  getBatches(): Observable<ProductionBatch[]> {
    return this.api.get<ProductionBatch[]>('stock/production/batches').pipe(catchError(() => of([])));
  }
  getPendingBatches(): Observable<ProductionBatch[]> {
    return this.api.get<ProductionBatch[]>('stock/production/batches/pending').pipe(catchError(() => of([])));
  }
  getBatchById(id: number): Observable<ProductionBatch> { return this.api.get(`stock/production/batches/${id}`); }
  getBatchStats(): Observable<Record<string, unknown>> {
    return this.api.get<Record<string, unknown>>('stock/production/batches/stats').pipe(catchError(() => of({})));
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

  /**
   * Source réelle : /api/stock/stock-mobile/suivi/... (StockMobileController), pas
   * /api/stock/info-produits (bouchon qui renvoyait un statut DRAFT figé et aucune
   * décomposition pris/vendu/restant — cause du crash ".reduce is not a function",
   * l'appelant recevait l'enveloppe ApiResponse entière au lieu du tableau).
   *
   * Le mapping ligne par ligne garde ce qui est réellement mesuré par StockMobile :
   * quantiteInitiale → pris, quantiteVendue → vendu. `returnedQty` est approché par
   * quantiteDisponible (ce qui reste chez le commercial) — une approximation, pas
   * un retour physique au dépôt (règle métier : les invendus ne retournent pas).
   * `status`/validations caissier-comptable n'existent pas dans cette source : fixé
   * à 'DRAFT', pas de double validation tant que ce workflow n'est pas branché ici.
   */
  getInfoProduits(date?: string): Observable<InfoProduits[]> {
    const fallback = catchError<InfoProduits[], Observable<InfoProduits[]>>(() => of([]));
    const url = date ? `stock/stock-mobile/suivi/date/${date}` : 'stock/stock-mobile/suivi/tous';
    return this.api.get<{ donnees?: StockMobileResponseDto[] }>(url).pipe(
      map(res => (res.donnees || []).map(toInfoProduits)),
      fallback
    );
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
