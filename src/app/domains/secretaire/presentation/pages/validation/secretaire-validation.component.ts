import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ComptableService, DecaissementBE } from '../../../../comptable/infrastructure/comptable.service';
import { AuthService } from '../../../../../core/auth/auth.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';
import { fCFA } from '../../../../../shared/utils/format.utils';
import { CanDirective } from '../../../../../shared/directives/can.directive';

@Component({
  selector: 'app-secretaire-validation',
  standalone: true,
  imports: [CommonModule, DatePipe, CanDirective],
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

  decaissements = signal<DecaissementBE[]>([]);
  executingId = signal<string | null>(null);

  /**
   * Statuts réels (StatutDecaissement, backend) : PROPOSE (CG propose) → VALIDEE_CG (DG a validé
   * l'étape 1, malgré son nom) → VALIDEE_DG (DG a approuvé l'étape 2) → EXECUTE (Secrétaire a payé).
   * Les deux étapes de validation sont toutes les deux faites par le DG, jamais par le Contrôleur
   * Général. La secrétaire n'a qu'une seule action réelle ici : exécuter (payer) un décaissement
   * une fois VALIDEE_DG — `executerDecaissement` existait déjà côté service mais n'était appelé
   * nulle part dans le frontend (corrigé le 2026-10-16) : la secrétaire n'avait aucun moyen
   * d'exécuter un décaissement pourtant approuvé, malgré le droit que lui donne le backend.
   */
  decaissementsEnAttenteDG = computed(() =>
    this.decaissements().filter(d => d.statut === 'PROPOSE' || d.statut === 'VALIDEE_CG')
  );

  decaissementsAExecuter = computed(() =>
    this.decaissements().filter(d => d.statut === 'VALIDEE_DG')
  );

  totalEnAttente = computed(() =>
    this.decaissementsEnAttenteDG().length
  );

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.cptSvc.getDecaissements().subscribe({
      next: d => this.decaissements.set(d),
      error: () => {},
    });
  }

  statutDecClass(s: string): string {
    const map: Record<string, string> = {
      PROPOSE: 'badge bg-orange',
      VALIDEE_CG: 'badge bg-orange',
      VALIDEE_DG: 'badge bg-neutral',
      EXECUTE: 'badge bg-success',
      ANNULE: 'badge bg-red',
    };
    return map[s] ?? 'badge bg-neutral';
  }

  enAttenteDG(d: DecaissementBE): boolean {
    return d.statut === 'PROPOSE' || d.statut === 'VALIDEE_CG';
  }

  executer(d: DecaissementBE): void {
    const matricule = this.auth.user()?.matricule ?? '';
    this.executingId.set(d.numeroDecaissement);
    this.cptSvc.executerDecaissement(d.numeroDecaissement, matricule).subscribe({
      next: updated => {
        this.executingId.set(null);
        this.decaissements.update(list =>
          list.map(x => x.numeroDecaissement === updated.numeroDecaissement ? updated : x)
        );
        this.toast.success(`Décaissement ${updated.numeroDecaissement} exécuté.`);
      },
      error: e => {
        this.executingId.set(null);
        this.toast.error(extractApiError(e), "Échec de l'exécution");
      },
    });
  }
}
