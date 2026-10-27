import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
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

/** Lot de produit fini — noms identiques à la réponse backend (LotResponse). */
export interface LotBE {
  id: number; numeroLot: string; referencePPH: string | null;
  productSku: string; productName: string; productUnit: string | null;
  declaredQuantityKg: number; equivalentUnits: number;
  dateProduction: string; dlc: string;
  matriculeChefProduction: string; declaredBy: string | null;
  statut: string;
  matriculeGestionnaireValidation?: string | null; motifRejet?: string | null;
  conditioningType: string | null; conditioningQty: number | null; notes: string | null;
  createdAt: string | null; validatedAt: string | null;
}

/** Corps de la déclaration d'un lot (DeclarerLotRequest). */
export interface DeclarerLotBE {
  referencePPH: string; productSku: string; productName: string; productUnit?: string;
  declaredQuantityKg: number; equivalentUnits: number;
  dateProduction: string; dlc: string;
  conditioningType?: string; conditioningQty?: number; notes?: string; declaredBy?: string;
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

/** Besoin en une matière première (kg) — nom libre, issu de la formule de production du produit. */
export interface BesoinMatiereBE { matierePremiere: string; quantiteKg: number; }

/** Besoin en un composant d'emballage — type issu de la composition du conditionnement (SACHET, COUVERCLE, SEAU...). */
export interface BesoinEmballageBE { type: string; quantite: number; }

export interface PPHLigneDetailBE {
  codeProduit: string; nomProduit: string; categorieMetier: string;
  quantiteCartons: number; nombreUnites: number; poidsUnitaireGrammes: number;
  dateJour: string; quantiteJour: number;
  besoinsMatieresPremiere: BesoinMatiereBE[];
  /** true : le produit n'a pas de formule — aucun besoin en matière calculé (état signalé, pas un zéro). */
  formuleManquante: boolean;
  besoinsEmballage: BesoinEmballageBE[];
  /** true : le conditionnement n'a pas de type/composition d'emballage — aucun besoin calculé. */
  compositionEmballageManquante: boolean;
  totalMatieresPremieresKg: number;
  futsPrevus: number;
  poidsTotalGrammes: number;
  quantiteAttendueKg: number; quantiteAttendueUnites: number;
}

export interface PPHRepartitionJourBE {
  dateJour: string;
  besoinsMatieresPremiere: BesoinMatiereBE[];
  besoinsEmballage: BesoinEmballageBE[];
  totalMatieresPremieresKg: number;
  futsPrevus: number;
}

/** Réponse de POST /production/pph/{reference}/recalculer. */
export interface RecalculerPPHBE {
  pph: PPHBE;
  /** true : une répartition ajustée manuellement a été remplacée par la répartition recalculée. */
  ajustementsManuelsEcrases: boolean;
}

// ═══════════════════════════════════════════════════════════════════════
// Modèles — Formules de production et composition d'emballage
// ═══════════════════════════════════════════════════════════════════════

export interface FormuleLigneBE { matierePremiere: string; proportionKg: number; }
export interface FormuleBE { baseKg: number; lignes: FormuleLigneBE[]; }
export interface ComposantEmballageBE { type: string; quantiteComposant: number; quantiteUnitesProduites: number; }
export interface ConditionnementProductionBE {
  id: string; sku: string; libelle: string; niveau: string; poidsUnitaireGrammes: number;
  type: string | null; composants: ComposantEmballageBE[];
}
export interface ReferentielProductionBE {
  codeProduit: string; designation: string; categorieMetier: string; actif: boolean;
  formule: FormuleBE | null;
  conditionnements: ConditionnementProductionBE[];
}

/** Miroir de l'enum backend TypeEmballage. */
export const TYPES_EMBALLAGE = [
  { code: 'SACHET', libelle: 'Sachet' },
  { code: 'COUVERCLE', libelle: 'Couvercle' },
  { code: 'SCELLE', libelle: 'Scellé' },
  { code: 'CARTON', libelle: 'Carton' },
  { code: 'SEAU', libelle: 'Seau' },
  { code: 'GAINE', libelle: 'Gaine' },
  { code: 'ETUI', libelle: 'Étui' },
];

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

/** Synthèse de l'atelier de broyage sur une journée ou une période (ApercuBroyageResponse côté backend). */
export interface SyntheseBroyageBE {
  nbSessions: number; nbClotures: number; nbValidees: number;
  objectif: number; realise: number; taux: number | null;
  nette: number; pertes: number; pctPertes: number | null; machinistes: number;
}

/** Vue d'ensemble du broyage : synthèse du jour, de la période, répartition par poudre et série journalière. */
export interface ApercuBroyageBE {
  debut: string; fin: string;
  duJour: SyntheseBroyageBE;
  periode: SyntheseBroyageBE;
  poudres: { code: string; objectif: number; realise: number; pertes: number; part: number | null }[];
  jours: {
    date: string; nbSessions: number; nbValidees: number; objectif: number; realise: number;
    nette: number; pertes: number; taux: number | null; pctPertes: number | null;
  }[];
  planEnCours: string | null;
  plansValides: number;
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
  matieresPremieres: { matierePremiere: string; quantiteKg: number }[];
  /** Sessions sans matière saisie dont la formule n'a pas pu être identifiée sans ambiguïté (exclues de l'estimation). */
  nbSessionsNonEstimees: number;
  comparaison: {
    debutPeriodePrecedente: string; finPeriodePrecedente: string;
    nbFutsNetsPeriodePrecedente: number; variationPourcentage: number;
  };
  nbSessions: number;
}

/** Poudre prévue et écrasée d'un plan PPH, par matière (AvancementBroyageResponse côté backend). */
export interface AvancementBroyageBE {
  referencePPH: string;
  nbSessions: number; nbSessionsCloturees: number;
  matieres: {
    code: string; suivie: boolean; prevuKg: number; ecraseKg: number; enCoursKg: number;
    restantKg: number; ecartKg: number; pourcent: number;
  }[];
}

/** Fûts dosés d'un plan PPH (AvancementDosageResponse côté backend). */
export interface AvancementDosageBE {
  referencePPH: string;
  nbSessions: number; nbSessionsValidees: number;
  futsValides: number; futsEnCours: number; futsDoses: number;
  parJour: { date: string; futsValides: number; futsEnCours: number }[];
}

/** Prédiction enregistrée d'un plan PPH (PredictionPPHResponse côté backend). */
export interface PredictionPPHBE {
  referencePPH: string;
  nbFuts: number;
  poudreKg: number;
  dateCalcul: string;
  matricule: string;
  predictions: PredictionPPHLigneBE[];
  exclusions: { codeProduit: string; motif: string }[];
}

export interface PredictionPPHLigneBE {
  codeProduit: string; designation: string; composition: string;
  poudreAlloueeKg: number; quantiteUnitesBase: number; quantiteCartons: number;
  poidsUnitaireGrammes: number; unitesParCarton: number;
}

export interface PredictionProduitFiniBE {
  nbFutsNets: number; poidsTotalPoudreKg: number;
  predictions: {
    codeProduit: string; designation: string; composition: string | null;
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
    productionsIndividuelles: {
      matriculeEmploye: string; nomEmploye: string; quantiteRealisee: number; unite: string;
      objectifIndividuel: number; pctRealisation: number;
    }[];
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

/** Classement d'un exécutant : le taux est individuel (sans unité) ; les quantités ne sont jamais additionnées entre unités. */
export interface ClassementExecuteurBE {
  rang: number; matriculeEmploye: string; nomEmploye: string;
  quantiteTotaleRealisee: number; unite: string;
  tauxRealisationMoyen: number; nbJoursAffectes: number;
  quantitesParUnite?: { unite: string; quantite: number }[];
}

export interface ComparaisonFutsProductionBE {
  referencePPH: string; date: string;
  nbFutsNets: number; poidsTotalPoudreKg: number;
  productionReelleKg: number; ecartKg: number; ecartPourcentage: number;
  uniteProduction: string;
}

/** Performance d'un poste sur une période (GET /performances-postes). Quantités dans l'unité du poste. */
export interface PerformancePosteBE {
  codePoste: string; libelle: string; unite: string;
  joursAffectes: number; joursSaisis: number;
  objectifTotal: number; realiseTotal: number; tauxRealisation: number;
  effectifMoyen: number; rendementParPersonne: number; rang: number | null;
}

/** Réponse de GET /comparaisons/{referencePPH}?date= : plan du BC contre dosage et production de la journée. */
export interface ComparaisonBCBE {
  /** referenceBC est null quand le plan n'est rattaché à aucun bon de commande. */
  referencePPH: string; referenceBC: string | null; date: string; nbSessionsDosage: number;
  futs: { futsNetsDoses: number; futsPrevus: number; ecart: number; ecartPct: number };
  matieres: {
    /** matiere : libellé normalisé (ex. SOJA) ; codeMP : code catalogue de rapprochement plan / dosage. */
    matiere: string; codeMP: string; theoriqueKg: number; doseeKg: number; ecartKg: number; ecartPct: number;
    theoriqueParCategorie: { categorie: string; theoriqueKg: number }[];
  }[];
  produits: {
    codeProduit: string; nomProduit: string; categorie: string;
    cartonsPrevus: number; unitesPrevues: number; poidsPrevuKg: number; matieresPrevuesKg: number;
  }[];
  postesRealises: {
    codePoste: string; libelle: string; categories: string[];
    quantiteRealisee: number; objectifAjuste: number; unite: string;
  }[];
  /** Bouillie produite, convertie en kg via le poids du conditionnement (#107) ; non convertible si ambigu. */
  productionBouillie: { quantiteKg: number; convertible: boolean; motifNonConvertible: string | null };
}

/** Réponse de GET /affectations/rapport-hebdomadaire (forme propre au module Affectation). */
export interface RapportHebdoAffectationBE {
  debut: string; fin: string; periodeLibelle: string;
  /** Non fournis par RapportHebdomadaireProductionResponse : absents de l'API actuelle. */
  nbFutsProduits?: number; nbFutsNets: number; nbFutsCasses?: number;
  poidsTotalPoudreKg: number; productionTotaleKg: number;
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

/** Tableau de bord du responsable de salle (DashboardResponsableSalleResponse côté backend). */
export interface DashboardResponsableSalleBE {
  date: string;
  planEnCours: {
    reference: string; semaine: string; dateDebut: string; dateFin: string;
    nbProduits: number; objectif: number; realise: number; avancementPct: number | null;
  } | null;
  plansValides: number;
  affectation: {
    existe: boolean; statut: string | null; postes: number; employesAffectes: number;
    saisies: number; objectifsAtteints: number; ecarts: number; quantiteRealisee: number;
  };
  registreSaisi: boolean;
  besoins: { enAttente: number; valides: number; rejetes: number };
  lots: { enAttenteStock: number; valides: number; rejetes: number };
  ofs: { enCours: number; planifies: number; honores: number };
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

/**
 * Fonctions de l'écran sans endpoint dans l'API actuelle : on n'émet aucune requête (pas de 404) et on
 * renvoie une erreur au format de l'API, affichée telle quelle par les écrans (extractApiError lit « erreur »).
 */
function indisponible<T>(fonction: string): Observable<T> {
  return throwError(() => ({
    status: 501,
    error: { succes: false, message: 'Fonction indisponible', erreur: `${fonction} n'est pas disponible avec la version actuelle de l'API.` },
  }));
}

/** Réponse brute de GET /production/affectations/performances-postes (PerformancePosteResponse). */
interface PerformancePosteApi {
  codePoste: string; libellePoste: string; unite: string; joursAffectes: number; joursSaisis: number;
  objectifCumule: number; realiseCumule: number; taux: number | null; effectifMoyen: number | null;
  rendementParPersonne: number | null; rang: number | null;
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

  declarerLot(req: DeclarerLotBE): Observable<LotBE> {
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

  /** Changer le statut d'un OF : PLANIFIE (brouillon), EN_COURS, EN_PAUSE, HONORE (terminé) ou ANNULE. */
  changerStatutOF(idOF: string, statut: string): Observable<OFBE> {
    // L'API n'a pas de PATCH /statut : seules les transitions « démarrer » et « annuler » existent.
    if (statut === 'EN_COURS') return this.demarrerOF(idOF);
    if (statut === 'ANNULE') return this.annulerOF(idOF);
    return indisponible<OFBE>(`Le passage d'un OF au statut ${statut}`);
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
    futsPrevus: number;
    besoinsMatieresPremiere: { matierePremiere: string; quantiteKg: number }[];
    besoinsEmballage: { type: string; quantite: number }[];
  }[]): Observable<PPHBE> {
    return this.api.put<ApiResponse<PPHBE>>(
      `production/pph/${encodeURIComponent(reference)}/repartition`, { repartition }
    ).pipe(map(r => r.donnees!));
  }

  /** Recalcule un PPH non démarré depuis l'état actuel du BC et du catalogue (refusé si EN_COURS/CLOTURE). */
  recalculerPPH(reference: string): Observable<RecalculerPPHBE> {
    // Aucun endpoint dans l'API actuelle.
    void [reference];
    return indisponible<RecalculerPPHBE>("Le recalcul d'un plan de production");
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

  /** Vue d'ensemble de l'atelier de broyage sur une période (synthèses, poudres, série journalière). */
  getApercuBroyage(debut: string, fin: string): Observable<ApercuBroyageBE> {
    // Aucun endpoint dans l'API actuelle.
    void [debut, fin];
    return indisponible<ApercuBroyageBE>("L'aperçu de l'atelier de broyage");
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

  /** Les quantités viennent de la formule du produit du BC de la session — plus de « type de mélange » à choisir. */
  mettreAJourDosageAutomatique(id: number, nbFuts: number): Observable<SessionDosageBE> {
    return this.api.post<ApiResponse<SessionDosageBE>>(
      `production/dosage/${id}/dosage-auto?nbFuts=${nbFuts}`, {}
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

  /** Calcule et enregistre la prédiction d'un plan à partir du nombre de fûts (référence lue par les autres rôles). */
  calculerPredictionPPH(referencePPH: string, nbFuts: number): Observable<PredictionPPHBE> {
    // Aucun endpoint dans l'API actuelle.
    void [referencePPH, nbFuts];
    return indisponible<PredictionPPHBE>("La prédiction d'un plan de production");
  }

  /** Prédiction enregistrée d'un plan (erreur 404 si aucune n'a encore été calculée). */
  getPredictionPPH(referencePPH: string): Observable<PredictionPPHBE> {
    // Aucun endpoint dans l'API actuelle.
    void [referencePPH];
    return indisponible<PredictionPPHBE>("La prédiction d'un plan de production");
  }

  /** Fûts dosés d'un plan (sessions de dosage), en lecture seule : n'alimente pas l'avancement de production. */
  getAvancementDosage(referencePPH: string): Observable<AvancementDosageBE> {
    // Aucun endpoint dans l'API actuelle.
    void [referencePPH];
    return indisponible<AvancementDosageBE>("L'avancement du dosage d'un plan");
  }

  /** Poudre prévue par le plan et poudre écrasée des sessions de broyage, par matière (lecture seule). */
  getAvancementBroyage(referencePPH: string): Observable<AvancementBroyageBE> {
    // Aucun endpoint dans l'API actuelle.
    void [referencePPH];
    return indisponible<AvancementBroyageBE>("L'avancement du broyage d'un plan");
  }

  getPredictionsPPH(): Observable<PredictionPPHBE[]> {
    // Aucun endpoint dans l'API actuelle.
    return indisponible<PredictionPPHBE[]>("La liste des prédictions de plans");
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

  /** Recalcule les prédictions (dosage pour la bouillie, postes pour le grignoter) sans toucher aux quantités saisies. */
  recalculerPredictionsFiche(referencePPH: string, date: string): Observable<FicheProductionBE> {
    // Aucun endpoint dans l'API actuelle.
    void [referencePPH, date];
    return indisponible<FicheProductionBE>("Le recalcul des prédictions d'une fiche");
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

  getPerformancesPostes(debut: string, fin: string): Observable<PerformancePosteBE[]> {
    return this.api.get<ApiResponse<PerformancePosteApi[]>>('production/affectations/performances-postes', { debut, fin })
      .pipe(map(r => (r.donnees ?? []).map(p => ({
        codePoste: p.codePoste, libelle: p.libellePoste, unite: p.unite,
        joursAffectes: p.joursAffectes, joursSaisis: p.joursSaisis,
        objectifTotal: p.objectifCumule, realiseTotal: p.realiseCumule, tauxRealisation: p.taux ?? 0,
        effectifMoyen: p.effectifMoyen ?? 0, rendementParPersonne: p.rendementParPersonne ?? 0, rang: p.rang,
      }))));
  }

  /** Comparaison d'une journée : plan du BC contre dosage réel et réalisations des postes (ComparaisonController). */
  getComparaisonBC(referencePPH: string, date: string): Observable<ComparaisonBCBE> {
    return this.api.get<ApiResponse<ComparaisonBCBE>>(
      `production/comparaisons/${encodeURIComponent(referencePPH)}`, { date }
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

  /** Corrige un registre — refusé par le serveur si sa date n'est plus la journée en cours. */
  modifierRegistre(referencePPH: string, date: string, req: {
    lignes: { matriculeEmploye: string; nomEmploye: string; poste: string; present: boolean; motifAbsence?: string; heureArrivee?: string; qteRealisee?: number; unite?: string }[];
  }): Observable<RegistreProductionBE> {
    return this.api.patch<ApiResponse<RegistreProductionBE>>(
      `production/registres/pph/${encodeURIComponent(referencePPH)}/date/${date}`, req
    ).pipe(map(r => r.donnees!));
  }

  // ── Dashboards ───────────────────────────────────────────────

  getDashboardChef(): Observable<DashboardChefBE> {
    return this.api.get<ApiResponse<DashboardChefBE>>('production/dashboard/chef')
      .pipe(map(r => r.donnees!));
  }

  /** Tableau de bord du responsable de salle pour une journée (plan en cours, affectation, registre, besoins, lots, OF). */
  getDashboardResponsableSalle(date: string): Observable<DashboardResponsableSalleBE> {
    // Aucun endpoint dans l'API actuelle.
    void [date];
    return indisponible<DashboardResponsableSalleBE>("Le tableau de bord du responsable de salle");
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

  // ── Formules de production & composition d'emballage ───────────────────

  getReferentielFormules(): Observable<ReferentielProductionBE[]> {
    // Aucun endpoint dans l'API actuelle.
    return indisponible<ReferentielProductionBE[]>("Le référentiel des formules de production");
  }

  sauvegarderFormule(codeProduit: string, req: { baseKg: number; lignes: FormuleLigneBE[] }): Observable<ReferentielProductionBE> {
    // Aucun endpoint dans l'API actuelle.
    void [codeProduit, req];
    return indisponible<ReferentielProductionBE>("L'enregistrement d'une formule");
  }

  supprimerFormule(codeProduit: string): Observable<unknown> {
    // Aucun endpoint dans l'API actuelle.
    void [codeProduit];
    return indisponible<unknown>("La suppression d'une formule");
  }

  definirCompositionEmballage(codeProduit: string, conditionnementId: string,
                              req: { type: string | null; composants: ComposantEmballageBE[] }): Observable<ReferentielProductionBE> {
    // Aucun endpoint dans l'API actuelle.
    void [codeProduit, conditionnementId, req];
    return indisponible<ReferentielProductionBE>("La composition d'emballage");
  }
}
