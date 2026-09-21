import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../../../core/http/api.service';
import { ApiResponse } from '../../../core/models/api-response.model';

// ═══════════════════════════════════════════════════════════════════════
// Référentiels statiques (miroir des enums backend)
// ═══════════════════════════════════════════════════════════════════════

export interface CodePosteRef {
  id?: number;
  code: string; libelle: string; effectifReference: number;
  productionParHeure: number; productionJournaliere: number; unite: string;
  actif?: boolean;
  ordre?: number;
  categoriesMetier?: string[];
}

/** Fallback local des 11 postes de production (Responsable de Salle). 
 *  Le référentiel canonique est désormais chargé depuis le backend. */
export const CODES_POSTE: CodePosteRef[] = [
  { code: 'CARAMEL', libelle: 'Caramel', effectifReference: 1, productionParHeure: 8.2, productionJournaliere: 65.6, unite: 'KG', categoriesMetier: ['TANTY_A_GRIGNOTER'] },
  { code: 'CROQUETTE', libelle: 'Croquette', effectifReference: 1, productionParHeure: 3.6, productionJournaliere: 28.8, unite: 'KG', categoriesMetier: ['TANTY_A_GRIGNOTER'] },
  { code: 'ARACHIDE_ENROBEE', libelle: 'Arachide enrobée', effectifReference: 1, productionParHeure: 6.1, productionJournaliere: 48.8, unite: 'KG', categoriesMetier: ['TANTY_A_GRIGNOTER'] },
  { code: 'CHIPS_PLANTAIN', libelle: 'Chips plantain', effectifReference: 2, productionParHeure: 7.5, productionJournaliere: 60.0, unite: 'KG', categoriesMetier: ['TANTY_A_GRIGNOTER'] },
  { code: 'CONDITIONNEMENT_MINI_GRIGNOTER', libelle: 'Conditionnement mini à grignoter (Chips)', effectifReference: 3, productionParHeure: 30.0, productionJournaliere: 2400.0, unite: 'SACHET', categoriesMetier: ['TANTY_A_GRIGNOTER'] },
  { code: 'CONDITIONNEMENT_GRIGNOTER', libelle: 'Conditionnement à grignoter', effectifReference: 2, productionParHeure: 200.0, productionJournaliere: 1600.0, unite: 'SACHET', categoriesMetier: ['TANTY_A_GRIGNOTER'] },
  { code: 'CONDITIONNEMENT_SCEAUX_2L', libelle: 'Conditionnement sceaux 2L', effectifReference: 4, productionParHeure: 100.0, productionJournaliere: 800.0, unite: 'SCEAU', categoriesMetier: ['TANTY_BOUILLIE_DE_SOJA'] },
  { code: 'CONDITIONNEMENT_RASS', libelle: 'Conditionnement RASS', effectifReference: 2, productionParHeure: 625.0, productionJournaliere: 5000.0, unite: 'SACHET', categoriesMetier: ['TANTY_CHOCOLAT'] },
  { code: 'CONDITIONNEMENT_PRESTIGE_CHAP', libelle: 'Conditionnement prestige/chap.', effectifReference: 2, productionParHeure: 50.0, productionJournaliere: 400.0, unite: 'ETUI', categoriesMetier: ['TANTY_CHOCOLAT'] },
  { code: 'ETIQUETAGE', libelle: 'Étiquetage', effectifReference: 1, productionParHeure: 225.0, productionJournaliere: 1800.0, unite: 'SCEAU', categoriesMetier: ['TANTY_BOUILLIE_DE_SOJA', 'TANTY_CHOCOLAT', 'TANTY_A_GRIGNOTER', 'INGREDIENTS'] },
  { code: 'DATAGE', libelle: 'Datage', effectifReference: 1, productionParHeure: 313.0, productionJournaliere: 2500.0, unite: 'ETIQUETTE', categoriesMetier: ['TANTY_BOUILLIE_DE_SOJA', 'TANTY_CHOCOLAT', 'TANTY_A_GRIGNOTER', 'INGREDIENTS'] },
];

export const DUREES_AFFECTATION = [
  { code: 'DEMI_JOURNEE', libelle: 'Demi-journée' },
  { code: 'JOURNEE_COMPLETE', libelle: 'Journée complète' },
];

export const OPERATIONS_BROYAGE = [
  { code: 'ECRASAGE', libelle: 'Écrasage' },
  { code: 'TRIAGE', libelle: 'Triage' },
  { code: 'TAMISAGE', libelle: 'Tamisage' },
  { code: 'DEPULPAGE', libelle: 'Dépulpage' },
];

export const TYPES_POUDRE = [
  { code: 'MAIS', libelle: 'Maïs' },
  { code: 'SOJA', libelle: 'Soja' },
  { code: 'ARACHIDE', libelle: 'Arachide' },
];

export const TYPES_BESOIN = [
  { code: 'MATIERE_PREMIERE', libelle: 'Matière première' },
  { code: 'EMBALLAGE', libelle: 'Emballage' },
  { code: 'CONSOMMABLE', libelle: 'Consommable' },
];

export const STATUTS_BESOIN = ['EN_ATTENTE', 'VALIDE', 'REJETE'] as const;
export const STATUTS_LOT = ['DECLARE', 'RECEPTIONNE_STOCK', 'VALIDATED_BY_STOCK', 'REJETE'] as const;
export const STATUTS_OF = ['PLANIFIE', 'EN_COURS', 'HONORE', 'ANNULE'] as const;
export const STATUTS_PPH = ['BROUILLON', 'VALIDE', 'EN_COURS', 'CLOTURE'] as const;

// ═══════════════════════════════════════════════════════════════════════
// Modèles — Lots
// ═══════════════════════════════════════════════════════════════════════

