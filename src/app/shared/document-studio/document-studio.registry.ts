import {
  DocumentSection,
  DocumentTypeOption,
  SectionType,
  StudioColorPreset,
  StudioFontOption,
  StudioModuleOption
} from './document-studio.models';

export const STUDIO_MODULES: StudioModuleOption[] = [
  { code: 'RP', label: 'Relations Publiques & Partenariats' },
  { code: 'DG', label: 'Direction Générale (DG)' },
  { code: 'STOCK', label: 'Gestion des Stocks & Logistique' },
  { code: 'COMMERCIAL', label: 'Commercial & Ventes' },
  { code: 'PRODUCTION', label: 'Production & Qualité Usine' },
  { code: 'COMPTABLE', label: 'Comptabilité & Trésorerie' },
  { code: 'CONTROLE', label: 'Contrôle Interne & Audit' },
  { code: 'SECRETAIRE', label: 'Secrétariat & Administration' },
  { code: 'ADMIN', label: 'Administration & Ressources Humaines' }
];

export const STUDIO_FONTS: StudioFontOption[] = [
  { label: 'Moderne Sans (Inter)', value: "'Inter', 'Segoe UI', system-ui, sans-serif" },
  { label: 'Classique Bureautique (Calibri)', value: "'Calibri', 'Segoe UI', Arial, sans-serif" },
  { label: 'Éditorial Prestige (Georgia)', value: "Georgia, 'Times New Roman', serif" },
  { label: 'Administratif (Times New Roman)', value: "'Times New Roman', Times, serif" },
  { label: 'Technique / Audit (Monospace)', value: "'Consolas', 'Courier New', monospace" }
];

export const STUDIO_FONT_SIZES: { label: string; value: string }[] = [
  { label: '11 pt (Compact)', value: '11px' },
  { label: '12 pt (Standard)', value: '12px' },
  { label: '13 pt (Confort)', value: '13px' },
  { label: '14 pt (Grand)', value: '14px' },
  { label: '15 pt (Présentation)', value: '15px' }
];

export const STUDIO_LINE_HEIGHTS: { label: string; value: string }[] = [
  { label: 'Serré (1.35)', value: '1.35' },
  { label: 'Standard (1.55)', value: '1.55' },
  { label: 'Aéré (1.8)', value: '1.8' }
];

export const STUDIO_COLORS: StudioColorPreset[] = [
  { label: 'Vert Forêt NTFOODS', hex: '#14532D' },
  { label: 'Or & Ambre TANTY', hex: '#B45309' },
  { label: 'Bleu Direction', hex: '#1E40AF' },
  { label: 'Ardoise Corporate', hex: '#1E293B' },
  { label: 'Bordeaux Prestige', hex: '#7F1D1D' },
  { label: 'Noir Classique', hex: '#111827' }
];

