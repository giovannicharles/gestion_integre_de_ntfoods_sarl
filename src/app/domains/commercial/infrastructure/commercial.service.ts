import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../../../core/http/api.service';
import { ApiResponse } from '../../../core/models/api-response.model';
import { PageResponse, PageParams } from '../../../core/models/page-response.model';
import { ClassementCommercialBE } from '../../dg/infrastructure/dg.service';

export type { ClassementCommercialBE };

export interface ClientBE {
  id: number; codeClient: string; nom: string; telephone: string;
  adresse: string; localite: string; type: string;
  matriculeCommercialReferent: string; actif: boolean;
  dette?: number;
}

export interface LignePCBE {
  codeProduit: string; designationProduit: string; conditionnement: string;
  quantiteDemandee: number; quantiteValidee: number;
}

export interface PreCommandeBE {
  id: number; numeroPreCommande: string; matriculeCommercial: string; nomCommercial?: string;
  dateSoumission: string; dateEffet: string; statut: string;
  matriculeValidateurSecretaire?: string; matriculeValidateurComptable?: string;
  motifRefus?: string; soumiseEnSoiree: boolean; lignes: LignePCBE[];
}

/**
 * Calcul automatique des primes hebdomadaires (2026-10-25) — GET /api/commercial/rapports/primes
 * (RapportCommercialController.java:66, CalculerPrimesHebdoUseCase) : calcule déjà le CA réalisé
 * et le taux par gamme à partir des vraies ventes, jamais consommé par l'écran
 * `comptable-primes` qui forçait jusqu'ici une saisie manuelle des mêmes chiffres.
 */
export interface PrimeResultatAutoBE {
  matriculeCommercial: string;
  caRealise: number;
  caCible: number;
  tauxGlobal: number;
  tauxParGamme: Record<string, number>;
  eligible: boolean;
  montantPrime: number;
  montantCashFCFA: number;
  montantNatureFCFA: number;
  gammesValidees: string[];
  gammesBloquantes: string[];
  conditionGlobaleOK: boolean;
  joursValides: number;
  joursTotal: number;
}

export interface RecouvrementBE {
  id: number; referenceRecouvrement: string; codeClient: string; nomClient: string;
  montantDu: number; montantRembourse: number; montantRestant: number;
  dateEcheance: string; statut: string; matriculeCommercial: string; observations?: string;
}

export interface CarburantBE {
  id: number; referenceCarburant: string; matriculeCommercial: string;
  immatriculation: string; stationPartenaire: string; kilometrage: number;
  litresDemandes: number; montant: number;
  date: string; statut: string;
  motifRefus?: string; photoCompteur?: string;
  caZoneMoisCourantFCFA: number; ratioCarburantSurCaPourcent: number;
}

/** Forme réelle de FeuillRouteResponse (backend) — champs pertinents pour le sélecteur carburant. */
export interface FeuillRouteBE {
  id: number; numeroFeuillRoute: string; numeroSession: string; matriculeCommercial: string;
  date: string; nombreVisites: number; nombreNonVisites: number; tousArretsTranches: boolean;
}

export interface VenteBE {
  id: number; numeroVente: string; matriculeCommercial: string;
  codeClient: string; date: string; modeReglement: string;
  typeVente: string; statut: string; montantTotal: number;
  lignes: LigneVenteBE[];
}

export interface LigneVenteBE {
  codeProduit: string; designation: string; conditionnement: string;
  quantite: number; prixUnitaire: number; remise: number;
  montantHT: number; montantTVA: number; montantTTC: number;
}

export interface ReglesAvarieBE {
  id: number; reference: string; quantiteSeuilPhotoObligatoire: number;
  dateDebut: string; dateFin: string | null; courant: boolean;
  matriculeAuteur: string; motif: string; dateCreation: string;
}

export interface AvoirBE {
  id: number; numeroAvoir: string; numeroVenteOriginale: string;
  matriculeCommercial: string; codeClient: string; matriculeComptable: string;
  montantHT: number; montantTVA: number; montantTTC: number;
  motif: string; dateAvoir: string; statut: string;
  dateCreation: string; dateValidation?: string;
}

export type CanalCommande = 'APPEL_TELEPHONIQUE' | 'WHATSAPP' | 'SMS' | 'EMAIL';

export interface LigneCommandeDistanceBE {
  codeProduit: string; designation: string; conditionnement: string;
  quantite: number; prixUnitaire: number;
}