export interface LotBE {
  id: number; numeroLot: string; referencePPH: string; codeProduit: string; designationProduit: string;
  quantiteKg: number; nbCartons: number; dateProduction: string; dlc: string;
  matriculeChefProduction: string; statut: string;
  matriculeGestionnaireValidation?: string | null; motifRejet?: string | null;
}

// ═══════════════════════════════════════════════════════════════════════
// Modèles — Ordres de fabrication
// ═══════════════════════════════════════════════════════════════════════

export interface OFBE {
  id: number; idOF: string; referencePPH: string; codeProduit: string; designationProduit: string;
  qteDemandee: number; qteRealisee: number; dateButoir: string | null; statut: string;
}

// ═══════════════════════════════════════════════════════════════════════
// Modèles — PPH
// ═══════════════════════════════════════════════════════════════════════

export interface PPHBE {
  id: number; referencePPH: string; referenceBC: string | null; statut: string;
  dateDebut: string; dateFin: string; dateSoumission: string | null;
  semaine: string;
  matriculeChefProduction: string;
  lignes: PPHLigneBE[];
  lignesDetaillees: PPHLigneDetailBE[];
  repartitionJours: PPHRepartitionJourBE[];
}

export interface PPHLigneBE {
  codeProduit: string; nomProduit: string; categorieMetier: string;
  objectifSemaine: number; productionRealisee: number;
  quantiteAttendueKg: number; quantiteAttendueUnites: number;
}

export interface PPHLigneDetailBE {
  codeProduit: string; nomProduit: string; categorieMetier: string;
  quantiteCartons: number; nombreUnites: number; poidsUnitaireGrammes: number;
  recette: string | null; dateJour: string; quantiteJour: number;
  poudreMaisKg: number; poudreSojaKg: number; poudreArachideKg: number;
  poudreTotaleKg: number;
  futsPrevus: number;
  poudreMaisParFutKg: number; poudreSojaParFutKg: number; poudreArachideParFutKg: number;
  sachetsPrevus: number; couverclesPrevus: number; scellesPrevus: number;
  poidsTotalGrammes: number;
  quantiteAttendueKg: number; quantiteAttendueUnites: number;
}

export interface PPHRepartitionJourBE {
  dateJour: string;
  poudreMaisKg: number; poudreSojaKg: number; poudreArachideKg: number;
  poudreTotaleKg: number;
  futsPrevus: number;
  poudreMaisParFutKg: number; poudreSojaParFutKg: number; poudreArachideParFutKg: number;
  sachetsPrevus: number; couverclesPrevus: number; scellesPrevus: number;
}

// ═══════════════════════════════════════════════════════════════════════
// Modèles — Broyage
// ═══════════════════════════════════════════════════════════════════════

export interface SessionBroyageBE {
  id: number; referencePPH: string; date: string;
  typePoudre: string; typePoudreLibelle: string;
  objectifJournalierKg: number; matriculeChefMachiniste: string; statut: string;
  objectifsMachinistes: ObjectifMachinisteBE[];
  realisations: RealisationMachinisteBE[];
  quantiteNetteBroyeeKg: number | null; pertesKg: number | null;
  pctPertes: number | null; totalRealiseKg: number;
  depassementAutoriseKg: number; journeeValidee: boolean;
  justificatifNonValidation: string | null;
  dateCreation: string; dateModification: string;
}

export interface ObjectifMachinisteBE {
  machinisteMatricule: string; nomMachiniste: string;
  operation: string; operationLibelle: string; objectifKg: number;
}

export interface RealisationMachinisteBE {
  machinisteMatricule: string; nomMachiniste: string;
  operation: string; operationLibelle: string;
  objectifKg: number; realiseKg: number; pctRealisation: number;
}

export interface EmployeBE {
  id: number; matricule: string; nom: string; prenom: string; nomComplet: string;
  role: string; zoneTravail: string; superviseurMatricule: string | null;
  avecCompte: boolean; actif: boolean; dateEmbauche: string | null;
  dateCreation: string; dateModification: string;
}

export interface ClassementMachinisteBE {
  classements: {
    rang: number; machinisteMatricule: string; nomMachiniste: string;
    productiviteKg: number; objectifTotalKg: number;
    tauxRealisationMoyen: number; efficacite: number; nbJours: number;
    operations: string[];
  }[];
  periode: string;
}

// ═══════════════════════════════════════════════════════════════════════
// Modèles — Dosage
// ═══════════════════════════════════════════════════════════════════════

export interface SessionDosageBE {
  id: number; referencePPH: string; date: string;
  matriculeAgentDoseur: string;
  matieresUtilisees: { typeMatiere: string; quantiteKg: number }[];
  machinesMobilisees: string[];
  nbFutsProduits: number; nbFutsNets: number; nbFutsCasses: number;
  justificationEcart: string | null;
  validee: boolean; cloturee: boolean; enPause: boolean;
  dateCreation: string; dateModification: string;
}

export interface StatistiquesFutsBE {
  debut: string; fin: string; periodeLibelle: string;
  nbFutsProduits: number; nbFutsNets: number;
  poudreMaisKg: number; poudreSojaKg: number; poudreArachideKg: number;
  comparaison: {
    debutPeriodePrecedente: string; finPeriodePrecedente: string;
    nbFutsNetsPeriodePrecedente: number; variationPourcentage: number;
  };
  nbSessions: number;
}

export interface PredictionProduitFiniBE {
  nbFutsNets: number; poidsTotalPoudreKg: number;
  predictions: {
    codeProduit: string; designation: string; recette: string;
    quantiteUnitesBase: number; quantiteCartons: number;
    poidsUnitaireGrammes: number; nombreUnitesParCarton: number;
  }[];
}

