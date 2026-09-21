import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { forkJoin } from 'rxjs';
import { ProductionService, RapportHebdomadaireProductionBE } from '../../../../infrastructure/production.service';
import { MiniChartComponent, ChartSeries } from '../../../shared/charts/mini-chart.component';

/**
 * STATISTIQUES — Chef de Production
 * Comparaisons Semaine N/N-1, Mois N/N-1, évolutions (objectifs, rendement,
 * pertes, ressources, performances) — 8 dernières semaines, données réelles
 * via GET /rapports/hebdomadaire.
 */
@Component({
  selector: 'app-cp-statistiques',
  standalone: true,
  imports: [CommonModule, DecimalPipe, MiniChartComponent],
  templateUrl: './cp-statistiques.component.html',
  styleUrls: ['./cp-statistiques.component.css', '../_shared.css']
})
export class CpStatistiquesComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  loading = signal(true);
  tendance = signal<{ label: string; rapport: RapportHebdomadaireProductionBE }[]>([]);

  labels = computed(() => this.tendance().map(t => t.label));

  serieProduction = computed<ChartSeries[]>(() => [{ name: 'Production (kg)', color: 'var(--primary, #1976d2)', values: this.tendance().map(t => t.rapport.totalQuantiteLots) }]);
  seriePertes = computed<ChartSeries[]>(() => [{ name: 'Taux pertes (%)', color: 'var(--danger, #d32f2f)', values: this.tendance().map(t => Math.round(t.rapport.tauxPertesGlobal * 10) / 10) }]);
  serieRendement = computed<ChartSeries[]>(() => [{ name: 'Fûts nets', color: 'var(--success, #2e7d32)', values: this.tendance().map(t => t.rapport.totalFutsNets) }]);
  serieObjectifs = computed<ChartSeries[]>(() => [
    { name: 'Sessions broyage', color: 'var(--info, #0284c7)', values: this.tendance().map(t => t.rapport.nbSessionsBroyage) },
    { name: 'Sessions dosage', color: 'var(--success, #2e7d32)', values: this.tendance().map(t => t.rapport.nbSessionsDosage) },
  ]);

  comparaisonSemaine = computed(() => {
    const t = this.tendance();
    if (t.length < 2) return null;
    return this.comparer(t[t.length - 1].rapport, t[t.length - 2].rapport);
  });
  comparaisonMois = computed(() => {
    const t = this.tendance();
    if (t.length < 8) return null;
    const actuel = t.slice(4);
    const precedent = t.slice(0, 4);
    const sum = (arr: typeof t, key: 'totalQuantiteLots' | 'totalFutsNets') => arr.reduce((s, x) => s + x.rapport[key], 0);
    const prodActuelle = sum(actuel, 'totalQuantiteLots'); const prodPrecedente = sum(precedent, 'totalQuantiteLots');
    const variation = prodPrecedente > 0 ? Math.round(((prodActuelle - prodPrecedente) / prodPrecedente) * 1000) / 10 : 0;
    return { prodActuelle, prodPrecedente, variation };
  });

  private comparer(actuel: RapportHebdomadaireProductionBE, precedent: RapportHebdomadaireProductionBE) {
    const variation = precedent.totalQuantiteLots > 0 ? Math.round(((actuel.totalQuantiteLots - precedent.totalQuantiteLots) / precedent.totalQuantiteLots) * 1000) / 10 : 0;
    return { prodActuelle: actuel.totalQuantiteLots, prodPrecedente: precedent.totalQuantiteLots, variation };
  }

  ngOnInit(): void { this.charger(); }

  charger(): void {
    this.loading.set(true);
    const semaines = this.dernieresSemaines(8);
    forkJoin(semaines.map(s => this.svc.getRapportHebdomadaireProduction(s.debut, s.fin))).subscribe({
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
