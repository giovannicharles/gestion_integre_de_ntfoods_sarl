import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CodeValidationService, CodeValidation, AttributionCodeResponse } from '../../../../core/services/code-validation.service';
import { ApiService } from '../../../../core/services/api.service';

@Component({
  selector: 'app-admin-code-validation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-code-validation.component.html',
  styleUrls: ['./admin-code-validation.component.css']
})
export class AdminCodeValidationComponent implements OnInit {
  private codeValidationService = inject(CodeValidationService);
  private apiService = inject(ApiService);

  codes = this.codeValidationService.codesActifs;
  loading = this.codeValidationService.loading;
  error = this.codeValidationService.error;

  utilisateurs: any[] = [];
  utilisateurSelectionne: number | null = null;
  dateExpiration: string = '';
  maxUtilisations: number | null = null;
  commentaire: string = '';

  nouveauCode: string = '';
  showCodeModal = false;
  showRevokeModal = false;
  codeToRevoke: CodeValidation | null = null;
  motifRevocation: string = '';

  ngOnInit() {
    this.codeValidationService.listerCodesActifs();
    this.chargerUtilisateurs();
  }

  chargerUtilisateurs() {
    this.apiService.get('/api/auth/utilisateurs').subscribe({
      next: (data: any) => {
        this.utilisateurs = data;
      },
      error: (err) => {
        console.error('Erreur lors du chargement des utilisateurs', err);
      }
    });
  }

  attribuerCode() {
    if (!this.utilisateurSelectionne) return;

    this.codeValidationService.attribuerCode(
      this.utilisateurSelectionne,
      this.dateExpiration || undefined,
      this.maxUtilisations || undefined,
      this.commentaire || undefined
    ).subscribe({
      next: (response: AttributionCodeResponse) => {
        this.nouveauCode = response.code;
        this.showCodeModal = true;
        this.codeValidationService.listerCodesActifs();
        this.resetForm();
      },
      error: (err) => {
        console.error('Erreur lors de l\'attribution du code', err);
      }
    });
  }

  confirmerRevoquer(code: CodeValidation) {
    this.codeToRevoke = code;
    this.showRevokeModal = true;
  }

  revoquerCode() {
    if (!this.codeToRevoke || !this.motifRevocation) return;

    this.codeValidationService.revoquerCode(this.codeToRevoke.id, this.motifRevocation).subscribe({
      next: () => {
        this.showRevokeModal = false;
        this.codeToRevoke = null;
        this.motifRevocation = '';
        this.codeValidationService.listerCodesActifs();
      },
      error: (err) => {
        console.error('Erreur lors de la révocation du code', err);
      }
    });
  }

  debloquerCode(code: CodeValidation) {
    this.codeValidationService.debloquerCode(code.id).subscribe({
      next: () => {
        this.codeValidationService.listerCodesActifs();
      },
      error: (err) => {
        console.error('Erreur lors du déblocage du code', err);
      }
    });
  }

  resetForm() {
    this.utilisateurSelectionne = null;
    this.dateExpiration = '';
    this.maxUtilisations = null;
    this.commentaire = '';
  }

  closeModal() {
    this.showCodeModal = false;
    this.nouveauCode = '';
  }

  closeRevokeModal() {
    this.showRevokeModal = false;
    this.codeToRevoke = null;
    this.motifRevocation = '';
  }
}
