import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface DocControle {
  id: string;
  titre: string;
  type: string;
  periode: string;
  description: string;
  taille: string;
}

@Component({
  selector: 'app-controle-documents',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './controle-documents.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ControleDocumentsComponent {
  documents = signal<DocControle[]>([
    {
      id: 'DOC-CG-01',
      titre: 'Lettre de Cadrage Budgétaire Exercice 2026',
      type: 'Directive',
      periode: 'Exercice 2026',
      description: 'Plafonds d’engagement par département, règles d’arbitrage des dépenses d’investissement et seuils de visa DG.',
      taille: '1.2 Mo'
    },
    {
      id: 'DOC-CG-02',
      titre: 'Procédure Standard de Contrôle des Réceptions Matières Premières',
      type: 'Procédure',
      periode: 'Permanente',
      description: 'Protocole de double contrôle contradictoire (Magasinier + Contrôle de Gestion) pour le soja, maïs et emballages.',
      taille: '840 Ko'
    },
    {
      id: 'DOC-CG-03',
      titre: 'Fiche d’Audit des Consommations Carburant Flotte Commerciale',
      type: 'Audit',
      periode: 'T3-T4 2026',
      description: 'Grille d’analyse des ratios litres/100km par véhicule de livraison et suivi des anomalies de cartes carburant.',
      taille: '620 Ko'
    },
    {
      id: 'DOC-CG-04',
      titre: 'Nomenclature Analytique des Centres de Coûts NT Foods',
      type: 'Nomenclature',
      periode: 'SYSCOHADA',
      description: 'Référentiel des sections analytiques : Usine Batouri, Usine Bassa, Logistique Nsam, Direction Générale.',
      taille: '450 Ko'
    }
  ]);
}
