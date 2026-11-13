import { Component, ChangeDetectionStrategy, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { CommercialService, VenteBE, RecouvrementBE } from '../../../infrastructure/commercial.service';
import { AuthService } from '../../../../../core/auth/auth.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { fCFA } from '../../../../../shared/utils/format.utils';
import { extractApiError } from '../../../../../core/http/api-error-parser';

@Component({
  selector: 'app-commercial-reporting',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './commercial-reporting.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommercialReportingComponent implements OnInit {
  private readonly comSvc = inject(CommercialService);
  private readonly authSvc = inject(AuthService);
  private readonly toast = inject(ToastService);

  fCFA = fCFA;
  today = new Date();
  loading = signal(true);
  loadError = signal<string | null>(null);

  currentUser = computed(() => this.authSvc.getCurrentUser());
  ventes = signal<VenteBE[]>([]);
  recouvrements = signal<RecouvrementBE[]>([]);

  ngOnInit(): void {
    this.chargerDonneesReelles();
  }

  chargerDonneesReelles(): void {
    this.loading.set(true);
    this.loadError.set(null);
    const matricule = this.currentUser()?.matricule || '';

    this.comSvc.getVentesParCommercial(matricule, { page: 0, size: 50 }).subscribe({
      next: (page) => {
        this.ventes.set(page.contenu || []);
        this.comSvc.getRecouvrements({ commercial: matricule }).subscribe({
          next: (recs) => {
            this.recouvrements.set(recs);
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

  get totalVentesCount(): number {
    return this.ventes().length;
  }

  get totalCaFCFA(): number {
    return this.ventes().reduce((s, v) => s + (v.montantTotal || 0), 0);
  }

  get totalCashEncaisse(): number {
    return this.ventes()
      .filter(v => v.modeReglement === 'CASH' || v.modeReglement === 'ESPECES')
      .reduce((s, v) => s + (v.montantTotal || 0), 0);
  }

  get totalCreancesRestantes(): number {
    return this.recouvrements().reduce((s, r) => s + (r.montantRestant || 0), 0);
  }

  get totalRecouvrementsEnCours(): number {
    return this.recouvrements().length;
  }
}
