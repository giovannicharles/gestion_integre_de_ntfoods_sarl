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

/** Un mois de l'historique de CA, GET /dg/historique-ca-mensuel (2026-11-01). */
export interface MoisCaBE {
  mois: string;
  libelleCourt: string;
  caFCFA: number;
  nbVentes: number;
}

/**
 * Répartition par gamme commerciale, semaine en cours (2026-11-08). Vient de
 * RpDashboardResponse.gammes (GET /rp/dashboard, déjà ouvert au DG) : pas de second calcul, le DG
 * lit la même donnée réelle que l'écran RP. marge/stock restent absents côté backend (aucun
 * rattachement fiable produit → gamme n'existe encore) : non affichés plutôt qu'inventés.
 */
export interface PerformanceGammeBE {
  gamme: string;
  ca: number;
  objectif: number;
  marge: number | null;
  stock: string | null;
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

/** GET /dg/incidents-resume (2026-11-01), compteurs seuls, jamais le détail d'un incident. */
export interface IncidentResumeBE {
  actifs: number;
  enCours: number;
  critiquesActifs: number;
  resolus: number;
  /** Incidents actifs (OUVERT+EN_COURS) groupés par module ; "NON_RENSEIGNE" si non renseigné sur l'incident. */
  actifsParModule: Record<string, number>;
}

/** GET /dg/concentration-clients (2026-11-01). */
export interface ClientCaBE {
  codeClient: string;
  nomClient: string;
  localite: string | null;
  caFCFA: number;
  nbVentes: number;
  pourcentDuTotal: number;
}
export interface ConcentrationClientsBE {
  topClients: ClientCaBE[];
  pourcentTop5: number;
  pourcentTop10: number;
  caTotalFCFA: number;
  nombreClientsActifs: number;
}

/** GET /dg/historique-tresorerie (2026-11-01), solde de caisse, pas la trésorerie composite. */
export interface MoisSoldeCaisseBE {
  mois: string;
  libelleCourt: string;
  soldeFCFA: number | null;
}

/** GET /dg/controle-gestion (2026-11-01), pont vers le module Contrôle (budget/marges/variances). */
export interface TopMargeBE {
  code: string;
  designation: string;
  margePct: number;
  margeTotaleFCFA: number;
}
export interface ControleGestionResumeBE {
  budgetTotalFCFA: number;
  budgetEngageFCFA: number;
  budgetsDepasses: number;
  nombrePostesBudget: number;
  margeMoyennePct: number;
  topMarges: TopMargeBE[];
  nombreVariances: number;
}

/**
 * GET /dg/audit (2026-11-01), écran DG dédié, remplace l'alias vers admin-audit retiré le même
 * jour (le DG voit tout en lecture seule, l'écran de GESTION de l'audit reste côté Admin).
 */
export interface JournalAuditBE {
  id: number;
  matricule: string;
  role: string;
  typeAction: string;
  module: string;
  ressource: string;
  referenceEntite: string | null;
  methodeHttp: string;
  endpoint: string;
  details: string | null;
  succes: boolean;
  messageErreur: string | null;
  adresseIp: string;
  dureeMs: number;
  horodatage: string;
}
export interface FiltresAuditDg {
  matricule?: string;
  debut?: string;
  fin?: string;
  module?: string;
  typeAction?: string;
  limite?: number;
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
  /** 2026-11-01, CRITIQUE/HAUTE/MOYENNE/BASSE. Inclut maintenant péremptions imminentes et
   * seuils franchis (tampon/central), en plus des écarts déjà remontés. */
  priorite?: string;
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

export interface SeuilBE {
  id: number;
  codeProduit: string;
  typeEntrepot: 'CENTRAL' | 'TAMPON' | 'MOBILE';
  seuilReapprovisionnement: number;
  actif: boolean;
}

export interface HistoriqueSeuilBE {
  id: number;
  codeProduit: string;
  typeEntrepot: string;
  ancienneValeur: number;
  nouvelleValeur: number;
  matriculeAuteur: string;
  dateModification: string;
}

export interface DefinirSeuilRequestBE {
  codeProduit: string;
  typeEntrepot: 'CENTRAL' | 'TAMPON' | 'MOBILE';
  seuilReapprovisionnement: number;
}

/**
 * Paramètres système (2026-10-25), GET/PUT /api/dg/parametres (DgController.java:241,264,
 * GererParametresSystemeUseCase). Sans rapport avec /admin/parametres (TVA, primes, table
 * différente côté métier) ni /dg/seuils (seuils de réapprovisionnement par produit) : ce sont
 * les 9 seuils de sécurité/session (caisse, connexion, alertes), jamais exposés jusqu'ici.
 */
export interface ParametreSystemeBE {
  id: number;
  cle: string;
  valeurNumerique: number;
  description: string;
  modifiePar: string | null;
  horodatage: string | null;
}

@Injectable({ providedIn: 'root' })
export class DgService {
  private readonly api = inject(ApiService);

