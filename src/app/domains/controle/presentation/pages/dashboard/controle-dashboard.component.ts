import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ControleService, ControleDashboard, MargeProduit, BudgetItem, VarianceItem, AnomalieItem } from '../../../infrastructure/controle.service';
import { ComptableService, DecaissementBE } from '../../../../comptable/infrastructure/comptable.service';
import { StockService } from '../../../../stock/infrastructure/stock.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';
import { fCFA } from '../../../../../shared/utils/format.utils';

@Component({
  selector: 'app-controle-dashboard',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink],
  templateUrl: './controle-dashboard.component.html',
})
export class ControleDashboardComponent implements OnInit {
  today = new Date();
  fCFA = fCFA;
  Math = Math;

  private readonly svc = inject(ControleService);
  private readonly cptSvc = inject(ComptableService);
  private readonly stkSvc = inject(StockService);

  loading = signal(true);
  loadError = signal<string | null>(null);

  data = signal<ControleDashboard | null>(null);
  marges = signal<MargeProduit[]>([]);
  budget = signal<BudgetItem[]>([]);
  variances = signal<VarianceItem[]>([]);
  anomalies = signal<AnomalieItem[]>([]);
  decaissementsEnCours = signal<DecaissementBE[]>([]);
  /**
   * Correction 2026-10-25 : `ControleDashboardResponse.valoStock` est câblé à `0` en dur côté
   * serveur (ControleDashboardService.java:97) — jamais corrigé depuis. Le vrai calcul existe
   * déjà et tourne sur `/controle/valorisation` (StockService.getEtatStock(), somme de
   * `valeurStock`) : repris ici tel quel plutôt que de dupliquer la logique côté serveur.
   */
  valoStock = signal(0);
  tresorerie = computed(() => this.data()?.tresorerie ?? 0);
  ecartsRouges = computed(() => this.data()?.ecartsRouges ?? 0);
  ventesCredit = computed(() => this.data()?.ventesCredit ?? 0);
  margeMoyenne = computed(() => this.data()?.margeMoyenne ?? 0);
  budgetEngage = computed(() => this.data()?.budgetEngage ?? 0);
  budgetTotal = computed(() => this.data()?.budgetTotal ?? 0);
  budgetDepasse = computed(() => this.data()?.budgetDepasse ?? 0);
  decaissementsAttente = computed(() => this.data()?.decaissementsAttente ?? 0);
  anomaliesElevees = computed(() => this.data()?.anomaliesElevees ?? 0);

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({
      dashboard: this.svc.getDashboard(),
      decaissements: this.cptSvc.getDecaissements(),
      etatStock: this.stkSvc.getEtatStock(),
    }).subscribe({
      next: ({ dashboard, decaissements, etatStock }) => {
        this.data.set(dashboard);
        this.marges.set(dashboard.marges);
        this.budget.set(dashboard.budget);
        this.variances.set(dashboard.variances);
        this.anomalies.set(dashboard.anomalies);
        this.decaissementsEnCours.set(
          decaissements.filter(x => x.statut === 'PROPOSE' || x.statut === 'VALIDEE_CG').slice(0, 5)
        );
        this.valoStock.set(etatStock.reduce((s, m) => s + m.valeurStock, 0));
        this.loading.set(false);
      },
      error: e => {
        this.loadError.set(extractApiError(e));
        this.loading.set(false);
      },
    });
  }

  budgetPct(b: { engage: number; budget: number }): number {
    return Math.round((b.engage / b.budget) * 100);
  }
  variancePct(v: { standard: number; reel: number }): number {
    return Math.round(((v.reel - v.standard) / v.standard) * 100);
  }
}