export interface LigneCommandeDistanceRequest {
  codeProduit: string; designation: string; conditionnement: string;
  quantite: number; prixUnitaire: number;
}

export interface CommandeDistanceBE {
  id: number; numeroCommande: string; codeClient: string; matriculeCommercial: string;
  canal: CanalCommande; dateCommande: string; statut: string;
  matriculeValidateurSecretaire?: string; matriculeValidateurComptable?: string;
  motifAnnulation?: string; observations?: string;
  dateCreation: string; dateModification?: string;
  lignes: LigneCommandeDistanceBE[];
}

export interface FicheSyntheseBE {
  date: string;
  caYaounde: number; caDouala: number; caTotal: number;
  effectifCommerciaux: number;
  vacInit: number; ca: number; vac: number;
  recouvrements: number; vteCpt: number; soldeVAC: number;
  cumulMensuelCA: number; eCheques: number; vstBanques: number;
  depensesJustifiees: number; depensesNonJust: number;
  sCaisse: number; montantAvaries: number; montantDotPromo: number;
  lignes: LigneFicheSyntheseBE[];
}

export interface LigneFicheSyntheseBE {
  codeProduit: string; qteProduite: number; stockVeille: number;
  stockCamion: number; stockTotal: number; qteSorties: number;
  stockFinal: number; qteAvoDotProm: number; qteFacturee: number;
}

@Injectable({ providedIn: 'root' })
export class CommercialService {
  private readonly api = inject(ApiService);

  getPrimesHebdoAutomatique(semaineDebut: string, semaineFin: string): Observable<PrimeResultatAutoBE[]> {
    return this.api.get<ApiResponse<PrimeResultatAutoBE[]>>('commercial/rapports/primes', { semaineDebut, semaineFin })
      .pipe(map(r => r.donnees ?? []));
  }

  // ── Clients ─────────────────────────────────────────────────

  getClients(commercial?: string): Observable<ClientBE[]> {
    const params: Record<string, string> = {};
    if (commercial) params['commercial'] = commercial;
    return this.api.get<ApiResponse<ClientBE[]>>('commercial/clients', params)
      .pipe(map(r => r.donnees ?? []));
  }

  creerClient(req: {
    nom: string; telephone: string; adresse: string;
    localite: string; type: string; matriculeCommercialReferent: string;
  }): Observable<ClientBE> {
    return this.api.post<ApiResponse<ClientBE>>('commercial/clients', req)
      .pipe(map(r => r.donnees!));
  }

  // ── Précommandes ────────────────────────────────────────────

  getPrecommandesAValider(page?: PageParams): Observable<PageResponse<PreCommandeBE>> {
    const params: Record<string, string> = {};
    if (page?.page !== undefined) params['page'] = String(page.page);
    if (page?.size !== undefined) params['size'] = String(page.size);
    if (page?.sort) params['sort'] = page.sort;
    return this.api.get<ApiResponse<PageResponse<PreCommandeBE>>>('commercial/precommandes/a-valider', params)
      .pipe(map(r => r.donnees!));
  }

  getPrecommandesAValiderComptable(page?: PageParams): Observable<PageResponse<PreCommandeBE>> {
    const params: Record<string, string> = {};
    if (page?.page !== undefined) params['page'] = String(page.page);
    if (page?.size !== undefined) params['size'] = String(page.size);
    if (page?.sort) params['sort'] = page.sort;
    return this.api.get<ApiResponse<PageResponse<PreCommandeBE>>>('commercial/precommandes/a-valider-comptable', params)
      .pipe(map(r => r.donnees!));
  }

  getPrecommandesALivrer(page?: PageParams): Observable<PageResponse<PreCommandeBE>> {
    const params: Record<string, string> = {};
    if (page?.page !== undefined) params['page'] = String(page.page);
    if (page?.size !== undefined) params['size'] = String(page.size);
    if (page?.sort) params['sort'] = page.sort;
    return this.api.get<ApiResponse<PageResponse<PreCommandeBE>>>('commercial/precommandes/a-livrer', params)
      .pipe(map(r => r.donnees!));
  }

  getPrecommandesParDate(date: string, page?: PageParams): Observable<PageResponse<PreCommandeBE>> {
    const params: Record<string, string> = {};
    if (page?.page !== undefined) params['page'] = String(page.page);
    if (page?.size !== undefined) params['size'] = String(page.size);
    if (page?.sort) params['sort'] = page.sort;
    return this.api.get<ApiResponse<PageResponse<PreCommandeBE>>>(`commercial/precommandes/date-effet/${date}`, params)
      .pipe(map(r => r.donnees!));
  }

