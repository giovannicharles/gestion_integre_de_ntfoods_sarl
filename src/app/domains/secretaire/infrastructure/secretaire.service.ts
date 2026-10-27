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

export interface MicroStockMouvementResponse {
  id: number;
  articleId: number;
  codeArticle: string;
  delta: number;
  quantiteAvant: number;
  quantiteApres: number;
  motif: string;
  matriculeActeur: string;
  dateOperation: string;
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

  // ── Écritures (2026-10-25) — endpoints déjà prêts côté serveur depuis le 2026-09-23,
  // jamais appelés jusqu'ici : voir SecretaireController.java. ──

  enregistrerMouvementCaisse(libelle: string, type: 'ENTREE' | 'SORTIE', montant: number, heure?: string, categorie?: string): Observable<PetiteCaisseResponse> {
    return this.api.post<ApiResponse<PetiteCaisseResponse>>('secretaire/petite-caisse', { libelle, type, montant, heure, categorie }).pipe(map(r => r.donnees));
  }

  creerArticleMicroStock(code: string, designation: string, qte: number, prixUnite: number, seuil: number): Observable<MicroStockResponse> {
    return this.api.post<ApiResponse<MicroStockResponse>>('secretaire/micro-stock', { code, designation, qte, prixUnite, seuil }).pipe(map(r => r.donnees));
  }

  ajusterMicroStock(id: number, delta: number, motif?: string): Observable<MicroStockResponse> {
    return this.api.put<ApiResponse<MicroStockResponse>>(`secretaire/micro-stock/${id}/ajuster`, { delta, motif }).pipe(map(r => r.donnees));
  }

  getMouvementsMicroStock(id: number): Observable<MicroStockMouvementResponse[]> {
    return this.api.get<ApiResponse<MicroStockMouvementResponse[]>>(`secretaire/micro-stock/${id}/mouvements`).pipe(map(r => r.donnees));
  }

  enregistrerDocumentRecu(matriculeCommercial: string, nom: string, feuilleRoute: boolean, bonCommande: boolean, factures: boolean): Observable<DocumentRecuResponse> {
    return this.api.post<ApiResponse<DocumentRecuResponse>>('secretaire/documents', { matriculeCommercial, nom, feuilleRoute, bonCommande, factures }).pipe(map(r => r.donnees));
  }
}
