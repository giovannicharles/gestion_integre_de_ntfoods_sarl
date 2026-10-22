import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ComptableService, DecaissementBE } from '../../../../comptable/infrastructure/comptable.service';
import { fCFA } from '../../../../../shared/utils/format.utils';
import { ToastService } from '../../../../../core/services/toast.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';
import { CanDirective } from '../../../../../shared/directives/can.directive';

@Component({
  selector: 'app-dg-decaissements',
  standalone: true,
  imports: [CommonModule, DatePipe, CanDirective],
  templateUrl: './dg-decaissements.component.html',
  styleUrls: ['./dg-decaissements.component.css']
})
/**
 * Statuts réels (StatutDecaissement, backend) — corrigé le 2026-10-15 (P5) : les anciens
 * EN_ATTENTE_DG/DG_APPROUVE/VALIDE n'existent nulle part côté serveur (vérifié par grep +
 * lecture de l'enum), si bien que chaque KPI de cet écran affichait 0 et aucun filtre ne
 * matchait jamais rien. Workflow réel (DecaissementController, 3 étapes) : le Contrôleur
 * Général PROPOSE, puis le DG fait LES DEUX validations suivantes (jamais le CG une seconde
 * fois, malgré le nom du statut intermédiaire) : validerParDG → VALIDEE_CG, puis
 * approuverParDG → VALIDEE_DG. La Secrétaire exécute ensuite (VALIDEE_DG → EXECUTE).
 */
export class DgDecaissementsComponent implements OnInit {
  today = new Date();
  private readonly cptSvc = inject(ComptableService);
  private readonly toast = inject(ToastService);
  decaissements = signal<DecaissementBE[]>([]);
  filterStatut = signal<'all' | 'PROPOSE' | 'VALIDEE_CG' | 'VALIDEE_DG' | 'EXECUTE'>('all');

  liste = computed(() => {
    const f = this.filterStatut();
    return f === 'all' ? this.decaissements() : this.decaissements().filter(d => d.statut === f);
  });

  nbEnAttentesDG = computed(() => this.decaissements().filter(d => d.statut === 'PROPOSE').length);
  totalEnAttente = computed(() => this.decaissements().filter(d => d.statut === 'PROPOSE' || d.statut === 'VALIDEE_CG').reduce((s, d) => s + d.montantFCFA, 0));
  nbValides = computed(() => this.decaissements().filter(d => d.statut === 'EXECUTE').length);
  totalValide = computed(() => this.decaissements().filter(d => d.statut === 'EXECUTE').reduce((s, d) => s + d.montantFCFA, 0));
  totalDecaissements = computed(() => this.decaissements().reduce((s, d) => s + d.montantFCFA, 0));

  fCFA = fCFA;

  ngOnInit(): void {
    this.cptSvc.getDecaissements().subscribe({
      next: d => this.decaissements.set(d),
      error: (err) => this.toast.error(extractApiError(err), 'Chargement des décaissements impossible'),
    });
  }

  /** Étape 1 (PROPOSE → VALIDEE_CG) ou étape 2 (VALIDEE_CG → VALIDEE_DG) selon le statut actuel. */
  approuverDG(dec: DecaissementBE) {
    const appel = dec.statut === 'PROPOSE'
      ? this.cptSvc.validerDecaissementDG(dec.numeroDecaissement, '')
      : this.cptSvc.approuverDecaissementDG(dec.numeroDecaissement, '');
    appel.subscribe({
      next: updated => {
        this.decaissements.update(list => list.map(d => d.numeroDecaissement === dec.numeroDecaissement ? updated : d));
        this.toast.success(`Décaissement ${dec.numeroDecaissement} ${dec.statut === 'PROPOSE' ? 'validé (étape 1)' : 'approuvé (étape 2)'}`);
      },
      error: (err) => this.toast.error(extractApiError(err), 'Validation impossible'),
    });
  }
  refuserDG(numero: string) {
    this.cptSvc.annulerDecaissement(numero, 'Refusé par DG', '').subscribe({
      next: updated => {
        this.decaissements.update(list => list.map(d => d.numeroDecaissement === numero ? updated : d));
        this.toast.success(`Décaissement ${numero} refusé`);
      },
      error: (err) => this.toast.error(extractApiError(err), 'Refus impossible'),
    });
  }
}
