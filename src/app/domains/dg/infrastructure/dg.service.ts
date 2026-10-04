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

export interface VersementDuJourBE {
  referenceVersement: string;
  matriculeCommercial: string;
  montantAttendu: number;
  cashVerse: number;
  ecart: number;
  alerteRouge: boolean;
  statut: string;
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
  date: string;
  soldeCaisse: number;
  totalFacturesEmises: number;
  totalFacturesPayees: number;
  nbFacturesImpayees: number;
  totalDecaissementsExecutes: number;
  nbDecaissementsEnAttente: number;
  nbVersementsEnAttente: number;
  nbAlertesRouges: number;
  totalVersementsValides: number;
  nbPrimesValideesNonVersées: number;
  totalPrimesAVerser: number;
  nbRecouvrementsEnCours: number;
  nbRecouvrementsContentieux: number;
  totalCreances: number;
}

export interface DashboardProductionDgBE {
  date: string;
  nbPPHEnCours: number;
  nbPPHClotures: number;
  nbOFPlanifies: number;
  nbOFEnCours: number;
  nbOFHonores: number;
  nbOFAnnules: number;
  nbLotsDeclares: number;
  nbLotsReceptionnes: number;
  nbLotsValides: number;
  nbLotsRejetes: number;
  quantiteProduiteKg: number;
  nbCartons: number;
}

@Injectable({ providedIn: 'root' })
export class DgService {
  private readonly api = inject(ApiService);

  getKpis(): Observable<KpisDgBE> {
    return this.api.get<ApiResponse<KpisDgBE>>('dg/kpis')
      .pipe(map(r => r.donnees!));
  }

  /** Versements du jour, tous commerciaux — lecture directe du module comptabilité (COMPTABILITE_VERSEMENT_CONSULTER, déjà accordée au DG). */
  getVersementsDuJour(date?: string): Observable<VersementDuJourBE[]> {
    const params: Record<string, string> = { date: date ?? new Date().toISOString().slice(0, 10) };
    return this.api.get<ApiResponse<VersementDuJourBE[]>>('comptabilite/versements', params)
      .pipe(map(r => r.donnees ?? []));
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

  resoudreValidation(reference: string, type: string, approbation: boolean): Observable<ApiResponse<void>> {
    return this.api.post<ApiResponse<void>>(`dg/validations/${reference}/resoudre`, null, {
      type,
      approbation: String(approbation)
    });
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

  /**
   * Contexte remis à l'assistance IA — chiffres du jour, alertes, validations
   * en attente. Le serveur l'expose sur `GET /api/dg/ai-context`
   * (`DgController:234`) ; la forme est libre et volontairement non typée ici,
   * car c'est le serveur qui décide de ce qu'il juge utile d'y mettre.
   */
  getAiContext(): Observable<Record<string, unknown>> {
    return this.api.get<ApiResponse<Record<string, unknown>>>('dg/ai-context')
      .pipe(map(r => r.donnees ?? {}));
  }
}
