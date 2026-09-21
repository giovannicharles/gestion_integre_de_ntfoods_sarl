import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductionService, PPHBE, AffectationBE } from '../../../../infrastructure/production.service';
import { MiniChartComponent, ChartSeries } from '../../../shared/charts/mini-chart.component';

/**
 * CALCUL AUTOMATIQUE DES PERFORMANCES — Responsable de Salle
 * Objectif recalculé, quantité produite, taux d'atteinte et classement
 * journalier des postes — calculés côté backend (AffectationJournaliere.getClassementPostes()).
 */
@Component({
  selector: 'app-rs-performances-postes',
  standalone: true,
  imports: [CommonModule, DecimalPipe, FormsModule, MiniChartComponent],
  templateUrl: './rs-performances-postes.component.html',
  styleUrls: ['./rs-performances-postes.component.css', '../_shared.css']
})
export class RsPerformancesPostesComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  loading = signal(true);
  pphs = signal<PPHBE[]>([]);
  referencePPH = '';
  affectation = signal<AffectationBE | null>(null);

  ngOnInit(): void {
    this.svc.getPPHs('EN_COURS').subscribe({
      next: p => { this.pphs.set(p); if (p.length) { this.referencePPH = p[0].referencePPH; this.charger(); } else this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  charger(): void {
    if (!this.referencePPH) return;
    this.loading.set(true);
    this.svc.getAffectationDuJour(this.referencePPH).subscribe({
      next: a => { this.affectation.set(a); this.loading.set(false); },
      error: () => { this.affectation.set(null); this.loading.set(false); }
    });
  }

  serieClassement(): ChartSeries[] {
    return [{ name: 'Taux réalisation (%)', color: 'var(--primary, #1976d2)', values: (this.affectation()?.classement ?? []).map(c => c.pctRealisation) }];
  }
  labelsClassement(): string[] { return (this.affectation()?.classement ?? []).map(c => c.libellePoste); }

  medaille(rang: number): string {
    if (rang === 1) return '🥇'; if (rang === 2) return '🥈'; if (rang === 3) return '🥉'; return '';
  }
}
