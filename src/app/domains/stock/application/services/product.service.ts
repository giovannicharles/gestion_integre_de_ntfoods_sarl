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
  PriceType
} from '../../domain/models/product.models';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private apiUrl = environment.productUrl;

  constructor(private http: HttpClient) {}

  // ── BRANDS ───────────────────────────────────────────────
  getAllBrands(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/brands`);
  }

  getActiveBrands(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/brands/active`);
  }

  createBrand(request: CreateBrandRequest): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/brands`, request);
  }

  updateBrand(id: number, request: UpdateBrandRequest): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/brands/${id}`, request);
  }

  deleteBrand(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/brands/${id}`);
  }

  // ── PRODUCT LINES ─────────────────────────────────────────
  getAllProductLines(brandId?: number): Observable<any[]> {
    let params = new HttpParams();
    if (brandId) {
      params = params.set('brandId', brandId);
    }
    return this.http.get<any[]>(`${this.apiUrl}/product-lines`, { params });
  }

  createProductLine(request: CreateProductLineRequest): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/product-lines`, request);
  }

  updateProductLine(id: number, request: UpdateProductLineRequest): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/product-lines/${id}`, request);
  }

  deleteProductLine(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/product-lines/${id}`);
  }

  // ── PRODUCT VARIANTS ──────────────────────────────────────
  getAllProductVariants(productLineId?: number): Observable<any[]> {
    let params = new HttpParams();
    if (productLineId) {
      params = params.set('productLineId', productLineId);
    }
    return this.http.get<any[]>(`${this.apiUrl}/product-variants`, { params });
  }

  createProductVariant(request: CreateProductVariantRequest): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/product-variants`, request);
  }

  updateProductVariant(id: number, request: UpdateProductVariantRequest): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/product-variants/${id}`, request);
  }

  deleteProductVariant(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/product-variants/${id}`);
  }

  // ── PRODUCTS ───────────────────────────────────────────────
  getAllProducts(materialType?: string, active?: boolean): Observable<any[]> {
    let params = new HttpParams();
    if (materialType) params = params.set('materialType', materialType);
    if (active !== undefined) params = params.set('active', active);
    return this.http.get<any[]>(`${this.apiUrl}`, { params });
  }

  getProductById(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }

  getProductBySku(sku: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/sku/${sku}`);
  }

  createProduct(request: CreateProductRequest): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}`, request);
  }

  updateProduct(id: number, request: UpdateProductRequest): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, request);
  }

  deleteProduct(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  // ── PRODUCT PRICES ─────────────────────────────────────────
  getProductPrices(productId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/${productId}/prices`);
  }

  getActiveProductPrices(productId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/${productId}/prices/active`);
  }

  getProductPriceByType(productId: number, priceType: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${productId}/prices/${priceType}`);
  }

  createProductPrice(productId: number, request: CreateProductPriceRequest): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${productId}/prices`, request);
  }

  updateProductPrice(productId: number, priceId: number, request: UpdateProductPriceRequest): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${productId}/prices/${priceId}`, request);
  }

  deleteProductPrice(productId: number, priceId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${productId}/prices/${priceId}`);
  }

  // ── STATS ─────────────────────────────────────────────────
  getStats(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/stats`);
  }
}
