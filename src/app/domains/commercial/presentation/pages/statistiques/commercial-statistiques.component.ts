import { Component, ChangeDetectionStrategy, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DgService, PerformanceGammeBE, ClassementCommercialBE } from '../../../../dg/infrastructure/dg.service';
import { AuthService } from '../../../../../core/auth/auth.service';
import { fCFA } from '../../../../../shared/utils/format.utils';
import { extractApiError } from '../../../../../core/http/api-error-parser';

@Component({
  selector: 'app-commercial-statistiques',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './commercial-statistiques.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommercialStatistiquesComponent implements OnInit {
  private readonly dgSvc = inject(DgService);
  private readonly authSvc = inject(AuthService);

  fCFA = fCFA;
  loading = signal(true);
  loadError = signal<string | null>(null);

  currentUser = computed(() => this.authSvc.getCurrentUser());
  gammes = signal<PerformanceGammeBE[]>([]);
  commerciaux = signal<ClassementCommercialBE[]>([]);

  ngOnInit(): void {
    this.chargerStatistiques();
  }

  chargerStatistiques(): void {
    this.loading.set(true);
    this.loadError.set(null);

    this.dgSvc.getPerformanceGammes().subscribe({
      next: (gammes) => {
        this.gammes.set(gammes);
        this.dgSvc.getClassement().subscribe({
          next: (classement) => {
            this.commerciaux.set(classement);
            this.loading.set(false);
          },
          error: () => this.loading.set(false)
        });
      },
      error: (err) => {
        this.loadError.set(extractApiError(err));
        this.loading.set(false);
      }
    });
  }

  monClassement = computed(() => {
    const matricule = this.currentUser()?.matricule;
    if (!matricule) return null;
    const index = this.commerciaux().findIndex(c => c.matricule === matricule);
    if (index === -1) return null;
    return { rang: index + 1, donnee: this.commerciaux()[index] };
  });

  totalCaEntreprise = computed(() => {
    return this.gammes().reduce((s, g) => s + (g.ca || 0), 0);
  });
}