// ═══════════════════════════════════════════════════════════════════════
// Modèles — Fiches
// ═══════════════════════════════════════════════════════════════════════

export interface FicheProductionBE {
  id: number; referencePPH: string; semaine: string; date: string;
  matriculeAgentProduction: string; justificationEcart: string | null;
  verrouillee: boolean;
  nbFutsProduits: number;
  predictionDosage: Record<string, number>;
  predictionPostes: Record<string, number>;
  lignes: {
    codeProduit: string; nomProduit: string; quantiteProduite: number;
    quantitePrediteDosage: number | null; quantitePreditePostes: number | null; ecart: number | null;
    tauxAvancement: number | null;
  }[];
}

// ═══════════════════════════════════════════════════════════════════════
// Modèles — Affectations
// ═══════════════════════════════════════════════════════════════════════

export interface AffectationBE {
  id: number; referencePPH: string; date: string;
  matriculeAgent: string; statut: string;
  lignes: {
    codePoste: string; libellePoste: string;
    effectifReference: number; effectifReel: number;
    duree: string; objectifAjuste: number; unite: string;
    matriculesEmployes: string[];
  }[];
  saisies: {
    codePoste: string; libellePoste: string;
    quantiteRealisee: number; objectifAjuste: number; pctRealisation: number; unite: string;
    productionsIndividuelles: { matriculeEmploye: string; nomEmploye: string; quantiteRealisee: number; unite: string }[];
    details: {
      nbRegimesEpluches: number | null; nbRegimesDecoupes: number | null;
      nbSceauxEtiquetes: number | null; nbEtiquettesDatees: number | null;
      nbSachetsDates: number | null; nbCartonsProduits: number | null;
      kgChipsProduits: number | null;
    } | null;
    warnings: string[];
    dateEnregistrement: string;
  }[];
  classement: {
    rang: number; codePoste: string; libellePoste: string;
    quantiteRealisee: number; objectifAjuste: number; pctRealisation: number; unite: string;
  }[];
  dateCreation: string; dateModification: string;
}

export interface AgentProductionBE {
  matricule: string;
  nomComplet: string;
  prenom: string;
  nom: string;
  actif: boolean;
}

export interface ClassementExecuteurBE {
  rang: number; matriculeEmploye: string; nomEmploye: string;
  quantiteTotaleRealisee: number; unite: string;
  tauxRealisationMoyen: number; nbJoursAffectes: number;
}

export interface ComparaisonFutsProductionBE {
  referencePPH: string; date: string;
  nbFutsNets: number; poidsTotalPoudreKg: number;
  productionReelleKg: number; ecartKg: number; ecartPourcentage: number;
  uniteProduction: string;
}

/** Réponse de GET /affectations/rapport-hebdomadaire (forme propre au module Affectation). */
export interface RapportHebdoAffectationBE {
  debut: string; fin: string; periodeLibelle: string;
  nbFutsNets: number; poidsTotalPoudreKg: number; productionTotaleKg: number;
  nbSessionsDosage: number; nbJoursAffectes: number;
  classementExecuteurs: ClassementExecuteurBE[];
  comparaisonsJournalieres: ComparaisonFutsProductionBE[];
}

// ═══════════════════════════════════════════════════════════════════════
// Modèles — Registres
// ═══════════════════════════════════════════════════════════════════════

export interface LigneRegistreBE {
  matriculeEmploye: string; nomEmploye: string; poste: string;
  present: boolean; motifAbsence: string | null;
  heureArrivee: string | null; qteRealisee: number; unite: string | null;
}

export interface RegistreProductionBE {
  id: number; referencePPH: string; date: string;
  matriculeChefProduction: string;
  lignes: LigneRegistreBE[];
  nbPresents: number; nbAbsents: number;
  dateCreation: string; dateModification: string;
}

// ═══════════════════════════════════════════════════════════════════════
// Modèles — Dashboards
// ═══════════════════════════════════════════════════════════════════════

export interface DashboardChefBE {
  quantiteKgSemaine: number; cartonsSemaine: number; lotsEnAttenteValidation: number;
  ofsEnCours: number; ofsPlanifies: number; ofsHonores: number;
  tauxAvancementPPH: number; fichesSemaine: number;
  pphEnCoursReference: string | null; pphEnCoursSemaine: string | null;
  debutSemaine: string; finSemaine: string;
}

export interface DashboardAgentBE {
  date: string; ofsEnCours: number; ofsPlanifies: number;
  fichesSemaine: number; ficheJourExistante: boolean;
  ofs: { idOF: string; codeProduit: string; designationProduit: string; qteDemandee: number; qteRealisee: number; tauxAvancement: number }[];
}

// ═══════════════════════════════════════════════════════════════════════
// Modèles — Rapports (module /production/rapports, generation automatique)
// ═══════════════════════════════════════════════════════════════════════

export interface RapportHebdomadaireProductionBE {
  debutSemaine: string; finSemaine: string;
  quantitesParReference: Record<string, number>;
  tauxAvancementParBC: Record<string, number>;
  pertesParTypePoudre: Record<string, number>;
  quantiteBroyeeParTypePoudre: Record<string, number>;
  totalFutsProduits: number; totalFutsNets: number;
  totalLotsValides: number; totalQuantiteLots: number;
  nbFiches: number; nbSessionsBroyage: number; nbSessionsDosage: number;
  tauxPertesGlobal: number;
  pctPertesParTypePoudre: Record<string, number>;
}

export interface LigneComparatifBCBE {
  codeProduit: string; designation: string;
  quantitePlanifiee: number; quantiteProduite: number;
  quantiteLotsValidesKg: number; nbCartonsValides: number;
}

