import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../environment/environment';
import { ApiResponse } from '../../../core/models/api-response.model';

@Injectable({ providedIn: 'root' })
export class DocumentService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  importer(typeDocument: string, reference: string, file: File): Observable<string> {
    const formData = new FormData();
    formData.append('typeDocument', typeDocument);
    formData.append('reference', reference);
    formData.append('file', file);
    return this.http.post<ApiResponse<string>>(`${this.base}/documents/importer`, formData)
      .pipe(map(r => r.donnees ?? ''));
  }

  recuperer(typeDocument: string, reference: string): Observable<Blob> {
    return this.http.get(`${this.base}/documents/recuperer`, {
      params: { typeDocument, reference },
      responseType: 'blob',
    });
  }
}
