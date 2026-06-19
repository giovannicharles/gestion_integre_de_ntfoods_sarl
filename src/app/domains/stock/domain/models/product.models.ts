// ════════════════════════════════════════════════════════════
// TANTY DIGITAL ERP — Modèles spécifiques aux Produits
// Complément aux modèles de stock pour la gestion des produits
// ════════════════════════════════════════════════════════════

import { Brand, ProductLine, ProductVariant, Product, Category, UnitType } from './stock.models';

// ── PRICE TYPES ─────────────────────────────────────────────
export type PriceType = 'PURCHASE' | 'COST' | 'WHOLESALE' | 'RETAIL' | 'PROMOTIONAL' | 'DISTRIBUTOR' | 'COMMERCIAL';

export interface ProductPrice {
  id: number;
  productId: number;
  priceType: PriceType;
  price: number;
  currency?: string;
  validFrom?: string;
  validTo?: string;
  minQuantity?: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── REQUEST DTOs ─────────────────────────────────────────────
export interface CreateBrandRequest {
  name: string;
  code: string;
  active?: boolean;
}

export interface UpdateBrandRequest {
  name?: string;
  code?: string;
  active?: boolean;
}

export interface CreateProductLineRequest {
  brandId: number;
  name: string;
  code: string;
  active?: boolean;
}

export interface UpdateProductLineRequest {
  name?: string;
  code?: string;
  active?: boolean;
}

export interface CreateProductVariantRequest {
  productLineId: number;
  name: string;
  code: string;
}

export interface UpdateProductVariantRequest {
  name?: string;
  code?: string;
}

export interface CreateProductPriceRequest {
  productId: number;
  priceType: PriceType;
  price: number;
  currency?: string;
  validFrom?: string;
  validTo?: string;
  minQuantity?: number;
  active?: boolean;
}

export interface UpdateProductPriceRequest {
  priceType?: PriceType;
  price?: number;
  currency?: string;
  validFrom?: string;
  validTo?: string;
  minQuantity?: number;
  active?: boolean;
}

export interface CreateProductRequest {
  sku: string;
  variantId?: number;
  barcode?: string;
  category: Category;
  unit: UnitType;
  unitPriceAmount: number;
  leadTimeDays?: number;
  safetyStockDays?: number;
  active?: boolean;
  prices?: CreateProductPriceRequest[];
}

export interface UpdateProductRequest {
  sku?: string;
  variantId?: number;
  barcode?: string;
  category?: Category;
  unit?: UnitType;
  unitPriceAmount?: number;
  leadTimeDays?: number;
  safetyStockDays?: number;
  active?: boolean;
  prices?: UpdateProductPriceRequest[];
}

// ── RESPONSE DTOs ───────────────────────────────────────────
export interface BrandResponse {
  id: number;
  name: string;
  code: string;
  active: boolean;
  productLinesCount?: number;
}

export interface ProductLineResponse {
  id: number;
  brandId: number;
  name: string;
  code: string;
  active: boolean;
  brand?: Brand;
  variantsCount?: number;
}

export interface ProductVariantResponse {
  id: number;
  productLineId: number;
  name: string;
  code: string;
  productLine?: ProductLine;
  productsCount?: number;
}

export interface ProductPriceResponse {
  id: number;
  productId: number;
  priceType: PriceType;
  price: number;
  currency?: string;
  validFrom?: string;
  validTo?: string;
  minQuantity?: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductResponse {
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
  designation?: string;
  stockLevels?: ProductStockInfo[];
  prices?: ProductPriceResponse[];
}

export interface ProductStockInfo {
  warehouseId: number;
  warehouseName: string;
  quantity: number;
  availableQty: number;
  reservedQty: number;
}

// ── FILTER & SEARCH ─────────────────────────────────────────
export interface ProductFilter {
  category?: Category;
  unit?: UnitType;
  active?: boolean;
  brandId?: number;
  productLineId?: number;
  variantId?: number;
  search?: string;
  priceType?: PriceType;
  minPrice?: number;
  maxPrice?: number;
}

export interface ProductListResponse {
  products: ProductResponse[];
  total: number;
  page: number;
  pageSize: number;
}

export interface BrandListResponse {
  brands: BrandResponse[];
  total: number;
}

export interface ProductLineListResponse {
  productLines: ProductLineResponse[];
  total: number;
}

export interface ProductVariantListResponse {
  variants: ProductVariantResponse[];
  total: number;
}

export interface ProductPriceListResponse {
  prices: ProductPriceResponse[];
  total: number;
}