export interface RapportComparatifBCBE {
  referenceBC: string;
  lignes: LigneComparatifBCBE[];
  totalQuantitePlanifiee: number;
  totalQuantiteProduite: number;
  totalCartonsValides: number;
  totalKgValides: number;
}

// ═══════════════════════════════════════════════════════════════════════
// Modèles — Expressions de besoin
// ═══════════════════════════════════════════════════════════════════════

export interface ExpressionBesoinBE {
  id: number; numero: string; referencePPH: string | null; type: string;
  codeProduit: string; designationProduit: string;
  quantiteDemandee: number; unite: string;
  matriculeDemandeur: string; dateBesoin: string | null; motif: string | null;
  statut: string; matriculeValidateur: string | null; motifRejet: string | null;
  dateCreation: string; dateModification: string;
}

@Injectable({ providedIn: 'root' })
export class ProductionService {
  private readonly api = inject(ApiService);

  // ── Lots ───────────────────────────────────────────────────

  getLots(statut?: string): Observable<LotBE[]> {
    const params: Record<string, string> = {};
    if (statut) params['statut'] = statut;
    return this.api.get<ApiResponse<LotBE[]>>('production/lots', params)
      .pipe(map(r => r.donnees ?? []));
  }

  declarerLot(req: {
    referencePPH: string; codeProduit: string; designationProduit: string;
    quantiteKg: number; nbCartons: number; dateProduction?: string; dlc: string;
  }): Observable<LotBE> {
    return this.api.post<ApiResponse<LotBE>>('production/lots', req)
      .pipe(map(r => r.donnees!));
  }

  getLotsAValider(): Observable<LotBE[]> {
    return this.api.get<ApiResponse<LotBE[]>>('production/lots/a-valider')
      .pipe(map(r => r.donnees ?? []));
  }

  validerLot(numeroLot: string): Observable<LotBE> {
    return this.api.patch<ApiResponse<LotBE>>(
      `production/lots/${encodeURIComponent(numeroLot)}/valider`, {}
    ).pipe(map(r => r.donnees!));
  }

  rejeterLot(numeroLot: string, motif: string): Observable<LotBE> {
    return this.api.patch<ApiResponse<LotBE>>(
      `production/lots/${encodeURIComponent(numeroLot)}/rejeter?motif=${encodeURIComponent(motif)}`, {}
    ).pipe(map(r => r.donnees!));
  }

  // ── Ordres de fabrication ──────────────────────────────────

  getOFs(statut?: string, pph?: string): Observable<OFBE[]> {
    const params: Record<string, string> = {};
    if (statut) params['statut'] = statut;
    if (pph) params['pph'] = pph;
    return this.api.get<ApiResponse<OFBE[]>>('production/ordres-fabrication', params)
      .pipe(map(r => r.donnees ?? []));
  }

  getOF(idOF: string): Observable<OFBE> {
    return this.api.get<ApiResponse<OFBE>>(`production/ordres-fabrication/${encodeURIComponent(idOF)}`)
      .pipe(map(r => r.donnees!));
  }

  creerOF(req: {
    idOF: string; referencePPH: string; codeProduit: string; designationProduit: string;
    qteDemandee: number; dateButoir?: string;
  }): Observable<OFBE> {
    return this.api.post<ApiResponse<OFBE>>('production/ordres-fabrication', req)
      .pipe(map(r => r.donnees!));
  }

  demarrerOF(idOF: string): Observable<OFBE> {
    return this.api.patch<ApiResponse<OFBE>>(`production/ordres-fabrication/${encodeURIComponent(idOF)}/demarrer`, {})
      .pipe(map(r => r.donnees!));
  }

  produireOF(idOF: string, quantite: number): Observable<OFBE> {
    return this.api.patch<ApiResponse<OFBE>>(
      `production/ordres-fabrication/${encodeURIComponent(idOF)}/produire?quantite=${quantite}`, {}
    ).pipe(map(r => r.donnees!));
  }

  annulerOF(idOF: string): Observable<OFBE> {
    return this.api.patch<ApiResponse<OFBE>>(`production/ordres-fabrication/${encodeURIComponent(idOF)}/annuler`, {})
      .pipe(map(r => r.donnees!));
  }

  // ── PPH ────────────────────────────────────────────────────

  getPPHs(statut?: string): Observable<PPHBE[]> {
    const params: Record<string, string> = {};
    if (statut) params['statut'] = statut;
    return this.api.get<ApiResponse<PPHBE[]>>('production/pph', params)
      .pipe(map(r => r.donnees ?? []));
  }

  getPPHEnCours(): Observable<PPHBE> {
    return this.api.get<ApiResponse<PPHBE>>('production/pph/en-cours')
      .pipe(map(r => r.donnees!));
  }

  getPPH(reference: string): Observable<PPHBE> {
    return this.api.get<ApiResponse<PPHBE>>(`production/pph/${encodeURIComponent(reference)}`)
      .pipe(map(r => r.donnees!));
  }

  creerPPH(req: {
    referencePPH: string; referenceBC?: string; semaine: string;
    dateDebut: string; dateFin: string;
    lignes: { codeProduit: string; nomProduit: string; objectifSemaine: number }[];
  }): Observable<PPHBE> {
    return this.api.post<ApiResponse<PPHBE>>('production/pph', req)
      .pipe(map(r => r.donnees!));
  }

  validerPPH(reference: string): Observable<PPHBE> {
    return this.api.patch<ApiResponse<PPHBE>>(
      `production/pph/${encodeURIComponent(reference)}/valider`, {}
    ).pipe(map(r => r.donnees!));
  }

  demarrerPPH(reference: string): Observable<PPHBE> {
    return this.api.patch<ApiResponse<PPHBE>>(
      `production/pph/${encodeURIComponent(reference)}/demarrer`, {}
    ).pipe(map(r => r.donnees!));
  }

