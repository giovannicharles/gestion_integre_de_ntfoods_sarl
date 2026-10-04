import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { extractApiError } from '../../core/http/api-error-parser';
import { ToastService } from '../../core/services/toast.service';
import {
  libelleActionType,
  ValidationRequestDto,
  ValideurPotentielDto,
  ValidationService,
} from '../../domains/validation/infrastructure/validation.service';

/**
 * Page "Mes validations" — corrigée le 2026-09-30 : appelait `/en-attente`
 * (le vrai chemin est `/en-attente-pour-moi`), affichait des champs qui
 * n'existent pas côté backend (`workflowNom`, `demandeurNom`,
 * `minValidations`) et n'exposait ni le poids accumulé/seuil, ni qui a déjà
 * validé, ni qui peut encore valider (délégations comprises) — aucune de ces
 * données n'était renvoyée par l'ancien contrat (entité JPA brute, en plus
 * à risque de planter dès qu'une demande portait une validation).
 */
@Component({
  selector: 'app-validation-pending',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './validation-pending.component.html',
  styleUrls: ['./validation-pending.component.css'],
})
export class ValidationPendingComponent implements OnInit {
  private readonly validationService = inject(ValidationService);
  private readonly toast = inject(ToastService);

  demandesEnAttente = signal<ValidationRequestDto[]>([]);
  loading = signal<boolean>(false);
  error = signal<string | null>(null);

  selectedDemande = signal<ValidationRequestDto | null>(null);
  valideursPotentiels = signal<ValideurPotentielDto[]>([]);
  chargementValideurs = signal(false);

  showDetailModal = false;
  showValidationModal = false;
  showRejectModal = false;
  actionEnCours = false;

  codeValidation = '';
  commentaireValidation = '';
  motifRejet = '';

  libelleActionType = libelleActionType;

  ngOnInit() {
    this.chargerDemandesEnAttente();
  }

  chargerDemandesEnAttente() {
    this.loading.set(true);
    this.error.set(null);

    this.validationService.mesDemandesEnAttente().subscribe({
      next: (data) => {
        this.demandesEnAttente.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(extractApiError(err));
        this.loading.set(false);
      },
    });
  }

  /** Progression 0-100 du poids accumulé vers le seuil requis, jamais > 100 même en cas de données incohérentes. */
  progression(demande: ValidationRequestDto): number {
    if (!demande.seuilRequis) return 0;
    return Math.min(100, Math.round((demande.poidsAccumule / demande.seuilRequis) * 100));
  }

  estExpiree(dateLimite: string | null): boolean {
    return !!dateLimite && new Date(dateLimite) < new Date();
  }

  voirDetails(demande: ValidationRequestDto) {
    this.selectedDemande.set(demande);
    this.showDetailModal = true;
    this.chargerValideursPotentiels(demande.id);
  }

  private chargerValideursPotentiels(id: number) {
    this.chargementValideurs.set(true);
    this.valideursPotentiels.set([]);
    this.validationService.valideursPotentiels(id).subscribe({
      next: (v) => {
        this.valideursPotentiels.set(v);
        this.chargementValideurs.set(false);
      },
      error: () => {
        // Panneau secondaire : une panne ici ne doit pas empêcher de consulter/valider la demande.
        this.chargementValideurs.set(false);
      },
    });
  }

  ouvrirValidation(demande: ValidationRequestDto) {
    this.selectedDemande.set(demande);
    this.showValidationModal = true;
    this.codeValidation = '';
    this.commentaireValidation = '';
  }

  validerDemande() {
    const demande = this.selectedDemande();
    if (!demande || !this.codeValidation || this.actionEnCours) return;
    this.actionEnCours = true;

    this.validationService.valider(demande.id, this.codeValidation, this.commentaireValidation).subscribe({
      next: () => {
        this.actionEnCours = false;
        this.showValidationModal = false;
        this.selectedDemande.set(null);
        this.codeValidation = '';
        this.commentaireValidation = '';
        this.toast.success('Validation enregistrée.');
        this.chargerDemandesEnAttente();
      },
      error: (err) => {
        this.actionEnCours = false;
        this.toast.error(extractApiError(err), 'Validation impossible');
      },
    });
  }

  ouvrirRejet(demande: ValidationRequestDto) {
    this.selectedDemande.set(demande);
    this.showRejectModal = true;
    this.motifRejet = '';
  }

  rejeterDemande() {
    const demande = this.selectedDemande();
    if (!demande || !this.motifRejet || this.actionEnCours) return;
    this.actionEnCours = true;

    this.validationService.rejeter(demande.id, this.motifRejet).subscribe({
      next: () => {
        this.actionEnCours = false;
        this.showRejectModal = false;
        this.selectedDemande.set(null);
        this.motifRejet = '';
        this.toast.success('Demande rejetée.');
        this.chargerDemandesEnAttente();
      },
      error: (err) => {
        this.actionEnCours = false;
        this.toast.error(extractApiError(err), 'Rejet impossible');
      },
    });
  }

  fermerModal() {
    this.showValidationModal = false;
    this.selectedDemande.set(null);
    this.codeValidation = '';
    this.commentaireValidation = '';
  }

  fermerRejetModal() {
    this.showRejectModal = false;
    this.selectedDemande.set(null);
    this.motifRejet = '';
  }

  fermerDetailModal() {
    this.showDetailModal = false;
    this.selectedDemande.set(null);
    this.valideursPotentiels.set([]);
  }

  formatDate(dateStr: string | null): string {
    return dateStr ? new Date(dateStr).toLocaleString('fr-FR') : '—';
  }
}
