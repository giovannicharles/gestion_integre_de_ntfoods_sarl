import { Component, ChangeDetectionStrategy, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { fCFA } from '../../../../../shared/utils/format.utils';

interface CampagneRP {
  id: number;
  titre: string;
  type: 'DEGUSTATION' | 'SALON' | 'STREET_MARKETING' | 'PROMO_GMS';
  lieu: string;
  dateDebut: string;
  dateFin: string;
  budgetEngage: number;
  caGenere: number;
  echantillonsDistribues: number;
  contactsQualifies: number;
  roi: number; // en %
  statut: 'TERMINE' | 'EN_COURS' | 'PLANIFIE';
}

@Component({
  selector: 'app-rp-reporting',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './rp-reporting.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RpReportingComponent implements OnInit {
  fCFA = fCFA;

  periode = signal<'MOIS' | 'TRIMESTRE' | 'ANNEE'>('MOIS');

  campagnes = signal<CampagneRP[]>([
    {
      id: 1,
      titre: 'Grandes Dégustations Tanty Bouillie Infantile & Tapioca Gourmand',
      type: 'DEGUSTATION',
      lieu: 'DOVV Bastos, Essos & Yaoundé Centre',
      dateDebut: '2026-10-01',
      dateFin: '2026-10-15',
      budgetEngage: 450000,
      caGenere: 2850000,
      echantillonsDistribues: 3200,
      contactsQualifies: 840,
      roi: 533,
      statut: 'TERMINE'
    },
    {
      id: 2,
      titre: 'Animation Commerciale Tête de Gondole - Rentrée Scolaire Tanty',
      type: 'PROMO_GMS',
      lieu: 'Carrefour Bonamoussadi & Grand Mall Douala',
      dateDebut: '2026-09-01',
      dateFin: '2026-09-20',
      budgetEngage: 600000,
      caGenere: 4200000,
      echantillonsDistribues: 4500,
      contactsQualifies: 1120,
      roi: 600,
      statut: 'TERMINE'
    },
    {
      id: 3,
      titre: 'Activation Terrains Marchés Urbains - Sensibilisation Nutritionnelle',
      type: 'STREET_MARKETING',
      lieu: 'Marché Mokolo (Yaoundé) & Marché Sandaga (Douala)',
      dateDebut: '2026-11-01',
      dateFin: '2026-11-12',
      budgetEngage: 320000,
      caGenere: 1950000,
      echantillonsDistribues: 5000,
      contactsQualifies: 620,
      roi: 509,
      statut: 'EN_COURS'
    },
    {
      id: 4,
      titre: 'Pavillon Agroalimentaire Salon International PROMOTE',
      type: 'SALON',
      lieu: 'Palais des Congrès de Yaoundé',
      dateDebut: '2026-12-05',
      dateFin: '2026-12-13',
      budgetEngage: 1800000,
      caGenere: 8500000,
      echantillonsDistribues: 12000,
      contactsQualifies: 2400,
      roi: 372,
      statut: 'PLANIFIE'
    }
  ]);

  totalBudget = () => this.campagnes().reduce((acc, c) => acc + c.budgetEngage, 0);
  totalCa = () => this.campagnes().reduce((acc, c) => acc + c.caGenere, 0);
  totalContacts = () => this.campagnes().reduce((acc, c) => acc + c.contactsQualifies, 0);
  roiMoyen = () => {
    const b = this.totalBudget();
    return b > 0 ? Math.round(((this.totalCa() - b) / b) * 100) : 0;
  };

  ngOnInit(): void {}
}