  soumettrePrecommande(req: {
    matriculeCommercial: string; dateSoumission: string;
    lignes: { codeProduit: string; designation: string; conditionnement: string; quantite: number }[];
  }): Observable<PreCommandeBE> {
    return this.api.post<ApiResponse<PreCommandeBE>>('commercial/precommandes', req)
      .pipe(map(r => r.donnees!));
  }

  validerSecretaire(numero: string, matricule: string): Observable<PreCommandeBE> {
    return this.api.patch<ApiResponse<PreCommandeBE>>(
      `commercial/precommandes/${encodeURIComponent(numero)}/valider-secretaire?matriculeSecretaire=${encodeURIComponent(matricule)}`,
      {}
    ).pipe(map(r => r.donnees!));
  }

  validerComptable(numero: string, matricule: string, quantitesValidees?: Record<string, number>): Observable<PreCommandeBE> {
    return this.api.patch<ApiResponse<PreCommandeBE>>(
      `commercial/precommandes/${encodeURIComponent(numero)}/valider-comptable?matriculeComptable=${encodeURIComponent(matricule)}`,
      quantitesValidees ?? {}
    ).pipe(map(r => r.donnees!));
  }

  // ── Recouvrements ───────────────────────────────────────────

  getRecouvrements(params: { commercial?: string; client?: string; statut?: string } = {}): Observable<RecouvrementBE[]> {
    const p: Record<string, string> = {};
    if (params.commercial) p['commercial'] = params.commercial;
    if (params.client) p['client'] = params.client;
    if (params.statut) p['statut'] = params.statut;
    return this.api.get<ApiResponse<RecouvrementBE[]>>('commercial/recouvrements', p)
      .pipe(map(r => r.donnees ?? []));
  }

  rembourserRecouvrement(reference: string, montant: number): Observable<RecouvrementBE> {
    return this.api.patch<ApiResponse<RecouvrementBE>>(
      `commercial/recouvrements/${encodeURIComponent(reference)}/rembourser?montant=${montant}`,
      {}
    ).pipe(map(r => r.donnees!));
  }

  // ── Carburant ───────────────────────────────────────────────

  getCarburant(params: { commercial?: string; statut?: string } = {}): Observable<CarburantBE[]> {
    const p: Record<string, string> = {};
    if (params.commercial) p['commercial'] = params.commercial;
    if (params.statut) p['statut'] = params.statut;
    return this.api.get<ApiResponse<CarburantBE[]>>('commercial/carburant', p)
      .pipe(map(r => r.donnees ?? []));
  }

  creerCarburant(req: {
    matriculeCommercial: string; immatriculation: string;
    stationPartenaire: string; kilometrage: number;
    litresDemandes: number; montant: number;
    photoCompteur?: string; numeroFeuillRoute: string;
  }): Observable<CarburantBE> {
    return this.api.post<ApiResponse<CarburantBE>>('commercial/carburant', req)
      .pipe(map(r => r.donnees!));
  }

  /**
   * Feuilles de route du commercial à une date donnée — nécessaire pour renseigner
   * `numeroFeuillRoute` lors d'une demande de carburant (CarburantController : confronté à un
   * trajet réel, sans quoi toute demande échoue avec RegleMetierException, voir P5 2026-10-15).
   */
  getFeuillesRouteParDate(matricule: string, date: string): Observable<FeuillRouteBE[]> {
    return this.api.get<ApiResponse<FeuillRouteBE[]>>(`commercial/feuills-route/commercial/${encodeURIComponent(matricule)}/date/${date}`)
      .pipe(map(r => r.donnees ?? []));
  }

  // ── Ventes ─────────────────────────────────────────────────

  getVentes(debut: string, fin: string, page?: PageParams): Observable<PageResponse<VenteBE>> {
    const params: Record<string, string> = { debut, fin };
    if (page?.page !== undefined) params['page'] = String(page.page);
    if (page?.size !== undefined) params['size'] = String(page.size);
    if (page?.sort) params['sort'] = page.sort;
    return this.api.get<ApiResponse<PageResponse<VenteBE>>>('commercial/ventes', params)
      .pipe(map(r => r.donnees!));
  }

