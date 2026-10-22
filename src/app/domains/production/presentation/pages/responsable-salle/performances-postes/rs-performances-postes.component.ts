import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductionService, PPHBE, AffectationBE, PerformancePosteBE } from '../../../../infrastructure/production.service';
import { MiniChartComponent, ChartSeries } from '../../../shared/charts/mini-chart.component';

type PeriodeChoix = 'jour' | 'semaine' | 'mois' | 'libre';

/**
 * CALCUL AUTOMATIQUE DES PERFORMANCES — Responsable de Salle
 * Objectif recalculé, quantité produite, taux d'atteinte et classement
 * journalier des postes — calculés côté backend (AffectationJournaliere.getClassementPostes()).
 *
 * Vue par période (§99) : les mêmes postes vus sur jour / semaine / mois / intervalle libre,
 * via GET /affectations/performances-postes — l'affectation du jour ci-dessus ne couvre que
 * la journée en cours, faute de prendre une date en paramètre.
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

  periode = signal<PeriodeChoix>('semaine');
  debutLibre = this.dateLocaleIso();
  finLibre = this.dateLocaleIso();
  performancesLoading = signal(false);
  performancesErreur = signal('');
  performances = signal<PerformancePosteBE[]>([]);

  ngOnInit(): void {
    this.svc.getPPHs('EN_COURS').subscribe({
      next: p => { this.pphs.set(p); if (p.length) { this.referencePPH = p[0].referencePPH; this.charger(); } else this.loading.set(false); },
      error: () => this.loading.set(false)
    });
    this.chargerPerformances();
  }

  charger(): void {
    if (!this.referencePPH) return;
    this.loading.set(true);
    this.svc.getAffectationDuJour(this.referencePPH).subscribe({
      next: a => { this.affectation.set(a); this.loading.set(false); },
      error: () => { this.affectation.set(null); this.loading.set(false); }
    });
  }

  private dateLocaleIso(d: Date = new Date()): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  changerPeriode(p: PeriodeChoix): void {
    this.periode.set(p);
    this.chargerPerformances();
  }

  private bornesPeriode(): { debut: string; fin: string } | null {
    const aujourdhui = new Date();
    switch (this.periode()) {
      case 'jour':
        return { debut: this.dateLocaleIso(), fin: this.dateLocaleIso() };
      case 'semaine': {
        const jour = aujourdhui.getDay();
        const debut = new Date(aujourdhui);
        debut.setDate(aujourdhui.getDate() - (jour === 0 ? 6 : jour - 1));
        return { debut: this.dateLocaleIso(debut), fin: this.dateLocaleIso() };
      }
      case 'mois': {
        const debut = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), 1);
        return { debut: this.dateLocaleIso(debut), fin: this.dateLocaleIso() };
      }
      case 'libre':
        if (!this.debutLibre || !this.finLibre || this.finLibre < this.debutLibre) return null;
        return { debut: this.debutLibre, fin: this.finLibre };
    }
  }

  chargerPerformances(): void {
    const bornes = this.bornesPeriode();
    if (!bornes) {
      this.performancesErreur.set('Période invalide (fin antérieure au début)');
      return;
    }
    this.performancesLoading.set(true);
    this.performancesErreur.set('');
    this.svc.getPerformancesPostes(bornes.debut, bornes.fin).subscribe({
      next: p => { this.performances.set(p); this.performancesLoading.set(false); },
      error: () => { this.performancesErreur.set('Erreur lors du chargement des performances'); this.performancesLoading.set(false); }
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
