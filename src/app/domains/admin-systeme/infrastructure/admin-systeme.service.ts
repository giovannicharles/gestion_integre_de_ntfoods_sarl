import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../../../core/http/api.service';
import { ApiResponse } from '../../../core/models/api-response.model';

/**
 * Configuration technique de la plateforme (module `admin` backend,
 * `/api/v1/admin/parametres`) — distinct de la gestion des comptes/paramètres
 * métier du module `administration` (voir AdminService, domains/admin/).
 * Ne jamais fusionner les deux : décision actée, docs/PROGRESS.md 2026-09-23.
 */
export interface ParametreSystemeBE {
  id: number;
  code: string;
  nom: string;
  description?: string;
  valeur: string;
  typeValeur: string; // STRING, INTEGER, BOOLEAN, JSON, DURATION
  groupe?: string;
  modifiable: boolean;
  requireRedemarrage: boolean;
  valeurParDefaut?: string;
  validationRegex?: string;
  minValue?: string;
  maxValue?: string;
  options?: string;
  actif: boolean;
}

export interface JournalAuditBE {
  id: number;
  matricule: string;
  role: string;
  typeAction: string;
  module: string;
  ressource: string;
  referenceEntite?: string;
  methodeHttp?: string;
  endpoint?: string;
  details?: string;
  succes: boolean;
  messageErreur?: string;
  adresseIp?: string;
  dureeMs: number;
  horodatage: string;
}

export interface ActiviteSuspecteBE {
  matricule: string;
  ressource: string;
  occurrences: number;
}

export interface PageBE<T> {
  contenu: T[];
  totalElements: number;
  totalPages: number;
  pageCourante: number;
  taillePage: number;
  dernierePage: boolean;
}

export interface CreerParametreSystemeRequest {
  code: string;
  nom: string;
  description?: string;
  valeur: string;
  typeValeur: string;
  groupe?: string;
  modifiable?: boolean;
  requireRedemarrage?: boolean;
  valeurParDefaut?: string;
  validationRegex?: string;
  minValue?: string;
  maxValue?: string;
  options?: string;
}

export interface ElementCorbeilleBE {
  typeEntite: string;
  id: number;
  reference: string;
  libelle: string;
  dateSuppression: string;
  supprimePar: string;
  motif?: string;
}

export interface SauvegardeBE {
  id: number;
  dateDebut: string;
  dateFin?: string;
  statut: string; // EN_COURS, REUSSIE, ECHEC
  typeDeclenchement: string; // MANUELLE, AUTOMATIQUE
  matriculeDeclencheur?: string;
  cheminFichier?: string;
  tailleOctets?: number;
  messageErreur?: string;
}

export interface ValidationRequestBE {
  id: number;
  actionType: string;
  statut: string;
}

@Injectable({ providedIn: 'root' })
export class AdminSystemeService {
  private readonly api = inject(ApiService);
  private readonly base = 'v1/admin/parametres';

  lister(): Observable<ParametreSystemeBE[]> {
    return this.api.get<ApiResponse<ParametreSystemeBE[]>>(this.base)
      .pipe(map(r => r.donnees ?? []));
  }

  listerParGroupe(groupe: string): Observable<ParametreSystemeBE[]> {
    return this.api.get<ApiResponse<ParametreSystemeBE[]>>(`${this.base}/groupe/${encodeURIComponent(groupe)}`)
      .pipe(map(r => r.donnees ?? []));
  }

  consulter(code: string): Observable<ParametreSystemeBE> {
    return this.api.get<ApiResponse<ParametreSystemeBE>>(`${this.base}/${encodeURIComponent(code)}`)
      .pipe(map(r => r.donnees!));
  }

  creer(req: CreerParametreSystemeRequest): Observable<ParametreSystemeBE> {
    return this.api.post<ApiResponse<ParametreSystemeBE>>(this.base, req)
      .pipe(map(r => r.donnees!));
  }

  modifierValeur(code: string, valeur: string): Observable<ParametreSystemeBE> {
    return this.api.put<ApiResponse<ParametreSystemeBE>>(`${this.base}/${encodeURIComponent(code)}`, { valeur })
      .pipe(map(r => r.donnees!));
  }

  reinitialiser(code: string): Observable<ParametreSystemeBE> {
    return this.api.post<ApiResponse<ParametreSystemeBE>>(`${this.base}/${encodeURIComponent(code)}/reinitialiser`, {})
      .pipe(map(r => r.donnees!));
  }

  desactiver(code: string): Observable<ParametreSystemeBE> {
    return this.api.delete<ApiResponse<ParametreSystemeBE>>(`${this.base}/${encodeURIComponent(code)}`)
      .pipe(map(r => r.donnees!));
  }

  // ── Suivi plateforme (journal d'audit transversal, /api/audit) ─────────────

  echecs(page = 0, size = 20): Observable<PageBE<JournalAuditBE>> {
    return this.api.get<ApiResponse<PageBE<JournalAuditBE>>>('audit/echecs', { page: String(page), size: String(size) })
      .pipe(map(r => r.donnees!));
  }

  activitesSuspectes(fenetreHeures = 24, seuil = 5): Observable<ActiviteSuspecteBE[]> {
    return this.api.get<ApiResponse<ActiviteSuspecteBE[]>>('audit/activites-suspectes',
      { fenetreHeures: String(fenetreHeures), seuil: String(seuil) })
      .pipe(map(r => r.donnees ?? []));
  }

  parModule(module: string, page = 0, size = 20): Observable<PageBE<JournalAuditBE>> {
    return this.api.get<ApiResponse<PageBE<JournalAuditBE>>>(`audit/module/${encodeURIComponent(module)}`,
      { page: String(page), size: String(size) })
      .pipe(map(r => r.donnees!));
  }

  // ── Corbeille (/api/v1/corbeille) ───────────────────────────────────────────

  corbeille(): Observable<ElementCorbeilleBE[]> {
    return this.api.get<ApiResponse<ElementCorbeilleBE[]>>('v1/corbeille')
      .pipe(map(r => r.donnees ?? []));
  }

  demanderRestauration(typeEntite: string, id: number, motif: string): Observable<ValidationRequestBE> {
    return this.api.post<ApiResponse<ValidationRequestBE>>('v1/corbeille/demander-restauration', { typeEntite, id, motif })
      .pipe(map(r => r.donnees!));
  }

  // ── Sauvegardes (/api/v1/admin/sauvegardes) ─────────────────────────────────

  declencherSauvegarde(): Observable<SauvegardeBE> {
    return this.api.post<ApiResponse<SauvegardeBE>>('v1/admin/sauvegardes/declencher', {})
      .pipe(map(r => r.donnees!));
  }

  historiqueSauvegardes(page = 0, size = 20): Observable<PageBE<SauvegardeBE>> {
    return this.api.get<ApiResponse<PageBE<SauvegardeBE>>>('v1/admin/sauvegardes', { page: String(page), size: String(size) })
      .pipe(map(r => r.donnees!));
  }

  demanderModificationPlanification(actif: boolean | null, frequenceHeures: number | null, motif: string): Observable<ValidationRequestBE> {
    return this.api.post<ApiResponse<ValidationRequestBE>>('v1/admin/sauvegardes/configuration/demander-modification',
      { actif, frequenceHeures, motif })
      .pipe(map(r => r.donnees!));
  }
}