  /** Gouvernance des seuils (DG), GET/POST /api/stock/seuils (SeuilController, backend). */
  getSeuils(): Observable<SeuilBE[]> {
    return this.api.get<ApiResponse<SeuilBE[]>>('stock/seuils')
      .pipe(map(r => r.donnees ?? []));
  }

  definirSeuil(request: DefinirSeuilRequestBE): Observable<SeuilBE> {
    return this.api.post<ApiResponse<SeuilBE>>('stock/seuils', request)
      .pipe(map(r => r.donnees!));
  }

  getHistoriqueSeuils(): Observable<HistoriqueSeuilBE[]> {
    return this.api.get<ApiResponse<HistoriqueSeuilBE[]>>('stock/seuils/historique')
      .pipe(map(r => r.donnees ?? []));
  }

  getParametresSysteme(): Observable<ParametreSystemeBE[]> {
    return this.api.get<ApiResponse<ParametreSystemeBE[]>>('dg/parametres')
      .pipe(map(r => r.donnees ?? []));
  }

  modifierParametresSysteme(modifications: Record<string, number>): Observable<ParametreSystemeBE[]> {
    return this.api.put<ApiResponse<ParametreSystemeBE[]>>('dg/parametres', modifications)
      .pipe(map(r => r.donnees ?? []));
  }

  getKpis(): Observable<KpisDgBE> {
    return this.api.get<ApiResponse<KpisDgBE>>('dg/kpis')
      .pipe(map(r => r.donnees!));
  }

