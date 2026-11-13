import { Component, ChangeDetectionStrategy, OnInit, signal, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { DgService, VersementDuJourBE } from '../../../../dg/infrastructure/dg.service';
import { fCFA } from '../../../../../shared/utils/format.utils';
import { extractApiError } from '../../../../../core/http/api-error-parser';

@Component({
  selector: 'app-secretaire-reporting',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './secretaire-reporting.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SecretaireReportingComponent implements OnInit {
  private readonly dgSvc = inject(DgService);

  fCFA = fCFA;
  today = new Date();
  loading = signal(true);
  loadError = signal<string | null>(null);
  versements = signal<VersementDuJourBE[]>([]);

  ngOnInit(): void {
    this.chargerVersements();
  }

  chargerVersements(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.dgSvc.getVersementsDuJour().subscribe({
      next: (data) => {
        this.versements.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(extractApiError(err));
        this.loading.set(false);
      }
    });
  }

  get totalCashVerse(): number {
    return this.versements().reduce((s, v) => s + (v.cashVerse || 0), 0);
  }

  get totalMontantAttendu(): number {
    return this.versements().reduce((s, v) => s + (v.montantAttendu || 0), 0);
  }

  get totalEcart(): number {
    return this.versements().reduce((s, v) => s + (v.ecart || 0), 0);
  }

  get nbAlertesRouges(): number {
    return this.versements().filter(v => v.alerteRouge).length;
  }
}
