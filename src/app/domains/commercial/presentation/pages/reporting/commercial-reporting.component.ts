import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { fCFA } from '../../../../../shared/utils/format.utils';

interface VisiteTournee {
  id: string;
  nomBoutique: string;
  quartier: string;
  statut: 'LIVRE' | 'COMMANDE_PRISE' | 'RUPTURE' | 'REFUS_STOCK_PLEIN';
  cartonsLivres: number;
  montantEncaisseFCFA: number;
  heure: string;
  commentaire: string;
}

@Component({
  selector: 'app-commercial-reporting',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './commercial-reporting.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommercialReportingComponent {
  dateRapport = signal('Aujourd\'hui');
  fCFA = fCFA;

  visites = signal<VisiteTournee[]>([
    {
      id: 'VIS-001',
      nomBoutique: 'Épicerie Grâce Divine',
      quartier: 'Yaoundé - Mokolo',
      statut: 'LIVRE',
      cartonsLivres: 8,
      montantEncaisseFCFA: 96000,
      heure: '08:45',
      commentaire: 'Réassort bouillies soja et chips plantain. Paiement cash effectué.'
    },
    {
      id: 'VIS-002',
      nomBoutique: 'Alimentation Centrale Du Marché',
      quartier: 'Yaoundé - Mokolo En-bas',
      statut: 'LIVRE',
      cartonsLivres: 15,
      montantEncaisseFCFA: 180000,
      heure: '09:30',
      commentaire: 'Client fidèle. A demandé un présentoir de comptoir Tanty.'
    },
    {
      id: 'VIS-003',
      nomBoutique: 'Boutique Le Phare',
      quartier: 'Yaoundé - Madagascar',
      statut: 'COMMANDE_PRISE',
      cartonsLivres: 0,
      montantEncaisseFCFA: 0,
      heure: '10:15',
      commentaire: 'Commande de 10 cartons programmée pour la livraison de vendredi.'
    },
    {
      id: 'VIS-004',
      nomBoutique: 'Mini-Market Les Oliviers',
      quartier: 'Yaoundé - Cité Verte',
      statut: 'LIVRE',
      cartonsLivres: 12,
      montantEncaisseFCFA: 144000,
      heure: '11:20',
      commentaire: 'Forte demande sur le piment de table Tanty.'
    },
    {
      id: 'VIS-005',
      nomBoutique: 'Boutique Chez Mama Jeanne',
      quartier: 'Yaoundé - Cité Verte',
      statut: 'REFUS_STOCK_PLEIN',
      cartonsLivres: 0,
      montantEncaisseFCFA: 0,
      heure: '12:05',
      commentaire: 'Stock de farine infantile encore suffisant pour 4 jours.'
    }
  ]);

  get totalVisites(): number { return this.visites().length; }
  get boutiquesLivrees(): number { return this.visites().filter(v => v.statut === 'LIVRE').length; }
  get totalCartons(): number { return this.visites().reduce((s, v) => s + v.cartonsLivres, 0); }
  get totalCash(): number { return this.visites().reduce((s, v) => s + v.montantEncaisseFCFA, 0); }
  get tauxReussite(): number { return Math.round((this.boutiquesLivrees / this.totalVisites) * 100); }
}
