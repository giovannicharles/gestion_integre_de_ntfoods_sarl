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
        if (Array.isArray(parsed)) {
          this.campagnes.set(parsed);
          return;
        }
      } catch (_) {}
    }
    this.campagnes.set([]);
  }

  exporterCsv(): void {
    const list = this.campagnes();
    if (!list.length) {
      this.toast.info('Aucune campagne à exporter.');
      return;
    }
    const headers = ['Titre', 'Type', 'Lieu', 'Date Debut', 'Date Fin', 'Budget Engage (FCFA)', 'CA Genere (FCFA)', 'Echantillons', 'Contacts Qualifies', 'Statut'];
    const rows = list.map(c => [
      `"${c.titre}"`,
      `"${c.type}"`,
      `"${c.lieu}"`,
      `"${c.dateDebut}"`,
      `"${c.dateFin}"`,
      c.budgetEngage || 0,
      c.caGenere || 0,
      c.echantillonsDistribues || 0,
      c.contactsQualifies || 0,
      `"${c.statut}"`
    ]);
    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rapport_campagnes_rp_tanty_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    this.toast.success(`${list.length} campagne(s) exportée(s) en CSV.`);
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
