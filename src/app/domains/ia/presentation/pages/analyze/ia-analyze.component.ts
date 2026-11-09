import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IaService, AnalysisResponse } from '../../../infrastructure/ia.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';

const TYPES_ANALYSE = [
  { value: 'STOCK', label: 'Stock & approvisionnement' },
  { value: 'VENTES', label: 'Ventes & commercial' },
  { value: 'PRODUCTION', label: 'Production' },
  { value: 'FINANCIER', label: 'Financier' },
];

@Component({
  selector: 'app-ia-analyze',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ia-analyze.component.html',
  styleUrls: ['./ia-analyze.component.css'],
})
export class IaAnalyzeComponent {
  private readonly iaSvc = inject(IaService);

  types = TYPES_ANALYSE;
  analysisType = signal(TYPES_ANALYSE[0].value);
  domain = signal('');
  period = signal('');

  loading = signal(false);
  errorMsg = signal<string | null>(null);
  resultat = signal<AnalysisResponse | null>(null);

  lancerAnalyse(auto: boolean): void {
    this.loading.set(true);
    this.errorMsg.set(null);
    this.resultat.set(null);
    const req = { analysisType: this.analysisType(), domain: this.domain() || undefined, period: this.period() || undefined };
    const obs$ = auto ? this.iaSvc.autoAnalyze(req) : this.iaSvc.analyze(req);
    obs$.subscribe({
      next: r => { this.resultat.set(r); this.loading.set(false); },
      error: e => { this.errorMsg.set(extractApiError(e)); this.loading.set(false); },
    });
  }

  risqueClass(niveau: string): string {
    const n = (niveau || '').toUpperCase();
    if (n.includes('HAUT') || n.includes('ELEVE') || n.includes('HIGH') || n.includes('CRITIQUE')) return 'badge bg-red';
    if (n.includes('MOYEN') || n.includes('MEDIUM')) return 'badge bg-orange';
    return 'badge bg-success';
  }
}