  cloturerPPH(reference: string): Observable<PPHBE> {
    return this.api.patch<ApiResponse<PPHBE>>(
      `production/pph/${encodeURIComponent(reference)}/cloturer`, {}
    ).pipe(map(r => r.donnees!));
  }

  modifierLignesPPH(reference: string, lignes: { codeProduit: string; objectifSemaine: number }[]): Observable<PPHBE> {
    return this.api.put<ApiResponse<PPHBE>>(
      `production/pph/${encodeURIComponent(reference)}/lignes`, { lignes }
    ).pipe(map(r => r.donnees!));
  }

  ajusterRepartitionPPH(reference: string, repartition: {
    dateJour: string;
    poudreMaisKg: number;
    poudreSojaKg: number;
    poudreArachideKg: number;
    futsPrevus: number;
    sachetsPrevus: number;
    couverclesPrevus: number;
    scellesPrevus: number;
  }[]): Observable<PPHBE> {
    return this.api.put<ApiResponse<PPHBE>>(
      `production/pph/${encodeURIComponent(reference)}/repartition`, { repartition }
    ).pipe(map(r => r.donnees!));
  }

  getPPHParBC(referenceBC: string): Observable<PPHBE[]> {
    return this.api.get<ApiResponse<PPHBE[]>>(`production/pph/bc/${encodeURIComponent(referenceBC)}`)
      .pipe(map(r => r.donnees ?? []));
  }

  // ── Broyage ────────────────────────────────────────────────

  getSessionsBroyage(params: {
    referencePPH?: string; debut?: string; fin?: string;
  } = {}): Observable<SessionBroyageBE[]> {
    const p: Record<string, string> = {};
    if (params.referencePPH) p['referencePPH'] = params.referencePPH;
    if (params.debut) p['debut'] = params.debut;
    if (params.fin) p['fin'] = params.fin;
    return this.api.get<ApiResponse<SessionBroyageBE[]>>('production/broyage/sessions', p)
      .pipe(map(r => r.donnees ?? []));
  }

  getSessionBroyage(id: number): Observable<SessionBroyageBE> {
    return this.api.get<ApiResponse<SessionBroyageBE>>(`production/broyage/sessions/${id}`)
      .pipe(map(r => r.donnees!));
  }

  ouvrirSessionBroyage(req: {
    referencePPH: string; date: string; typePoudre: string;
    objectifJournalierKg: number;
    objectifsMachinistes: { machinisteMatricule: string; nomMachiniste: string; operation: string; objectifKg: number }[];
  }): Observable<SessionBroyageBE> {
    return this.api.post<ApiResponse<SessionBroyageBE>>('production/broyage/sessions', req)
      .pipe(map(r => r.donnees!));
  }

  enregistrerRealisationBroyage(req: {
    sessionId: number; machinisteMatricule: string; nomMachiniste: string;
    operation: string; typePoudre: string; objectifKg: number; realiseKg: number;
  }): Observable<SessionBroyageBE> {
    return this.api.post<ApiResponse<SessionBroyageBE>>('production/broyage/sessions/realisations', req)
      .pipe(map(r => r.donnees!));
  }

  cloturerSessionBroyage(req: {
    sessionId: number; quantiteNetteBroyeeKg: number; pertesKg: number;
  }): Observable<SessionBroyageBE> {
    return this.api.post<ApiResponse<SessionBroyageBE>>('production/broyage/sessions/cloturer', req)
      .pipe(map(r => r.donnees!));
  }

  autoriserDepassementBroyage(sessionId: number, quantiteSupplementaireKg: number): Observable<SessionBroyageBE> {
    return this.api.post<ApiResponse<SessionBroyageBE>>(
      'production/broyage/sessions/autoriser-depassement',
      { sessionId, quantiteSupplementaireKg }
    ).pipe(map(r => r.donnees!));
  }

  justifierNonValidationBroyage(sessionId: number, justificatif: string): Observable<SessionBroyageBE> {
    return this.api.post<ApiResponse<SessionBroyageBE>>(
      'production/broyage/sessions/justifier',
      { sessionId, justificatif }
    ).pipe(map(r => r.donnees!));
  }

  getPerformancesMachiniste(machinisteMatricule: string, debut: string, fin: string): Observable<SessionBroyageBE[]> {
    return this.api.get<ApiResponse<SessionBroyageBE[]>>(
      'production/broyage/performances', { machinisteMatricule, debut, fin }
    ).pipe(map(r => r.donnees ?? []));
  }

  getClassementMachinistes(debut: string, fin: string): Observable<ClassementMachinisteBE> {
    return this.api.get<ApiResponse<ClassementMachinisteBE>>('production/broyage/classement', { debut, fin })
      .pipe(map(r => r.donnees!));
  }

  getMachinistes(): Observable<EmployeBE[]> {
    return this.api.get<ApiResponse<EmployeBE[]>>('production/chef-machiniste/machinistes')
      .pipe(map(r => r.donnees ?? []));
  }


// getMachinistesDepuisEmployes(): Observable<EmployeBE[]> {
//  return this.api.get<ApiResponse<EmployeBE[]>>('dg/employes').pipe(
//    map(r => (r.donnees ?? []).filter(e =>
//      (e.role ?? '').toUpperCase().includes('MACHINISTE') && e.actif)),
//  );
//}

  creerEmploye(req: {
    prenom: string; nom: string; role: string; zoneTravail: string;
    superviseurMatricule?: string; dateEmbauche?: string;
    email?: string; motDePasse?: string;
  }): Observable<EmployeBE> {
    return this.api.post<ApiResponse<EmployeBE>>('dg/employes', req)
      .pipe(map(r => r.donnees!));
  }

  // ── Dosage ─────────────────────────────────────────────────

