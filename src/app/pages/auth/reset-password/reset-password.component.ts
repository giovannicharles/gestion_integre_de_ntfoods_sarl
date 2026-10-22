import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

/**
 * Dernière étape du parcours « mot de passe oublié » : nécessite la session JWT ouverte par
 * `two-fa` (vérification OTP = preuve d'identité). Arrivée directe sans cette session → retour
 * au point de départ, cette page n'a pas de sens isolée.
 */
@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.css'
})
export class ResetPasswordComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);

  resetForm: FormGroup;
  loading = signal(false);
  showPassword = false;
  showConfirmPassword = false;
  error = signal('');

  constructor(private fb: FormBuilder) {
    this.resetForm = this.fb.group({
      // Même politique que le serveur (PolitiqueMotDePasse.java) : au moins 8 caractères,
      // une lettre et un chiffre — vérifié ici pour un retour immédiat, imposé côté serveur.
      password: ['', [Validators.required, Validators.minLength(8), this.complexityValidator]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  private complexityValidator(control: AbstractControl): ValidationErrors | null {
    const value = control.value as string;
    if (!value) return null;
    const hasLetter = /[a-zA-Z]/.test(value);
    const hasDigit = /[0-9]/.test(value);
    return hasLetter && hasDigit ? null : { complexity: true };
  }

  ngOnInit(): void {
    if (!this.authService.isLoggedIn()) {
      // Cette page suppose une identité déjà prouvée par OTP (voir two-fa) : sans session,
      // changer "son" mot de passe n'a pas de sens — retour au point de départ du parcours.
      this.router.navigate(['/auth/forgot-password']);
    }
  }

  passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordMismatch: true };
  }

  onSubmit() {
    if (this.resetForm.invalid || this.loading()) return;
    this.loading.set(true);
    this.error.set('');

    this.authService.changePassword(this.resetForm.value.password).subscribe({
      next: () => {
        this.loading.set(false);
        // Déconnexion volontaire : l'utilisateur se reconnecte avec le nouveau mot de passe,
        // preuve concrète que le changement a bien fonctionné (pas juste une redirection).
        this.authService.logout();
        this.router.navigate(['/auth/login'], { queryParams: { motDePasseReinitialise: '1' } });
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.erreur || err?.message || 'Échec du changement de mot de passe.');
      }
    });
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPassword() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  goToLogin() {
    this.router.navigate(['/auth/login']);
  }
}
