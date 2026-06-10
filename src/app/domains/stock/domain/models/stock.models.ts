// ════════════════════════════════════════════════════════════
// TANTY DIGITAL ERP — Modèles du Domaine Stock v3
// Correspond exactement aux entités JPA du backend Spring Boot
// ════════════════════════════════════════════════════════════

// ── ENUMS ─────────────────────────────────────────────────
export type Role = 'GESTIONNAIRE_STOCK'|'CHEF_PRODUCTION'|'COMPTABLE'|'CAISSIERE'|'DG'|'COMMERCIAL';
export type Category = 'RAW_MATERIAL'|'CONSUMABLE'|'FINISHED_PRODUCT'|'PACKAGING'|'EQUIPMENT';
export type UnitType = 'KG'|'SACHET_42G'|'SEAU_1L'|'SEAU_5L'|'SEAU_10L'|'CARTON'|'SAC'|'LITER';
export type WarehouseType = 'CENTRAL'|'BUFFER';
export type ReceiptStatus = 'PENDING_FIRST_VALIDATION'|'PENDING_SECOND_VALIDATION'|'VALIDATED'|'REJECTED';
export type SourceType = 'SUPPLIER'|'PRODUCTION';
export type OrderStatus = 'DRAFT'|'APPROVED'|'PARTIALLY_RECEIVED'|'FULLY_RECEIVED';
export type ProductionStatus = 'DECLARED_BY_PRODUCTION'|'VALIDATED_BY_STOCK'|'REJECTED';
export type InternalOrderStatus = 'DRAFT'|'APPROVED'|'PARTIALLY_DELIVERED'|'DELIVERED'|'CANCELLED';
export type InfoStatus = 'DRAFT'|'PENDING_CASH'|'PENDING_ACCOUNTANT'|'CLOSED';
export type PaymentType = 'CASH'|'CREDIT';
export type SessionStatus = 'OPEN'|'PENDING_CASH'|'PENDING_ACCOUNTANT'|'CLOSED';
export type MovementType = 'ENTRY_FROM_SUPPLIER'|'ENTRY_FROM_PRODUCTION'|'EXIT_TO_COMMERCIAL'|'TRANSFER'|'ADJUSTMENT'|'VIREMENT_BETWEEN_COMMERCIAL';
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
  id: number;
  productId: number;
  productName?: string;
  productSku?: string;
  productUnit?: string;
  orderedQty: number;
  receivedQty: number;
  deviation?: number;
  deviationReason?: string;
  lotNumber?: string;
  unitPrice?: number;
  lineTotal?: number;
}

export interface Receipt {
  id: number;
  receiptNumber: string;
  source: SourceType;
  sourceId?: number;
  receiptDate: string;
  warehouseId: number;
  warehouseName?: string;
  status: ReceiptStatus;
  firstValidatorId?: number;
  firstValidatorName?: string;
  firstValidatedAt?: string;
  firstValidatorNotes?: string;
  secondValidatorId?: number;
  secondValidatorName?: string;
  secondValidatedAt?: string;
  secondValidatorNotes?: string;
  rejectionReason?: string;
  totalAmount: number;
  createdAt: string;
  createdByName?: string;
  items: ReceiptItem[];
  // display
  warehouse?: Warehouse;
  fournisseur?: Supplier;
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
}

// ── INTERNAL ORDER (Gestionnaire → Production) ────────────
export interface InternalOrderItem {
  id: number;
  productId: number;
  productName?: string;
  productSku?: string;
  productUnit?: string;
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
  requestedBy: number;
  requestedByName?: string;
  approvedBy?: number;
  approvedByName?: string;
  createdAt: string;
  approvedAt?: string;
  notes?: string;
  items: InternalOrderItem[];
}

// ── COMMERCIAL ────────────────────────────────────────────
export interface Commercial { id: number; name: string; phone: string; vehicle: string; active: boolean; }

export interface CommercialStock { id: number; commercialId: number; productId: number; quantity: number; product?: Product; }

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
  commercialId: number;
  commercial?: Commercial;
  date: string;
  status: InfoStatus;
  preparedBy: number;
  cashierValidatedBy?: number;
  accountantValidatedBy?: number;
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
  productId: number;
  warehouseId: number;
  quantity: number;
  previousStock: number;
  newStock: number;
  reference?: string;
  createdBy: number;
  createdAt: string;
  notes?: string;
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

// ── ALERT (UI helper) ─────────────────────────────────────
export interface StockAlert {
  produitId: number;
  designation: string;
  magasin: string;
  stockActuel: number;
  stockMinimum: number;
  niveau: AlertLevel;
  leadTimeDays?: number;
}
