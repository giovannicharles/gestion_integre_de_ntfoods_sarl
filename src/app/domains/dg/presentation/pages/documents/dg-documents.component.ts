import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface DocDG {
  id: string;
  reference: string;
  titre: string;
  categorie: 'Gouvernance' | 'Finance' | 'Juridique' | 'Stratégie';
  dateSignature: string;
  signataire: string;
  confidentialite: 'HAUTE' | 'RESTREINT_DG';
}

@Component({
  selector: 'app-dg-documents',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dg-documents.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DgDocumentsComponent {
  documents = signal<DocDG[]>([
    {
      id: 'DG-DOC-01',
      reference: 'PV-CA-2026/02',
      titre: 'Procès-Verbal du Conseil d’Administration - Clôture des Comptes 2025',
      categorie: 'Gouvernance',
      dateSignature: '28/01/2026',
      signataire: 'Président du Conseil d’Administration',
      confidentialite: 'RESTREINT_DG'
    },
    {
      id: 'DG-DOC-02',
      reference: 'RAPPORT-CAC-2025',
      titre: 'Rapport Général du Commissaire aux Comptes sur les États Financiers',
      categorie: 'Finance',
      dateSignature: '15/02/2026',
      signataire: 'Cabinet Audit & Conseil Cameroun (CAC)',
      confidentialite: 'HAUTE'
    },
    {
      id: 'DG-DOC-03',
      reference: 'CONV-INVEST-2026',
      titre: 'Convention de Financement Ligne de Crédit Campagne Agricole Batouri',
      categorie: 'Finance',
      dateSignature: '10/03/2026',
      signataire: 'Directeur Général & Afriland First Bank',
      confidentialite: 'RESTREINT_DG'
    },
    {
      id: 'DG-DOC-04',
      reference: 'CERT-ANOR-QUALITE',
      titre: 'Certificat de Conformité Sanitaire & Norme NC - Farines et Bouillies Tanty',
      categorie: 'Juridique',
      dateSignature: '04/01/2026',
      signataire: 'Agence des Normes et de la Qualité (ANOR)',
      confidentialite: 'HAUTE'
    }
  ]);
}