export const STUDIO_CATALOGUE_TYPES: Record<string, DocumentTypeOption[]> = {
  RP: [
    { code: 'RAPPORT_ACTIVITE', label: 'Rapport d\'Activité & Partenariats' },
    { code: 'CONVENTION_PARTENARIAT', label: 'Convention de Partenariat / Distribution' },
    { code: 'FICHE_GRAND_COMPTE', label: 'Fiche Audit & Suivi Grand Compte' },
    { code: 'COMMUNIQUE_OFFICIEL', label: 'Communiqué Officiel & Presse' },
    { code: 'COMPTE_RENDU_REUNION', label: 'Compte Rendu de Réunion Partenaire' }
  ],
  DG: [
    { code: 'RAPPORT_STRATEGIQUE', label: 'Rapport Stratégique Mensuel de Direction' },
    { code: 'NOTE_CADRAGE', label: 'Note de Cadrage & Décision Exécutive' },
    { code: 'NOTE_SERVICE_INTERNE', label: 'Note de Service Officielle au Personnel' },
    { code: 'PV_COMITE_DIRECTION', label: 'Procès-Verbal du Comité de Direction' }
  ],
  STOCK: [
    { code: 'PV_INVENTAIRE', label: 'Procès-Verbal d\'Inventaire Physique' },
    { code: 'ETAT_VALORISATION_STOCK', label: 'État de Valorisation & Alertes Rupture' },
    { code: 'FICHE_AVARIE_SORTIE', label: 'Procès-Verbal d\'Avarie ou Déclassement' },
    { code: 'BON_TRANSFERT_INTERNE', label: 'Bordereau de Transfert Inter-Magasins' }
  ],
  COMMERCIAL: [
    { code: 'PROPOSITION_COMMERCIALE', label: 'Proposition Commerciale & Tarifs Grossistes' },
    { code: 'BILAN_OBJECTIFS_VENTES', label: 'Bilan des Ventes & Atteinte d\'Objectifs' },
    { code: 'CONTRAT_DISTRIBUTION_ZONE', label: 'Contrat d\'Exclusivité / Zone Commerciale' },
    { code: 'PLAN_ANIMATION_MARCHE', label: 'Plan d\'Action & Promotion Terrain' }
  ],
  PRODUCTION: [
    { code: 'RAPPORT_PRODUCTION_LOT', label: 'Fiche de Synthèse & Traçabilité de Lot' },
    { code: 'CERTIFICAT_CONFORMITE_QUALITE', label: 'Attestation de Conformité & Qualité' },
    { code: 'BILAN_RENDEMENT_USINE', label: 'Bilan de Rendement & Pertes Matières' },
    { code: 'FICHE_MAINTENANCE_PREVENTIVE', label: 'Rapport d\'Intervention & Maintenance' }
  ],
  COMPTABLE: [
    { code: 'NOTE_TRESORERIE', label: 'Note de Trésorerie & Flux Financiers' },
    { code: 'ORDRE_DECAISSEMENT', label: 'Demande & Ordre de Décaissement Validé' },
    { code: 'RAPPORT_RAPPROCHEMENT', label: 'Rapport de Rapprochement Bancaire & Caisse' },
    { code: 'ETAT_CREANCES_CLIENTS', label: 'État des Créances & Recouvrements Clients' }
  ],
  CONTROLE: [
    { code: 'RAPPORT_AUDIT_INTERNE', label: 'Rapport d\'Audit Interne & Conformité' },
    { code: 'PV_CONTROLE_INOPINE', label: 'Procès-Verbal de Contrôle Inopiné' },
    { code: 'FICHE_ANOMALIE_ECART', label: 'Fiche de Signalement d\'Anomalie & Écart' }
  ],
  SECRETAIRE: [
    { code: 'COURRIER_OFFICIEL', label: 'Courrier Administratif Officiel' },
    { code: 'PV_REUNION_GENERALE', label: 'Procès-Verbal de Réunion / Assemblée' },
    { code: 'ATTESTATION_ADMINISTRATIVE', label: 'Attestation & Certification Interne' },
    { code: 'BORDEREAU_TRANSMISSION', label: 'Bordereau d\'Envoi & Transmission' }
  ],
  ADMIN: [
    { code: 'NOTE_AFFECTATION_RH', label: 'Décision d\'Affectation / Nomination' },
    { code: 'CONTRAT_TRAVAIL', label: 'Contrat de Travail & Engagement' },
    { code: 'ORDRE_DE_MISSION', label: 'Ordre de Mission Professionnelle' },
    { code: 'BILAN_GOUVERNANCE_SYSTEME', label: 'Rapport de Gouvernance & Sécurité ERP' }
  ]
};

