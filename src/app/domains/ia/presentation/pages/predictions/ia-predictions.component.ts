import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IaService, PredictiveResponse } from '../../../infrastructure/ia.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';

const TYPES_PREDICTION = [
  { value: 'RUPTURE_STOCK', label: 'Risque de rupture de stock' },
  { value: 'VENTES', label: 'Tendance des ventes' },
  { value: 'PRODUCTION', label: 'Besoins de production' },
];

/** Nommé IaHubPredictionsComponent (pas IaPredictionsComponent) pour ne pas entrer en collision
 * avec le composant homonyme du module Stock (domains/stock/.../ia-predictions), un écran
 * entièrement différent (prévisions de rupture sur le catalogue produits), sans rapport avec ce
 * hub générique. */
@Component({
  selector: 'app-ia-hub-predictions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ia-predictions.component.html',
  styleUrls: ['./ia-predictions.component.css'],
})
export class IaHubPredictionsComponent {
  private readonly iaSvc = inject(IaService);

  types = TYPES_PREDICTION;
  predictionType = signal(TYPES_PREDICTION[0].value);
  horizonDays = signal(30);
  domain = signal('');

  loading = signal(false);
  errorMsg = signal<string | null>(null);
  resultat = signal<PredictiveResponse | null>(null);

  lancerPrediction(auto: boolean): void {
    this.loading.set(true);
    this.errorMsg.set(null);
    this.resultat.set(null);
    const req = { predictionType: this.predictionType(), horizonDays: this.horizonDays() || 30, domain: this.domain() || undefined };
    const obs$ = auto ? this.iaSvc.autoPredict(req) : this.iaSvc.predict(req);
    obs$.subscribe({
      next: r => { this.resultat.set(r); this.loading.set(false); },
      error: e => { this.errorMsg.set(extractApiError(e)); this.loading.set(false); },
    });
  }

  risqueClass(risk: string): string {
    const r = (risk || '').toUpperCase();
    if (r.includes('HAUT') || r.includes('ELEVE') || r.includes('HIGH') || r.includes('CRITIQUE')) return 'badge bg-red';
    if (r.includes('MOYEN') || r.includes('MEDIUM')) return 'badge bg-orange';
    return 'badge bg-success';
  }
}
