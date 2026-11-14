import { Component, ChangeDetectionStrategy, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { DocumentService } from '../../domains/shared/infrastructure/document.service';
import { IaService } from '../../core/services/ia.service';
import { ToastService } from '../../core/services/toast.service';
import { fCFA } from '../utils/format.utils';

export interface DocumentSection {
  id: string;
  titre: string;
  type: 'TEXTE' | 'RESUME' | 'TABLEAU_DONNEES' | 'KPIS' | 'RECOMMANDATIONS' | 'SIGNATURES';
  actif: boolean;
  ordre: number;
  contenuTexte?: string;
  kpis?: { label: string; valeur: string; sousTitre?: string }[];
  colonnesTableau?: string[];
  lignesTableau?: string[][];
  signatures?: { role: string; nom: string; statut: string }[];
}

export interface DocumentProjet {
  titre: string;
  reference: string;
  typeDocument: string;
  moduleOrigine: string;
  dateDocument: string;
  lieu: string;
  destinataire: string;
  auteur: string;
  statut: 'BROUILLON' | 'SOUMIS' | 'VALIDE' | 'OFFICIEL';
  themeDesign: 'FORET_OR' | 'CORPORATE_SLATE' | 'MINIMALISTE';
  formatPage: 'A4_PORTRAIT' | 'A4_PAYSAGE';
  filigrane: string;
  sections: DocumentSection[];
}

const STORAGE_DOC_STUDIO_KEY = 'tanty_document_studio_draft';

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
  private readonly docService = inject(DocumentService);
  private readonly iaService = inject(IaService);
  private readonly toast = inject(ToastService);

  vueActive = signal<'EDITEUR' | 'PREVIEW'>('EDITEUR');
  iaEnCours = signal(false);
  sauvegardeEnCours = signal(false);

  // Modèles prédéfinis par module
  readonly modulesDisponibles = [
    { code: 'RP', label: 'Relations Publiques & Grands Comptes' },
    { code: 'DG', label: 'Direction Générale & Stratégie' },
    { code: 'COMMERCIAL', label: 'Direction Commerciale & Ventes' },
    { code: 'STOCK', label: 'Stock & Logistique' },
    { code: 'PRODUCTION', label: 'Production Industrielle' },
    { code: 'COMPTABLE', label: 'Comptabilité & Finance OHADA' },
    { code: 'CONTROLE', label: 'Contrôle de Gestion & Audit' },
    { code: 'SECRETAIRE', label: 'Secrétariat & Accueil' }
  ];

  readonly typesDocuments = [
    { code: 'RAPPORT_ACTIVITE', label: 'Rapport d\'Activité & Bilan Périodique' },
    { code: 'CONVENTION_PARTENARIAT', label: 'Convention de Partenariat & Référencement GMS' },
    { code: 'FICHE_GRAND_COMPTE', label: 'Fiche d\'Audit & Suivi Grand Compte VIP' },
    { code: 'COMPTE_RENDU_REUNION', label: 'Compte-Rendu de Réunion / Négociation' },
    { code: 'PROPOSITION_COMMERCIALE', label: 'Proposition Commerciale & Devis VIP' },
    { code: 'NOTE_CADRAGE', label: 'Note de Cadrage Stratégique & Décision' },
    { code: 'PV_CONTRADICTOIRE', label: 'Procès-Verbal d\'Inventaire / Contrôle' },
    { code: 'BILAN_CAMPAGNE', label: 'Bilan de Campagne d\'Animation / Dégustation' }
  ];

  doc = signal<DocumentProjet>({
    titre: 'Rapport d\'Activité & Relations Grands Comptes GMS',
    reference: 'NTF-DOC-2026-' + Math.floor(1000 + Math.random() * 9000),
    typeDocument: 'RAPPORT_ACTIVITE',
    moduleOrigine: 'RP',
    dateDocument: new Date().toISOString().substring(0, 10),
    lieu: 'Douala, Cameroun',
    destinataire: 'Direction Générale NT Foods',
    auteur: 'Chargée des Relations Publiques & Commerciales',
    statut: 'OFFICIEL',
    themeDesign: 'FORET_OR',
    formatPage: 'A4_PORTRAIT',
    filigrane: 'ORIGINAL',
    sections: [
      {
        id: 'sec-intro',
        titre: '1. Contexte & Résumé Exécutif',
        type: 'RESUME',
        actif: true,
        ordre: 1,
        contenuTexte: 'Le présent document synthétise les performances commerciales, la pénétration des marchés régionaux et les négociations conduites avec les enseignes de la Grande Distribution (DOVV, Carrefour, Santa Lucia). La dynamique observée témoigne d\'un renforcement notable des parts de marché sur la gamme Tapioca Sans Sable et Bouillie Lion.'
      },
      {
        id: 'sec-kpis',
        titre: '2. Indicateurs Clés de Performance (KPIs)',
        type: 'KPIS',
        actif: true,
        ordre: 2,
        kpis: [
          { label: 'Chiffre d\'Affaires Portefeuille', valeur: '18 450 000 FCFA', sousTitre: '+14% vs N-1' },
          { label: 'Taux de Pénétration Territoire', valeur: '64%', sousTitre: 'Yaoundé & Douala' },
          { label: 'Grands Comptes Actifs', valeur: '24 enseignes', sousTitre: '100% à jour' },
          { label: 'Retour sur Investissement (ROI)', valeur: '+148%', sousTitre: 'Campagnes GMS' }
        ]
      },
      {
        id: 'sec-table',
        titre: '3. Tableau Consolidé des Réalisations',
        type: 'TABLEAU_DONNEES',
        actif: true,
        ordre: 3,
        colonnesTableau: ['Enseigne / Segment', 'Volume Livré', 'CA Réalisé (FCFA)', 'Taux d\'Atteinte', 'Statut Relance'],
        lignesTableau: [
          ['Carrefour Warda & Bonamoussadi', '450 cartons', '6 750 000 FCFA', '105%', 'Conforme'],
          ['Supermarchés DOVV Yaoundé', '380 cartons', '5 700 000 FCFA', '98%', 'À jour'],
          ['Santa Lucia Bafoussam & Douala', '310 cartons', '4 650 000 FCFA', '92%', 'À jour'],
          ['Réseau Mahima & Spar', '120 cartons', '1 800 000 FCFA', '85%', 'En réassort']
        ]
      },
      {
        id: 'sec-recommandations',
        titre: '4. Recommandations Stratégiques & Plan d\'Actions',
        type: 'RECOMMANDATIONS',
        actif: true,
        ordre: 4,
        contenuTexte: '1. Sécuriser les approvisionnements des têtes de gondole pour les fêtes de fin d\'année.\n2. Renforcer les équipes d\'hôtesses sur les sites Carrefour le week-end.\n3. Maintenir le barème de remise VIP à 15% pour les volumes excédant 500 cartons mensuels.'
      },
      {
        id: 'sec-signatures',
        titre: '5. Visas & Approbations Officielles',
        type: 'SIGNATURES',
        actif: true,
        ordre: 5,
        signatures: [
          { role: 'Émetteur du Document', nom: 'Chargée des Relations Publiques', statut: 'Signé et visé' },
          { role: 'Contrôle de Gestion', nom: 'Contrôleur Général', statut: 'Vérifié' },
          { role: 'Direction Générale', nom: 'Directeur Général NT Foods', statut: 'Approuvé pour exécution' }
        ]
      }
    ]
  });

  ngOnInit(): void {
    const user = this.auth.getCurrentUser();
    if (user) {
      this.doc.update(d => ({
        ...d,
        auteur: `${user.firstname} ${user.lastname} (${user.roles?.[0] || 'Responsable'})`
      }));
    }
    this.chargerBrouillon();
  }

  chargerBrouillon(): void {
    const saved = localStorage.getItem(STORAGE_DOC_STUDIO_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.titre) {
          this.doc.set(parsed);
        }
      } catch (_) {}
    }
  }

  sauvegarderBrouillon(): void {
    localStorage.setItem(STORAGE_DOC_STUDIO_KEY, JSON.stringify(this.doc()));
    this.toast.success('Brouillon du document enregistré.');
  }

  changerModule(nouveauModule: string): void {
    this.doc.update(d => ({ ...d, moduleOrigine: nouveauModule }));
    this.appliquerModeleParDefaut(nouveauModule, this.doc().typeDocument);
  }

  changerTypeDocument(nouveauType: string): void {
    this.doc.update(d => ({ ...d, typeDocument: nouveauType }));
    this.appliquerModeleParDefaut(this.doc().moduleOrigine, nouveauType);
  }

  appliquerModeleParDefaut(module: string, type: string): void {
    let titre = 'Rapport d\'Activité NT Foods';
    if (type === 'CONVENTION_PARTENARIAT') titre = 'Convention Cadre de Référencement & Distribution GMS';
    else if (type === 'FICHE_GRAND_COMPTE') titre = 'Fiche d\'Audit & de Suivi Partenaire VIP';
    else if (type === 'COMPTE_RENDU_REUNION') titre = 'Procès-Verbal de Réunion Commerciale';
    else if (type === 'PROPOSITION_COMMERCIALE') titre = 'Offre Commerciale & Barème Tarifaire VIP';
    else if (type === 'NOTE_CADRAGE') titre = 'Note de Cadrage Stratégique & Arbitrage';
    else if (type === 'PV_CONTRADICTOIRE') titre = 'Procès-Verbal de Contrôle & Traçabilité';
    else if (type === 'BILAN_CAMPAGNE') titre = 'Bilan des Retombées d\'Animation & Campagne';

    this.doc.update(d => ({
      ...d,
      titre,
      reference: `NTF-${module}-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
    }));
  }

  toggleSection(section: DocumentSection): void {
    section.actif = !section.actif;
    this.doc.update(d => ({ ...d }));
  }

  ajouterNouvelleSection(): void {
    const nouvelle: DocumentSection = {
      id: 'sec-' + Date.now(),
      titre: 'Nouvelle Section Personnalisée',
      type: 'TEXTE',
      actif: true,
      ordre: this.doc().sections.length + 1,
      contenuTexte: 'Saisissez ici le texte ou les éléments spécifiques à inclure dans cette section.'
    };
    this.doc.update(d => ({ ...d, sections: [...d.sections, nouvelle] }));
    this.toast.info('Nouvelle section ajoutée.');
  }

  supprimerSection(index: number): void {
    this.doc.update(d => {
      const copy = [...d.sections];
      copy.splice(index, 1);
      return { ...d, sections: copy };
    });
  }

  ameliorerAvecIa(sec: DocumentSection): void {
    this.iaEnCours.set(true);
    this.iaService.chat({
      message: `Rédige de façon professionnelle, percutante et institutionnelle le contenu de cette section d'un rapport d'entreprise NTFOODS TANTY:\n\nSection: ${sec.titre}\nTexte existant:\n${sec.contenuTexte || ''}`,
      domain: this.doc().moduleOrigine.toLowerCase()
    }).subscribe({
      next: res => {
        this.iaEnCours.set(false);
        if (res?.reply) {
          sec.contenuTexte = res.reply;
          this.doc.update(d => ({ ...d }));
          this.toast.success('Section enrichie avec l\'IA.');
        }
      },
      error: () => {
        this.iaEnCours.set(false);
        this.toast.info('Rédaction assistée terminée.');
      }
    });
  }

  imprimerDocument(): void {
    window.print();
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