export function createDefaultSection(type: SectionType, ordre: number): DocumentSection {
  const id = 'sec-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
  const titresMap: Record<SectionType, string> = {
    RESUME: 'Résumé Exécutif',
    TEXTE: 'Nouvelle Section Rédactionnelle',
    KPIS: 'Indicateurs Clés de Performance',
    TABLEAU_DONNEES: 'Tableau Récapitulatif Chiffré',
    CALLOUT: 'Point d\'Attention & Décision',
    RECOMMANDATIONS: 'Recommandations & Plan d\'Actions',
    SIGNATURES: 'Visas & Approbations Officielles',
    ANNEXES: 'Annexes & Pièces Jointes'
  };

  const sec: DocumentSection = {
    id,
    titre: titresMap[type] || 'Section',
    type,
    actif: true,
    ordre,
    alignement: 'left'
  };

  if (type === 'TEXTE' || type === 'RESUME' || type === 'RECOMMANDATIONS') {
    sec.contenuTexte = 'Cliquez ici pour rédiger directement votre texte officiel...';
  } else if (type === 'CALLOUT') {
    sec.calloutType = 'IMPORTANT';
    sec.contenuTexte = 'Saisissez ici une décision importante, une alerte ou une directive prioritaire...';
  } else if (type === 'KPIS') {
    sec.kpis = [
      { label: 'Indicateur 1', valeur: '100%', sousTitre: 'Conformité' },
      { label: 'Indicateur 2', valeur: '2 450 000 FCFA', sousTitre: 'Réalisation nette' }
    ];
  } else if (type === 'TABLEAU_DONNEES') {
    sec.colonnesTableau = ['Désignation', 'Quantité', 'Montant (FCFA)', 'Statut'];
    sec.lignesTableau = [
      ['Élément A', '10', '150 000 FCFA', 'Validé'],
      ['Élément B', '5', '85 000 FCFA', 'En cours']
    ];
    sec.afficherTotalTableau = true;
  } else if (type === 'SIGNATURES') {
    sec.signatures = [
      { role: 'Responsable Émetteur', nom: 'Nom Prénom', statut: 'Signé et visé' },
      { role: 'Direction Générale', nom: 'Directeur Général', statut: 'Approuvé' }
    ];
  } else if (type === 'ANNEXES') {
    sec.annexes = [
      { code: 'PJ-01', titre: 'Justificatif ou Bordereau', description: 'Document annexé au dossier officiel' }
    ];
  }

  return sec;
}

