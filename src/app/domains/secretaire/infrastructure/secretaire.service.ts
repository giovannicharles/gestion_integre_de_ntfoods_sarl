import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../../../core/http/api.service';

export interface SecretaireDashboard {
  versementsEnAttente: number;
  commandesAValider: number;
  alertesRouges: number;
  totalVerse: number;
  totalEntrees: number;
  totalSorties: number;
  soldeCaisse: number;
  seuilDepasse: boolean;
  microStockBas: number;
  valeurMicroStock: number;
  docsIncomplets: number;
  petiteCaisse: PetiteCaisseResponse[];
  microStock: MicroStockResponse[];
  documents: DocumentRecuResponse[];
}

export interface PetiteCaisseResponse {
  id: number;
  libelle: string;
  type: string;
  montant: number;
  heure: string;
  categorie: string;
  dateOperation: string;
}

export interface MicroStockResponse {
  id: number;
  code: string;
  designation: string;
  qte: number;
  prixUnite: number;
  seuil: number;
}

export interface DocumentRecuResponse {
  id: number;
  matriculeCommercial: string;
  nom: string;
  feuilleRoute: boolean;
  bonCommande: boolean;
  factures: boolean;
}

interface ApiResponse<T> {
  succes: boolean;
  message: string;
  donnees: T;
}

@Injectable({ providedIn: 'root' })
export class SecretaireService {
  private readonly api = inject(ApiService);

  getDashboard(): Observable<SecretaireDashboard> {
    return this.api.get<ApiResponse<SecretaireDashboard>>('secretaire/dashboard').pipe(map(r => r.donnees));
  }

  getPetiteCaisse(): Observable<PetiteCaisseResponse[]> {
    return this.api.get<ApiResponse<PetiteCaisseResponse[]>>('secretaire/petite-caisse').pipe(map(r => r.donnees));
  }

  getMicroStock(): Observable<MicroStockResponse[]> {
    return this.api.get<ApiResponse<MicroStockResponse[]>>('secretaire/micro-stock').pipe(map(r => r.donnees));
  }

  getDocuments(): Observable<DocumentRecuResponse[]> {
    return this.api.get<ApiResponse<DocumentRecuResponse[]>>('secretaire/documents').pipe(map(r => r.donnees));
  }
}
