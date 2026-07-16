// ════════════════════════════════════════════════════════════
// TANTY DIGITAL ERP — Modèles du Domaine Stock v3
// Correspond exactement aux entités JPA du backend Spring Boot
// ════════════════════════════════════════════════════════════

// ── ENUMS ─────────────────────────────────────────────────
export type Role = 'GESTIONNAIRE_STOCK'|'CHEF_PRODUCTION'|'COMPTABLE'|'CAISSIERE'|'DG'|'COMMERCIAL';
export type Category = 'RAW_MATERIAL'|'CONSUMABLE'|'FINISHED_PRODUCT'|'PACKAGING'|'EQUIPMENT';
export type UnitType = 'KG'|'SACHET_42G'|'SACHET_60G'|'SACHET_62G'|'SEAU_1L'|'SEAU_5L'|'SEAU_10L'|'CARTON'|'SAC'|'LITER'|'GAINE';
export type WarehouseType = 'CENTRAL'|'BUFFER';
export type ReceiptStatus = 'PENDING_FIRST_VALIDATION'|'PENDING_SECOND_VALIDATION'|'VALIDATED'|'REJECTED';
/** @deprecated remplacé par ReceptionType (3 workflows distincts, cf. cahier des charges §3) */
export type SourceType = 'SUPPLIER'|'PRODUCTION';
export type ReceptionType = 'CONSOMMABLE'|'MATIERE_PREMIERE'|'MATERIEL';
export type OrderStatus = 'DRAFT'|'APPROVED'|'PARTIALLY_RECEIVED'|'FULLY_RECEIVED';
export type ProductionStatus = 'DECLARED_BY_PRODUCTION'|'VALIDATED_BY_STOCK'|'REJECTED';
export type InternalOrderStatus = 'DRAFT'|'APPROVED'|'PARTIALLY_DELIVERED'|'DELIVERED'|'CANCELLED';
export type InfoStatus = 'DRAFT'|'PENDING_CASH'|'PENDING_ACCOUNTANT'|'CLOSED';
export type PaymentType = 'CASH'|'CREDIT';
export type SessionStatus = 'OPEN'|'PENDING_CASH'|'PENDING_ACCOUNTANT'|'CLOSED';
export type MovementType =
  | 'RECEPTION_PRODUCTION'
  | 'RECEPTION_CONSOMMABLE'
  | 'RECEPTION_RAW_MATERIAL'
  | 'RECEPTION_MATERIEL'
  | 'TRANSFER_CENTRAL_TO_BUFFER'
  | 'TRANSFER_BUFFER_TO_MOBILE'
  | 'TRANSFER_MOBILE_TO_CENTRAL'
  | 'SALE'
  | 'ADJUSTMENT'
  | 'LOSS'
  | 'EXPIRATION';
export type AlertLevel = 'CRITIQUE'|'FAIBLE'|'NORMAL'|'SURPLUS';

// ── USER ──────────────────────────────────────────────────
export interface User {
  id: number;
  matricule: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  fullName?: string;
}

// ── PRODUCT HIERARCHY ─────────────────────────────────────
export interface Brand { id: number; name: string; code: string; active: boolean; }
export interface ProductLine { id: number; brandId: number; name: string; code: string; active: boolean; brand?: Brand; }
export interface ProductVariant { id: number; productLineId: number; name: string; code: string; productLine?: ProductLine; }

export interface Product {
  id: number;
  sku: string;
  variantId?: number;
  barcode?: string;
  category: Category;
  unit: UnitType;
  unitPriceAmount: number;
  leadTimeDays?: number;
  safetyStockDays?: number;
  active: boolean;
  variant?: ProductVariant;
  // display helpers
  designation?: string;
  packagingType?: string;
  quantityPerCarton?: number;
  unitWeight?: number; // Weight per unit in grams
  volume?: string;
  cartonsPerAssortiment?: number;
  materialType?: 'MATIERE_PREMIERE' | 'CONSOMMABLE' | 'PRODUIT_FINI' | 'MATERIEL';
}

// ── WAREHOUSE & STOCK ─────────────────────────────────────
export interface Warehouse { id: number; name: string; type: WarehouseType; isBuffer: boolean; }

export interface StockLevel {
  id: number;
  productId: number;
  warehouseId: number;
  quantity: number;
  reservedQty: number;
  reorderPoint: number;
  safetyStock: number;
  lastUpdated: string;
  // enriched
  product?: Product;
  warehouse?: Warehouse;
  availableQty?: number;
  alertLevel?: AlertLevel;
  stockValue?: number;
  productName?: string;
  productSku?: string;
  productUnit?: string;
  productCategory?: string;
  warehouseName?: string;
  warehouseType?: string;
  unitPrice?: number;
  leadTimeDays?: number;
  variantName?: string;
  productLineName?: string;
  brandName?: string;
}

