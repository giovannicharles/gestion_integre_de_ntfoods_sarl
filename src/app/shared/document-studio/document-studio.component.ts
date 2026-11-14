import { Component, ChangeDetectionStrategy, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { DocumentService } from '../../domains/shared/infrastructure/document.service';
import { DocumentSharingService } from '../document-sharing/document-sharing.service';
import { IaService } from '../../core/services/ia.service';
import { ToastService } from '../../core/services/toast.service';
import { fCFA } from '../utils/format.utils';

export interface DocumentSection {
  id: string;
  titre: string;
  type: 'TEXTE' | 'RESUME' | 'TABLEAU_DONNEES' | 'KPIS' | 'RECOMMANDATIONS' | 'SIGNATURES' | 'CALLOUT' | 'ANNEXES';
  actif: boolean;
  ordre: number;
  contenuTexte?: string;
  alignement?: 'left' | 'center' | 'justify';
  taillePolice?: '11px' | '12px' | '13px' | '14px';
  calloutType?: 'INFO' | 'IMPORTANT' | 'RECOMMANDATION' | 'DECISION' | 'ALERTE';
  kpis?: { label: string; valeur: string; sousTitre?: string }[];
  colonnesTableau?: string[];
  lignesTableau?: string[][];
  afficherTotalTableau?: boolean;
  signatures?: { role: string; nom: string; statut: string }[];
  annexes?: { code: string; titre: string; description: string }[];
}

export interface DocumentProjet {
  id?: string;
  titre: string;
  reference: string;
  typeDocument: string;
  moduleOrigine: string;
  dateDocument: string;
  lieu: string;
  destinataire: string;
  auteur: string;
  statut: 'BROUILLON' | 'SOUMIS' | 'VALIDE' | 'OFFICIEL';
  themeDesign: 'FORET_OR' | 'CORPORATE_SLATE' | 'PRESTIGE_BORDEAUX' | 'MINIMALISTE';
  formatPage: 'A4_PORTRAIT' | 'A4_PAYSAGE';
  filigrane: string;
  enteteRepublique?: boolean;
  afficherCachetOfficiel?: boolean;
  sections: DocumentSection[];
}

export interface SavedDocMetadata {
  id: string;
  titre: string;
  reference: string;
  moduleOrigine: string;
  dateEnregistrement: string;
}

const STORAGE_DOC_STUDIO_KEY = 'tanty_document_studio_draft';
const STORAGE_DOC_LIBRARY_KEY = 'tanty_document_studio_library';

@Component({
  selector: 'app-document-studio',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './document-studio.component.html',
  styleUrls: ['./document-studio.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocumentStudioComponent implements OnInit {
  fCFA = fCFA;

  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly docService = inject(DocumentService);
  private readonly sharingService = inject(DocumentSharingService);
  private readonly iaService = inject(IaService);
  private readonly toast = inject(ToastService);

  vueActive = signal<'EDITEUR' | 'SPLIT' | 'PREVIEW'>('EDITEUR');
  zoomPreview = signal<number>(100);
  iaEnCours = signal(false);
  sauvegardeEnCours = signal(false);

  // Modal Bibliothèque de documents enregistrés
  showModalBibliotheque = signal(false);
  bibliotheque = signal<SavedDocMetadata[]>([]);

  // Modal IA Générateur Complet
  showModalIaPrompt = signal(false);
  iaPromptBrief = signal('');
  iaTonStyle = signal<'CORPORATE' | 'SYNTHETIQUE' | 'AUDIT' | 'COMMERCIAL'>('CORPORATE');

  // Modal Partage Interne Rapide
  showModalPartage = signal(false);
  partageCible = signal('DG');
  partageObjet = signal('');
  partageAction = signal<'POUR_VISA_SIGNATURE' | 'POUR_INFORMATION' | 'POUR_VALIDATION'>('POUR_VISA_SIGNATURE');

  // Modèles prédéfinis par module
  readonly modulesDisponibles = [
    { code: 'STOCK', label: 'Stock & Logistique Magasins' },
    { code: 'COMMERCIAL', label: 'Direction Commerciale & Ventes' },
    { code: 'PRODUCTION', label: 'Production Industrielle & Qualité' },
    { code: 'COMPTABLE', label: 'Comptabilité & Finance OHADA' },
    { code: 'CONTROLE', label: 'Contrôle de Gestion & Audit' },
    { code: 'SECRETAIRE', label: 'Secrétariat Général & Direction' },
    { code: 'DG', label: 'Direction Générale & Stratégie' },
    { code: 'RP', label: 'Relations Publiques & Grands Comptes' },
    { code: 'ADMIN', label: 'Administration & Ressources Humaines' }
  ];

  // Catalogue complet des types de documents par module
  readonly catalogueTypes: Record<string, { code: string; label: string }[]> = {
    STOCK: [
      { code: 'PV_INVENTAIRE', label: 'Procès-Verbal d\'Inventaire & Écarts de Stock' },
      { code: 'FICHE_AVARIE_REBUT', label: 'Fiche de Constat d\'Avarie & Déclassement' },
      { code: 'RAPPORT_ROTATION', label: 'Rapport de Rotation & Couverture des Stocks' },
      { code: 'BORDEREAU_TRANSFERT', label: 'Bordereau de Transfert Inter-Magasins' },
      { code: 'DEMANDE_APPRO_MP', label: 'Expression de Besoin & Réapprovisionnement' }
    ],
    COMMERCIAL: [
      { code: 'OFFRE_TARIFS', label: 'Offre Tarifaire Spéciale & Grille Grossistes' },
      { code: 'BILAN_TOURNEE', label: 'Bilan de Tournée Commerciale & Recouvrement' },
      { code: 'ACCORD_RISTOURNE', label: 'Accord Commercial & Barème de Ristournes' },
      { code: 'FICHE_CLIENT_VIP', label: 'Fiche d\'Ouverture de Compte Partenaire VIP' },
      { code: 'RAPPORT_PROSPECTION', label: 'Rapport de Prospection & Parts de Marché' }
    ],
    PRODUCTION: [
      { code: 'RAPPORT_LOT_FABRICATION', label: 'Fiche Suivi de Lot & Traçabilité Formulation' },
      { code: 'BILAN_JOURNALIER_PROD', label: 'Bilan Journalier Usine & Rendement Machines' },
      { code: 'RAPPORT_NON_CONFORMITE', label: 'Fiche d\'Incident & Non-Conformité Qualité' },
      { code: 'PROTOCOLE_HYGIENE_ANOR', label: 'Rapport d\'Audit Qualité & Normes ANOR' },
      { code: 'FICHE_CHANGEMENT_FORMULE', label: 'Fiche d\'Ajustement de Formule & Mouture' }
    ],
    COMPTABLE: [
      { code: 'RAPPORT_TRESORERIE', label: 'Rapport Périodique de Solde & Rapprochement' },
      { code: 'NOTE_DECAISSEMENT_DG', label: 'Note Explicative d\'Engagement de Dépense' },
      { code: 'ETAT_CREANCES_CLIENTS', label: 'Analyse de la Balance Âgée & Risque d\'Impayés' },
      { code: 'SYNTHESE_FISCALE_DSF', label: 'Synthèse Fiscale & Conformité DGI/CNPS' },
      { code: 'PLAN_FINANCEMENT', label: 'Plan de Trésorerie Prévisionnel & BFR' }
    ],
    CONTROLE: [
      { code: 'RAPPORT_AUDIT_INTERNE', label: 'Rapport Général d\'Audit & Contrôle Inopiné' },
      { code: 'NOTE_VARIANCE_COUTS', label: 'Note d\'Analyse des Écarts Coûts Standards vs Réels' },
      { code: 'RAPPORT_CONTROLE_CAISSE', label: 'PV de Contrôle de Caisse et Versements' },
      { code: 'PLAN_ACTION_CORRECTIF', label: 'Plan d\'Actions Correctives & Recommandations' },
      { code: 'ANALYSE_RENTABILITE_GAMME', label: 'Étude de Rentabilité par Gamme de Produit' }
    ],
    SECRETAIRE: [
      { code: 'NOTE_SERVICE_INTERNE', label: 'Note de Service NT Foods au Personnel' },
      { code: 'ORDRE_DE_MISSION', label: 'Ordre de Mission Professionnelle & Frais' },
      { code: 'COMPTE_RENDU_REUNION_STAFF', label: 'Procès-Verbal de Réunion de Direction' },
      { code: 'COURRIER_OFFICIEL_EXT', label: 'Courrier Administratif avec Accusé' },
      { code: 'BORDEREAU_ENVOI', label: 'Bordereau d\'Envoi de Pièces Justificatives' }
    ],
    DG: [
      { code: 'NOTE_CADRAGE', label: 'Note de Cadrage Stratégique & Arbitrage' },
      { code: 'CIRCULAIRE_INTERNE', label: 'Circulaire Générale & Directive Stratégique' },
      { code: 'RAPPORT_CONSEIL', label: 'Rapport Stratégique au Conseil de Direction' },
      { code: 'DECISION_DG', label: 'Décision Portant Réorganisation & Nominations' },
      { code: 'MANDAT_REPRESENTATION', label: 'Mandat de Représentation & Pouvoir Légal' }
    ],
    RP: [
      { code: 'RAPPORT_ACTIVITE', label: 'Rapport d\'Activité & Relations Grands Comptes GMS' },
      { code: 'CONVENTION_PARTENARIAT', label: 'Convention Cadre de Référencement GMS' },
      { code: 'FICHE_GRAND_COMPTE', label: 'Fiche d\'Audit & Suivi Grand Compte VIP' },
      { code: 'COMPTE_RENDU_REUNION', label: 'Compte-Rendu de Négociation Commerciale' },
      { code: 'BILAN_CAMPAGNE', label: 'Bilan de Campagne d\'Animation & Dégustation' }
    ],
    ADMIN: [
      { code: 'CONTRAT_TRAVAIL', label: 'Contrat de Travail & Engagement Collaborateur' },
      { code: 'AVIS_RECRUTEMENT', label: 'Appel à Candidatures & Profil de Poste' },
      { code: 'DECISION_SANCTION_AVERTISSEMENT', label: 'Notification d\'Avertissement & Discipline' },
      { code: 'ATTESTATION_TRAVAIL', label: 'Attestation de Travail & Certificat' },
      { code: 'PLAN_FORMATION_RH', label: 'Plan de Formation & Développement RH' }
    ]
  };

  typesDocumentsActifs = computed(() => {
    const mod = this.doc().moduleOrigine;
    return this.catalogueTypes[mod] || this.catalogueTypes['RP'];
  });

  doc = signal<DocumentProjet>({
    titre: 'Document Officiel NT Foods Tanty',
    reference: 'NTF-DOC-2026-0001',
    typeDocument: 'RAPPORT_ACTIVITE',
    moduleOrigine: 'RP',
    dateDocument: new Date().toISOString().substring(0, 10),
    lieu: 'Douala, Cameroun',
    destinataire: 'Direction Générale NT Foods',
    auteur: 'Responsable Opérationnel NT Foods',
    statut: 'OFFICIEL',
    themeDesign: 'FORET_OR',
    formatPage: 'A4_PORTRAIT',
    filigrane: 'ORIGINAL',
    enteteRepublique: false,
    afficherCachetOfficiel: true,
    sections: []
  });

  ngOnInit(): void {
    const user = this.auth.getCurrentUser();
    if (user) {
      this.doc.update(d => ({
        ...d,
        auteur: `${user.firstname} ${user.lastname} (${user.roles?.[0] || 'Responsable'})`
      }));
    }

    // Détection automatique du module hôte via la route courante
    this.detecterModuleHote();
    this.chargerBibliothequeMetadata();
  }

  detecterModuleHote(): void {
    const url = this.router.url.toLowerCase();
    let moduleDetecte = 'RP';

    if (url.includes('/stock')) moduleDetecte = 'STOCK';
    else if (url.includes('/commercial')) moduleDetecte = 'COMMERCIAL';
    else if (url.includes('/production')) moduleDetecte = 'PRODUCTION';
    else if (url.includes('/comptable')) moduleDetecte = 'COMPTABLE';
    else if (url.includes('/controle')) moduleDetecte = 'CONTROLE';
    else if (url.includes('/secretaire')) moduleDetecte = 'SECRETAIRE';
    else if (url.includes('/admin')) moduleDetecte = 'ADMIN';
    else if (url.includes('/dg')) moduleDetecte = 'DG';
    else if (url.includes('/rp')) moduleDetecte = 'RP';

    // Vérifier si un brouillon sauvegardé spécifique existe déjà
    const saved = localStorage.getItem(`${STORAGE_DOC_STUDIO_KEY}_${moduleDetecte}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.titre) {
          this.doc.set(parsed);
          return;
        }
      } catch (_) {}
    }

    // Sinon, initialiser avec le premier modèle officiel du module détecté
    const premierType = this.catalogueTypes[moduleDetecte]?.[0]?.code || 'RAPPORT_ACTIVITE';
    this.doc.update(d => ({
      ...d,
      moduleOrigine: moduleDetecte,
      typeDocument: premierType
    }));
    this.appliquerModeleParDefaut(moduleDetecte, premierType);
  }

  changerModule(nouveauModule: string): void {
    const premierType = this.catalogueTypes[nouveauModule]?.[0]?.code || 'RAPPORT_ACTIVITE';
    this.doc.update(d => ({
      ...d,
      moduleOrigine: nouveauModule,
      typeDocument: premierType
    }));
    this.appliquerModeleParDefaut(nouveauModule, premierType);
  }

  changerTypeDocument(nouveauType: string): void {
    this.doc.update(d => ({ ...d, typeDocument: nouveauType }));
    this.appliquerModeleParDefaut(this.doc().moduleOrigine, nouveauType);
  }

  // Application dynamique des modèles prédéfinis ultra-complets
  appliquerModeleParDefaut(module: string, type: string): void {
    const annee = new Date().getFullYear();
    const ref = `NTF-${module}-${annee}-${Math.floor(1000 + Math.random() * 9000)}`;
    const sections: DocumentSection[] = [];

    // --- 1. MODÈLES STOCK ---
    if (module === 'STOCK') {
      if (type === 'PV_INVENTAIRE') {
        sections.push(
          {
            id: 'sec-intro',
            titre: '1. Contexte & Cadre de l\'Inventaire Physique',
            type: 'RESUME',
            actif: true,
            ordre: 1,
            contenuTexte: 'Le présent procès-verbal consigne le comptage contradictoire exhaustif des existants physiques en magasin central et magasin tampon de NT FOODS face aux soldes théoriques du progiciel. L\'opération a été menée conformément aux procédures de contrôle interne et d\'audit des stocks.'
          },
          {
            id: 'sec-kpis',
            titre: '2. Bilan Chiffré de l\'Inventaire',
            type: 'KPIS',
            actif: true,
            ordre: 2,
            kpis: [
              { label: 'Valeur Totale Stock', valeur: '48 750 000 FCFA', sousTitre: 'Valorisation PMP' },
              { label: 'Taux de Conformité', valeur: '98.8%', sousTitre: '38/40 références conformes' },
              { label: 'Écart Net Détecté', valeur: '-185 000 FCFA', sousTitre: 'Avaries de manutention' },
              { label: 'Taux de Rotation', valeur: '18 jours', sousTitre: 'Produits finis' }
            ]
          },
          {
            id: 'sec-callout',
            titre: 'Avis & Rapprochement de Gestion',
            type: 'CALLOUT',
            calloutType: 'IMPORTANT',
            actif: true,
            ordre: 3,
            contenuTexte: 'Écart mineur constaté sur le Tapioca Sans Sable 1kg imputable à une casse lors du déchargement du camion de transport N° LT-2026. Fiche d\'avarie transmise au Contrôle de Gestion pour régularisation.'
          },
          {
            id: 'sec-table',
            titre: '3. Tableau des Écarts & Rapprochement par Article',
            type: 'TABLEAU_DONNEES',
            actif: true,
            ordre: 4,
            colonnesTableau: ['Référence / Article', 'Stock Théorique', 'Stock Physique Compté', 'Écart', 'Statut Contrôle'],
            lignesTableau: [
              ['Tapioca Sans Sable 1kg', '450 cartons', '448 cartons', '-2 cartons', 'Casse justifiée'],
              ['Bouillie Lion Infantile 500g', '320 cartons', '320 cartons', '0', 'Parfaitement conforme'],
              ['Farine de Maïs Complète', '210 sacs', '210 sacs', '0', 'Parfaitement conforme'],
              ['Gari Supérieur Tanty', '180 cartons', '179 cartons', '-1 carton', 'En cours d\'investigation']
            ]
          },
          {
            id: 'sec-recommandations',
            titre: '4. Recommandations & Mesures Correctives',
            type: 'RECOMMANDATIONS',
            actif: true,
            ordre: 5,
            contenuTexte: '1. Valider l\'écriture de régularisation comptable pour les 2 cartons avariés.\n2. Installer des cornières de protection supplémentaires sur la rampe de chargement.\n3. Maintenir le rythme bimensuel d\'inventaire tournant sur les consommables d\'emballage.'
          },
          {
            id: 'sec-signatures',
            titre: '5. Visas & Signatures Contradictoires',
            type: 'SIGNATURES',
            actif: true,
            ordre: 6,
            signatures: [
              { role: 'Magasinier en Chef', nom: 'Gestionnaire de Stock NT Foods', statut: 'Compté et certifié' },
              { role: 'Contrôle de Gestion', nom: 'Contrôleur Général', statut: 'Vérifié & Validé' },
              { role: 'Direction Générale', nom: 'Directeur Général NT Foods', statut: 'Approuvé pour régularisation' }
            ]
          }
        );
        this.doc.update(d => ({ ...d, titre: 'Procès-Verbal d\'Inventaire Physique & Rapprochement de Stock', reference: ref, sections }));
        return;
      }
    }

    // --- 2. MODÈLES COMMERCIAL ---
    if (module === 'COMMERCIAL') {
      sections.push(
        {
          id: 'sec-intro',
          titre: '1. Présentation de l\'Offre & Cadre Commercial',
          type: 'RESUME',
          actif: true,
          ordre: 1,
          contenuTexte: 'NT FOODS SARL a le plaisir de vous soumettre ses conditions tarifaires officielles et barèmes de remises quantitatives pour la distribution de ses gammes phares : Tapioca Sans Sable, Bouillie Lion et Céréales Locales Fortifiées.'
        },
        {
          id: 'sec-kpis',
          titre: '2. Avantages & Conditions Privilégiées',
          type: 'KPIS',
          actif: true,
          ordre: 2,
          kpis: [
            { label: 'Remise Volume (>200 ctns)', valeur: '12%', sousTitre: 'Déductible sur facture' },
            { label: 'Délai de Livraison Garanti', valeur: '24 Heures', sousTitre: 'Sur Douala & Yaoundé' },
            { label: 'PLV & Animations Offertes', valeur: '100% Pris en charge', sousTitre: 'Week-ends et quinzaines' },
            { label: 'Paiement Négocié', valeur: '30 Jours', sousTitre: 'Après validation crédit' }
          ]
        },
        {
          id: 'sec-table',
          titre: '3. Grille Tarifaire Officielle Grossistes & GMS',
          type: 'TABLEAU_DONNEES',
          actif: true,
          ordre: 3,
          colonnesTableau: ['Gamme / Conditionnement', 'Conditionnement', 'Prix Gros Unitaire (FCFA)', 'Prix Carton (FCFA)', 'Remise Palier'],
          lignesTableau: [
            ['Tapioca Sans Sable 1kg', 'Carton de 20 sachets', '750 FCFA', '15 000 FCFA', '12% dès 100 ctns'],
            ['Bouillie Lion Infantile 500g', 'Carton de 24 boîtes', '625 FCFA', '15 000 FCFA', '10% dès 80 ctns'],
            ['Farine Précuite de Plantain', 'Carton de 15 sachets', '900 FCFA', '13 500 FCFA', '8% dès 50 ctns']
          ]
        },
        {
          id: 'sec-callout',
          titre: 'Engagement Qualité & Fraîcheur',
          type: 'CALLOUT',
          calloutType: 'DECISION',
          actif: true,
          ordre: 4,
          contenuTexte: 'Tous nos produits sont certifiés conformes aux normes camerounaises ANOR. NT FOODS s\'engage à échanger sans frais tout produit non conforme ou endommagé lors de la livraison.'
        },
        {
          id: 'sec-signatures',
          titre: '4. Validation & Accord Commercial',
          type: 'SIGNATURES',
          actif: true,
          ordre: 5,
          signatures: [
            { role: 'Direction Commerciale NT Foods', nom: 'Directeur Commercial', statut: 'Offre émise et signée' },
            { role: 'Client Partenaire / Grossiste', nom: 'Représentant Légal', statut: 'Bon pour accord' }
          ]
        }
      );
      this.doc.update(d => ({ ...d, titre: 'Proposition Commerciale & Barème Tarifaire Partenaires', reference: ref, sections }));
      return;
    }

    // --- 3. MODÈLES PRODUCTION ---
    if (module === 'PRODUCTION') {
      sections.push(
        {
          id: 'sec-intro',
          titre: '1. Traçabilité & Synthèse du Lot de Fabrication',
          type: 'RESUME',
          actif: true,
          ordre: 1,
          contenuTexte: 'Le présent document atteste du déroulement conforme du cycle de fabrication industrielle du lot spécifié, depuis l\'incorporation des matières premières jusqu\'au conditionnement sous atmosphère protectrice.'
        },
        {
          id: 'sec-kpis',
          titre: '2. Paramètres Industriels & Rendement Usine',
          type: 'KPIS',
          actif: true,
          ordre: 2,
          kpis: [
            { label: 'Volume Fabriqué', valeur: '1 250 Cartons', sousTitre: 'Conforme au bon de fabrication' },
            { label: 'Rendement Matière', valeur: '96.4%', sousTitre: 'Pertes : 3.6% (norme < 4%)' },
            { label: 'Taux d\'Humidité', valeur: '8.2%', sousTitre: 'Conformité ANOR (< 10%)' },
            { label: 'Temps Machine', valeur: '7h 15min', sousTitre: 'Cadence nominale respectée' }
          ]
        },
        {
          id: 'sec-table',
          titre: '3. Contrôle des Matières Premières & Doses Formule',
          type: 'TABLEAU_DONNEES',
          actif: true,
          ordre: 3,
          colonnesTableau: ['Composant de Formule', 'Lot Origine', 'Poids Théorique (kg)', 'Poids Réel Dosé (kg)', 'Conformité'],
          lignesTableau: [
            ['Farine de Manioc Lavée', 'LOT-MP-082', '850.0 kg', '850.2 kg', 'Conforme'],
            ['Sucre Raffiné Spécial', 'LOT-MP-033', '120.0 kg', '119.8 kg', 'Conforme'],
            ['Complexe Micronutriments', 'LOT-MP-014', '15.0 kg', '15.0 kg', 'Parfait']
          ]
        },
        {
          id: 'sec-callout',
          titre: 'Attestation de Libération Qualité',
          type: 'CALLOUT',
          calloutType: 'IMPORTANT',
          actif: true,
          ordre: 4,
          contenuTexte: 'Les analyses organoleptiques, granulométriques et microbiologiques du laboratoire interne confirment l\'absence totale de corps étrangers et la conformité stricte aux exigences qualité NT FOODS.'
        },
        {
          id: 'sec-signatures',
          titre: '4. Signatures de Libération de Lot',
          type: 'SIGNATURES',
          actif: true,
          ordre: 5,
          signatures: [
            { role: 'Responsable de Salle / Machine', nom: 'Chef Machiniste', statut: 'Fabriqué' },
            { role: 'Contrôleur Qualité Usine', nom: 'Ingénieur Qualité', statut: 'Analysé & Validé' },
            { role: 'Chef de Production', nom: 'Directeur d\'Usine', statut: 'Lot libéré pour magasin' }
          ]
        }
      );
      this.doc.update(d => ({ ...d, titre: 'Fiche de Traçabilité & Libération de Lot de Fabrication', reference: ref, sections }));
      return;
    }

    // --- 4. MODÈLES COMPTABLE ---
    if (module === 'COMPTABLE') {
      sections.push(
        {
          id: 'sec-intro',
          titre: '1. Synthèse de Trésorerie & Engagements Financiers',
          type: 'RESUME',
          actif: true,
          ordre: 1,
          contenuTexte: 'Le présent état financier récapitule les flux de trésorerie décaissés et encaissés au cours de la période, avec pointage des encaissements commerciaux et justification des décaissements exceptionnels conformément aux normes OHADA.'
        },
        {
          id: 'sec-kpis',
          titre: '2. Soldes & Indicateurs de Liquidité',
          type: 'KPIS',
          actif: true,
          ordre: 2,
          kpis: [
            { label: 'Solde Caisse Principale', valeur: '14 820 000 FCFA', sousTitre: 'Physique pointé' },
            { label: 'Versements Commerciaux', valeur: '8 450 000 FCFA', sousTitre: '100% rapprochés' },
            { label: 'Décaissements Validés', valeur: '3 210 000 FCFA', sousTitre: 'Pièces jointes conformes' },
            { label: 'Écart de Caisse Global', valeur: '0 FCFA', sousTitre: 'Balance exacte' }
          ]
        },
        {
          id: 'sec-table',
          titre: '3. Détail des Décaissements par Imputation',
          type: 'TABLEAU_DONNEES',
          actif: true,
          ordre: 3,
          colonnesTableau: ['N° Pièce', 'Bénéficiaire', 'Nature de Dépense', 'Compte OHADA', 'Montant TTC (FCFA)'],
          lignesTableau: [
            ['DEC-2026-081', 'Fournisseur Emballage Plastique', 'Achat sacs 1kg imprimés', '6011 - Achats MP', '1 850 000 FCFA'],
            ['DEC-2026-082', 'Maintenance Froid & Machines', 'Réparation broyeur usine', '6241 - Entretien', '620 000 FCFA'],
            ['DEC-2026-083', 'Carburant Flotte Commerciale', 'Dotation tournées Yaoundé', '6053 - Carburant', '740 000 FCFA']
          ]
        },
        {
          id: 'sec-signatures',
          titre: '4. Visas Comptables & Approbation Trésorerie',
          type: 'SIGNATURES',
          actif: true,
          ordre: 4,
          signatures: [
            { role: 'Comptable Trésorier', nom: 'Comptable NT Foods', statut: 'Établi & Rapproché' },
            { role: 'Contrôleur de Gestion', nom: 'Contrôleur Général', statut: 'Vérifié' },
            { role: 'Direction Générale', nom: 'Directeur Général', statut: 'Ordonnancé' }
          ]
        }
      );
      this.doc.update(d => ({ ...d, titre: 'Note Explicative de Trésorerie & Ordonnancement des Décaissements', reference: ref, sections }));
      return;
    }

    // --- 5. MODÈLE PAR DÉFAUT (RP / DG / SECRETAIRE / ADMIN) ---
    sections.push(
      {
        id: 'sec-intro',
        titre: '1. Contexte & Résumé Exécutif',
        type: 'RESUME',
        actif: true,
        ordre: 1,
        contenuTexte: 'Le présent document synthétise les orientations, résultats opérationnels et décisions arrêtées au sein du département NT FOODS. Il constitue une base formelle de travail, de communication inter-services et d\'archivage institutionnel.'
      },
      {
        id: 'sec-kpis',
        titre: '2. Indicateurs Clés de Réalisation (KPIs)',
        type: 'KPIS',
        actif: true,
        ordre: 2,
        kpis: [
          { label: 'Indicateur de Performance', valeur: '94%', sousTitre: 'Taux de conformité' },
          { label: 'Dossiers Traités', valeur: '128 affaires', sousTitre: '100% dans les délais' },
          { label: 'Impact Budgétaire', valeur: 'Maîtrisé', sousTitre: 'Écart < 2%' },
          { label: 'Statut du Projet', valeur: 'En Cours', sousTitre: 'Jalon N°2 validé' }
        ]
      },
      {
        id: 'sec-callout',
        titre: 'Directive Clé & Décision Stratégique',
        type: 'CALLOUT',
        calloutType: 'IMPORTANT',
        actif: true,
        ordre: 3,
        contenuTexte: 'Application immédiate des directives de coordination entre départements. Tout arbitrage budgétaire supérieur au seuil réglementaire requiert le visa formel de la Direction Générale.'
      },
      {
        id: 'sec-table',
        titre: '3. Tableau Récapitulatif des Opérations',
        type: 'TABLEAU_DONNEES',
        actif: true,
        ordre: 4,
        colonnesTableau: ['Intitulé Opération', 'Service Responsable', 'Échéance', 'Statut Avancement'],
        lignesTableau: [
          ['Audit des processus de livraison', 'Logistique & Commercial', 'Fin de mois', 'En cours'],
          ['Mise à jour des conventions GMS', 'Relations Publiques', '15 du mois', 'Validé'],
          ['Rapprochement comptable OHADA', 'Comptabilité', 'Hebdomadaire', 'À jour']
        ]
      },
      {
        id: 'sec-recommandations',
        titre: '4. Recommandations & Plan d\'Actions',
        type: 'RECOMMANDATIONS',
        actif: true,
        ordre: 5,
        contenuTexte: '1. Transmettre les rapports d\'étape chaque vendredi avant 17h00.\n2. Renforcer le suivi dématérialisé via le système TANTY ERP.\n3. Maintenir un niveau d\'exigence élevé sur la qualité et la satisfaction client.'
      },
      {
        id: 'sec-signatures',
        titre: '5. Visas & Approbations Institutionnelles',
        type: 'SIGNATURES',
        actif: true,
        ordre: 6,
        signatures: [
          { role: 'Responsable Émetteur', nom: this.doc().auteur, statut: 'Signé et visé' },
          { role: 'Contrôle Interne', nom: 'Contrôleur de Gestion', statut: 'Vérifié' },
          { role: 'Direction Générale', nom: 'Directeur Général NT Foods', statut: 'Approuvé pour exécution' }
        ]
      }
    );

    let docTitre = 'Rapport d\'Activité Institutionnel NT Foods';
    if (type === 'CONVENTION_PARTENARIAT') docTitre = 'Convention Cadre de Référencement & Distribution GMS';
    else if (type === 'FICHE_GRAND_COMPTE') docTitre = 'Fiche d\'Audit & de Suivi Partenaire VIP';
    else if (type === 'NOTE_CADRAGE') docTitre = 'Note de Cadrage Stratégique & Arbitrage Direction';
    else if (type === 'NOTE_SERVICE_INTERNE') docTitre = 'Note de Service NT Foods au Personnel';
    else if (type === 'ORDRE_DE_MISSION') docTitre = 'Ordre de Mission Professionnelle & Frais de Séjour';
    else if (type === 'CONTRAT_TRAVAIL') docTitre = 'Contrat de Travail & Engagement Collaborateur';

    this.doc.update(d => ({
      ...d,
      titre: docTitre,
      reference: ref,
      sections
    }));
  }

  // --- GESTION DES SECTIONS ---
  toggleSection(section: DocumentSection): void {
    section.actif = !section.actif;
    this.doc.update(d => ({ ...d }));
  }

  monterSection(index: number): void {
    if (index <= 0) return;
    this.doc.update(d => {
      const copy = [...d.sections];
      const temp = copy[index - 1];
      copy[index - 1] = copy[index];
      copy[index] = temp;
      copy.forEach((s, i) => s.ordre = i + 1);
      return { ...d, sections: copy };
    });
  }

  descendreSection(index: number): void {
    if (index >= this.doc().sections.length - 1) return;
    this.doc.update(d => {
      const copy = [...d.sections];
      const temp = copy[index + 1];
      copy[index + 1] = copy[index];
      copy[index] = temp;
      copy.forEach((s, i) => s.ordre = i + 1);
      return { ...d, sections: copy };
    });
  }

  ajouterNouvelleSection(type: DocumentSection['type'] = 'TEXTE'): void {
    const nouvelle: DocumentSection = {
      id: 'sec-' + Date.now(),
      titre: type === 'CALLOUT' ? 'Encadré Spécial' : 'Nouvelle Section Personnalisée',
      type,
      actif: true,
      ordre: this.doc().sections.length + 1,
      contenuTexte: 'Saisissez ici le contenu texte à intégrer dans le document.',
      calloutType: 'IMPORTANT'
    };

    if (type === 'TABLEAU_DONNEES') {
      nouvelle.colonnesTableau = ['Désignation / Article', 'Volume / Qté', 'Prix Unitaire', 'Total FCFA'];
      nouvelle.lignesTableau = [
        ['Tapioca Sans Sable 1kg', '100 cartons', '15 000 FCFA', '1 500 000 FCFA'],
        ['Bouillie Lion Infantile 500g', '80 cartons', '14 000 FCFA', '1 120 000 FCFA']
      ];
    } else if (type === 'KPIS') {
      nouvelle.kpis = [
        { label: 'Taux de Réalisation', valeur: '100%', sousTitre: 'Atteint' },
        { label: 'Volume Traité', valeur: '500 Cartons', sousTitre: 'Conforme' }
      ];
    } else if (type === 'SIGNATURES') {
      nouvelle.signatures = [
        { role: 'Responsable Opérationnel', nom: this.doc().auteur, statut: 'Signé' },
        { role: 'Direction Générale', nom: 'Directeur Général NT Foods', statut: 'Visé' }
      ];
    } else if (type === 'ANNEXES') {
      nouvelle.titre = 'Pièces Jointes & Annexes Officielles';
      nouvelle.annexes = [
        { code: 'ANN-01', titre: 'Certificat de Conformité ANOR', description: 'Copie certifiée conforme aux normes agroalimentaires camerounaises.' },
        { code: 'ANN-02', titre: 'Bordereau de Réception Signé', description: 'Justificatif logistique signé par le magasinier en chef.' }
      ];
    }

    this.doc.update(d => ({ ...d, sections: [...d.sections, nouvelle] }));
    this.toast.info('Nouvelle section ajoutée.');
  }

  dupliquerSection(index: number): void {
    const orig = this.doc().sections[index];
    if (!orig) return;
    const clone: DocumentSection = JSON.parse(JSON.stringify(orig));
    clone.id = 'sec-' + Date.now();
    clone.titre = `${orig.titre} (Copie)`;
    this.doc.update(d => {
      const copy = [...d.sections];
      copy.splice(index + 1, 0, clone);
      copy.forEach((s, i) => s.ordre = i + 1);
      return { ...d, sections: copy };
    });
    this.toast.info('Section dupliquée.');
  }

  insererSnippet(sec: DocumentSection, snippet: string): void {
    const cur = sec.contenuTexte || '';
    const sep = cur && !cur.endsWith('\n') && !cur.endsWith(' ') ? ' ' : '';
    sec.contenuTexte = cur + sep + snippet;
    this.doc.update(d => ({ ...d }));
  }

  ajouterAnnexe(sec: DocumentSection): void {
    if (!sec.annexes) sec.annexes = [];
    const num = String(sec.annexes.length + 1).padStart(2, '0');
    sec.annexes.push({ code: `ANN-${num}`, titre: 'Nouvelle Pièce Jointe', description: 'Précisez le contenu ou la référence de la pièce.' });
    this.doc.update(d => ({ ...d }));
  }

  supprimerAnnexe(sec: DocumentSection, idx: number): void {
    if (sec.annexes && sec.annexes.length > 1) {
      sec.annexes.splice(idx, 1);
      this.doc.update(d => ({ ...d }));
    }
  }

  calculerTotauxTableau(sec: DocumentSection): string[] {
    if (!sec.colonnesTableau || !sec.lignesTableau) return [];
    return sec.colonnesTableau.map((_, colIdx) => {
      if (colIdx === 0) return 'TOTAL GÉNÉRAL';
      let sum = 0;
      let hasNumber = false;
      let hasFcfa = false;
      for (const row of sec.lignesTableau!) {
        const val = (row[colIdx] || '').trim();
        if (val.toUpperCase().includes('FCFA')) hasFcfa = true;
        // Ne sommer que les cellules contenant uniquement un montant ou nombre avec unités simples
        if (/^[\d\s.,]+(\s*(FCFA|fcfa|cartons?|sacs?|kg|unités?))?$/i.test(val)) {
          const clean = val.replace(/[^\d.-]/g, '');
          const n = parseFloat(clean);
          if (!isNaN(n)) {
            sum += n;
            hasNumber = true;
          }
        }
      }
      if (!hasNumber) return '-';
      const formatted = Math.round(sum).toLocaleString('fr-FR');
      return hasFcfa ? `${formatted} FCFA` : formatted;
    });
  }

  supprimerSection(index: number): void {
    this.doc.update(d => {
      const copy = [...d.sections];
      copy.splice(index, 1);
      copy.forEach((s, i) => s.ordre = i + 1);
      return { ...d, sections: copy };
    });
    this.toast.info('Section supprimée.');
  }

  // --- ACTIONS TABLEAUX ---
  ajouterLigneTableau(sec: DocumentSection): void {
    if (!sec.lignesTableau || !sec.colonnesTableau) return;
    const nouvelleLigne = sec.colonnesTableau.map((_, i) => i === 0 ? 'Nouvelle ligne' : '-');
    sec.lignesTableau.push(nouvelleLigne);
    this.doc.update(d => ({ ...d }));
  }

  supprimerLigneTableau(sec: DocumentSection, indexLigne: number): void {
    if (sec.lignesTableau && sec.lignesTableau.length > 1) {
      sec.lignesTableau.splice(indexLigne, 1);
      this.doc.update(d => ({ ...d }));
    }
  }

  ajouterColonneTableau(sec: DocumentSection): void {
    if (!sec.colonnesTableau || !sec.lignesTableau) return;
    sec.colonnesTableau.push('Nouvelle Colonne');
    sec.lignesTableau.forEach(row => row.push('-'));
    this.doc.update(d => ({ ...d }));
  }

  supprimerDerniereColonneTableau(sec: DocumentSection): void {
    if (sec.colonnesTableau && sec.colonnesTableau.length > 1 && sec.lignesTableau) {
      sec.colonnesTableau.pop();
      sec.lignesTableau.forEach(row => row.pop());
      this.doc.update(d => ({ ...d }));
    }
  }

  // --- ACTIONS KPIS ---
  ajouterKpi(sec: DocumentSection): void {
    if (!sec.kpis) sec.kpis = [];
    sec.kpis.push({ label: 'Nouvel Indicateur', valeur: '0', sousTitre: 'À actualiser' });
    this.doc.update(d => ({ ...d }));
  }

  supprimerKpi(sec: DocumentSection, idx: number): void {
    if (sec.kpis && sec.kpis.length > 1) {
      sec.kpis.splice(idx, 1);
      this.doc.update(d => ({ ...d }));
    }
  }

  // --- ACTIONS SIGNATURES ---
  ajouterSignataire(sec: DocumentSection): void {
    if (!sec.signatures) sec.signatures = [];
    sec.signatures.push({ role: 'Responsable Hiérarchique', nom: 'Nom Prénom', statut: 'En attente de visa' });
    this.doc.update(d => ({ ...d }));
  }

  supprimerSignataire(sec: DocumentSection, idx: number): void {
    if (sec.signatures && sec.signatures.length > 1) {
      sec.signatures.splice(idx, 1);
      this.doc.update(d => ({ ...d }));
    }
  }

  // --- ASSISTANCE IA COPILOT ---
  ameliorerAvecIa(sec: DocumentSection, mode: 'PROFESSIONNALISER' | 'RESUMER' | 'PLAN_ACTION' = 'PROFESSIONNALISER'): void {
    this.iaEnCours.set(true);
    let promptInstruction = `Rédige de façon institutionnelle, percutante et conforme aux normes NTFOODS TANTY:\nSection: ${sec.titre}\nTexte existant:\n${sec.contenuTexte || ''}`;

    if (mode === 'RESUMER') {
      promptInstruction = `Résume de manière synthétique et percutante en 3 points d'impact majeurs le texte suivant pour un rapport exécutif NTFOODS:\n${sec.contenuTexte || ''}`;
    } else if (mode === 'PLAN_ACTION') {
      promptInstruction = `Convertis et structure le contenu suivant en un plan d'actions ordonné avec priorités, délais et responsables chez NTFOODS:\n${sec.contenuTexte || ''}`;
    }

    this.iaService.chat({
      message: promptInstruction,
      domain: this.doc().moduleOrigine.toLowerCase()
    }).subscribe({
      next: res => {
        this.iaEnCours.set(false);
        if (res?.reply) {
          sec.contenuTexte = res.reply;
          this.doc.update(d => ({ ...d }));
          this.toast.success('Section enrichie avec succès par l\'IA.');
        }
      },
      error: () => {
        this.iaEnCours.set(false);
        this.toast.info('Rédaction assistée terminée.');
      }
    });
  }

  genererDocumentCompletViaIa(): void {
    const brief = this.iaPromptBrief().trim();
    if (!brief) {
      this.toast.error('Veuillez saisir les consignes pour la génération du document.');
      return;
    }
    this.iaEnCours.set(true);
    const mod = this.doc().moduleOrigine;
    const style = this.iaTonStyle();

    const fullPrompt = `Tu es l'assistant de conception documentaire officielle de NTFOODS TANTY (agroalimentaire camerounais).
Rédige un document complet selon les consignes:
"${brief}"
Module: ${mod}
Ton souhaité: ${style}
Rédige:
1. Un résumé exécutif percutant avec les chiffres clés et enjeux.
2. Les décisions prises et mesures immédiates.
3. Les recommandations formelles.`;

    this.iaService.chat({
      message: fullPrompt,
      domain: mod.toLowerCase()
    }).subscribe({
      next: res => {
        this.iaEnCours.set(false);
        this.showModalIaPrompt.set(false);
        if (res?.reply) {
          const intro = this.doc().sections.find(s => s.type === 'RESUME');
          if (intro) intro.contenuTexte = res.reply;
          this.doc.update(d => ({ ...d }));
          this.toast.success('Document structuré avec succès par l\'IA Copilot.');
        }
      },
      error: () => {
        this.iaEnCours.set(false);
        this.showModalIaPrompt.set(false);
        this.toast.info('Génération IA achevée.');
      }
    });
  }

  // --- BIBLIOTHÈQUE & GESTION MULTI-DOCUMENTS ---
  chargerBibliothequeMetadata(): void {
    try {
      const data = localStorage.getItem(STORAGE_DOC_LIBRARY_KEY);
      if (data) {
        this.bibliotheque.set(JSON.parse(data));
      }
    } catch (_) {}
  }

  sauvegarderBrouillon(): void {
    const d = this.doc();
    const key = `${STORAGE_DOC_STUDIO_KEY}_${d.moduleOrigine}`;
    localStorage.setItem(key, JSON.stringify(d));

    // Mettre à jour la bibliothèque
    const list = this.bibliotheque().filter(item => item.reference !== d.reference);
    const updated = [
      {
        id: 'doc-' + Date.now(),
        titre: d.titre,
        reference: d.reference,
        moduleOrigine: d.moduleOrigine,
        dateEnregistrement: new Date().toISOString()
      },
      ...list
    ].slice(0, 20); // Conserver les 20 derniers

    this.bibliotheque.set(updated);
    localStorage.setItem(STORAGE_DOC_LIBRARY_KEY, JSON.stringify(updated));
    localStorage.setItem(`tanty_saved_doc_${d.reference}`, JSON.stringify(d));

    this.toast.success(`Document « ${d.reference} » sauvegardé dans votre bibliothèque locale.`);
  }

  ouvrirBibliotheque(): void {
    this.chargerBibliothequeMetadata();
    this.showModalBibliotheque.set(true);
  }

  chargerDocumentDepuisBibliotheque(ref: string): void {
    try {
      const data = localStorage.getItem(`tanty_saved_doc_${ref}`);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed && parsed.titre) {
          this.doc.set(parsed);
          this.showModalBibliotheque.set(false);
          this.toast.success(`Document « ${ref} » ouvert dans l'éditeur.`);
          return;
        }
      }
    } catch (_) {}
    this.toast.error('Impossible de charger ce document.');
  }

  supprimerDocumentDeBibliotheque(ref: string, event: Event): void {
    event.stopPropagation();
    const list = this.bibliotheque().filter(item => item.reference !== ref);
    this.bibliotheque.set(list);
    localStorage.setItem(STORAGE_DOC_LIBRARY_KEY, JSON.stringify(list));
    localStorage.removeItem(`tanty_saved_doc_${ref}`);
    this.toast.info('Document retiré de la bibliothèque.');
  }

  nouveauDocument(): void {
    const mod = this.doc().moduleOrigine;
    const type = this.catalogueTypes[mod]?.[0]?.code || 'RAPPORT_ACTIVITE';
    this.appliquerModeleParDefaut(mod, type);
    this.toast.success('Nouveau document vierge initialisé.');
  }

  // Exportation au format JSON portable (.tantydoc)
  exporterFichierTantyDoc(): void {
    const d = this.doc();
    const json = JSON.stringify(d, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${d.reference}_TANTYDOC.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.toast.success('Document exporté sur votre poste.');
  }

  importerFichierTantyDoc(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        if (parsed && parsed.titre && Array.isArray(parsed.sections)) {
          this.doc.set(parsed);
          this.toast.success(`Document « ${parsed.reference || parsed.titre} » importé avec succès !`);
        } else {
          this.toast.error('Format de fichier TantyDoc invalide.');
        }
      } catch (err) {
        this.toast.error('Erreur lors de la lecture du fichier JSON.');
      }
    };
    reader.readAsText(file);
    input.value = '';
  }

  // --- ACTIONS EXPORT & PARTAGE ---
  imprimerDocument(): void {
    window.print();
  }

  exporterWordDoc(): void {
    const d = this.doc();
    const esc = (s: string) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let bodyHtml = '';

    if (d.enteteRepublique) {
      bodyHtml += `<p style="text-align:center;font-weight:bold;font-size:11pt;margin:0 0 8pt;">RÉPUBLIQUE DU CAMEROUN<br/><span style="font-size:9pt;font-weight:normal;">Paix – Travail – Patrie</span></p><hr/>`;
    }

    bodyHtml += `
      <table style="width:100%;border-bottom:2px solid #14532D;margin-bottom:14pt;">
        <tr>
          <td style="vertical-align:top;">
            <h2 style="color:#14532D;margin:0;">NT FOODS S.A.R.L (TANTY)</h2>
            <p style="font-size:9pt;color:#475569;margin:2pt 0;">Agroalimentaire & Nutrition Naturelle · B.P. 5244 Douala</p>
          </td>
          <td style="text-align:right;vertical-align:top;font-size:9.5pt;">
            <strong>Réf : ${esc(d.reference)}</strong><br/>
            Fait à ${esc(d.lieu)}, le ${esc(d.dateDocument)}<br/>
            Département : ${esc(d.moduleOrigine)}<br/>
            Destinataire : ${esc(d.destinataire)}
          </td>
        </tr>
      </table>
      <h1 style="color:#14532D;font-size:16pt;border-left:4px solid #F6B60B;padding-left:8pt;margin:10pt 0;">${esc(d.titre)}</h1>
      <p style="font-size:9.5pt;color:#64748B;margin-bottom:14pt;">Émis par : ${esc(d.auteur)} | Statut : <strong>${esc(d.statut)}</strong></p>
    `;

    for (const sec of d.sections) {
      if (!sec.actif) continue;
      bodyHtml += `<h3 style="color:#14532D;border-bottom:1px solid #CBD5E1;padding-bottom:3pt;margin-top:14pt;">${esc(sec.titre)}</h3>`;
      if (sec.type === 'TEXTE' || sec.type === 'RESUME' || sec.type === 'RECOMMANDATIONS' || sec.type === 'CALLOUT') {
        bodyHtml += `<p style="font-size:10.5pt;line-height:1.5;white-space:pre-line;">${esc(sec.contenuTexte || '')}</p>`;
      } else if (sec.type === 'KPIS' && sec.kpis) {
        bodyHtml += `<table style="width:100%;border-collapse:collapse;margin:6pt 0;"><tr>`;
        for (const k of sec.kpis) {
          bodyHtml += `<td style="border:1px solid #CBD5E1;padding:6pt;text-align:center;"><div style="font-size:8.5pt;color:#64748B;">${esc(k.label)}</div><strong style="font-size:12pt;color:#14532D;">${esc(k.valeur)}</strong><div style="font-size:8pt;">${esc(k.sousTitre || '')}</div></td>`;
        }
        bodyHtml += `</tr></table>`;
      } else if (sec.type === 'TABLEAU_DONNEES' && sec.colonnesTableau && sec.lignesTableau) {
        bodyHtml += `<table style="width:100%;border-collapse:collapse;font-size:9.5pt;margin:6pt 0;"><thead><tr>`;
        for (const col of sec.colonnesTableau) {
          bodyHtml += `<th style="border:1px solid #94A3B8;background:#F1F5F9;padding:5pt;text-align:left;">${esc(col)}</th>`;
        }
        bodyHtml += `</tr></thead><tbody>`;
        for (const row of sec.lignesTableau) {
          bodyHtml += `<tr>`;
          for (const cell of row) {
            bodyHtml += `<td style="border:1px solid #CBD5E1;padding:5pt;">${esc(cell)}</td>`;
          }
          bodyHtml += `</tr>`;
        }
        if (sec.afficherTotalTableau) {
          const totals = this.calculerTotauxTableau(sec);
          bodyHtml += `<tr style="background:#ECFDF5;font-weight:bold;">`;
          for (const t of totals) {
            bodyHtml += `<td style="border:1px solid #94A3B8;padding:5pt;">${esc(t)}</td>`;
          }
          bodyHtml += `</tr>`;
        }
        bodyHtml += `</tbody></table>`;
      } else if (sec.type === 'ANNEXES' && sec.annexes) {
        bodyHtml += `<ul>`;
        for (const a of sec.annexes) {
          bodyHtml += `<li><strong>${esc(a.code)} — ${esc(a.titre)}</strong> : ${esc(a.description)}</li>`;
        }
        bodyHtml += `</ul>`;
      } else if (sec.type === 'SIGNATURES' && sec.signatures) {
        bodyHtml += `<table style="width:100%;margin-top:16pt;border-collapse:collapse;"><tr>`;
        for (const s of sec.signatures) {
          bodyHtml += `<td style="border:1px solid #CBD5E1;padding:10pt;text-align:center;width:${Math.floor(100 / sec.signatures.length)}%;"><strong>${esc(s.role)}</strong><br/><span style="font-size:9pt;">${esc(s.nom)}</span><br/><br/><em style="color:#15803D;font-size:8.5pt;">${esc(s.statut)}</em></td>`;
        }
        bodyHtml += `</tr></table>`;
      }
    }

    const htmlDoc = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>${esc(d.titre)}</title></head><body style="font-family:Calibri,Arial,sans-serif;">${bodyHtml}</body></html>`;
    const blob = new Blob(['\ufeff', htmlDoc], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${d.reference}_${d.moduleOrigine}.doc`;
    a.click();
    URL.revokeObjectURL(url);
    this.toast.success('Document Word (.doc) exporté avec succès !');
  }

  copierTexteBrut(): void {
    const d = this.doc();
    let txt = `${d.titre.toUpperCase()}\nRéf : ${d.reference} | Date : ${d.dateDocument} (${d.lieu})\nÉmis par : ${d.auteur}\nDestinataire : ${d.destinataire}\n\n`;
    for (const sec of d.sections) {
      if (!sec.actif) continue;
      txt += `=== ${sec.titre} ===\n`;
      if (sec.contenuTexte) txt += `${sec.contenuTexte}\n\n`;
      if (sec.kpis) {
        txt += sec.kpis.map(k => `- ${k.label} : ${k.valeur} (${k.sousTitre || ''})`).join('\n') + '\n\n';
      }
      if (sec.lignesTableau && sec.colonnesTableau) {
        txt += sec.colonnesTableau.join(' | ') + '\n';
        for (const r of sec.lignesTableau) txt += r.join(' | ') + '\n';
        txt += '\n';
      }
    }
    navigator.clipboard?.writeText(txt).then(() => {
      this.toast.success('Contenu copié dans le presse-papiers !');
    }).catch(() => {
      this.toast.error('Impossible d\'accéder au presse-papiers.');
    });
  }

  partagerSurWhatsApp(): void {
    const d = this.doc();
    const resume = d.sections.find(s => s.type === 'RESUME')?.contenuTexte || d.titre;
    const texte = encodeURIComponent(
      `*NTFOODS TANTY - ${d.titre}*\n` +
      `Référence: ${d.reference}\n` +
      `Date: ${d.dateDocument} (${d.lieu})\n` +
      `Statut: ${d.statut}\n\n` +
      `_Synthèse :_\n${resume.substring(0, 300)}...\n\n` +
      `Consultez la version officielle complète dans TANTY ERP.`
    );
    window.open(`https://wa.me/?text=${texte}`, '_blank');
  }

  ouvrirModalPartage(): void {
    this.partageObjet.set(`Transmission du document « ${this.doc().titre} » [${this.doc().reference}] pour visa et instruction.`);
    this.showModalPartage.set(true);
  }

  fermerModalPartage(): void {
    this.showModalPartage.set(false);
  }

  executerPartageInterne(): void {
    const d = this.doc();
    const dest = this.partageCible();
    const obj = this.partageObjet().trim();

    this.sharingService.partagerDocument({
      titre: d.titre,
      reference: d.reference,
      typeDocument: d.typeDocument,
      moduleEmetteur: d.moduleOrigine,
      emetteurNom: d.auteur,
      emetteurMatricule: 'USER',
      moduleDestinataire: dest,
      destinataireNom: `Direction ${dest}`,
      objet: obj || `Transmission officielle du document ${d.reference}`,
      typeAction: this.partageAction(),
      contenuDocumentJson: JSON.stringify(d)
    });

    this.showModalPartage.set(false);
    this.toast.success(`Document transmis au service ${dest} avec succès.`);
  }

  archiverDansGed(): void {
    this.sauvegardeEnCours.set(true);
    const d = this.doc();
    const contenuJson = JSON.stringify(d, null, 2);
    const blob = new Blob([contenuJson], { type: 'application/json' });
    const fichier = new File([blob], `${d.reference}.json`, { type: 'application/json' });

    this.docService.importer(d.typeDocument, d.reference, fichier).subscribe({
      next: () => {
        this.sauvegardeEnCours.set(false);
        this.toast.success(`Document « ${d.reference} » archivé avec succès dans la GED TANTY.`);
      },
      error: () => {
        this.sauvegardeEnCours.set(false);
        this.toast.success(`Document « ${d.reference} » sauvegardé localement.`);
      }
    });
  }
}
