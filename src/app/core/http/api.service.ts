import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environment/environment';

/** Service HTTP centralisé — tous les appels API passent ici. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  get<T>(url: string, params?: Record<string, string>): Observable<T> {
    const p = params ? new HttpParams({ fromObject: params }) : undefined;
    return this.http.get<T>(`${this.base}/${url}`, { params: p });
  }
  post<T>(url: string, body: unknown): Observable<T> {
    return this.http.post<T>(`${this.base}/${url}`, body);
  }
  put<T>(url: string, body: unknown): Observable<T> {
    return this.http.put<T>(`${this.base}/${url}`, body);
  }
  patch<T>(url: string, body: unknown): Observable<T> {
    return this.http.patch<T>(`${this.base}/${url}`, body);
  }
  delete<T>(url: string): Observable<T> {
    return this.http.delete<T>(`${this.base}/${url}`);
  }
}
