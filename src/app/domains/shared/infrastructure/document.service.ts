import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../../../core/http/api.service';
import { ApiResponse } from '../../../core/models/api-response.model';

/** Types réellement acceptés par le serveur (DocumentArchiveService.TYPES_AUTORISES, backend) — rien d'autre. */
export const TYPES_DOCUMENT = [
  { value: 'BON_COMMANDE', label: 'Bon de commande' },
  { value: 'BON_RECEPTION', label: 'Bon de réception' },
  { value: 'BON_SORTIE', label: 'Bon de sortie' },
  { value: 'FACTURE', label: 'Facture' },
  { value: 'BON_LIVRAISON', label: 'Bon de livraison' },
  { value: 'CERTIFICAT_CONFORMITE', label: 'Certificat de conformité' },
  { value: 'BON_DOTATION', label: 'Bon de dotation' },
  { value: 'RAPPORT', label: 'Rapport' },
  { value: 'PHOTO_AVARIE', label: "Photo d'avarie" },
  { value: 'PIECE_JOINTE_INCIDENT', label: "Pièce jointe d'incident" },
] as const;

export interface DocumentArchiveBE {
  id: number; typeDocument: string; reference: string;
  nomFichierOriginal: string; contentType: string; tailleOctets: number;
  entityType: string | null; entityId: number | null;
  matriculeUploader: string; dateImport: string;
}

@Injectable({ providedIn: 'root' })
export class DocumentService {
  private readonly api = inject(ApiService);

  importer(typeDocument: string, reference: string, file: File, entityType?: string, entityId?: number): Observable<DocumentArchiveBE> {
    const formData = new FormData();
    formData.append('typeDocument', typeDocument);
    formData.append('reference', reference);
    formData.append('file', file);
    if (entityType) formData.append('entityType', entityType);
    if (entityId !== undefined) formData.append('entityId', String(entityId));
    return this.api.post<ApiResponse<DocumentArchiveBE>>('documents/importer', formData)
      .pipe(map(r => r.donnees!));
  }

  rechercher(filtres: { typeDocument?: string; reference?: string; entityType?: string; entityId?: number } = {}): Observable<DocumentArchiveBE[]> {
    const params: Record<string, string> = {};
    if (filtres.typeDocument) params['typeDocument'] = filtres.typeDocument;
    if (filtres.reference) params['reference'] = filtres.reference;
    if (filtres.entityType) params['entityType'] = filtres.entityType;
    if (filtres.entityId !== undefined) params['entityId'] = String(filtres.entityId);
    return this.api.get<ApiResponse<DocumentArchiveBE[]>>('documents', params)
      .pipe(map(r => r.donnees ?? []));
  }

  listerParEntite(entityType: string, entityId: number): Observable<DocumentArchiveBE[]> {
    return this.api.get<ApiResponse<DocumentArchiveBE[]>>(`documents/entite/${encodeURIComponent(entityType)}/${entityId}`)
      .pipe(map(r => r.donnees ?? []));
  }

  telecharger(id: number): Observable<Blob> {
    return this.api.getBlob(`documents/${id}/telecharger`);
  }
}