// ── SUPPLIER ──────────────────────────────────────────────
export interface Supplier {
  id: number;
  name: string;
  leadTimeDays: number;
  pays?: string;
  telephone?: string;
  email?: string;
}

// ── RECEIPT ───────────────────────────────────────────────
export interface ReceiptItem {
  id?: number;
  productId: number;
  productName: string;
  productSku: string;
  productUnit: string;
  packagingType?: string;
  quantityPerCarton?: number;
  orderedQty: number;
  receivedQty: number;
  deviation?: number;
  deviationPercent?: number;
  exactMatch?: boolean;
  deviationReason?: string;
  lotNumber?: string;
}

export interface Receipt {
  id?: number;
  receiptNumber: string;
  receptionType: ReceptionType;
  receptionTypeLabel?: string;
  sourceLabel: string;
  sourceId?: number;
  receiptDate: string;
  destinationLocationId: string;
  destinationLocationName?: string;
  status: ReceiptStatus;
  statusLabel?: string;
  createdBy?: string;
  requiredFirstValidatorRole?: string;
  requiredSecondValidatorRole?: string;
  firstValidator?: string;
  firstValidatedAt?: string;
  firstValidationNotes?: string;
  secondValidator?: string;
  secondValidatedAt?: string;
  secondValidationNotes?: string;
  requiresAuthCode?: boolean;
  rejectionReason?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  items: ReceiptItem[];
}

// ── DOTATION ──────────────────────────────────────────────
export type DotationStatus = 'PENDING' | 'PAYMENT_VERIFIED' | 'QUANTITY_VALIDATED' | 'REVIEWED' | 'APPROVED' | 'REJECTED' | 'COMPLETED';

export interface DotationItem {
  id?: number;
  productId: number;
  productSku: string;
  productName: string;
  packagingType?: string;
  requestedQuantity: number;
  approvedQuantity?: number;
  quantityPerCarton?: number;
  notes?: string;
}

export interface DotationRequest {
  id?: number;
  commercialId: string;
  commercialMatricule: string;
  commercialName: string;
  justification?: string;
  status: DotationStatus;
  referenceNumber: string;
  items: DotationItem[];
  paymentVerifiedBy?: string;
  paymentVerifiedAt?: string;
  quantityValidatedBy?: string;
  quantityValidatedAt?: string;
  quantityValidationComments?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewComments?: string;
  approvedBy?: string;
  approvedAt?: string;
  deliveredBy?: string;
  requestedAt?: string;
  scheduledDate?: string;
  completedAt?: string;
}

export interface CreateDotationRequest {
  commercialId: string;
  commercialMatricule: string;
  commercialName: string;
  justification?: string;
  items: DotationItem[];
}

// ── PRODUCTION BATCH ──────────────────────────────────────
export interface ProductionBatch {
  id: number;
  productId: number;
  productName?: string;
  productSku?: string;
  productUnit?: string;
  declaredQuantityKg: number;
  equivalentUnits?: number;
  productionDate: string;
  batchDate?: string;
  status: ProductionStatus;
  declaredBy: number;
  declaredByName?: string;
  stockValidator?: number;
  stockValidatorName?: string;
  createdAt: string;
  validatedAt?: string;
  notes?: string;
  conditioningType?: string;
  conditioningQty?: number;
}

// ── INTERNAL ORDER (Gestionnaire → Production) ────────────
export interface InternalOrderItem {
  id: number;
  productId: number;
  productName?: string;
  productSku?: string;
  productUnit?: string;
  packagingType?: string;
  quantityPerCarton?: number;
  requestedQty: number;
  deliveredQty: number;
  fullyDelivered?: boolean;
  notes?: string;
}

export interface InternalOrder {
  id: number;
  orderNumber: string;
  orderDate: string;
  status: InternalOrderStatus;
  requestedBy: string;
  requestedByName?: string;
  approvedBy?: string;
  approvedByName?: string;
  createdAt: string;
  approvedAt?: string;
  cancelledBy?: string;
  cancelledReason?: string;
  cancelledAt?: string;
  notes?: string;
  items: InternalOrderItem[];
}

// ── COMMERCIAL ────────────────────────────────────────────
export interface Commercial { id: number; name: string; phone: string; vehicle: string; active: boolean; matricule?: string; }

