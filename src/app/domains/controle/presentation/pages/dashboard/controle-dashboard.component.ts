import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ControleService, ControleDashboard, MargeProduit, BudgetItem, VarianceItem } from '../../../infrastructure/controle.service';
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

  data = signal<ControleDashboard | null>(null);
  marges = signal<MargeProduit[]>([]);
  budget = signal<BudgetItem[]>([]);
  variances = signal<VarianceItem[]>([]);

  tresorerie = computed(() => this.data()?.tresorerie ?? 0);
  ecartsRouges = computed(() => this.data()?.ecartsRouges ?? 0);
  ventesCredit = computed(() => this.data()?.ventesCredit ?? 0);
  margeMoyenne = computed(() => this.data()?.margeMoyenne ?? 0);
  valoStock = computed(() => this.data()?.valoStock ?? 0);
  budgetEngage = computed(() => this.data()?.budgetEngage ?? 0);
  budgetTotal = computed(() => this.data()?.budgetTotal ?? 0);
  budgetDepasse = computed(() => this.data()?.budgetDepasse ?? 0);
  decaissementsAttente = computed(() => this.data()?.decaissementsAttente ?? 0);
  anomaliesElevees = computed(() => this.data()?.anomaliesElevees ?? 0);

  ngOnInit(): void {
    this.svc.getDashboard().subscribe({
      next: d => {
        this.data.set(d);
        this.marges.set(d.marges);
        this.budget.set(d.budget);
        this.variances.set(d.variances);
      },
      error: () => {},
    });
  }

  budgetPct(b: { engage: number; budget: number }): number {
    return Math.round((b.engage / b.budget) * 100);
  }
  variancePct(v: { standard: number; reel: number }): number {
    return Math.round(((v.reel - v.standard) / v.standard) * 100);
  }
}
