import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { forkJoin } from 'rxjs';
import { ProductionService, RapportHebdoAffectationBE } from '../../../../infrastructure/production.service';
import { MiniChartComponent, ChartSeries } from '../../../shared/charts/mini-chart.component';

/**
 * STATISTIQUES — Responsable de Salle
 * Production journalière/hebdo/mensuelle, comparaisons N/N-1, évolution des
 * postes/employés/objectifs — GET /affectations/rapport-hebdomadaire (réel),
 * 8 dernières semaines.
 */
@Component({
  selector: 'app-rs-statistiques',
  standalone: true,
  imports: [CommonModule, DecimalPipe, MiniChartComponent],
  templateUrl: './rs-statistiques.component.html',
  styleUrls: ['./rs-statistiques.component.css', '../_shared.css']
})
export class RsStatistiquesComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  loading = signal(true);
  tendance = signal<{ label: string; rapport: RapportHebdoAffectationBE }[]>([]);

  labels = computed(() => this.tendance().map(t => t.label));
  serieProduction = computed<ChartSeries[]>(() => [{ name: 'Production (kg)', color: 'var(--primary, #1976d2)', values: this.tendance().map(t => t.rapport.productionTotaleKg) }]);
  serieFuts = computed<ChartSeries[]>(() => [{ name: 'Fûts nets', color: 'var(--info, #0284c7)', values: this.tendance().map(t => t.rapport.nbFutsNets) }]);
  serieObjectifs = computed<ChartSeries[]>(() => [{ name: 'Jours affectés', color: 'var(--success, #2e7d32)', values: this.tendance().map(t => t.rapport.nbJoursAffectes) }]);

  comparaisonSemaine = computed(() => {
    const t = this.tendance();
    if (t.length < 2) return null;
    return this.comparer(t[t.length - 1].rapport, t[t.length - 2].rapport);
  });
  comparaisonMois = computed(() => {
    const t = this.tendance();
    if (t.length < 8) return null;
    const actuel = t.slice(4).reduce((s, x) => s + x.rapport.productionTotaleKg, 0);
    const precedent = t.slice(0, 4).reduce((s, x) => s + x.rapport.productionTotaleKg, 0);
    const variation = precedent > 0 ? Math.round(((actuel - precedent) / precedent) * 1000) / 10 : 0;
    return { actuel, precedent, variation };
  });

  private comparer(a: RapportHebdoAffectationBE, p: RapportHebdoAffectationBE) {
    const variation = p.productionTotaleKg > 0 ? Math.round(((a.productionTotaleKg - p.productionTotaleKg) / p.productionTotaleKg) * 1000) / 10 : 0;
    return { actuel: a.productionTotaleKg, precedent: p.productionTotaleKg, variation };
  }

  ngOnInit(): void { this.charger(); }

  charger(): void {
    this.loading.set(true);
    const semaines = this.dernieresSemaines(8);
    forkJoin(semaines.map(s => this.svc.getRapportHebdomadaireAffectation(s.debut, s.fin))).subscribe({
      next: rapports => { this.tendance.set(rapports.map((r, i) => ({ label: semaines[i].label, rapport: r }))); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  private dernieresSemaines(n: number): { debut: string; fin: string; label: string }[] {
    const result: { debut: string; fin: string; label: string }[] = [];
    const aujourdHui = new Date();
    for (let i = n - 1; i >= 0; i--) {
      const ref = new Date(aujourdHui); ref.setDate(ref.getDate() - i * 7);
      const jour = ref.getDay();
      const lundi = new Date(ref); lundi.setDate(ref.getDate() - jour + (jour === 0 ? -6 : 1));
      const dimanche = new Date(lundi); dimanche.setDate(lundi.getDate() + 6);
      result.push({ debut: lundi.toISOString().split('T')[0], fin: dimanche.toISOString().split('T')[0], label: i === 0 ? 'S' : `S-${i}` });
    }
    return result;
  }
}
