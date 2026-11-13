import { Component, ChangeDetectionStrategy, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CommercialService, PreCommandeBE } from '../../../../commercial/infrastructure/commercial.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';

@Component({
  selector: 'app-secretaire-statistiques',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './secretaire-statistiques.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SecretaireStatistiquesComponent implements OnInit {
  private readonly comSvc = inject(CommercialService);

  loading = signal(true);
  loadError = signal<string | null>(null);
  precommandes = signal<PreCommandeBE[]>([]);

  ngOnInit(): void {
    this.chargerStats();
  }

  chargerStats(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.comSvc.getPrecommandesAValider({ page: 0, size: 100 }).subscribe({
      next: (page) => {
        this.precommandes.set(page.contenu || []);
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(extractApiError(err));
        this.loading.set(false);
      }
    });
  }

  get totalPrecommandes(): number {
    return this.precommandes().length;
  }

  get soumisesEnSoiree(): number {
    return this.precommandes().filter(p => p.soumiseEnSoiree).length;
  }

  get totalCartonsDemandes(): number {
    return this.precommandes().reduce((s, p) => {
      const qte = p.lignes?.reduce((sum: number, l) => sum + (l.quantiteDemandee || 0), 0) || 0;
      return s + qte;
    }, 0);
  }
}
