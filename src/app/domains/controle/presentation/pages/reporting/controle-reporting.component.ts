import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { fCFA } from '../../../../../shared/utils/format.utils';

interface CentreCout {
  code: string;
  libelle: string;
  budgetAlloueFCFA: number;
  depensesEngageesFCFA: number;
  ecartFCFA: number;
  tauxConsommation: number;
  statut: 'CONFORME' | 'ATTENTION' | 'DEPASSEMENT';
}

@Component({
  selector: 'app-controle-reporting',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './controle-reporting.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ControleReportingComponent {
  fCFA = fCFA;

  centres = signal<CentreCout[]>([
    {
      code: 'CC-101',
      libelle: 'Usine Production Bassa (Énergie & Main d’œuvre)',
      budgetAlloueFCFA: 18_000_000,
      depensesEngageesFCFA: 16_450_000,
      ecartFCFA: 1_550_000,
      tauxConsommation: 91,
      statut: 'ATTENTION'
    },
    {
      code: 'CC-102',
      libelle: 'Achats Matières Premières Agricoles (Batouri Soja/Maïs)',
      budgetAlloueFCFA: 35_000_000,
      depensesEngageesFCFA: 31_200_000,
      ecartFCFA: 3_800_000,
      tauxConsommation: 89,
      statut: 'CONFORME'
    },
    {
      code: 'CC-103',
      libelle: 'Logistique & Flotte Commerciale (Carburant & Entretien)',
      budgetAlloueFCFA: 8_500_000,
      depensesEngageesFCFA: 8_920_000,
      ecartFCFA: -420_000,
      tauxConsommation: 105,
      statut: 'DEPASSEMENT'
    },
    {
      code: 'CC-104',
      libelle: 'Direction Générale & Frais Administratifs Siège',
      budgetAlloueFCFA: 6_000_000,
      depensesEngageesFCFA: 4_800_000,
      ecartFCFA: 1_200_000,
      tauxConsommation: 80,
      statut: 'CONFORME'
    }
  ]);

  get totalBudget(): number {
    return this.centres().reduce((s, c) => s + c.budgetAlloueFCFA, 0);
  }

  get totalEngage(): number {
    return this.centres().reduce((s, c) => s + c.depensesEngageesFCFA, 0);
  }

  get tauxGlobal(): number {
    return Math.round((this.totalEngage / this.totalBudget) * 100);
  }
}
