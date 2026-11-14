import { Component, ChangeDetectionStrategy, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { DocumentService } from '../../domains/shared/infrastructure/document.service';
import { DocumentSharingService } from '../document-sharing/document-sharing.service';
import { IaService } from '../../core/services/ia.service';
import { ToastService } from '../../core/services/toast.service';
import { fCFA } from '../utils/format.utils';

export interface DocumentSection {
  id: string;
  titre: string;
  type: 'TEXTE' | 'RESUME' | 'TABLEAU_DONNEES' | 'KPIS' | 'RECOMMANDATIONS' | 'SIGNATURES' | 'CALLOUT';
  actif: boolean;
  ordre: number;
  contenuTexte?: string;
  calloutType?: 'INFO' | 'IMPORTANT' | 'RECOMMANDATION' | 'DECISION' | 'ALERTE';
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
  private readonly sharingService = inject(DocumentSharingService);
  private readonly iaService = inject(IaService);
  private readonly toast = inject(ToastService);

  vueActive = signal<'EDITEUR' | 'PREVIEW'>('EDITEUR');
  iaEnCours = signal(false);
  sauvegardeEnCours = signal(false);

  // Modal IA Générateur Complet
  showModalIaPrompt = signal(false);
  iaPromptBrief = signal('');

  // Modal Partage Interne Rapide
  showModalPartage = signal(false);
  partageCible = signal('DG');
  partageObjet = signal('');
  partageAction = signal<'POUR_VISA_SIGNATURE' | 'POUR_INFORMATION' | 'POUR_VALIDATION'>('POUR_VISA_SIGNATURE');

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
        id: 'sec-callout',
        titre: 'Point Clé & Décision Stratégique',
        type: 'CALLOUT',
        calloutType: 'IMPORTANT',
        actif: true,
        ordre: 3,
        contenuTexte: 'Accord cadre finalisé avec DOVV Yaoundé : réapprovisionnement automatique fixé au mardi matin avec engagement de présence permanente en tête de gondole.'
      },
      {
        id: 'sec-table',
        titre: '3. Tableau Consolidé des Réalisations',
        type: 'TABLEAU_DONNEES',
        actif: true,
        ordre: 4,
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
        ordre: 5,
        contenuTexte: '1. Sécuriser les approvisionnements des têtes de gondole pour les fêtes de fin d\'année.\n2. Renforcer les équipes d\'hôtesses sur les sites Carrefour le week-end.\n3. Maintenir le barème de remise VIP à 15% pour les volumes excédant 500 cartons mensuels.'
      },
      {
        id: 'sec-signatures',
        titre: '5. Visas & Approbations Officielles',
        type: 'SIGNATURES',
        actif: true,
        ordre: 6,
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

  ajouterNouvelleSection(type: DocumentSection['type'] = 'TEXTE'): void {
    const nouvelle: DocumentSection = {
      id: 'sec-' + Date.now(),
      titre: type === 'CALLOUT' ? 'Encadré Spécial' : 'Nouvelle Section Personnalisée',
      type,
      actif: true,
      ordre: this.doc().sections.length + 1,
      contenuTexte: 'Saisissez ici le texte ou les éléments spécifiques à inclure dans cette section.',
      calloutType: 'IMPORTANT'
    };
    if (type === 'TABLEAU_DONNEES') {
      nouvelle.colonnesTableau = ['Désignation', 'Quantité', 'Prix Unitaire', 'Total FCFA'];
      nouvelle.lignesTableau = [
        ['Tapioca Sans Sable 1kg', '100 cartons', '15 000 FCFA', '1 500 000 FCFA'],
        ['Bouillie Lion Infantile', '80 cartons', '14 000 FCFA', '1 120 000 FCFA']
      ];
    } else if (type === 'KPIS') {
      nouvelle.kpis = [
        { label: 'Objectif Atteint', valeur: '100%', sousTitre: 'Réalisé' },
        { label: 'Volume Total', valeur: '500 cartons', sousTitre: 'Expédié' }
      ];
    }
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

  // --- ACTIONS DE MODIFICATION DE TABLEAU ---
  ajouterLigneTableau(sec: DocumentSection): void {
    if (!sec.lignesTableau || !sec.colonnesTableau) return;
    const nouvelleLigne = sec.colonnesTableau.map(() => 'Nouvelle valeur');
    sec.lignesTableau.push(nouvelleLigne);
    this.doc.update(d => ({ ...d }));
  }

  supprimerDerniereLigneTableau(sec: DocumentSection): void {
    if (sec.lignesTableau && sec.lignesTableau.length > 1) {
      sec.lignesTableau.pop();
      this.doc.update(d => ({ ...d }));
    }
  }

  // --- ASSISTANT IA CRÉATIF ET INNOVANT ---
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
          this.toast.success('Section enrichie avec l\'IA.');
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
    const module = this.doc().moduleOrigine;

    const fullPrompt = `Tu es l'assistant de conception documentaire de NTFOODS TANTY.
Rédige un document complet selon les consignes suivantes:
"${brief}"
Module: ${module}
Réponds avec un résumé exécutif percutant, un jeu de 3 recommandations clés et des décisions officielles.`;

    this.iaService.chat({
      message: fullPrompt,
      domain: module.toLowerCase()
    }).subscribe({
      next: res => {
        this.iaEnCours.set(false);
        this.showModalIaPrompt.set(false);
        if (res?.reply) {
          const intro = this.doc().sections.find(s => s.type === 'RESUME');
          if (intro) intro.contenuTexte = res.reply;
          this.doc.update(d => ({ ...d }));
          this.toast.success('Document rédigé avec succès par l\'IA.');
        }
      },
      error: () => {
        this.iaEnCours.set(false);
        this.showModalIaPrompt.set(false);
        this.toast.info('Génération IA finalisée.');
      }
    });
  }

  // --- ACTIONS D'EXPORTATION & PARTAGE ---
  imprimerDocument(): void {
    window.print();
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