  /** Versements du jour, tous commerciaux, lecture directe du module comptabilité (COMPTABILITE_VERSEMENT_CONSULTER, déjà accordée au DG). */
  getVersementsDuJour(date?: string): Observable<VersementDuJourBE[]> {
    // Composition manuelle en heure locale, `toISOString()` convertit en UTC et décale la date avant 01:00 (WAT).
    const aujourdhui = new Date();
    const dateLocale = `${aujourdhui.getFullYear()}-${String(aujourdhui.getMonth() + 1).padStart(2, '0')}-${String(aujourdhui.getDate()).padStart(2, '0')}`;
    const params: Record<string, string> = { date: date ?? dateLocale };
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

  getHistoriqueCaMensuel(mois: number = 12): Observable<MoisCaBE[]> {
    return this.api.get<ApiResponse<MoisCaBE[]>>('dg/historique-ca-mensuel', { mois: String(mois) })
      .pipe(map(r => r.donnees ?? []));
  }

  /** Réutilise GET /rp/dashboard (déjà ouvert au DG) pour sa seule section gammes, pas de doublon. */
  getPerformanceGammes(): Observable<PerformanceGammeBE[]> {
    return this.api.get<ApiResponse<{ gammes: PerformanceGammeBE[] }>>('rp/dashboard')
      .pipe(map(r => r.donnees?.gammes ?? []));
  }

  getIncidentsResume(): Observable<IncidentResumeBE> {
    return this.api.get<ApiResponse<IncidentResumeBE>>('dg/incidents-resume')
      .pipe(map(r => r.donnees ?? { actifs: 0, enCours: 0, critiquesActifs: 0, resolus: 0, actifsParModule: {} }));
  }

  getConcentrationClients(top: number = 10): Observable<ConcentrationClientsBE> {
    return this.api.get<ApiResponse<ConcentrationClientsBE>>('dg/concentration-clients', { top: String(top) })
      .pipe(map(r => r.donnees ?? { topClients: [], pourcentTop5: 0, pourcentTop10: 0, caTotalFCFA: 0, nombreClientsActifs: 0 }));
  }

  getHistoriqueTresorerie(mois: number = 12): Observable<MoisSoldeCaisseBE[]> {
    return this.api.get<ApiResponse<MoisSoldeCaisseBE[]>>('dg/historique-tresorerie', { mois: String(mois) })
      .pipe(map(r => r.donnees ?? []));
  }

  getControleGestion(): Observable<ControleGestionResumeBE> {
    return this.api.get<ApiResponse<ControleGestionResumeBE>>('dg/controle-gestion')
      .pipe(map(r => r.donnees ?? { budgetTotalFCFA: 0, budgetEngageFCFA: 0, budgetsDepasses: 0, nombrePostesBudget: 0, margeMoyennePct: 0, topMarges: [], nombreVariances: 0 }));
  }

  getAudit(filtres: FiltresAuditDg): Observable<JournalAuditBE[]> {
    const params: Record<string, string> = {};
    if (filtres.matricule) params['matricule'] = filtres.matricule;
    if (filtres.debut) params['debut'] = filtres.debut;
    if (filtres.fin) params['fin'] = filtres.fin;
    if (filtres.module) params['module'] = filtres.module;
    if (filtres.typeAction) params['typeAction'] = filtres.typeAction;
    params['limite'] = String(filtres.limite ?? 200);
    return this.api.get<ApiResponse<JournalAuditBE[]>>('dg/audit', params)
      .pipe(map(r => r.donnees ?? []));
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
   * Contexte remis à l'assistance IA, chiffres du jour, alertes, validations
   * en attente. Le serveur l'expose sur `GET /api/dg/ai-context`
   * (`DgController:234`) ; la forme est libre et volontairement non typée ici,
   * car c'est le serveur qui décide de ce qu'il juge utile d'y mettre.
   */
  getAiContext(): Observable<Record<string, unknown>> {
    return this.api.get<ApiResponse<Record<string, unknown>>>('dg/ai-context')
      .pipe(map(r => r.donnees ?? {}));
  }

  /**
   * Export du classement commercial / de la performance par zone (2026-11-01), les boutons
   * « Exporter PDF »/« Exporter Excel » de /dg/reporting n'appelaient rien jusqu'ici.
   * `format` : pdf | xlsx | csv | json (voir `FormatRapport` backend).
   */
  exporterClassement(format: 'pdf' | 'xlsx'): Observable<Blob> {
    return this.api.download('dg/rapports/classement', { format });
  }

  exporterZones(format: 'pdf' | 'xlsx'): Observable<Blob> {
    return this.api.download('dg/rapports/zones', { format });
  }

  /** Export de l'historique mensuel du CA / du comparatif de période (2026-11-01, bloc 9 DG_MODULE_SPEC.md). */
  exporterHistoriqueCa(format: 'pdf' | 'xlsx', mois: number = 12): Observable<Blob> {
    return this.api.download('dg/rapports/historique-ca', { format, mois: String(mois) });
  }

  exporterComparatif(format: 'pdf' | 'xlsx', periode: string, date?: string): Observable<Blob> {
    const params: Record<string, string> = { format, periode };
    if (date) params['date'] = date;
    return this.api.download('dg/rapports/comparatif', params);
  }
}
