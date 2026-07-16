import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../http/api.service';
import { ApiResponse } from '../models/api-response.model';
import { PageResponse, PageParams } from '../models/page-response.model';

export interface JournalAuditBE {
  id: number;
  matricule: string;
  role: string;
  typeAction: string;
  module: string;
  ressource: string;
  referenceEntite: string;
  methodeHttp: string;
  endpoint: string;
  details: string;
  succes: boolean;
  messageErreur?: string;
  adresseIp: string;
  dureeMs: number;
  horodatage: string;
}

export interface ActiviteSuspecteBE {
  matricule: string;
  ressource: string;
  occurrences: number;
}

@Injectable({ providedIn: 'root' })
export class AuditService {
  private readonly api = inject(ApiService);

  private pageParamsToRecord(page?: PageParams): Record<string, string> {
    const p: Record<string, string> = {};
    if (page?.page !== undefined) p['page'] = String(page.page);
    if (page?.size !== undefined) p['size'] = String(page.size);
    if (page?.sort) p['sort'] = page.sort;
    return p;
  }

  getAuditParUtilisateur(matricule: string, page?: PageParams): Observable<PageResponse<JournalAuditBE>> {
    return this.api.get<ApiResponse<PageResponse<JournalAuditBE>>>(
      `audit/utilisateur/${encodeURIComponent(matricule)}`, this.pageParamsToRecord(page)
    ).pipe(map(r => r.donnees!));
  }

  getAuditParPeriode(debut: string, fin: string, page?: PageParams): Observable<PageResponse<JournalAuditBE>> {
    const params = { debut, fin, ...this.pageParamsToRecord(page) };
    return this.api.get<ApiResponse<PageResponse<JournalAuditBE>>>('audit/periode', params)
      .pipe(map(r => r.donnees!));
  }

  getAuditParModule(module: string, page?: PageParams): Observable<PageResponse<JournalAuditBE>> {
    return this.api.get<ApiResponse<PageResponse<JournalAuditBE>>>(
      `audit/module/${encodeURIComponent(module)}`, this.pageParamsToRecord(page)
    ).pipe(map(r => r.donnees!));
  }

  getAuditParType(typeAction: string, page?: PageParams): Observable<PageResponse<JournalAuditBE>> {
    return this.api.get<ApiResponse<PageResponse<JournalAuditBE>>>(
      `audit/type/${encodeURIComponent(typeAction)}`, this.pageParamsToRecord(page)
    ).pipe(map(r => r.donnees!));
  }

  getAuditEchecs(page?: PageParams): Observable<PageResponse<JournalAuditBE>> {
    return this.api.get<ApiResponse<PageResponse<JournalAuditBE>>>(
      'audit/echecs', this.pageParamsToRecord(page)
    ).pipe(map(r => r.donnees!));
  }

  getActivitesSuspectes(fenetreHeures: number = 24, seuil: number = 5): Observable<ActiviteSuspecteBE[]> {
    return this.api.get<ApiResponse<ActiviteSuspecteBE[]>>('audit/activites-suspectes', {
      fenetreHeures: String(fenetreHeures),
      seuil: String(seuil),
    }).pipe(map(r => r.donnees ?? []));
  }
}
