import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../../core/http/api.service';
import { CanDirective } from '../../../../../shared/directives/can.directive';

export interface ValidationWorkflow {
  id: number;
  code: string;
  nom: string;
  description: string;
  moduleSource: string;
  seuilPonderation: number;
  maxValidations: number | null;
  rolesAutorises: string | null;
  exigeCodeValidation: boolean;
  delaiMaxHeures: number | null;
  notificationAuto: boolean;
  actif: boolean;
  dateCreation: string;
}

/**
 * Réécrit le 2026-11-08 : appelait `/api/v1/validation/workflows`, un chemin doublement cassé -
 * `ApiService` préfixe déjà `/api`, produisant `/api/api/v1/...`, et surtout cet endpoint n'a
 * jamais existé côté backend (`ValidationWorkflowService.creerWorkflow` existait sans aucun
 * controller depuis le 2026-09-24). Ajouté : `ValidationWorkflowController`. Le bouton "Modifier"
 * existait déjà ici sans jamais ouvrir de modale (aucune n'existait) : retiré plutôt que simulé -
 * modifier le seuil/les rôles autorisés d'une politique déjà en vigueur est une décision métier
 * qui dépasse ce correctif (voir le commentaire sur le controller). Seules la création et
 * l'activation/désactivation, sans ambiguïté, sont exposées.
 */
@Component({
  selector: 'app-admin-validation-workflows',
  standalone: true,
  imports: [CommonModule, FormsModule, CanDirective],
  templateUrl: './admin-validation-workflows.component.html',
  styleUrls: ['./admin-validation-workflows.component.css']
})
export class AdminValidationWorkflowsComponent implements OnInit {
  private apiService = inject(ApiService);

  workflows: ValidationWorkflow[] = [];
  loading = false;
  error: string | null = null;
  saving = false;

  showCreateModal = false;

  newWorkflow = {
    code: '',
    nom: '',
    description: '',
    moduleSource: '',
    seuilPonderation: 1,
    maxValidations: null as number | null,
    rolesAutorises: '',
    exigeCodeValidation: true,
    delaiMaxHeures: null as number | null,
    notificationAuto: true
  };

  ngOnInit() {
    this.chargerWorkflows();
  }

  chargerWorkflows() {
    this.loading = true;
    this.error = null;
    this.apiService.get<ValidationWorkflow[]>('v1/validation/workflows').subscribe({
      next: data => {
        this.workflows = data;
        this.loading = false;
      },
      error: () => {
        this.error = 'Erreur lors du chargement des workflows';
        this.loading = false;
      }
    });
  }

  creerWorkflow() {
    if (this.saving) return;
    this.saving = true;
    this.apiService.post<ValidationWorkflow>('v1/validation/workflows', this.newWorkflow).subscribe({
      next: () => {
        this.saving = false;
        this.showCreateModal = false;
        this.resetForm();
        this.chargerWorkflows();
      },
      error: e => {
        this.saving = false;
        this.error = e?.error?.message || 'Erreur lors de la création du workflow.';
      }
    });
  }

  activerDesactiver(workflow: ValidationWorkflow) {
    const action = workflow.actif ? 'désactiver' : 'activer';
    if (!confirm(`Confirmer : ${action} le workflow "${workflow.nom}" ?`)) return;
    this.apiService.put<ValidationWorkflow>(`v1/validation/workflows/${workflow.id}/activer`, { actif: !workflow.actif }).subscribe({
      next: () => this.chargerWorkflows(),
      error: e => { this.error = e?.error?.message || 'Erreur lors de la modification du workflow.'; }
    });
  }

  resetForm() {
    this.newWorkflow = {
      code: '', nom: '', description: '', moduleSource: '', seuilPonderation: 1,
      maxValidations: null, rolesAutorises: '', exigeCodeValidation: true,
      delaiMaxHeures: null, notificationAuto: true
    };
  }

  closeCreateModal() {
    this.showCreateModal = false;
    this.resetForm();
  }
}
