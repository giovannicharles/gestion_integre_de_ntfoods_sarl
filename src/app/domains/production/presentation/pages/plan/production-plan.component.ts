import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProductionService, PPHBE } from '../../../infrastructure/production.service';
import { fCFA } from '../../../../../shared/utils/format.utils';

@Component({
  selector: 'app-production-plan',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink],
  templateUrl: './production-plan.component.html',
  styleUrls: ['./production-plan.component.css']
})
export class ProductionPlanComponent implements OnInit {
  today = new Date();
  fCFA = fCFA;
  private readonly prodSvc = inject(ProductionService);

  pph = signal<PPHBE | null>(null);
  loading = signal(true);

  lignesMP = computed(() => [] as { nom: string; quantite: number; unite: string }[]);

  totalMP = computed(() => this.lignesMP().length);

  totalProduitsPlannifies = computed(() => 0);
  totalProduitsRealises = computed(() => 0);

  progressionGlobale = computed(() => {
    const total = this.totalProduitsPlannifies();
    if (total === 0) return 0;
    return Math.round((this.totalProduitsRealises() / total) * 100);
  });

  getProduitDesignation(code: string): string {
    return code;
  }

  ngOnInit(): void {
    this.prodSvc.getPPHEnCours().subscribe({
      next: p => { this.pph.set(p); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  progression(realise: number, prevu: number): number {
    if (prevu === 0) return 0;
    return Math.min(Math.round((realise / prevu) * 100), 100);
  }

  progressClass(pct: number): string {
    if (pct >= 100) return 'prog-bar prog-g';
    if (pct >= 60) return 'prog-bar prog-y';
    return 'prog-bar prog-r';
  }

  statutPlanClass(s: string): string {
    const map: Record<string, string> = {
      EN_COURS: 'badge bg-orange',
      TERMINE: 'badge bg-success',
      PLANIFIE: 'badge bg-neutral',
    };
    return map[s] ?? 'badge bg-neutral';
  }
}
