import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../../../core/http/api.service';
import { ApiResponse } from '../../../core/models/api-response.model';

export interface KpisDgBE {
  caTotal: number;
  caMoisN1: number;
  caMoisN2: number;
  ventesCount: number;
  commerciauxActifs: number;
  objectifCible: number;
  objectifRealise: number;
  margeGlobale: number;
  tresorerie: number;
  rentabiliteProductionPct: number;
  stockMatieresPremieres: number;
  stockConsommables: number;
  stockProduitsFinis: number;
}

export interface ClassementCommercialBE {
  rang: number;
  matricule: string;
  nomComplet: string;
  caRealise: number;
  nbVentes: number;
}

export interface TrancheComparatifBE {
  debut: string;
  fin: string;
  caFCFA: number;
  nombreVentes: number;
}

export interface RapportComparatifBE {
  periode: string;
  actuelle: TrancheComparatifBE;
  precedente: TrancheComparatifBE;
  variationAbsolueFCFA: number;
  variationPourcent: number;
}

export interface TauxOccupationSecteurBE {
  secteur: string;
  boutiquesRecensees: number;
  clientsLivres: number;
  tauxOccupationPourcent: number;
}

export interface ZonePerformanceBE {
  secteur: string;
  caMoisCourantFCFA: number;
  nombreClients: number;
  nombreVentesMoisCourant: number;
}

export interface ValidationEnAttenteBE {
  type: string;
  reference: string;
  description: string;
  matriculeConcerne: string;
  depuis: string;
}

export interface AnomalieBE {
  categorie: string;
  reference: string;
  description: string;
  matriculeConcerne?: string;
}

export interface DashboardStockDgBE {
  date: string;
  nbProduitsCentral: number;
  totalQuantiteCentral: number;
  nbProduitsTampon: number;
  totalQuantiteTampon: number;
  nbProduitsMobile: number;
  totalQuantiteMobile: number;
  nbAlertesActives: number;
  totalAlertes: number;
  nbProduitsSousSeuil: number;
}

export interface DashboardFinancierDgBE {
  soldeCaisse: number;
  totalFacturesEmises: number;
  totalFacturesPayees: number;
  totalDecaissementsExecutes: number;
  totalVersements: number;
  totalPrimes: number;
  totalRecouvrements: number;
}

export interface DashboardProductionDgBE {
  totalPPH: number;
  totalOF: number;
  totalLots: number;
  totalQuantiteProduite: number;
}

@Injectable({ providedIn: 'root' })
export class DgService {
  private readonly api = inject(ApiService);

  getKpis(): Observable<KpisDgBE> {
    return this.api.get<ApiResponse<KpisDgBE>>('dg/kpis')
      .pipe(map(r => r.donnees!));
  }

  getClassement(): Observable<ClassementCommercialBE[]> {
    return this.api.get<ApiResponse<ClassementCommercialBE[]>>('dg/classement-commerciaux')
      .pipe(map(r => r.donnees ?? []));
  }

  getComparatif(periode: string, date?: string): Observable<RapportComparatifBE> {
    const params: Record<string, string> = { periode };
    if (date) params['date'] = date;
    return this.api.get<ApiResponse<RapportComparatifBE>>('dg/comparatif', params)
      .pipe(map(r => r.donnees!));
  }

  getTauxOccupationMarches(): Observable<TauxOccupationSecteurBE[]> {
    return this.api.get<ApiResponse<TauxOccupationSecteurBE[]>>('dg/taux-occupation-marches')
      .pipe(map(r => r.donnees ?? []));
  }

  getZones(): Observable<ZonePerformanceBE[]> {
    return this.api.get<ApiResponse<ZonePerformanceBE[]>>('dg/zones')
      .pipe(map(r => r.donnees ?? []));
  }

  getValidationsEnAttente(): Observable<ValidationEnAttenteBE[]> {
    return this.api.get<ApiResponse<ValidationEnAttenteBE[]>>('dg/validations')
      .pipe(map(r => r.donnees ?? []));
  }

  getAnomalies(): Observable<AnomalieBE[]> {
    return this.api.get<ApiResponse<AnomalieBE[]>>('dg/anomalies')
      .pipe(map(r => r.donnees ?? []));
  }

  getDashboardStock(): Observable<DashboardStockDgBE> {
    return this.api.get<ApiResponse<DashboardStockDgBE>>('dg/dashboard-stock')
      .pipe(map(r => r.donnees!));
  }

  getDashboardFinancier(): Observable<DashboardFinancierDgBE> {
    return this.api.get<ApiResponse<DashboardFinancierDgBE>>('dg/dashboard-financier')
      .pipe(map(r => r.donnees!));
  }

  getDashboardProduction(): Observable<DashboardProductionDgBE> {
    return this.api.get<ApiResponse<DashboardProductionDgBE>>('dg/dashboard-production')
      .pipe(map(r => r.donnees!));
  }

  getAiContext(): Observable<Record<string, unknown>> {
    return this.api.get<ApiResponse<Record<string, unknown>>>('dg/ai-context')
      .pipe(map(r => r.donnees ?? {}));
  }

  approverValidation(type: string, reference: string, matricule: string): Observable<ValidationEnAttenteBE> {
    return this.api.post<ApiResponse<ValidationEnAttenteBE>>('dg/validations/approuver', {
      type, reference, matricule
    }).pipe(map(r => r.donnees!));
  }

  refuserValidation(type: string, reference: string, matricule: string, motif?: string): Observable<ValidationEnAttenteBE> {
    return this.api.post<ApiResponse<ValidationEnAttenteBE>>('dg/validations/refuser', {
      type, reference, matricule, motif: motif || 'Refusé par le DG'
    }).pipe(map(r => r.donnees!));
  }
}
