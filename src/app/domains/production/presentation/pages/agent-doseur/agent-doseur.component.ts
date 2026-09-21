import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  ProductionService, SessionDosageBE, StatistiquesFutsBE
} from '../../../infrastructure/production.service';
import { MiniChartComponent, ChartSeries } from '../../shared/charts/mini-chart.component';
import { DonutChartComponent, DonutSlice } from '../../shared/charts/donut-chart.component';

@Component({
  selector: 'app-agent-doseur',
  standalone: true,
  imports: [CommonModule, DecimalPipe, RouterLink, MiniChartComponent, DonutChartComponent],
  templateUrl: './agent-doseur.component.html',
  styleUrls: ['./agent-doseur.component.css', './_shared.css']
})
export class AgentDoseurComponent implements OnInit {
  private readonly prodSvc = inject(ProductionService);

  today = new Date().toISOString().split('T')[0];
  semaineDebut = signal(this.debutSemaine(new Date()));
  semaineFin = signal(this.today);
  moisDebut = signal(this.debutMois(new Date()));
  moisFin = signal(this.today);

  sessions = signal<SessionDosageBE[]>([]);
  statsHebdo = signal<StatistiquesFutsBE | null>(null);
  statsMois = signal<StatistiquesFutsBE | null>(null);

  /** Historique 7 jours (vrai appel GET /dosage/periode) pour l'évolution des fûts. */
  historique7Jours = signal<SessionDosageBE[]>([]);

  totalFutsJour = computed(() =>
    this.sessions().filter(s => s.date === this.today).reduce((s, sess) => s + sess.nbFutsNets, 0)
  );

  sessionsActives = computed(() => this.sessions().filter(s => !s.cloturee));

  private joursDesSeptDerniers(): string[] {
    const jours: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      jours.push(d.toISOString().split('T')[0]);
    }
    return jours;
  }

  labelsHistorique = computed(() => this.joursDesSeptDerniers().map(j => j.slice(5).split('-').reverse().join('/')));

  /** Évolution des fûts nets sur 7 jours, agrégée par jour à partir des vraies sessions. */
  serieEvolutionFuts = computed<ChartSeries[]>(() => {
    const jours = this.joursDesSeptDerniers();
    const s = this.historique7Jours();
    return [{
      name: 'Fûts nets', color: 'var(--success, #2e7d32)',
      values: jours.map(j => s.filter(x => x.date === j).reduce((sum, x) => sum + x.nbFutsNets, 0)),
    }];
  });

  /** Répartition des matières utilisées sur la semaine (issue de statsHebdo, déjà réelle). */
  donutMatieres = computed<DonutSlice[]>(() => {
    const s = this.statsHebdo();
    if (!s) return [];
    return [
      { label: 'Maïs', value: Math.round(s.poudreMaisKg * 10) / 10, color: '#f9a825' },
      { label: 'Soja', value: Math.round(s.poudreSojaKg * 10) / 10, color: '#558b2f' },
      { label: 'Arachide', value: Math.round(s.poudreArachideKg * 10) / 10, color: '#6d4c41' },
    ];
  });

  ngOnInit(): void {
    this.chargerDonnees();
  }

  chargerDonnees(): void {
    this.prodSvc.getSessionsDosageParDate(this.today).subscribe({
      next: s => this.sessions.set(s)
    });
    this.prodSvc.getStatistiquesFuts(this.semaineDebut(), this.semaineFin()).subscribe({
      next: r => this.statsHebdo.set(r)
    });
    this.prodSvc.getStatistiquesFuts(this.moisDebut(), this.moisFin()).subscribe({
      next: r => this.statsMois.set(r)
    });
    const debut7j = this.joursDesSeptDerniers()[0];
    this.prodSvc.getSessionsDosageParPeriode(debut7j, this.today).subscribe({
      next: s => this.historique7Jours.set(s),
      error: () => this.historique7Jours.set([])
    });
  }

  private debutSemaine(d: Date): string {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff)).toISOString().split('T')[0];
  }

  private debutMois(d: Date): string {
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  }
}