  ouvrirSessionDosage(req: {
    referencePPH: string; date: string; matriculeAgentDoseur: string;
  }): Observable<SessionDosageBE> {
    return this.api.post<ApiResponse<SessionDosageBE>>('production/dosage', req)
      .pipe(map(r => r.donnees!));
  }

  enregistrerMatiereDosage(id: number, typeMatiere: string, quantiteKg: number): Observable<SessionDosageBE> {
    return this.api.post<ApiResponse<SessionDosageBE>>(
      `production/dosage/${id}/matiere?typeMatiere=${encodeURIComponent(typeMatiere)}&quantiteKg=${quantiteKg}`, {}
    ).pipe(map(r => r.donnees!));
  }

  mettreAJourDosageAutomatique(id: number, nbFuts: number, typeMelange: string): Observable<SessionDosageBE> {
    return this.api.post<ApiResponse<SessionDosageBE>>(
      `production/dosage/${id}/dosage-auto?nbFuts=${nbFuts}&typeMelange=${encodeURIComponent(typeMelange)}`, {}
    ).pipe(map(r => r.donnees!));
  }

  enregistrerMachineDosage(id: number, machineId: string): Observable<SessionDosageBE> {
    return this.api.post<ApiResponse<SessionDosageBE>>(
      `production/dosage/${id}/machine?machineId=${encodeURIComponent(machineId)}`, {}
    ).pipe(map(r => r.donnees!));
  }

  enregistrerFutsDosage(id: number, nbProduits: number): Observable<SessionDosageBE> {
    return this.api.post<ApiResponse<SessionDosageBE>>(
      `production/dosage/${id}/futs?nbProduits=${nbProduits}`, {}
    ).pipe(map(r => r.donnees!));
  }

  justifierEcartDosage(id: number, justification: string): Observable<SessionDosageBE> {
    return this.api.post<ApiResponse<SessionDosageBE>>(
      `production/dosage/${id}/justifier?justification=${encodeURIComponent(justification)}`, {}
    ).pipe(map(r => r.donnees!));
  }

  validerSessionDosage(id: number): Observable<SessionDosageBE> {
    return this.api.patch<ApiResponse<SessionDosageBE>>(
      `production/dosage/${id}/valider`, {}
    ).pipe(map(r => r.donnees!));
  }

  cloturerSessionDosage(id: number): Observable<SessionDosageBE> {
    return this.api.post<ApiResponse<SessionDosageBE>>(
      `production/dosage/${id}/cloturer`, {}
    ).pipe(map(r => r.donnees!));
  }

  mettreEnPauseSessionDosage(id: number): Observable<SessionDosageBE> {
    return this.api.post<ApiResponse<SessionDosageBE>>(
      `production/dosage/${id}/pause`, {}
    ).pipe(map(r => r.donnees!));
  }

  reprendreSessionDosage(id: number): Observable<SessionDosageBE> {
    return this.api.post<ApiResponse<SessionDosageBE>>(
      `production/dosage/${id}/reprendre`, {}
    ).pipe(map(r => r.donnees!));
  }

  getSessionDosage(id: number): Observable<SessionDosageBE> {
    return this.api.get<ApiResponse<SessionDosageBE>>(`production/dosage/${id}`)
      .pipe(map(r => r.donnees!));
  }

  getStatistiquesFuts(debut: string, fin: string): Observable<StatistiquesFutsBE> {
    return this.api.get<ApiResponse<StatistiquesFutsBE>>('production/dosage/statistiques/futs', { debut, fin })
      .pipe(map(r => r.donnees!));
  }

  predireProduitFini(sessionId: number): Observable<PredictionProduitFiniBE> {
    return this.api.get<ApiResponse<PredictionProduitFiniBE>>('production/dosage/prediction', { sessionId: String(sessionId) })
      .pipe(map(r => r.donnees!));
  }

  telechargerRegistreDosage(id: number, format: 'pdf' | 'excel' = 'pdf'): Observable<Blob> {
    return this.api.getBlob(`production/dosage/${id}/registre?format=${format}`);
  }

  telechargerDocumentsDosage(id: number): Observable<Blob> {
    return this.api.getBlob(`production/dosage/${id}/documents`);
  }

  getSessionsDosageParPPH(reference: string): Observable<SessionDosageBE[]> {
    return this.api.get<ApiResponse<SessionDosageBE[]>>(`production/dosage/pph/${encodeURIComponent(reference)}`)
      .pipe(map(r => r.donnees ?? []));
  }

  getSessionsDosageParDate(date: string): Observable<SessionDosageBE[]> {
    return this.api.get<ApiResponse<SessionDosageBE[]>>(`production/dosage/date/${date}`)
      .pipe(map(r => r.donnees ?? []));
  }

  getSessionsDosageParPeriode(debut: string, fin: string): Observable<SessionDosageBE[]> {
    return this.api.get<ApiResponse<SessionDosageBE[]>>('production/dosage/periode', { debut, fin })
      .pipe(map(r => r.donnees ?? []));
  }

  // ── Fiches de production ───────────────────────────────────

  getFichesParPPH(referencePPH: string): Observable<FicheProductionBE[]> {
    return this.api.get<ApiResponse<FicheProductionBE[]>>(`production/fiches/pph/${encodeURIComponent(referencePPH)}`)
      .pipe(map(r => r.donnees ?? []));
  }

  getFiche(referencePPH: string, date: string): Observable<FicheProductionBE> {
    return this.api.get<ApiResponse<FicheProductionBE>>(
      `production/fiches/pph/${encodeURIComponent(referencePPH)}/date/${date}`
    ).pipe(map(r => r.donnees!));
  }

