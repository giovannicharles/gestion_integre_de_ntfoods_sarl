export type TypeVente = 'COMPTANT' | 'CREDIT' | 'DON' | 'DOTATION' | 'AVARIE';
export type ModeReglement = 'COMPTANT' | 'CREDIT';

export interface LigneVenteBE {
  codeProduit: string;
  designation: string;
  conditionnement: string;
  quantite: number;
  prixUnitaire: number;
  remise: number;
  referencePrixExceptionnel?: string;
}

export interface VenteBE {
  id: number;
  numeroVente: string;
  matriculeCommercial: string;
  codeClient: string;
  date: string;
  typeVente: TypeVente;
  modeReglement: ModeReglement;
  uuidVente: string;
  coordonneesGPS?: string;
  idFeuillRoute?: string;
  signatureClient: boolean;
  statut: string;
  montantHT: number;
  montantTVA: number;
  montantTTC: number;
  photoProduits?: string;
  lignes: LigneVenteBE[];
  dateCreation?: string;
  dateFinalisation?: string;
}

export interface CreerVenteRequest {
  matriculeCommercial: string;
  codeClient: string;
  date: string;
  modeReglement: ModeReglement;
  typeVente: TypeVente;
  uuidVente: string;
  coordonneesGPS?: string;
  idFeuillRoute?: string;
  signatureClient: boolean;
  photoProduits: string;
  lignes: LigneVenteBE[];
}

export interface NonMarchandeRequest {
  typeVente: TypeVente;
  matriculeCommercial: string;
  codeClient: string;
  codeProduit: string;
  designationProduit: string;
  conditionnement: string;
  quantite: number;
  date: string;
  motif: string;
  pourcentageLot: number;
  photoJustificative?: string;
}

export interface AvoirBE {
  id: number;
  numeroAvoir: string;
  numeroVenteOriginale: string;
  matriculeCommercial: string;
  codeClient: string;
  matriculeComptable: string;
  montantHT: number;
  montantTVA: number;
  montantTTC: number;
  motif: string;
  dateAvoir: string;
  statut: string;
  dateCreation: string;
  dateValidation?: string;
}

export interface CreerAvoirRequest {
  matriculeComptable: string;
  motif: string;
}
