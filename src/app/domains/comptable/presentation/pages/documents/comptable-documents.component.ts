import { Component, ChangeDetectionStrategy, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../../../../core/services/toast.service';
import { fCFA } from '../../../../../shared/utils/format.utils';

interface DocumentComptable {
  id: number;
  numeroPiece: string;
  titre: string;
  type: 'FACTURE_FOURNISSEUR' | 'RELEVE_BANCAIRE' | 'BORDEREAU_CAISSE' | 'DECLARATION_FISCALE' | 'GRAND_LIVRE';
  compteOhada: string;
  banqueOuTiers: string;
  dateOperation: string;
  montant: number;
  statut: 'COMPTABILISE' | 'RAPPROCHE' | 'A_VERIFIER';
  fichier: string;
}

@Component({
  selector: 'app-comptable-documents',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './comptable-documents.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ComptableDocumentsComponent implements OnInit {
  fCFA = fCFA;

  filtreType = signal<string>('TOUS');
  rechercheTexte = signal<string>('');

  documents = signal<DocumentComptable[]>([
    {
      id: 1,
      numeroPiece: 'PC-2026-0041',
      titre: 'Relevé Mensuel Octobre 2026 - Compte Courant Afriland First Bank',
      type: 'RELEVE_BANCAIRE',
      compteOhada: '521100 - Afriland First Bank Douala',
      banqueOuTiers: 'Afriland First Bank',
      dateOperation: '2026-10-31',
      montant: 48500000,
      statut: 'RAPPROCHE',
      fichier: 'Releve_Afriland_Octobre_2026.pdf'
    },
    {
      id: 2,
      numeroPiece: 'FF-2026-0189',
      titre: 'Facture Fournisseur Matières Premières - Tapioca Brut Batouri',
      type: 'FACTURE_FOURNISSEUR',
      compteOhada: '401100 - Coopérative Planteurs Est',
      banqueOuTiers: 'GIC Planteurs de Manioc de Batouri',
      dateOperation: '2026-11-04',
      montant: 6500000,
      statut: 'COMPTABILISE',
      fichier: 'Facture_GIC_Planteurs_Manioc_0189.pdf'
    },
    {
      id: 3,
      numeroPiece: 'BC-2026-0512',
      titre: 'Bordereau Récapitulatif Clôture Caisse Siège Yaoundé Semaine 44',
      type: 'BORDEREAU_CAISSE',
      compteOhada: '571100 - Caisse Centrale Siège',
      banqueOuTiers: 'Caisse Principale NTFOODS',
      dateOperation: '2026-11-08',
      montant: 14200000,
      statut: 'COMPTABILISE',
      fichier: 'Bordereau_Caisse_Siege_S44_2026.pdf'
    },
    {
      id: 4,
      numeroPiece: 'DF-2026-M10',
      titre: 'Quittance Télédéclaration DGI - TVA & Précompte sur Achats M10',
      type: 'DECLARATION_FISCALE',
      compteOhada: '443100 - État, TVA Facturée',
      banqueOuTiers: 'Direction Générale des Impôts (DGI)',
      dateOperation: '2026-11-10',
      montant: 3820000,
      statut: 'RAPPROCHE',
      fichier: 'Quittance_DGI_TVA_M10_2026.pdf'
    },
    {
      id: 5,
      numeroPiece: 'GL-2026-T3',
      titre: 'Grand Livre Général des Comptes - 3ème Trimestre 2026',
      type: 'GRAND_LIVRE',
      compteOhada: 'Comptabilité Générale OHADA',
      banqueOuTiers: 'Cabinet Audit & Commissariat',
      dateOperation: '2026-10-05',
      montant: 185000000,
      statut: 'COMPTABILISE',
      fichier: 'Grand_Livre_General_T3_2026.pdf'
    },
    {
      id: 6,
      numeroPiece: 'FF-2026-0192',
      titre: 'Facture Emballages & Bobines Polypropylène Tanty',
      type: 'FACTURE_FOURNISSEUR',
      compteOhada: '401200 - Plastiques du Cameroun',
      banqueOuTiers: 'SOCAPLAST Douala',
      dateOperation: '2026-11-09',
      montant: 3450000,
      statut: 'A_VERIFIER',
      fichier: 'Facture_SOCAPLAST_Bobines_0192.pdf'
    }
  ]);

  constructor(private toast: ToastService) {}

  ngOnInit(): void {}

  telecharger(doc: DocumentComptable): void {
    this.toast.info(`Téléchargement de « ${doc.fichier} » initié.`);
  }

  listeFiltree(): DocumentComptable[] {
    const t = this.filtreType();
    const q = this.rechercheTexte().trim().toLowerCase();
    return this.documents().filter(d => {
      const matchType = t === 'TOUS' || d.type === t;
      const matchTxt = !q || d.titre.toLowerCase().includes(q) || d.numeroPiece.toLowerCase().includes(q) || d.banqueOuTiers.toLowerCase().includes(q);
      return matchType && matchTxt;
    });
  }
}

