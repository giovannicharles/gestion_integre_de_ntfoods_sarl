export type SectionType =
  | 'RESUME'
  | 'TEXTE'
  | 'KPIS'
  | 'TABLEAU_DONNEES'
  | 'RECOMMANDATIONS'
  | 'SIGNATURES'
  | 'CALLOUT'
  | 'ANNEXES';

export type TextAlignment = 'left' | 'center' | 'justify';

export interface KpiItem {
  label: string;
  valeur: string;
  sousTitre?: string;
}

export interface SignatureItem {
  role: string;
  nom: string;
  statut: string;
}

export interface AnnexeItem {
  code: string;
  titre: string;
  description: string;
}

export interface DocumentSection {
  id: string;
  titre: string;
  type: SectionType;
  actif: boolean;
  ordre: number;
  contenuTexte?: string;
  alignement?: TextAlignment;
  kpis?: KpiItem[];
  colonnesTableau?: string[];
  lignesTableau?: string[][];
  afficherTotalTableau?: boolean;
  signatures?: SignatureItem[];
  calloutType?: 'INFO' | 'IMPORTANT' | 'DECISION' | 'RECOMMANDATION' | 'ALERTE';
  annexes?: AnnexeItem[];
}

export type ThemeDesign = 'FORET_OR' | 'CORPORATE_SLATE' | 'PRESTIGE_BORDEAUX' | 'MINIMALISTE';
export type FormatPage = 'A4_PORTRAIT' | 'A4_PAYSAGE';

export interface DocumentProjet {
  titre: string;
  reference: string;
  moduleOrigine: string;
  typeDocument: string;
  auteur: string;
  destinataire: string;
  dateDocument: string;
  lieu: string;
  statut: 'BROUILLON' | 'EN_VALIDATION' | 'VALIDE' | 'ARCHIVE';
  themeDesign: ThemeDesign;
  formatPage: FormatPage;
  filigrane?: string;
  enteteRepublique?: boolean;
  afficherCachetOfficiel?: boolean;
  // Personnalisation typographique & chromatique
  couleurPrincipale?: string;
  police?: string;
  taillePolice?: string;
  interligne?: string;
  sections: DocumentSection[];
}

export interface SavedDocumentMeta {
  id: string;
  titre: string;
  reference: string;
  moduleOrigine: string;
  dateEnregistrement: string;
}

export interface StudioModuleOption {
  code: string;
  label: string;
}

export interface DocumentTypeOption {
  code: string;
  label: string;
}

export interface StudioFontOption {
  label: string;
  value: string;
}

export interface StudioColorPreset {
  label: string;
  hex: string;
}
