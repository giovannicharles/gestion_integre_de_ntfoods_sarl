import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environment/environment';

/** Service HTTP centralisé — tous les appels API passent ici. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  private buildUrl(url: string): string {
    const cleanUrl = url.startsWith('/') ? url.substring(1) : url;
    return `${this.base}/${cleanUrl}`;
  }

  get<T>(url: string, params?: Record<string, string>): Observable<T> {
    const p = params ? new HttpParams({ fromObject: params }) : undefined;
    return this.http.get<T>(this.buildUrl(url), { params: p });
  }
  post<T>(url: string, body: unknown, params?: Record<string, string>): Observable<T> {
    const p = params ? new HttpParams({ fromObject: params }) : undefined;
    return this.http.post<T>(this.buildUrl(url), body, { params: p });
  }
  put<T>(url: string, body: unknown, params?: Record<string, string>): Observable<T> {
    const p = params ? new HttpParams({ fromObject: params }) : undefined;
    return this.http.put<T>(this.buildUrl(url), body, { params: p });
  }
  patch<T>(url: string, body: unknown, params?: Record<string, string>): Observable<T> {
    const p = params ? new HttpParams({ fromObject: params }) : undefined;
    return this.http.patch<T>(this.buildUrl(url), body, { params: p });
  }
  delete<T>(url: string, params?: Record<string, string>): Observable<T> {
    const p = params ? new HttpParams({ fromObject: params }) : undefined;
    return this.http.delete<T>(this.buildUrl(url), { params: p });
  }

  /** Télécharge un fichier binaire (Blob). */
  download(url: string, params?: Record<string, string>): Observable<Blob> {
    const p = params ? new HttpParams({ fromObject: params }) : undefined;
    return this.http.get(this.buildUrl(url), {
      params: p,
      responseType: 'blob',
    });
  }


  /** Alias conservé pour la compatibilité avec le module stock existant. */
  getBlob(url: string, params?: Record<string, string>): Observable<Blob> {
    return this.download(url, params);
  }

  /** Télécharge un fichier binaire via POST (Blob). */
  postBlob(url: string, body: unknown): Observable<Blob> {
    return this.http.post(this.buildUrl(url), body, { responseType: 'blob' });
  }
}
