import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductionService, PredictionProduitFiniBE } from '../../../../infrastructure/production.service';
import { AdSessionContextService } from '../ad-session-context.service';

/**
 * PRÉDICTIONS DES PRODUITS FINIS — Agent Doseur
 * Vue informative : dès qu'une session de dosage est sélectionnée, la prédiction
 * est calculée automatiquement à partir de ses fûts nets. Sélection déléguée
 * à AdSessionContextService.
 */
@Component({
  selector: 'app-ad-predictions',
  standalone: true,
  imports: [CommonModule, DecimalPipe, FormsModule],
  templateUrl: './ad-predictions.component.html',
  styleUrls: ['./ad-predictions.component.css', '../_shared.css'],
})
export class AdPredictionsComponent implements OnInit {
  private readonly svc = inject(ProductionService);
  readonly contexte = inject(AdSessionContextService);

  loading = signal(false);
  message = signal('');
  prediction = signal<PredictionProduitFiniBE | null>(null);

  ngOnInit(): void {
    this.contexte.chargerSessionsOuvertes();
    const active = this.contexte.sessionActive();
    if (active) this.evaluer(active.id, active.nbFutsNets);
  }

  selectionnerSessionDepuisSelect(value: string): void {
    this.contexte.selectionnerParId(value);
    this.message.set('');
    this.prediction.set(null);
    const active = this.contexte.sessionActive();
    if (active) this.evaluer(active.id, active.nbFutsNets);
  }

  private evaluer(id: number, nbFutsNets: number): void {
    if (nbFutsNets > 0) {
      this.predire(id);
    } else {
      this.message.set("Cette session n'a pas encore de fûts nets enregistrés. Saisissez-les dans la vue Fûts.");
    }
  }

  private predire(sessionId: number): void {
    this.loading.set(true);
    this.svc.predireProduitFini(sessionId).subscribe({
      next: p => { this.prediction.set(p); this.loading.set(false); },
      error: () => { this.message.set('Erreur lors du calcul de la prédiction'); this.loading.set(false); },
    });
  }
}
