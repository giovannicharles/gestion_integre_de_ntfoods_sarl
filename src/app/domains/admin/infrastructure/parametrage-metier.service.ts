import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '../../../core/http/api.service';
import { ApiResponse } from '../../../core/models/api-response.model';

/**
 * Paramétrages métier datés.
 *
 * Chaque famille suit le même contrat : consultation de la version en vigueur,
 * historique des versions successives, et ouverture d'une nouvelle version à
 * compter d'une date. Les valeurs déjà appliquées ne sont jamais recalculées.
 */

export interface BaremePrimeBE {
  id: number; reference: string;
  tauxGlobalMinimumPourcent: number; tauxGammeMinimumPourcent: number;
  montantParGammeFCFA: number; montantMaximumFCFA: number;
  dateDebut: string; dateFin: string | null; courant: boolean;
  matriculeAuteur: string; motif: string | null; dateCreation: string;
}

export interface ParametrageCaisseBE {
  id: number; reference: string;
  seuilSecurisationFCFA: number; seuilAlerteRougeVersementFCFA: number;
  dateDebut: string; dateFin: string | null; courant: boolean;
  matriculeAuteur: string; motif: string | null; dateCreation: string;
}

export interface ParametrageObjectifBE {
  id: number; reference: string; nombreJoursOuvres: number;
  dateDebut: string; dateFin: string | null; courant: boolean;
  matriculeAuteur: string; motif: string | null; dateCreation: string;
}

export interface ReglesAvarieBE {
  id: number; reference: string; quantiteSeuilPhotoObligatoire: number;
  dateDebut: string; dateFin: string | null; courant: boolean;
  matriculeAuteur: string; motif: string | null; dateCreation: string;
}

@Injectable({ providedIn: 'root' })
export class ParametrageMetierService {
  private readonly api = inject(ApiService);

  // ── Barème des primes ─────────────────────────────────────────────────────

  getBaremeCourant(): Observable<BaremePrimeBE> {
    return this.api.get<ApiResponse<BaremePrimeBE>>('comptabilite/baremes-prime/courant')
      .pipe(map(r => r.donnees!));
  }

  getBaremeHistorique(): Observable<BaremePrimeBE[]> {
    return this.api.get<ApiResponse<BaremePrimeBE[]>>('comptabilite/baremes-prime/historique')
      .pipe(map(r => r.donnees ?? []));
  }

  ouvrirBareme(req: {
    tauxGlobalMinimumPourcent: number; tauxGammeMinimumPourcent: number;
    montantParGammeFCFA: number; montantMaximumFCFA: number;
    dateEffet: string; matriculeAuteur: string; motif: string;
  }): Observable<BaremePrimeBE> {
    return this.api.post<ApiResponse<BaremePrimeBE>>('comptabilite/baremes-prime', req)
      .pipe(map(r => r.donnees!));
  }

  // ── Caisse et versements ──────────────────────────────────────────────────

  getCaisseCourant(): Observable<ParametrageCaisseBE> {
    return this.api.get<ApiResponse<ParametrageCaisseBE>>('comptabilite/parametrages/caisse/courant')
      .pipe(map(r => r.donnees!));
  }

  getCaisseHistorique(): Observable<ParametrageCaisseBE[]> {
    return this.api.get<ApiResponse<ParametrageCaisseBE[]>>('comptabilite/parametrages/caisse/historique')
      .pipe(map(r => r.donnees ?? []));
  }

  ouvrirCaisse(req: {
    seuilSecurisationFCFA: number; seuilAlerteRougeVersementFCFA: number;
    dateEffet: string; matriculeAuteur: string; motif: string;
  }): Observable<ParametrageCaisseBE> {
    return this.api.post<ApiResponse<ParametrageCaisseBE>>('comptabilite/parametrages/caisse', req)
      .pipe(map(r => r.donnees!));
  }

  // ── Objectifs ─────────────────────────────────────────────────────────────

  getObjectifCourant(): Observable<ParametrageObjectifBE> {
    return this.api.get<ApiResponse<ParametrageObjectifBE>>('comptabilite/parametrages/objectif/courant')
      .pipe(map(r => r.donnees!));
  }

  getObjectifHistorique(): Observable<ParametrageObjectifBE[]> {
    return this.api.get<ApiResponse<ParametrageObjectifBE[]>>('comptabilite/parametrages/objectif/historique')
      .pipe(map(r => r.donnees ?? []));
  }

  ouvrirObjectif(req: {
    nombreJoursOuvres: number; dateEffet: string; matriculeAuteur: string; motif: string;
  }): Observable<ParametrageObjectifBE> {
    return this.api.post<ApiResponse<ParametrageObjectifBE>>('comptabilite/parametrages/objectif', req)
      .pipe(map(r => r.donnees!));
  }

  // ── Règles d'avarie ───────────────────────────────────────────────────────

  getAvarieCourantes(): Observable<ReglesAvarieBE> {
    return this.api.get<ApiResponse<ReglesAvarieBE>>('commercial/regles-avarie/courantes')
      .pipe(map(r => r.donnees!));
  }

  getAvarieHistorique(): Observable<ReglesAvarieBE[]> {
    return this.api.get<ApiResponse<ReglesAvarieBE[]>>('commercial/regles-avarie/historique')
      .pipe(map(r => r.donnees ?? []));
  }

  ouvrirAvarie(req: {
    quantiteSeuilPhotoObligatoire: number; dateEffet: string; matriculeAuteur: string; motif: string;
  }): Observable<ReglesAvarieBE> {
    return this.api.post<ApiResponse<ReglesAvarieBE>>('commercial/regles-avarie', req)
      .pipe(map(r => r.donnees!));
  }
}