  getVentesParCommercial(matricule: string, page?: PageParams): Observable<PageResponse<VenteBE>> {
    const params: Record<string, string> = {};
    if (page?.page !== undefined) params['page'] = String(page.page);
    if (page?.size !== undefined) params['size'] = String(page.size);
    if (page?.sort) params['sort'] = page.sort;
    return this.api.get<ApiResponse<PageResponse<VenteBE>>>(`commercial/ventes/commercial/${matricule}`, params)
      .pipe(map(r => r.donnees!));
  }

  finaliserVente(numero: string): Observable<VenteBE> {
    return this.api.patch<ApiResponse<VenteBE>>(
      `commercial/ventes/${encodeURIComponent(numero)}/finaliser`, {}
    ).pipe(map(r => r.donnees!));
  }

  annulerVente(numero: string, motif: string): Observable<VenteBE> {
    return this.api.patch<ApiResponse<VenteBE>>(
      `commercial/ventes/${encodeURIComponent(numero)}/annuler?motif=${encodeURIComponent(motif)}`, {}
    ).pipe(map(r => r.donnees!));
  }

  declarerNonMarchand(req: {
    typeVente: string; matriculeCommercial: string; codeClient: string;
    codeProduit: string; designationProduit: string; conditionnement: string;
    quantite: number; date: string; motif: string;
    pourcentageLot?: number; photoJustificative?: string;
  }): Observable<VenteBE> {
    return this.api.post<ApiResponse<VenteBE>>('commercial/ventes/non-marchand', req)
      .pipe(map(r => r.donnees!));
  }

  /**
   * Seuil (en unités de base) à partir duquel une photo devient obligatoire pour une
   * déclaration d'avarie — jamais codé en dur côté client, administrable par le DG.
   */
  getReglesAvarieCourantes(): Observable<ReglesAvarieBE> {
    return this.api.get<ApiResponse<ReglesAvarieBE>>('commercial/regles-avarie/courantes')
      .pipe(map(r => r.donnees!));
  }

  emettreAvoir(numeroVente: string, req: {
    matriculeComptable: string; motif: string;
  }): Observable<AvoirBE> {
    return this.api.post<ApiResponse<AvoirBE>>(
      `commercial/ventes/${encodeURIComponent(numeroVente)}/avoir`, req
    ).pipe(map(r => r.donnees!));
  }

  validerAvoir(numeroAvoir: string): Observable<AvoirBE> {
    return this.api.patch<ApiResponse<AvoirBE>>(
      `commercial/ventes/avoirs/${encodeURIComponent(numeroAvoir)}/valider`, {}
    ).pipe(map(r => r.donnees!));
  }

  refuserPrecommande(numero: string, motif: string, matriculeValidateur: string): Observable<PreCommandeBE> {
    return this.api.patch<ApiResponse<PreCommandeBE>>(
      `commercial/precommandes/${encodeURIComponent(numero)}/refuser?motif=${encodeURIComponent(motif)}&matriculeValidateur=${encodeURIComponent(matriculeValidateur)}`, {}
    ).pipe(map(r => r.donnees!));
  }

  arbitrerPrecommande(numero: string, lignes: { codeProduit: string; quantiteValidee: number }[], matriculeArbitre: string, motif?: string): Observable<PreCommandeBE> {
    return this.api.patch<ApiResponse<PreCommandeBE>>(
      `commercial/precommandes/${encodeURIComponent(numero)}/arbitrer`,
      { matriculeArbitre, motif: motif || '', lignes }
    ).pipe(map(r => r.donnees!));
  }

  livrerPrecommande(numero: string): Observable<PreCommandeBE> {
    return this.api.patch<ApiResponse<PreCommandeBE>>(
      `commercial/precommandes/${encodeURIComponent(numero)}/livrer`, {}
    ).pipe(map(r => r.donnees!));
  }

  // ── Fiche synthèse journalière ─────────────────────────────

  getFicheSynthese(date?: string): Observable<FicheSyntheseBE> {
    const params: Record<string, string> = {};
    if (date) params['date'] = date;
    return this.api.get<ApiResponse<FicheSyntheseBE>>('commercial/dashboard/fiche-synthese', params)
      .pipe(map(r => r.donnees!));
  }

  // ── Classement des commerciaux ─────────────────────────────

