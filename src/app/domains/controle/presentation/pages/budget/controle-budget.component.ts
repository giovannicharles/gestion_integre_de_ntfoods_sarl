import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControleService, BudgetItem } from '../../../infrastructure/controle.service';
import { fCFA } from '../../../../../shared/utils/format.utils';

@Component({
  selector: 'app-controle-budget',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './controle-budget.component.html',
})
export class ControleBudgetComponent implements OnInit {
  fCFA = fCFA;
  Math = Math;

  private readonly svc = inject(ControleService);

  budget = signal<BudgetItem[]>([]);
  totalBudget = computed(() => this.budget().reduce((s, b) => s + b.budget, 0));
  totalEngage = computed(() => this.budget().reduce((s, b) => s + b.engage, 0));
  totalRealise = computed(() => this.budget().reduce((s, b) => s + b.realise, 0));
  nbDepasse = computed(() => this.budget().filter(b => b.engage > b.budget).length);

  ngOnInit(): void {
    this.svc.getBudget().subscribe({
      next: b => this.budget.set(b),
      error: () => {},
    });
  }

  pct(engage: number, budget: number): number { return Math.round((engage / budget) * 100); }
}
