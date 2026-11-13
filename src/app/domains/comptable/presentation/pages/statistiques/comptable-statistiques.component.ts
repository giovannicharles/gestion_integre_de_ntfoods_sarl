import { Component, ChangeDetectionStrategy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { fCFA } from '../../../../../shared/utils/format.utils';

interface TrancheCreance {
  tranche: string;
  montant: number;
  nombreClients: number;
  partPourcent: number;
  niveauRisque: 'FAIBLE' | 'MOYEN' | 'ELEVE' | 'CONTENTIEUX';
}

interface RatioMois {
  mois: string;
  ca: number;
  bfr: number;
  tresorerieNette: number;
  dsoJours: number;
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

  tranchesCreances = signal<TrancheCreance[]>([
    { tranche: 'Moins de 30 jours (Factures courantes)', montant: 14200000, nombreClients: 48, partPourcent: 56.8, niveauRisque: 'FAIBLE' },
    { tranche: 'Entre 30 et 60 jours (Relance N°1 envoyée)', montant: 6100000, nombreClients: 19, partPourcent: 24.4, niveauRisque: 'MOYEN' },
    { tranche: 'Entre 60 et 90 jours (Relance N°2 avec blocage)', montant: 3200000, nombreClients: 8, partPourcent: 12.8, niveauRisque: 'ELEVE' },
    { tranche: 'Plus de 90 jours (Dossier Contentieux / Huissier)', montant: 1500000, nombreClients: 3, partPourcent: 6.0, niveauRisque: 'CONTENTIEUX' }
  ]);

  historiqueRatios = signal<RatioMois[]>([
    { mois: 'Juin 2026', ca: 38000000, bfr: 12500000, tresorerieNette: 28400000, dsoJours: 42 },
    { mois: 'Juillet 2026', ca: 41200000, bfr: 13100000, tresorerieNette: 31200000, dsoJours: 39 },
    { mois: 'Août 2026', ca: 44500000, bfr: 13800000, tresorerieNette: 34500000, dsoJours: 38 },
    { mois: 'Septembre 2026', ca: 48000000, bfr: 14200000, tresorerieNette: 38100000, dsoJours: 36 },
    { mois: 'Octobre 2026', ca: 51200000, bfr: 14900000, tresorerieNette: 42000000, dsoJours: 35 },
    { mois: 'Novembre 2026 (En cours)', ca: 53800000, bfr: 15200000, tresorerieNette: 45200000, dsoJours: 34 }
  ]);

  totalCreances = () => this.tranchesCreances().reduce((a, b) => a + b.montant, 0);

  ngOnInit(): void {}
}

