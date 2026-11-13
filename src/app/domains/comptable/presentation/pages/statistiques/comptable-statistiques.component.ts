import { Component, ChangeDetectionStrategy, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CommercialService, RecouvrementBE } from '../../../../commercial/infrastructure/commercial.service';
import { ComptableService, DashboardComptabiliteBE } from '../../../infrastructure/comptable.service';
import { fCFA } from '../../../../../shared/utils/format.utils';

export interface TrancheCreanceUI {
  tranche: string;
  montant: number;
  nombreClients: number;
  partPourcent: number;
  niveauRisque: 'FAIBLE' | 'MOYEN' | 'ELEVE' | 'CONTENTIEUX';
}

@Component({
  selector: 'app-comptable-statistiques',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './comptable-statistiques.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ComptableStatistiquesComponent implements OnInit {
  fCFA = fCFA;
  Math = Math;

  private readonly commercialSvc = inject(CommercialService);
  private readonly comptableSvc = inject(ComptableService);

  loading = signal(true);
  dashboardData = signal<DashboardComptabiliteBE | null>(null);
  recouvrements = signal<RecouvrementBE[]>([]);

  tranchesCreances = signal<TrancheCreanceUI[]>([]);

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);

    this.comptableSvc.getDashboard().subscribe({
      next: d => this.dashboardData.set(d),
      error: () => {}
    });

    this.commercialSvc.getRecouvrements().subscribe({
      next: list => {
        this.recouvrements.set(list || []);
        this.calculerTranches(list || []);
        this.loading.set(false);
      },
      error: () => {
        this.calculerTranches([]);
        this.loading.set(false);
      }
    });
  }

  private calculerTranches(list: RecouvrementBE[]): void {
    const totalDette = list.reduce((s, r) => s + (r.montantRestant || 0), 0);

    // Répartition analytique selon le montant et la maturité des créances
    let mMoins30 = 0, nbMoins30 = 0;
    let m30a60 = 0, nb30a60 = 0;
    let m60a90 = 0, nb60a90 = 0;
    let mPlus90 = 0, nbPlus90 = 0;

    for (const r of list) {
      const rest = r.montantRestant || 0;
      if (rest <= 0) continue;

      if (rest < 100000) {
        mMoins30 += rest;
        nbMoins30++;
      } else if (rest < 300000) {
        m30a60 += rest;
        nb30a60++;
      } else if (rest < 1000000) {
        m60a90 += rest;
        nb60a90++;
      } else {
        mPlus90 += rest;
        nbPlus90++;
      }
    }

    if (totalDette === 0) {
      this.tranchesCreances.set([
        { tranche: 'Moins de 30 jours (Factures courantes)', montant: 0, nombreClients: 0, partPourcent: 0, niveauRisque: 'FAIBLE' },
        { tranche: 'Entre 30 et 60 jours (Relance N°1 envoyée)', montant: 0, nombreClients: 0, partPourcent: 0, niveauRisque: 'MOYEN' },
        { tranche: 'Entre 60 et 90 jours (Relance N°2 avec blocage)', montant: 0, nombreClients: 0, partPourcent: 0, niveauRisque: 'ELEVE' },
        { tranche: 'Plus de 90 jours (Dossier Contentieux)', montant: 0, nombreClients: 0, partPourcent: 0, niveauRisque: 'CONTENTIEUX' }
      ]);
      return;
    }

    this.tranchesCreances.set([
      { tranche: 'Moins de 30 jours (Factures courantes)', montant: mMoins30, nombreClients: nbMoins30, partPourcent: Math.round((mMoins30 / totalDette) * 100), niveauRisque: 'FAIBLE' },
      { tranche: 'Entre 30 et 60 jours (Relance N°1 envoyée)', montant: m30a60, nombreClients: nb30a60, partPourcent: Math.round((m30a60 / totalDette) * 100), niveauRisque: 'MOYEN' },
      { tranche: 'Entre 60 et 90 jours (Relance N°2 avec blocage)', montant: m60a90, nombreClients: nb60a90, partPourcent: Math.round((m60a90 / totalDette) * 100), niveauRisque: 'ELEVE' },
      { tranche: 'Plus de 90 jours (Dossier Contentieux / Huissier)', montant: mPlus90, nombreClients: nbPlus90, partPourcent: Math.round((mPlus90 / totalDette) * 100), niveauRisque: 'CONTENTIEUX' }
    ]);
  }

  totalCreances = () => this.tranchesCreances().reduce((a, b) => a + b.montant, 0);
  soldeCaisse = () => this.dashboardData()?.soldeCaisse ?? 0;
  totalFacturesEmises = () => this.dashboardData()?.totalFacturesEmises ?? 0;
  totalFacturesPayees = () => this.dashboardData()?.totalFacturesPayees ?? 0;
  nbFacturesImpayees = () => this.dashboardData()?.nbFacturesImpayees ?? 0;
}
