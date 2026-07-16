import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../../../core/http/api.service';
import { ApiResponse } from '../../../core/models/api-response.model';

export interface SyncLogBE {
  id: number;
  idempotencyKey: string;
  matriculeCommercial: string;
  entityType: string;
  entityRef: string;
  result: string;
  serverEntityRef: string | null;
  conflictDetail: string | null;
  dateTraitement: string;
}

export interface SyncPushResponseBE {
  idempotencyKey: string;
  result: string;
  serverEntityRef: string | null;
  conflictDetail: string | null;
  dateTraitement: string;
}

export interface SyncPullResponseBE {
  serverTime: string;
  matriculeCommercial: string;
  batches: { entityType: string; lastSync: string; entities: { entityRef: string; payload: string | null; dateModification: string }[] }[];
}

@Injectable({ providedIn: 'root' })
export class SyncService {
  private api = inject(ApiService);

  push(req: {
    idempotencyKey: string;
    matriculeCommercial: string;
    entityType: string;
    entityRef: string;
    payloadHash: string;
  }): Observable<SyncPushResponseBE> {
    return this.api.post<ApiResponse<SyncPushResponseBE>>('sync/push', req)
      .pipe(map(r => r.donnees!));
  }

  pull(matriculeCommercial: string, lastSync: string): Observable<SyncPullResponseBE> {
    return this.api.get<ApiResponse<SyncPullResponseBE>>('sync/pull', { matriculeCommercial, lastSync })
      .pipe(map(r => r.donnees!));
  }

  getHistorique(params?: {
    matricule?: string;
    entityType?: string;
    result?: string;
    debut?: string;
    fin?: string;
    limite?: number;
  }): Observable<SyncLogBE[]> {
    const p: Record<string, string> = {};
    if (params?.matricule) p['matricule'] = params.matricule;
    if (params?.entityType) p['entityType'] = params.entityType;
    if (params?.result) p['result'] = params.result;
    if (params?.debut) p['debut'] = params.debut;
    if (params?.fin) p['fin'] = params.fin;
    p['limite'] = String(params?.limite ?? 100);
    return this.api.get<ApiResponse<SyncLogBE[]>>('sync/historique', p)
      .pipe(map(r => r.donnees ?? []));
  }
}
