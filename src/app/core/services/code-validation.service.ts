import { Injectable, signal } from '@angular/core';
import { ApiService } from './api.service';
import { Observable } from 'rxjs';

export interface CodeValidation {
  id: number;
  utilisateurId: number;
  utilisateurNom: string;
  actif: boolean;
  dateAttribution: string;
  dateExpiration?: string;
  attributionParId?: number;
  motifRevocation?: string;
  dateRevocation?: string;
  nombreUtilisations: number;
  derniereUtilisation?: string;
  maxUtilisations?: number;
  tentativesEchouees: number;
  bloque: boolean;
  commentaire?: string;
}

export interface AttributionCodeResponse {
  code: string;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class CodeValidationService {
  private baseUrl = '/api/v1/validation/codes';

  codesActifs = signal<CodeValidation[]>([]);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);

  constructor(private apiService: ApiService) {}

  /**
   * Attribue un code de validation à un utilisateur
   */
  attribuerCode(utilisateurId: number, dateExpiration?: string, maxUtilisations?: number, commentaire?: string): Observable<AttributionCodeResponse> {
    const params: any = { utilisateurId };
    if (dateExpiration) params.dateExpiration = dateExpiration;
    if (maxUtilisations) params.maxUtilisations = maxUtilisations;
    if (commentaire) params.commentaire = commentaire;

    return this.apiService.post(`${this.baseUrl}/attribuer`, null, params);
  }

  /**
   * Révoque un code de validation
   */
  revoquerCode(codeId: number, motif: string): Observable<CodeValidation> {
    return this.apiService.post(`${this.baseUrl}/${codeId}/revoquer`, null, { motif });
  }

  /**
   * Débloque un code de validation
   */
  debloquerCode(codeId: number): Observable<CodeValidation> {
    return this.apiService.post(`${this.baseUrl}/${codeId}/debloquer`, null);
  }

  /**
   * Vérifie un code de validation
   */
  verifierCode(code: string): Observable<boolean> {
    return this.apiService.post(`${this.baseUrl}/verifier`, null, { code });
  }

  /**
   * Enregistre l'utilisation d'un code
   */
  enregistrerUtilisation(code: string): Observable<void> {
    return this.apiService.post(`${this.baseUrl}/utiliser`, null, { code });
  }

  /**
   * Liste tous les codes de validation actifs
   */
  listerCodesActifs(): void {
    this.loading.set(true);
    this.error.set(null);

    this.apiService.get<CodeValidation[]>(`${this.baseUrl}/actifs`).subscribe({
      next: (codes) => {
        this.codesActifs.set(codes);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Erreur lors du chargement des codes de validation');
        this.loading.set(false);
      }
    });
  }

  /**
   * Liste les codes de validation d'un utilisateur
   */
  listerCodesUtilisateur(utilisateurId: number): Observable<CodeValidation[]> {
    return this.apiService.get<CodeValidation[]>(`${this.baseUrl}/utilisateur/${utilisateurId}`);
  }
}