  enregistrerFiche(req: {
    referencePPH: string; semaine: string; date: string; matriculeAgentProduction: string;
    lignes: { codeProduit: string; nomProduit: string; quantiteProduite: number }[];
    predictionDosage?: Record<string, number>; predictionPostes?: Record<string, number>;
  }): Observable<FicheProductionBE> {
    return this.api.post<ApiResponse<FicheProductionBE>>('production/fiches', req)
      .pipe(map(r => r.donnees!));
  }

  modifierFiche(referencePPH: string, date: string, req: {
    lignes: { codeProduit: string; nomProduit: string; quantiteProduite: number }[];
  }): Observable<FicheProductionBE> {
    return this.api.patch<ApiResponse<FicheProductionBE>>(
      `production/fiches/pph/${encodeURIComponent(referencePPH)}/date/${date}`, req
    ).pipe(map(r => r.donnees!));
  }

  // ── Affectations ───────────────────────────────────────────

  getAgentsProduction(): Observable<AgentProductionBE[]> {
    return this.api.get<ApiResponse<AgentProductionBE[]>>('production/affectations/agents-production')
      .pipe(map(r => r.donnees ?? []));
  }

  getAffectations(params: {
    referencePPH?: string; debut?: string; fin?: string;
  } = {}): Observable<AffectationBE[]> {
    const p: Record<string, string> = {};
    if (params.referencePPH) p['referencePPH'] = params.referencePPH;
    if (params.debut) p['debut'] = params.debut;
    if (params.fin) p['fin'] = params.fin;
    return this.api.get<ApiResponse<AffectationBE[]>>('production/affectations', p)
      .pipe(map(r => r.donnees ?? []));
  }

  getAffectation(id: number): Observable<AffectationBE> {
    return this.api.get<ApiResponse<AffectationBE>>(`production/affectations/${id}`)
      .pipe(map(r => r.donnees!));
  }

  getAffectationDuJour(referencePPH: string): Observable<AffectationBE> {
    return this.api.get<ApiResponse<AffectationBE>>(
      `production/affectations/aujourd-hui?referencePPH=${encodeURIComponent(referencePPH)}`
    ).pipe(map(r => r.donnees!));
  }

  creerAffectation(req: {
    referencePPH: string; date: string;
    lignes: { poste: string; matriculesEmployes: string[]; duree: string }[];
  }): Observable<AffectationBE> {
    return this.api.post<ApiResponse<AffectationBE>>('production/affectations', req)
      .pipe(map(r => r.donnees!));
  }

  saisirRealisationPoste(req: {
    affectationId: number; poste: string; quantiteRealisee: number;
    productionsIndividuelles?: { matriculeEmploye: string; nomEmploye: string; poste: string; quantiteRealisee: number }[];
    details?: {
      nbRegimesEpluches?: number; nbRegimesDecoupes?: number;
      nbSceauxEtiquetes?: number; nbEtiquettesDatees?: number;
      nbSachetsDates?: number; nbCartonsProduits?: number; kgChipsProduits?: number;
    };
  }): Observable<AffectationBE> {
    return this.api.post<ApiResponse<AffectationBE>>('production/affectations/realisations', req)
      .pipe(map(r => r.donnees!));
  }

  validerAffectation(id: number): Observable<AffectationBE> {
    return this.api.patch<ApiResponse<AffectationBE>>(
      `production/affectations/${id}/valider`, {}
    ).pipe(map(r => r.donnees!));
  }

  modifierLignesAffectation(id: number, lignes: {
    poste: string; matriculesEmployes: string[]; duree: string;
  }[]): Observable<AffectationBE> {
    return this.api.patch<ApiResponse<AffectationBE>>(
      `production/affectations/${id}/lignes`, lignes
    ).pipe(map(r => r.donnees!));
  }

  getComparaisonFutsProduction(referencePPH: string, date: string): Observable<ComparaisonFutsProductionBE> {
    return this.api.get<ApiResponse<ComparaisonFutsProductionBE>>(
      `production/affectations/${encodeURIComponent(referencePPH)}/comparaison-futs`, { date }
    ).pipe(map(r => r.donnees!));
  }

  getClassementExecuteurs(debut: string, fin: string): Observable<ClassementExecuteurBE[]> {
    return this.api.get<ApiResponse<ClassementExecuteurBE[]>>(
      'production/affectations/classement-executeurs', { debut, fin }
    ).pipe(map(r => r.donnees ?? []));
  }

  /** Rapport hebdomadaire propre au module Affectation (fûts vs production aval). */
  getRapportHebdomadaireAffectation(debut: string, fin: string): Observable<RapportHebdoAffectationBE> {
    return this.api.get<ApiResponse<RapportHebdoAffectationBE>>(
      'production/affectations/rapport-hebdomadaire', { debut, fin }
    ).pipe(map(r => r.donnees!));
  }

  // ── Registre production (employés) ─────────────────────────

  getRegistres(params: { referencePPH?: string; debut?: string; fin?: string } = {}): Observable<RegistreProductionBE[]> {
    const p: Record<string, string> = {};
    if (params.referencePPH) p['referencePPH'] = params.referencePPH;
    if (params.debut) p['debut'] = params.debut;
    if (params.fin) p['fin'] = params.fin;
    return this.api.get<ApiResponse<RegistreProductionBE[]>>('production/registres', p)
      .pipe(map(r => r.donnees ?? []));
  }

  getRegistre(referencePPH: string, date: string): Observable<RegistreProductionBE> {
    return this.api.get<ApiResponse<RegistreProductionBE>>(
      `production/registres/pph/${encodeURIComponent(referencePPH)}/date/${date}`
    ).pipe(map(r => r.donnees!));
  }

