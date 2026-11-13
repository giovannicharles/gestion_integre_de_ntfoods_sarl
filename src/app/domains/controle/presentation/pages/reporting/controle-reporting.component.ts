import { Component, ChangeDetectionStrategy, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DgService, ControleGestionResumeBE } from '../../../../dg/infrastructure/dg.service';
import { fCFA } from '../../../../../shared/utils/format.utils';
import { extractApiError } from '../../../../../core/http/api-error-parser';

@Component({
  selector: 'app-controle-reporting',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './controle-reporting.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ControleReportingComponent implements OnInit {
  private readonly dgSvc = inject(DgService);

  fCFA = fCFA;
  loading = signal(true);
  loadError = signal<string | null>(null);
  controle = signal<ControleGestionResumeBE | null>(null);

  ngOnInit(): void {
    this.chargerControle();
  }

  chargerControle(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.dgSvc.getControleGestion().subscribe({
      next: (data) => {
        this.controle.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(extractApiError(err));
        this.loading.set(false);
      }
    });
  }

  get budgetTotal(): number {
    return this.controle()?.budgetTotalFCFA ?? 0;
  }

  get budgetEngage(): number {
    return this.controle()?.budgetEngageFCFA ?? 0;
  }

  get soldeDisponible(): number {
    return this.budgetTotal - this.budgetEngage;
  }

  get tauxConsommation(): number {
    if (this.budgetTotal === 0) return 0;
    return Math.round((this.budgetEngage / this.budgetTotal) * 100);
  }
}
