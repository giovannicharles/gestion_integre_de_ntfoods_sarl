import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environment/environment';
import {
  CreateBrandRequest,
  UpdateBrandRequest,
  CreateProductLineRequest,
  UpdateProductLineRequest,
  CreateProductVariantRequest,
  UpdateProductVariantRequest,
  CreateProductPriceRequest,
  UpdateProductPriceRequest,
  CreateProductRequest,
  UpdateProductRequest,
  BrandResponse,
  ProductLineResponse,
  ProductVariantResponse,
  ProductPriceResponse,
  ProductResponse,
  ProductFilter,
  ProductListResponse,
  BrandListResponse,
  ProductLineListResponse,
  ProductVariantListResponse,
  ProductPriceListResponse
} from '../../domain/models/product.models';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private apiUrl = environment.productUrl;

  constructor(private http: HttpClient) {}

  // ── BRANDS ───────────────────────────────────────────────
  getAllBrands(): Observable<BrandListResponse> {
    return this.http.get<BrandListResponse>(`${this.apiUrl}/brands`);
  }

  getBrandById(id: number): Observable<BrandResponse> {
    return this.http.get<BrandResponse>(`${this.apiUrl}/brands/${id}`);
  }

  createBrand(request: CreateBrandRequest): Observable<BrandResponse> {
    return this.http.post<BrandResponse>(`${this.apiUrl}/brands`, request);
  }

  updateBrand(id: number, request: UpdateBrandRequest): Observable<BrandResponse> {
    return this.http.put<BrandResponse>(`${this.apiUrl}/brands/${id}`, request);
  }

  deleteBrand(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/brands/${id}`);
  }

  // ── PRODUCT LINES ─────────────────────────────────────────
  getAllProductLines(brandId?: number): Observable<ProductLineListResponse> {
    let params = new HttpParams();
    if (brandId) {
      params = params.set('brandId', brandId);
    }
    return this.http.get<ProductLineListResponse>(`${this.apiUrl}/product-lines`, { params });
  }

  getProductLineById(id: number): Observable<ProductLineResponse> {
    return this.http.get<ProductLineResponse>(`${this.apiUrl}/product-lines/${id}`);
  }

  createProductLine(request: CreateProductLineRequest): Observable<ProductLineResponse> {
    return this.http.post<ProductLineResponse>(`${this.apiUrl}/product-lines`, request);
  }

  updateProductLine(id: number, request: UpdateProductLineRequest): Observable<ProductLineResponse> {
    return this.http.put<ProductLineResponse>(`${this.apiUrl}/product-lines/${id}`, request);
  }

  deleteProductLine(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/product-lines/${id}`);
  }

  // ── PRODUCT VARIANTS ──────────────────────────────────────
  getAllProductVariants(productLineId?: number): Observable<ProductVariantListResponse> {
    let params = new HttpParams();
    if (productLineId) {
      params = params.set('productLineId', productLineId);
    }
    return this.http.get<ProductVariantListResponse>(`${this.apiUrl}/product-variants`, { params });
  }

  getProductVariantById(id: number): Observable<ProductVariantResponse> {
    return this.http.get<ProductVariantResponse>(`${this.apiUrl}/product-variants/${id}`);
  }

  createProductVariant(request: CreateProductVariantRequest): Observable<ProductVariantResponse> {
    return this.http.post<ProductVariantResponse>(`${this.apiUrl}/product-variants`, request);
  }

  updateProductVariant(id: number, request: UpdateProductVariantRequest): Observable<ProductVariantResponse> {
    return this.http.put<ProductVariantResponse>(`${this.apiUrl}/product-variants/${id}`, request);
  }

  deleteProductVariant(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/product-variants/${id}`);
  }

  // ── PRODUCTS ───────────────────────────────────────────────
  getAllProducts(filter?: ProductFilter, page: number = 0, pageSize: number = 20): Observable<ProductListResponse> {
    let params = new HttpParams()
      .set('page', page)
      .set('pageSize', pageSize);
    
    if (filter) {
      if (filter.category) params = params.set('category', filter.category);
      if (filter.unit) params = params.set('unit', filter.unit);
      if (filter.active !== undefined) params = params.set('active', filter.active);
      if (filter.brandId) params = params.set('brandId', filter.brandId);
      if (filter.productLineId) params = params.set('productLineId', filter.productLineId);
      if (filter.variantId) params = params.set('variantId', filter.variantId);
      if (filter.search) params = params.set('search', filter.search);
    }
    
    return this.http.get<ProductListResponse>(`${this.apiUrl}/products`, { params });
  }

  getProductById(id: number): Observable<ProductResponse> {
    return this.http.get<ProductResponse>(`${this.apiUrl}/products/${id}`);
  }

  getProductBySku(sku: string): Observable<ProductResponse> {
    return this.http.get<ProductResponse>(`${this.apiUrl}/products/sku/${sku}`);
  }

  createProduct(request: CreateProductRequest): Observable<ProductResponse> {
    return this.http.post<ProductResponse>(`${this.apiUrl}/products`, request);
  }

  updateProduct(id: number, request: UpdateProductRequest): Observable<ProductResponse> {
    return this.http.put<ProductResponse>(`${this.apiUrl}/products/${id}`, request);
  }

  deleteProduct(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/products/${id}`);
  }

  // ── SEARCH ─────────────────────────────────────────────────
  searchProducts(query: string, page: number = 0, pageSize: number = 20): Observable<ProductListResponse> {
    return this.http.get<ProductListResponse>(`${this.apiUrl}/products/search`, {
      params: { query, page, pageSize }
    });
  }

  // ── PRODUCT PRICES ─────────────────────────────────────────
  getProductPrices(productId: number): Observable<ProductPriceListResponse> {
    return this.http.get<ProductPriceListResponse>(`${this.apiUrl}/products/${productId}/prices`);
  }

  getProductPriceByType(productId: number, priceType: string): Observable<ProductPriceResponse> {
    return this.http.get<ProductPriceResponse>(`${this.apiUrl}/products/${productId}/prices/${priceType}`);
  }

  createProductPrice(productId: number, request: CreateProductPriceRequest): Observable<ProductPriceResponse> {
    return this.http.post<ProductPriceResponse>(`${this.apiUrl}/products/${productId}/prices`, request);
  }

  updateProductPrice(productId: number, priceId: number, request: UpdateProductPriceRequest): Observable<ProductPriceResponse> {
    return this.http.put<ProductPriceResponse>(`${this.apiUrl}/products/${productId}/prices/${priceId}`, request);
  }

  deleteProductPrice(productId: number, priceId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/products/${productId}/prices/${priceId}`);
  }
}
