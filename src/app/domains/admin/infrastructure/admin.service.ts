import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../../../core/http/api.service';
import { ApiResponse } from '../../../core/models/api-response.model';

export interface UtilisateurBE {
  id: number; matricule: string; nomComplet: string; email: string;
  role: string; roleLibelle: string; actif: boolean; dateCreation: string;
}

export interface ParametresBE {
  tvaTaux: number; primeMontant: number; alerteStockSeuil: number;
  seuilClientStrategique: number;
  zones: string[]; gammeProduits: string[]; villes: string[];
}

export interface CodeObservationBE {
  id: number;
  code: string;
  libelle: string;
  requireQuantity: boolean;
  actif: boolean;
  ordre: number;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly api = inject(ApiService);

  getUtilisateurs(role?: string): Observable<UtilisateurBE[]> {
    const params: Record<string, string> = {};
    if (role && role !== 'TOUS') params['role'] = role;
    return this.api.get<ApiResponse<UtilisateurBE[]>>('administration/utilisateurs', params)
      .pipe(map(r => r.donnees ?? []));
  }

  activer(matricule: string): Observable<UtilisateurBE> {
    return this.api.patch<ApiResponse<UtilisateurBE>>(
      `administration/utilisateurs/${encodeURIComponent(matricule)}/activer`, {}
    ).pipe(map(r => r.donnees!));
  }

  desactiver(matricule: string): Observable<UtilisateurBE> {
    return this.api.patch<ApiResponse<UtilisateurBE>>(
      `administration/utilisateurs/${encodeURIComponent(matricule)}/desactiver`, {}
    ).pipe(map(r => r.donnees!));
  }

  changerRole(matricule: string, role: string): Observable<UtilisateurBE> {
    return this.api.patch<ApiResponse<UtilisateurBE>>(
      `administration/utilisateurs/${encodeURIComponent(matricule)}/role?role=${encodeURIComponent(role)}`, {}
    ).pipe(map(r => r.donnees!));
  }

  debloquer(matricule: string): Observable<UtilisateurBE> {
    return this.api.patch<ApiResponse<UtilisateurBE>>(
      `administration/utilisateurs/${encodeURIComponent(matricule)}/debloquer`, {}
    ).pipe(map(r => r.donnees!));
  }

  creerUtilisateur(req: {
    prenom: string; nom: string; email: string; motDePasse: string; role: string;
    telephone?: string; residence?: string; cni?: string;
    dateNaissance?: string; lieuNaissance?: string; dateEmbauche?: string; sexe?: string;
  }): Observable<unknown> {
    return this.api.post<ApiResponse<unknown>>('auth/register', req)
      .pipe(map(r => r.donnees));
  }

  // ── Paramètres système ─────────────────────────────────────

  getParametres(): Observable<ParametresBE> {
    return this.api.get<ApiResponse<ParametresBE>>('administration/parametres')
      .pipe(map(r => r.donnees!));
  }

  modifierParametres(tvaTaux: number, primeMontant: number, alerteStockSeuil: number,
                      seuilClientStrategique: number): Observable<ParametresBE> {
    const params: Record<string, string> = {
      tvaTaux: String(tvaTaux),
      primeMontant: String(primeMontant),
      alerteStockSeuil: String(alerteStockSeuil),
      seuilClientStrategique: String(seuilClientStrategique),
    };
    return this.api.put<ApiResponse<ParametresBE>>('administration/parametres', {}, params)
      .pipe(map(r => r.donnees!));
  }

  ajouterReferentiel(categorie: string, valeur: string): Observable<ParametresBE> {
    const params: Record<string, string> = { categorie, valeur };
    return this.api.post<ApiResponse<ParametresBE>>('administration/parametres/referentiel', {}, params)
      .pipe(map(r => r.donnees!));
  }

  supprimerReferentiel(categorie: string, valeur: string): Observable<ParametresBE> {
    const params: Record<string, string> = { categorie, valeur };
    return this.api.delete<ApiResponse<ParametresBE>>('administration/parametres/referentiel', params)
      .pipe(map(r => r.donnees!));
  }

  // ── Codes observation tournée ─────────────────────────────────────────────

  getCodesObservation(): Observable<CodeObservationBE[]> {
    return this.api.get<ApiResponse<CodeObservationBE[]>>('administration/codes-observation')
      .pipe(map(r => r.donnees ?? []));
  }

  creerCodeObservation(code: string, libelle: string, requireQuantity: boolean, ordre: number): Observable<CodeObservationBE> {
    const params: Record<string, string> = {
      code, libelle, requireQuantity: String(requireQuantity), ordre: String(ordre),
    };
    return this.api.post<ApiResponse<CodeObservationBE>>('administration/codes-observation', {}, params)
      .pipe(map(r => r.donnees!));
  }

  modifierCodeObservation(id: number, code: string, libelle: string, requireQuantity: boolean, actif: boolean, ordre: number): Observable<CodeObservationBE> {
    const params: Record<string, string> = {
      code, libelle, requireQuantity: String(requireQuantity), actif: String(actif), ordre: String(ordre),
    };
    return this.api.put<ApiResponse<CodeObservationBE>>(`administration/codes-observation/${id}`, {}, params)
      .pipe(map(r => r.donnees!));
  }

  supprimerCodeObservation(id: number): Observable<unknown> {
    return this.api.delete<ApiResponse<unknown>>(`administration/codes-observation/${id}`)
      .pipe(map(r => r.donnees));
  }
}