export interface CommercialStock { id: number; commercialId: number; productId: number; quantity: number; product?: Product; }

export interface MobileStockSummary {
  commercialMatricule: string;
  locationId: string;
  stockItems: StockLevel[];
  totalValue: number;
  totalItems: number;
}

export interface MobileStockRotation {
  commercialMatricule: string;
  totalIn: number;
  totalOut: number;
  movementCount: number;
  netMovement: number;
}

export interface SlowStockCommercial {
  matricule: string;
  locationName: string;
  totalSales: number;
  totalStock: number;
  productCount: number;
}

export interface InfoProduitsLine {
  id: number;
  productId: number;
  product?: Product;
  takenQty: number;
  soldQty: number;
  returnedQty: number;
  unitPrice?: number;
}

export interface InfoProduits {
  id: number;
  commercialId: string;
  commercialMatricule?: string;
  commercial?: Commercial;
  date: string;
  status: InfoStatus;
  preparedBy: number;
  preparedByName?: string;
  cashierValidatedBy?: string;
  accountantValidatedBy?: string;
  createdAt: string;
  lines: InfoProduitsLine[];
  montantTotal?: number;
}

// ── SESSION & BALANCES ────────────────────────────────────
export interface DailySession {
  id: number;
  date: string;
  status: SessionStatus;
  openedBy: number;
  closedBy?: number;
  totalCashExpected: number;
  totalCashActual: number;
}

// ── STOCK MOVEMENT ────────────────────────────────────────
export interface StockMovement {
  id: number;
  type: MovementType;
  fromLocationId?: string;
  toLocationId?: string;
  productId: number;
  productSku?: string;
  packagingType?: string;
  quantity: number;
  quantityPerCarton?: number;
  referenceNumber?: string;
  notes?: string;
  status?: 'PENDING' | 'VALIDATED' | 'CANCELLED';
  requestedAt?: string;
  validatedAt?: string;
  // Legacy fields kept for backward compat with mock data
  warehouseId?: number;
  previousStock?: number;
  newStock?: number;
  reference?: string;
  createdBy?: number;
  createdAt?: string;
  product?: Product;
  warehouse?: Warehouse;
}

// ── DASHBOARD ─────────────────────────────────────────────
export interface DashboardStatsResponse {
  totalStockLevels: number;
  totalStockValue: number;
  criticalAlerts: number;
  lowAlerts: number;
  pendingReceipts: number;
  todayReceipts: number;
  todayMovements: number;
  pendingBatches: number;
  activeInternalOrders: number;
  todaySales: number;
}

// ── BATCH / LOT ───────────────────────────────────────────
export type BatchStatus = 'AVAILABLE' | 'RESERVED' | 'EXPIRED' | 'EMPTY' | 'QUARANTINE' | 'DELETED';

export interface StockBatch {
  id: number;
  batchNumber: string;
  productId: number;
  productSku: string;
  productName?: string;
  supplierName?: string;
  manufactureDate?: string;
  expiryDate?: string;
  initialQuantity: number;
  remainingQuantity: number;
  locationId?: string;
  status: BatchStatus;
  notes?: string;
  createdAt: string;
  lastMovementAt?: string;
}

// ── AUDIT LOG ─────────────────────────────────────────────
export interface StockAuditLog {
  id: number;
  entityType: string;
  entityId: string;
  action: string;
  userMatricule?: string;
  userName?: string;
  oldValues?: string;
  newValues?: string;
  reason?: string;
  timestamp: string;
}

// ── ALERT (backend entity) ────────────────────────────────
export type AlertType = 'LOW_STOCK' | 'CRITICAL_STOCK' | 'OVERSTOCK' | 'EXPIRATION_SOON' | 'EXPIRED' | 'SLOW_ROTATION' | 'REORDER_NEEDED' | 'BUFFER_INSUFFICIENT';
export type AlertPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type AlertStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface StockAlertEntity {
  id: number;
  type: AlertType;
  priority: AlertPriority;
  locationId: string;
  productId: number;
  productSku: string;
  productName: string;
  currentQuantity: number;
  threshold: number;
  message: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  createdAt: string;
  resolvedAt?: string;
  status: AlertStatus;
}

// ── ALERT (UI helper from stock levels) ───────────────────
export interface StockAlert {
  produitId: number;
  designation: string;
  magasin: string;
  stockActuel: number;
  stockMinimum: number;
  niveau: AlertLevel;
  leadTimeDays?: number;
}
