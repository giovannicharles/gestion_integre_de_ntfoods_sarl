import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environment/environment';

@Injectable({ providedIn: 'root' })
export class DocumentService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  importerDocument(typeDocument: string, reference: string, file: File): Observable<string> {
    const formData = new FormData();
    formData.append('typeDocument', typeDocument);
    formData.append('reference', reference);
    formData.append('file', file);
    return this.http.post(`${this.base}/documents/importer`, formData, { responseType: 'text' });
  }

  recupererDocument(cle: string): Observable<Blob> {
    return this.http.get(`${this.base}/documents/recuperer`, {
      params: { cle },
      responseType: 'blob',
    });
  }
}
