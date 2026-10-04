import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';

export interface ValidationWorkflow {
  id: number;
  code: string;
  nom: string;
  description: string;
  moduleSource: string;
  minValidations: number;
  maxValidations: number;
  rolesAutorises: string[];
  exigeCodeValidation: boolean;
  delaiMaxHeures: number;
  notificationAuto: boolean;
  actif: boolean;
  dateCreation: string;
}

@Component({
  selector: 'app-admin-validation-workflows',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-validation-workflows.component.html',
  styleUrls: ['./admin-validation-workflows.component.css']
})
export class AdminValidationWorkflowsComponent implements OnInit {
  private apiService = inject(ApiService);

  workflows: ValidationWorkflow[] = [];
  loading = false;
  error: string | null = null;

  showCreateModal = false;
  showEditModal = false;
  selectedWorkflow: ValidationWorkflow | null = null;

  newWorkflow = {
    code: '',
    nom: '',
    description: '',
    moduleSource: '',
    minValidations: 2,
    maxValidations: null,
    rolesAutorises: '',
    exigeCodeValidation: true,
    delaiMaxHeures: null,
    notificationAuto: true
  };

  ngOnInit() {
    this.chargerWorkflows();
  }

  chargerWorkflows() {
    this.loading = true;
    this.error = null;

    this.apiService.get('/api/v1/validation/workflows').subscribe({
      next: (data: any) => {
        this.workflows = data;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Erreur lors du chargement des workflows';
        this.loading = false;
      }
    });
  }

  creerWorkflow() {
    this.apiService.post('/api/v1/validation/workflows', this.newWorkflow).subscribe({
      next: () => {
        this.showCreateModal = false;
        this.resetForm();
        this.chargerWorkflows();
      },
      error: (err) => {
        console.error('Erreur lors de la création du workflow', err);
      }
    });
  }

  editerWorkflow(workflow: ValidationWorkflow) {
    this.selectedWorkflow = workflow;
    this.showEditModal = true;
  }

  activerDesactiver(workflow: ValidationWorkflow) {
    this.apiService.put(`/api/v1/validation/workflows/${workflow.id}/activer`, { actif: !workflow.actif }).subscribe({
      next: () => {
        this.chargerWorkflows();
      },
      error: (err) => {
        console.error('Erreur lors de la modification du workflow', err);
      }
    });
  }

  resetForm() {
    this.newWorkflow = {
      code: '',
      nom: '',
      description: '',
      moduleSource: '',
      minValidations: 2,
      maxValidations: null,
      rolesAutorises: '',
      exigeCodeValidation: true,
      delaiMaxHeures: null,
      notificationAuto: true
    };
  }

  closeCreateModal() {
    this.showCreateModal = false;
    this.resetForm();
  }

  closeEditModal() {
    this.showEditModal = false;
    this.selectedWorkflow = null;
  }
}