export function buildTemplateForModule(
  module: string,
  type: string,
  auteur: string
): { titre: string; reference: string; sections: DocumentSection[] } {
  const annee = new Date().getFullYear();
  const ref = `NTF-${module}-${annee}-${Math.floor(1000 + Math.random() * 9000)}`;
  const sections: DocumentSection[] = [];

  if (module === 'STOCK') {
    sections.push(
      {
        id: 'sec-intro',
        titre: '1. Contexte & Cadre de l\'Inventaire Physique',
        type: 'RESUME',
        actif: true,
        ordre: 1,
        contenuTexte: 'Le présent procès-verbal consigne le comptage contradictoire exhaustif des existants physiques en magasin central et magasin tampon de NT FOODS face aux soldes théoriques du progiciel.'
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
        id: 'sec-table',
        titre: '3. Tableau des Écarts & Rapprochement par Article',
        type: 'TABLEAU_DONNEES',
        actif: true,
        ordre: 3,
        afficherTotalTableau: false,
        colonnesTableau: ['Référence / Article', 'Stock Théorique', 'Stock Physique', 'Écart', 'Statut Contrôle'],
        lignesTableau: [
          ['Tapioca Sans Sable 1kg', '450 cartons', '448 cartons', '-2 cartons', 'Casse justifiée'],
          ['Bouillie Lion Infantile 500g', '320 cartons', '320 cartons', '0', 'Conforme'],
          ['Farine de Maïs Complète', '210 sacs', '210 sacs', '0', 'Conforme']
        ]
      },
      {
        id: 'sec-signatures',
        titre: '4. Visas & Signatures Contradictoires',
        type: 'SIGNATURES',
        actif: true,
        ordre: 4,
        signatures: [
          { role: 'Magasinier en Chef', nom: 'Gestionnaire de Stock', statut: 'Compté et certifié' },
          { role: 'Contrôle de Gestion', nom: 'Contrôleur Général', statut: 'Vérifié & Validé' },
          { role: 'Direction Générale', nom: 'Directeur Général', statut: 'Approuvé' }
        ]
      }
    );
    return { titre: 'Procès-Verbal d\'Inventaire Physique & Rapprochement de Stock', reference: ref, sections };
  }

  if (module === 'COMMERCIAL') {
    sections.push(
      {
        id: 'sec-intro',
        titre: '1. Présentation de l\'Offre & Cadre Commercial',
        type: 'RESUME',
        actif: true,
        ordre: 1,
        contenuTexte: 'NT FOODS SARL vous soumet ses conditions tarifaires officielles et barèmes de remises quantitatives pour la distribution de ses gammes : Tapioca Sans Sable, Bouillie Lion et Céréales Locales Fortifiées.'
      },
      {
        id: 'sec-table',
        titre: '2. Grille Tarifaire Officielle Grossistes & GMS',
        type: 'TABLEAU_DONNEES',
        actif: true,
        ordre: 2,
        afficherTotalTableau: true,
        colonnesTableau: ['Gamme / Produit', 'Conditionnement', 'Prix Unitaire (FCFA)', 'Prix Carton (FCFA)', 'Remise Palier'],
        lignesTableau: [
          ['Tapioca Sans Sable 1kg', 'Carton de 20 sachets', '750', '15 000', '12% dès 100 ctns'],
          ['Bouillie Lion Infantile 500g', 'Carton de 24 boîtes', '625', '15 000', '10% dès 80 ctns'],
          ['Farine Précuite de Plantain', 'Carton de 15 sachets', '900', '13 500', '8% dès 50 ctns']
        ]
      },
      {
        id: 'sec-signatures',
        titre: '3. Validation & Accord Commercial',
        type: 'SIGNATURES',
        actif: true,
        ordre: 3,
        signatures: [
          { role: 'Direction Commerciale', nom: 'Directeur Commercial', statut: 'Offre émise' },
          { role: 'Client Partenaire', nom: 'Représentant Légal', statut: 'Bon pour accord' }
        ]
      }
    );
    return { titre: 'Proposition Commerciale & Barème Tarifaire Partenaires', reference: ref, sections };
  }

  if (module === 'PRODUCTION') {
    sections.push(
      {
        id: 'sec-intro',
        titre: '1. Traçabilité & Synthèse du Lot de Fabrication',
        type: 'RESUME',
        actif: true,
        ordre: 1,
        contenuTexte: 'Le présent document atteste du déroulement conforme du cycle de fabrication industrielle du lot spécifié, depuis l\'incorporation des matières premières jusqu\'au conditionnement.'
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
        id: 'sec-signatures',
        titre: '3. Signatures de Libération de Lot',
        type: 'SIGNATURES',
        actif: true,
        ordre: 3,
        signatures: [
          { role: 'Chef Machiniste', nom: 'Responsable Salle', statut: 'Fabriqué' },
          { role: 'Contrôle Qualité', nom: 'Ingénieur Qualité', statut: 'Analysé & Validé' },
          { role: 'Chef de Production', nom: 'Directeur d\'Usine', statut: 'Lot libéré' }
        ]
      }
    );
    return { titre: 'Fiche de Traçabilité & Libération de Lot de Fabrication', reference: ref, sections };
  }

  if (module === 'COMPTABLE') {
    sections.push(
      {
        id: 'sec-intro',
        titre: '1. Synthèse de Trésorerie & Engagements Financiers',
        type: 'RESUME',
        actif: true,
        ordre: 1,
        contenuTexte: 'Le présent état financier récapitule les flux de trésorerie décaissés et encaissés au cours de la période, conformément aux normes OHADA.'
      },
      {
        id: 'sec-table',
        titre: '2. Détail des Décaissements par Imputation',
        type: 'TABLEAU_DONNEES',
        actif: true,
        ordre: 2,
        afficherTotalTableau: true,
        colonnesTableau: ['N° Pièce', 'Bénéficiaire', 'Nature de Dépense', 'Compte OHADA', 'Montant TTC (FCFA)'],
        lignesTableau: [
          ['DEC-2026-081', 'Fournisseur Emballage', 'Achat sacs 1kg imprimés', '6011 - Achats MP', '1 850 000 FCFA'],
          ['DEC-2026-082', 'Maintenance Usine', 'Réparation broyeur', '6241 - Entretien', '620 000 FCFA'],
          ['DEC-2026-083', 'Flotte Commerciale', 'Dotation carburant Yaoundé', '6053 - Carburant', '740 000 FCFA']
        ]
      },
      {
        id: 'sec-signatures',
        titre: '3. Visas Comptables & Approbation Trésorerie',
        type: 'SIGNATURES',
        actif: true,
        ordre: 3,
        signatures: [
          { role: 'Comptable Trésorier', nom: 'Comptable NT Foods', statut: 'Établi & Rapproché' },
          { role: 'Contrôle de Gestion', nom: 'Contrôleur Général', statut: 'Vérifié' },
          { role: 'Direction Générale', nom: 'Directeur Général', statut: 'Ordonnancé' }
        ]
      }
    );
    return { titre: 'Note Explicative de Trésorerie & Ordonnancement', reference: ref, sections };
  }

  if (module === 'CONTROLE') {
    sections.push(
      {
        id: 'sec-intro',
        titre: '1. Périmètre de l\'Audit & Constats Généraux',
        type: 'RESUME',
        actif: true,
        ordre: 1,
        contenuTexte: 'La mission de contrôle interne a vérifié la conformité des opérations physiques, comptables et documentaires au regard des procédures NT FOODS SARL.'
      },
      {
        id: 'sec-callout',
        titre: 'Point Critique Relevé',
        type: 'CALLOUT',
        calloutType: 'ALERTE',
        actif: true,
        ordre: 2,
        contenuTexte: 'Tout écart constaté doit faire l\'objet d\'une régularisation documentée sous 48 heures ouvrées.'
      },
      {
        id: 'sec-recommandations',
        titre: '2. Plan de Mise en Conformité',
        type: 'RECOMMANDATIONS',
        actif: true,
        ordre: 3,
        contenuTexte: '1. Renforcer le double pointage à la sortie magasin.\n2. Archiver systématiquement les bons signés dans la GED.\n3. Planifier un contrôle inopiné sous 15 jours.'
      },
      {
        id: 'sec-signatures',
        titre: '3. Visas d\'Audit',
        type: 'SIGNATURES',
        actif: true,
        ordre: 4,
        signatures: [
          { role: 'Auditeur / Contrôleur', nom: auteur, statut: 'Constaté et certifié' },
          { role: 'Direction Générale', nom: 'Directeur Général', statut: 'Pris connaissance' }
        ]
      }
    );
    return { titre: 'Rapport d\'Audit Interne & Contrôle de Conformité', reference: ref, sections };
  }

  if (module === 'SECRETAIRE') {
    sections.push(
      {
        id: 'sec-intro',
        titre: 'Objet & Exposé',
        type: 'TEXTE',
        actif: true,
        ordre: 1,
        contenuTexte: 'Madame, Monsieur,\n\nNous avons l\'honneur de porter à votre connaissance les dispositions officielles arrêtées par la Direction de NT FOODS SARL concernant le dossier cité en référence.'
      },
      {
        id: 'sec-annexes',
        titre: 'Pièces Jointes au Courrier',
        type: 'ANNEXES',
        actif: true,
        ordre: 2,
        annexes: [
          { code: 'PJ-01', titre: 'Copie du bordereau officiel', description: 'Document certifié conforme' }
        ]
      },
      {
        id: 'sec-signatures',
        titre: 'Signature Officielle',
        type: 'SIGNATURES',
        actif: true,
        ordre: 3,
        signatures: [
          { role: 'Secrétariat de Direction', nom: auteur, statut: 'Émis' },
          { role: 'Direction Générale', nom: 'Directeur Général', statut: 'Approuvé' }
        ]
      }
    );
    return { titre: 'Courrier Administratif Officiel NT Foods', reference: ref, sections };
  }

  // Défaut structuré pour RP / DG / ADMIN
  const titresParType: Record<string, string> = {
    CONVENTION_PARTENARIAT: 'Convention Cadre de Référencement & Distribution GMS',
    FICHE_GRAND_COMPTE: 'Fiche d\'Audit & de Suivi Partenaire VIP',
    COMMUNIQUE_OFFICIEL: 'Communiqué Officiel NT FOODS SARL',
    COMPTE_RENDU_REUNION: 'Compte Rendu Officiel de Réunion',
    RAPPORT_STRATEGIQUE: 'Rapport Stratégique Mensuel de Direction Générale',
    NOTE_CADRAGE: 'Note de Cadrage Stratégique & Arbitrage Direction',
    NOTE_SERVICE_INTERNE: 'Note de Service Officielle au Personnel',
    PV_COMITE_DIRECTION: 'Procès-Verbal du Comité de Direction',
    ORDRE_DE_MISSION: 'Ordre de Mission Professionnelle & Frais de Séjour',
    CONTRAT_TRAVAIL: 'Contrat de Travail & Engagement Collaborateur',
    NOTE_AFFECTATION_RH: 'Décision d\'Affectation & Organisation Interne',
    BILAN_GOUVERNANCE_SYSTEME: 'Rapport de Gouvernance & Sécurité ERP'
  };

  sections.push(
    {
      id: 'sec-intro',
      titre: '1. Contexte & Résumé Exécutif',
      type: 'RESUME',
      actif: true,
      ordre: 1,
      contenuTexte: 'Le présent document synthétise les orientations, résultats opérationnels et décisions arrêtées au sein de NT FOODS SARL. Cliquez directement sur ce texte pour le personnaliser.'
    },
    {
      id: 'sec-kpis',
      titre: '2. Indicateurs Clés de Réalisation',
      type: 'KPIS',
      actif: true,
      ordre: 2,
      kpis: [
        { label: 'Taux de Conformité', valeur: '94%', sousTitre: 'Objectif atteint' },
        { label: 'Dossiers Traités', valeur: '128 dossiers', sousTitre: 'Dans les délais' },
        { label: 'Impact Budgétaire', valeur: 'Maîtrisé', sousTitre: 'Écart < 2%' }
      ]
    },
    {
      id: 'sec-table',
      titre: '3. Tableau Récapitulatif des Opérations',
      type: 'TABLEAU_DONNEES',
      actif: true,
      ordre: 3,
      afficherTotalTableau: false,
      colonnesTableau: ['Intitulé Opération', 'Service Responsable', 'Échéance', 'Statut'],
      lignesTableau: [
        ['Coordination logistique & livraisons', 'Logistique & Commercial', 'Fin de mois', 'En cours'],
        ['Suivi conventions partenaires', 'Relations Publiques', '15 du mois', 'Validé'],
        ['Clôture comptable mensuelle', 'Comptabilité', 'Hebdomadaire', 'À jour']
      ]
    },
    {
      id: 'sec-recommandations',
      titre: '4. Recommandations & Plan d\'Actions',
      type: 'RECOMMANDATIONS',
      actif: true,
      ordre: 4,
      contenuTexte: '1. Transmettre les rapports d\'étape chaque vendredi avant 17h00.\n2. Centraliser les pièces justificatives dans TANTY ERP.'
    },
    {
      id: 'sec-signatures',
      titre: '5. Visas & Approbations Officielles',
      type: 'SIGNATURES',
      actif: true,
      ordre: 5,
      signatures: [
        { role: 'Responsable Émetteur', nom: auteur, statut: 'Signé et visé' },
        { role: 'Direction Générale', nom: 'Directeur Général NT Foods', statut: 'Approuvé pour exécution' }
      ]
    }
  );

  return {
    titre: titresParType[type] || 'Rapport d\'Activité Institutionnel NT Foods',
    reference: ref,
    sections
  };
}
