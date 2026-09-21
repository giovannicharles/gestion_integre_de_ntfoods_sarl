import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { ProductionService, StatistiquesFutsBE, SessionDosageBE } from '../../../../infrastructure/production.service';
import { MiniChartComponent, ChartSeries } from '../../../shared/charts/mini-chart.component';

/**
 * STATISTIQUES — Agent Doseur
 * GET /dosage/statistiques/futs autorise explicitement AGENT_DOSEUR (contrairement
 * aux autres endpoints de consultation) — comparaisons N/N-1 pleinement fonctionnelles.
 * Les graphiques d'évolution jour par jour dépendent en revanche de /dosage/periode
 * (réserve identique aux autres vues).
 */
@Component({
  selector: 'app-ad-statistiques',
  standalone: true,
  imports: [CommonModule, DecimalPipe, MiniChartComponent],
  templateUrl: './ad-statistiques.component.html',
  styleUrls: ['./ad-statistiques.component.css', '../_shared.css']
})
export class AdStatistiquesComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  loading = signal(true);
  statsJour = signal<StatistiquesFutsBE | null>(null);
  statsSemaine = signal<StatistiquesFutsBE | null>(null);
  statsMois = signal<StatistiquesFutsBE | null>(null);

  erreurEvolution = signal(false);
  historique7j = signal<SessionDosageBE[]>([]);

  labels7j = computed(() => {
    const jours: string[] = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); jours.push(d.toISOString().split('T')[0]); }
    return jours.map(j => j.slice(5).split('-').reverse().join('/'));
  });

  serieEvolutionFuts = computed<ChartSeries[]>(() => {
    const jours: string[] = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); jours.push(d.toISOString().split('T')[0]); }
    const h = this.historique7j();
    return [{ name: 'Fûts nets', color: 'var(--success, #2e7d32)', values: jours.map(j => h.filter(s => s.date === j).reduce((s, x) => s + x.nbFutsNets, 0)) }];
  });

  serieEvolutionMatieres = computed<ChartSeries[]>(() => {
    const jours: string[] = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); jours.push(d.toISOString().split('T')[0]); }
    const h = this.historique7j();
    const parType = (type: string) => jours.map(j => h.filter(s => s.date === j).flatMap(s => s.matieresUtilisees).filter(m => m.typeMatiere === type).reduce((s, m) => s + m.quantiteKg, 0));
    return [
      { name: 'Maïs', color: '#f9a825', values: parType('MAIS') },
      { name: 'Soja', color: '#558b2f', values: parType('SOJA') },
      { name: 'Arachide', color: '#6d4c41', values: parType('ARACHIDE') },
    ];
  });

  serieEvolutionSessions = computed<ChartSeries[]>(() => {
    const jours: string[] = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); jours.push(d.toISOString().split('T')[0]); }
    const h = this.historique7j();
    return [{ name: 'Sessions ouvertes', color: 'var(--primary, #1976d2)', values: jours.map(j => h.filter(s => s.date === j).length) }];
  });

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    const aujourdHui = new Date().toISOString().split('T')[0];
    this.svc.getStatistiquesFuts(aujourdHui, aujourdHui).subscribe({ next: s => this.statsJour.set(s) });
    this.svc.getStatistiquesFuts(this.debutSemaine(), aujourdHui).subscribe({ next: s => this.statsSemaine.set(s) });
    this.svc.getStatistiquesFuts(this.debutMois(), aujourdHui).subscribe({ next: s => { this.statsMois.set(s); this.loading.set(false); } });

    const debut7j = this.joursAvant(7);
    this.svc.getSessionsDosageParPeriode(debut7j, aujourdHui).subscribe({
      next: h => this.historique7j.set(h),
      error: () => this.erreurEvolution.set(true)
    });
  }

  private joursAvant(n: number): string { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0]; }
  private debutSemaine(): string { const d = new Date(); const j = d.getDay(); return new Date(d.setDate(d.getDate() - j + (j === 0 ? -6 : 1))).toISOString().split('T')[0]; }
  private debutMois(): string { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]; }
}
