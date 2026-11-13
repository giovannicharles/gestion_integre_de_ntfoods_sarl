import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ComptableService, DecaissementBE } from '../../../../comptable/infrastructure/comptable.service';
import { AuthService } from '../../../../../core/auth/auth.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';
import { fCFA } from '../../../../../shared/utils/format.utils';
import { CanDirective } from '../../../../../shared/directives/can.directive';

@Component({
  selector: 'app-secretaire-validation',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, CanDirective],
  templateUrl: './secretaire-validation.component.html',
  styleUrls: ['./secretaire-validation.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SecretaireValidationComponent implements OnInit {
  today = new Date();
  fCFA = fCFA;
  private readonly cptSvc = inject(ComptableService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  loading = signal(false);
  decaissements = signal<DecaissementBE[]>([]);
  executingId = signal<string | null>(null);

  searchQuery = signal<string>('');
  filtreStatut = signal<'TOUS' | 'VALIDEE_DG' | 'EN_ATTENTE_DG' | 'EXECUTE'>('VALIDEE_DG');

  // Modal d'impression officielle reçu de décaissement
  decaissementAImprimer = signal<DecaissementBE | null>(null);

  readonly decaissementsFiltres = computed(() => {
    let list = this.decaissements();
    const q = this.searchQuery().trim().toLowerCase();
    const st = this.filtreStatut();

    if (q) {
      list = list.filter(d =>
        d.numeroDecaissement.toLowerCase().includes(q) ||
        (d.beneficiaire && d.beneficiaire.toLowerCase().includes(q)) ||
        (d.motif && d.motif.toLowerCase().includes(q)) ||
        (d.typeDepense && d.typeDepense.toLowerCase().includes(q))
      );
    }

    if (st === 'VALIDEE_DG') {
      list = list.filter(d => d.statut === 'VALIDEE_DG');
    } else if (st === 'EN_ATTENTE_DG') {
      list = list.filter(d => d.statut === 'PROPOSE' || d.statut === 'VALIDEE_CG');
    } else if (st === 'EXECUTE') {
      list = list.filter(d => d.statut === 'EXECUTE');
    }
    return list;
  });

  decaissementsEnAttenteDG = computed(() =>
    this.decaissements().filter(d => d.statut === 'PROPOSE' || d.statut === 'VALIDEE_CG')
  );

  decaissementsAExecuter = computed(() =>
    this.decaissements().filter(d => d.statut === 'VALIDEE_DG')
  );

  decaissementsExecutes = computed(() =>
    this.decaissements().filter(d => d.statut === 'EXECUTE')
  );

  totalMontantAExecuter = computed(() =>
    this.decaissementsAExecuter().reduce((s, d) => s + d.montantFCFA, 0)
  );

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.cptSvc.getDecaissements().subscribe({
      next: d => {
        this.decaissements.set(d || []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  statutDecClass(s: string): string {
    const map: Record<string, string> = {
      PROPOSE: 'badge bg-orange',
      VALIDEE_CG: 'badge bg-gold',
      VALIDEE_DG: 'badge bg-primary',
      EXECUTE: 'badge bg-success',
      ANNULE: 'badge bg-red',
    };
    return map[s] ?? 'badge bg-neutral';
  }

  executer(d: DecaissementBE): void {
    const matricule = this.auth.user()?.matricule ?? 'SECRETAIRE';
    this.executingId.set(d.numeroDecaissement);
    this.cptSvc.executerDecaissement(d.numeroDecaissement, matricule).subscribe({
      next: updated => {
        this.executingId.set(null);
        this.decaissements.update(list =>
          list.map(x => x.numeroDecaissement === updated.numeroDecaissement ? updated : x)
        );
        this.toast.success(`Décaissement ${updated.numeroDecaissement} exécuté et payé au bénéficiaire.`);
      },
      error: e => {
        this.executingId.set(null);
        this.toast.error(extractApiError(e), "Échec de l'exécution");
      },
    });
  }

  imprimerRecu(d: DecaissementBE): void {
    this.decaissementAImprimer.set(d);
  }

  fermerImpression(): void {
    this.decaissementAImprimer.set(null);
  }

  lancerImpression(): void {
    window.print();
  }

  exporterCsv(): void {
    const list = this.decaissementsFiltres();
    let csv = 'Numero;Type_Depense;Beneficiaire;Montant_FCFA;Motif;Statut;Date_Depense\n';
    list.forEach(d => {
      csv += `"${d.numeroDecaissement}";"${d.typeDepense}";"${d.beneficiaire}";"${d.montantFCFA}";"${d.motif || ''}";"${d.statut}";"${new Date(d.dateDepense).toLocaleDateString()}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `decaissements_caisse_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.toast.info('Export CSV des décaissements téléchargé.');
  }
}
