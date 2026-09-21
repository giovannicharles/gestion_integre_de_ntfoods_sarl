import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { forkJoin } from 'rxjs';
import { ProductionService, SessionBroyageBE } from '../../../../infrastructure/production.service';
import { MiniChartComponent, ChartSeries } from '../../../shared/charts/mini-chart.component';

/**
 * STATISTIQUES — Chef Machiniste
 * Comparaisons Semaine N/N-1, Mois N/N-1, et évolutions (production, pertes,
 * objectifs, performances, quantités broyées) — 8 dernières semaines, données réelles.
 */
@Component({
  selector: 'app-cm-statistiques',
  standalone: true,
  imports: [CommonModule, DecimalPipe, MiniChartComponent],
  templateUrl: './cm-statistiques.component.html',
  styleUrls: ['./cm-statistiques.component.css', '../_shared.css']
})
export class CmStatistiquesComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  loading = signal(true);
  error = signal('');

  tendance8Semaines = signal<{ label: string; sessions: SessionBroyageBE[] }[]>([]);

  labelsEvolution = computed(() => this.tendance8Semaines().map(t => t.label));

  private totalBroye(sessions: SessionBroyageBE[]): number { return sessions.reduce((s, x) => s + (x.quantiteNetteBroyeeKg ?? 0), 0); }
  private totalPertes(sessions: SessionBroyageBE[]): number { return sessions.reduce((s, x) => s + (x.pertesKg ?? 0), 0); }
  private totalObjectif(sessions: SessionBroyageBE[]): number { return sessions.reduce((s, x) => s + x.objectifJournalierKg, 0); }
  private tauxMoyen(sessions: SessionBroyageBE[]): number {
    const obj = this.totalObjectif(sessions);
    return obj > 0 ? Math.round((this.totalBroye(sessions) / obj) * 1000) / 10 : 0;
  }

  serieEvolutionProduction = computed<ChartSeries[]>(() => [{
    name: 'Quantité broyée (kg)', color: 'var(--primary, #1976d2)',
    values: this.tendance8Semaines().map(t => this.totalBroye(t.sessions)),
  }]);

  serieEvolutionPertes = computed<ChartSeries[]>(() => [{
    name: 'Pertes (kg)', color: 'var(--danger, #d32f2f)',
    values: this.tendance8Semaines().map(t => this.totalPertes(t.sessions)),
  }]);

  serieEvolutionObjectifs = computed<ChartSeries[]>(() => [
    { name: 'Objectif (kg)', color: 'var(--info, #0284c7)', values: this.tendance8Semaines().map(t => this.totalObjectif(t.sessions)) },
    { name: 'Réalisé (kg)', color: 'var(--success, #2e7d32)', values: this.tendance8Semaines().map(t => this.totalBroye(t.sessions)) },
  ]);

  serieEvolutionPerformances = computed<ChartSeries[]>(() => [{
    name: 'Taux de réalisation (%)', color: 'var(--success, #2e7d32)',
    values: this.tendance8Semaines().map(t => this.tauxMoyen(t.sessions)),
  }]);

  serieEvolutionQuantitesBroyees = computed<ChartSeries[]>(() => {
    const couleurs: Record<string, string> = { MAIS: '#f9a825', SOJA: '#558b2f', ARACHIDE: '#6d4c41' };
    return ['MAIS', 'SOJA', 'ARACHIDE'].map(type => ({
      name: type, color: couleurs[type],
      values: this.tendance8Semaines().map(t => t.sessions.filter(s => s.typePoudre === type).reduce((s, x) => s + (x.quantiteNetteBroyeeKg ?? 0), 0)),
    }));
  });

  comparaisonSemaine = computed(() => {
    const t = this.tendance8Semaines();
    if (t.length < 2) return null;
    const actuelle = t[t.length - 1].sessions;
    const precedente = t[t.length - 2].sessions;
    return this.comparer(actuelle, precedente);
  });

  comparaisonMois = computed(() => {
    const t = this.tendance8Semaines();
    if (t.length < 8) return null;
    const actuelle = t.slice(4).flatMap(x => x.sessions);
    const precedente = t.slice(0, 4).flatMap(x => x.sessions);
    return this.comparer(actuelle, precedente);
  });

  private comparer(actuelle: SessionBroyageBE[], precedente: SessionBroyageBE[]) {
    const prodActuelle = this.totalBroye(actuelle);
    const prodPrecedente = this.totalBroye(precedente);
    const variation = prodPrecedente > 0 ? Math.round(((prodActuelle - prodPrecedente) / prodPrecedente) * 1000) / 10 : 0;
    return {
      prodActuelle, prodPrecedente, variation,
      pertesActuelle: this.totalPertes(actuelle), pertesPrecedente: this.totalPertes(precedente),
      tauxActuel: this.tauxMoyen(actuelle), tauxPrecedent: this.tauxMoyen(precedente),
    };
  }

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.error.set('');
    const semaines = this.dernieresSemaines(8);
    forkJoin(semaines.map(s => this.svc.getSessionsBroyage({ debut: s.debut, fin: s.fin }))).subscribe({
      next: resultats => {
        this.tendance8Semaines.set(resultats.map((sessions, i) => ({ label: semaines[i].label, sessions })));
        this.loading.set(false);
      },
      error: () => { this.error.set('Erreur lors du chargement des statistiques'); this.loading.set(false); }
    });
  }

  private dernieresSemaines(n: number): { debut: string; fin: string; label: string }[] {
    const result: { debut: string; fin: string; label: string }[] = [];
    const aujourdHui = new Date();
    for (let i = n - 1; i >= 0; i--) {
      const ref = new Date(aujourdHui);
      ref.setDate(ref.getDate() - i * 7);
      const jour = ref.getDay();
      const lundi = new Date(ref);
      lundi.setDate(ref.getDate() - jour + (jour === 0 ? -6 : 1));
      const dimanche = new Date(lundi);
      dimanche.setDate(lundi.getDate() + 6);
      result.push({ debut: lundi.toISOString().split('T')[0], fin: dimanche.toISOString().split('T')[0], label: i === 0 ? 'S' : `S-${i}` });
    }
    return result;
  }
}