  /**
   * Classement des commerciaux par CA du mois courant.
   *
   * Le serveur expose ce classement par **deux** portes qui appellent le même
   * cas d'usage et renvoient le même DTO :
   *
   *   - `/api/dg/classement-commerciaux`, sous le garde de classe du contrôleur
   *     DG — `hasAnyRole('DIRECTEUR_GENERAL', 'ADMIN')` ;
   *   - `/api/commercial/dashboard/classement`, gardé par la permission
   *     `COMMERCIAL_VENTE_CONSULTER`.
   *
   * Les écrans du Contrôleur Général, de la Chargée RP et du commercial
   * passaient par la première : chacun recevait un 403 sur un classement
   * auquel la seconde lui donne pleinement droit. On emprunte donc la porte
   * ouverte. Aucun accès n'est élargi — la donnée est rigoureusement la même,
   * seul le garde diffère.
   */
  getClassementCommerciaux(): Observable<ClassementCommercialBE[]> {
    return this.api.get<ApiResponse<ClassementCommercialBE[]>>('commercial/dashboard/classement')
      .pipe(map(r => r.donnees ?? []));
  }

  // ── Commandes à distance (client hors tournée : téléphone, WhatsApp, SMS, email) ──
  // Création ouverte à tout poste pouvant être contacté par un client (2026-10-16,
  // COMMERCIAL_COMMANDE_DISTANCE_RECEVOIR), pas seulement au commercial — voir
  // CommandeDistanceController, backend.

  getCommandesDistance(): Observable<CommandeDistanceBE[]> {
    return this.api.get<ApiResponse<CommandeDistanceBE[]>>('commercial/commandes-distance')
      .pipe(map(r => r.donnees ?? []));
  }

  consulterCommandeDistance(numero: string): Observable<CommandeDistanceBE> {
    return this.api.get<ApiResponse<CommandeDistanceBE>>(`commercial/commandes-distance/${encodeURIComponent(numero)}`)
      .pipe(map(r => r.donnees!));
  }

  creerCommandeDistance(req: {
    codeClient: string; matriculeCommercial: string; canal: CanalCommande;
    dateCommande: string; observations?: string; lignes: LigneCommandeDistanceRequest[];
  }): Observable<CommandeDistanceBE> {
    return this.api.post<ApiResponse<CommandeDistanceBE>>('commercial/commandes-distance', req)
      .pipe(map(r => r.donnees!));
  }

  validerCommandeDistanceSecretaire(numero: string, matricule: string): Observable<CommandeDistanceBE> {
    return this.api.patch<ApiResponse<CommandeDistanceBE>>(
      `commercial/commandes-distance/${encodeURIComponent(numero)}/valider-secretaire`, {}, { matricule }
    ).pipe(map(r => r.donnees!));
  }

  validerCommandeDistanceComptable(numero: string, matricule: string): Observable<CommandeDistanceBE> {
    return this.api.patch<ApiResponse<CommandeDistanceBE>>(
      `commercial/commandes-distance/${encodeURIComponent(numero)}/valider-comptable`, {}, { matricule }
    ).pipe(map(r => r.donnees!));
  }

  rejeterCommandeDistance(numero: string, matricule: string, motif: string): Observable<CommandeDistanceBE> {
    return this.api.patch<ApiResponse<CommandeDistanceBE>>(
      `commercial/commandes-distance/${encodeURIComponent(numero)}/rejeter`, {}, { matricule, motif }
    ).pipe(map(r => r.donnees!));
  }

  annulerCommandeDistance(numero: string, motif: string): Observable<CommandeDistanceBE> {
    return this.api.patch<ApiResponse<CommandeDistanceBE>>(
      `commercial/commandes-distance/${encodeURIComponent(numero)}/annuler`, {}, { motif }
    ).pipe(map(r => r.donnees!));
  }

  livrerCommandeDistance(numero: string): Observable<CommandeDistanceBE> {
    return this.api.patch<ApiResponse<CommandeDistanceBE>>(
      `commercial/commandes-distance/${encodeURIComponent(numero)}/livrer`, {}
    ).pipe(map(r => r.donnees!));
  }

  ajusterLigneCommandeDistance(numero: string, codeProduit: string, nouvelleQuantite: number): Observable<CommandeDistanceBE> {
    return this.api.patch<ApiResponse<CommandeDistanceBE>>(
      `commercial/commandes-distance/${encodeURIComponent(numero)}/ajuster-ligne`, {}, { codeProduit, nouvelleQuantite: String(nouvelleQuantite) }
    ).pipe(map(r => r.donnees!));
  }
}