  enregistrerRegistre(req: {
    referencePPH: string; date: string;
    lignes: { matriculeEmploye: string; nomEmploye: string; poste: string; present: boolean; motifAbsence?: string; heureArrivee?: string; qteRealisee?: number; unite?: string }[];
  }): Observable<RegistreProductionBE> {
    return this.api.post<ApiResponse<RegistreProductionBE>>('production/registres', req)
      .pipe(map(r => r.donnees!));
  }

  // ── Dashboards ───────────────────────────────────────────────

  getDashboardChef(): Observable<DashboardChefBE> {
    return this.api.get<ApiResponse<DashboardChefBE>>('production/dashboard/chef')
      .pipe(map(r => r.donnees!));
  }

  getDashboardAgent(): Observable<DashboardAgentBE> {
    return this.api.get<ApiResponse<DashboardAgentBE>>('production/dashboard/agent')
      .pipe(map(r => r.donnees!));
  }

  // ── Rapports ─────────────────────────────────────────────────

  getRapportLots(debut: string, fin: string, format: string = 'xlsx'): Observable<Blob> {
    return this.api.getBlob(`production/rapports/lots?debut=${debut}&fin=${fin}&format=${format}`);
  }

  getRapportHebdomadaireProduction(debut: string, fin: string): Observable<RapportHebdomadaireProductionBE> {
    return this.api.get<ApiResponse<RapportHebdomadaireProductionBE>>(
      'production/rapports/hebdomadaire', { debut, fin }
    ).pipe(map(r => r.donnees!));
  }

  getRapportComparatifBC(referenceBC: string): Observable<RapportComparatifBCBE> {
    return this.api.get<ApiResponse<RapportComparatifBCBE>>(
      'production/rapports/comparatif-bc', { referenceBC }
    ).pipe(map(r => r.donnees!));
  }

  getRapportResponsableSalle(debut: string, fin: string): Observable<RapportHebdomadaireProductionBE> {
    return this.api.get<ApiResponse<RapportHebdomadaireProductionBE>>(
      'production/rapports/responsable-salle', { debut, fin }
    ).pipe(map(r => r.donnees!));
  }

  // ── Expressions de besoin ──────────────────────────────────

  getBesoins(statut?: string): Observable<ExpressionBesoinBE[]> {
    const params: Record<string, string> = {};
    if (statut) params['statut'] = statut;
    return this.api.get<ApiResponse<ExpressionBesoinBE[]>>('production/besoins', params)
      .pipe(map(r => r.donnees ?? []));
  }

  getBesoin(numero: string): Observable<ExpressionBesoinBE> {
    return this.api.get<ApiResponse<ExpressionBesoinBE>>(`production/besoins/${encodeURIComponent(numero)}`)
      .pipe(map(r => r.donnees!));
  }

  signalerBesoin(req: {
    numero: string; referencePPH?: string; type: string; codeProduit: string; designationProduit: string;
    quantiteDemandee: number; unite: string; dateBesoin?: string; motif?: string;
  }): Observable<ExpressionBesoinBE> {
    return this.api.post<ApiResponse<ExpressionBesoinBE>>('production/besoins', req)
      .pipe(map(r => r.donnees!));
  }

  validerBesoin(numero: string): Observable<ExpressionBesoinBE> {
    return this.api.patch<ApiResponse<ExpressionBesoinBE>>(
      `production/besoins/${encodeURIComponent(numero)}/valider`, {}
    ).pipe(map(r => r.donnees!));
  }

  rejeterBesoin(numero: string, motif: string): Observable<ExpressionBesoinBE> {
    return this.api.patch<ApiResponse<ExpressionBesoinBE>>(
      `production/besoins/${encodeURIComponent(numero)}/rejeter?motif=${encodeURIComponent(motif)}`, {}
    ).pipe(map(r => r.donnees!));
  }

  // ── Postes de production (effectifs et objectifs) ──────────────────────────

  getPostesProduction(): Observable<CodePosteRef[]> {
    return this.api.get<ApiResponse<CodePosteRef[]>>('production/postes-production')
      .pipe(map(r => r.donnees ?? []));
  }

  getPostesProductionAdmin(): Observable<CodePosteRef[]> {
    return this.api.get<ApiResponse<CodePosteRef[]>>('administration/postes-production')
      .pipe(map(r => r.donnees ?? []));
  }

  creerPosteProduction(p: CodePosteRef): Observable<CodePosteRef> {
    const params: Record<string, string> = {
      code: p.code, libelle: p.libelle,
      effectifReference: String(p.effectifReference),
      productionParHeure: String(p.productionParHeure),
      productionJournaliere: String(p.productionJournaliere),
      unite: p.unite, ordre: String(p.ordre ?? 0),
      categoriesMetier: (p.categoriesMetier ?? []).join(','),
    };
    return this.api.post<ApiResponse<CodePosteRef>>('administration/postes-production', {}, params)
      .pipe(map(r => r.donnees!));
  }

  modifierPosteProduction(id: number, p: CodePosteRef & { actif: boolean }): Observable<CodePosteRef> {
    const params: Record<string, string> = {
      code: p.code, libelle: p.libelle,
      effectifReference: String(p.effectifReference),
      productionParHeure: String(p.productionParHeure),
      productionJournaliere: String(p.productionJournaliere),
      unite: p.unite, actif: String(p.actif), ordre: String(p.ordre ?? 0),
      categoriesMetier: (p.categoriesMetier ?? []).join(','),
    };
    return this.api.put<ApiResponse<CodePosteRef>>(`administration/postes-production/${id}`, {}, params)
      .pipe(map(r => r.donnees!));
  }

  supprimerPosteProduction(id: number): Observable<unknown> {
    return this.api.delete<ApiResponse<unknown>>(`administration/postes-production/${id}`)
      .pipe(map(r => r.donnees));
  }
}
