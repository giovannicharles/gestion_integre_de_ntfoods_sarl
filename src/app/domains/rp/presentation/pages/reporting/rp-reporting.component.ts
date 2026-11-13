import { Component, ChangeDetectionStrategy, OnInit, signal, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CommercialService } from '../../../../commercial/infrastructure/commercial.service';
import { RpService } from '../../../infrastructure/rp.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { fCFA } from '../../../../../shared/utils/format.utils';

export interface CampagneRP {
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
  statut: 'TERMINE' | 'EN_COURS' | 'PLANIFIE';
}

const STORAGE_KEY = 'tanty_rp_campagnes_data';

@Component({
  selector: 'app-rp-reporting',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './rp-reporting.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RpReportingComponent implements OnInit {
  fCFA = fCFA;
  Math = Math;

  private readonly commercialSvc = inject(CommercialService);
  private readonly rpSvc = inject(RpService);
  private readonly toast = inject(ToastService);

  periode = signal<'MOIS' | 'TRIMESTRE' | 'ANNEE'>('MOIS');
  activeTab = signal<'CAMPAGNES' | 'ROI' | 'ANALYSE'>('CAMPAGNES');

  campagnes = signal<CampagneRP[]>([]);

  // Modal nouvelle campagne
  showModal = signal(false);
  nouvelleCampagne = signal<CampagneRP>({
    id: 0,
    titre: '',
    type: 'DEGUSTATION',
    lieu: '',
    dateDebut: new Date().toISOString().substring(0, 10),
    dateFin: new Date(Date.now() + 7 * 86400000).toISOString().substring(0, 10),
    budgetEngage: 250000,
    caGenere: 1200000,
    echantillonsDistribues: 1500,
    contactsQualifies: 350,
    statut: 'EN_COURS'
  });

  totalBudget = () => this.campagnes().reduce((acc, c) => acc + (c.budgetEngage || 0), 0);
  totalCa = () => this.campagnes().reduce((acc, c) => acc + (c.caGenere || 0), 0);
  totalContacts = () => this.campagnes().reduce((acc, c) => acc + (c.contactsQualifies || 0), 0);
  totalEchantillons = () => this.campagnes().reduce((acc, c) => acc + (c.echantillonsDistribues || 0), 0);

  roiMoyen = () => {
    const b = this.totalBudget();
    return b > 0 ? Math.round(((this.totalCa() - b) / b) * 100) : 0;
  };

  ngOnInit(): void {
    this.chargerCampagnes();
  }

  chargerCampagnes(): void {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.campagnes.set(parsed);
          return;
        }
      } catch (_) {}
    }

    // Données opérationnelles réelles par défaut
    const initiales: CampagneRP[] = [
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
        statut: 'PLANIFIE'
      }
    ];
    this.campagnes.set(initiales);
    this.sauvegarder(initiales);
  }

  private sauvegarder(list: CampagneRP[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  ouvrirModal(): void {
    this.nouvelleCampagne.set({
      id: Date.now(),
      titre: '',
      type: 'DEGUSTATION',
      lieu: '',
      dateDebut: new Date().toISOString().substring(0, 10),
      dateFin: new Date(Date.now() + 7 * 86400000).toISOString().substring(0, 10),
      budgetEngage: 200000,
      caGenere: 0,
      echantillonsDistribues: 1000,
      contactsQualifies: 200,
      statut: 'PLANIFIE'
    });
    this.showModal.set(true);
  }

  fermerModal(): void {
    this.showModal.set(false);
  }

  enregistrerCampagne(): void {
    const c = this.nouvelleCampagne();
    if (!c.titre.trim() || !c.lieu.trim()) {
      this.toast.error('Veuillez renseigner le titre et le lieu de l\'opération.');
      return;
    }
    const updated = [c, ...this.campagnes()];
    this.campagnes.set(updated);
    this.sauvegarder(updated);
    this.showModal.set(false);
    this.toast.success(`Campagne « ${c.titre} » enregistrée.`);
  }

  supprimerCampagne(id: number): void {
    const updated = this.campagnes().filter(c => c.id !== id);
    this.campagnes.set(updated);
    this.sauvegarder(updated);
    this.toast.info('Campagne retirée de l\'historique.');
  }

  calculerRoi(c: CampagneRP): number {
    if (!c.budgetEngage || c.budgetEngage === 0) return 0;
    return Math.round(((c.caGenere - c.budgetEngage) / c.budgetEngage) * 100);
  }

  imprimerRapport(): void {
    window.print();
  }
}
