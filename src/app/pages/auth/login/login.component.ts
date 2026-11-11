import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { LoginRequest } from '../../../core/models/auth.models';
import { ROLE_HOMES, UserRole } from '../../../core/models/user.models';
import { extractApiError } from '../../../core/http/api-error-parser';

const REMEMBER_MATRICULE_KEY = 'tanty_saved_matricule';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  loginForm: FormGroup;
  loading = signal(false);
  showPassword = false;
  error = signal('');
  hasError = signal(false);
  passwordResetSuccess = signal(false);
  sessionReasonBanner = signal<{ tone: 'warning' | 'danger'; text: string } | null>(null);
  capsLockOn = signal(false);
  rememberMatricule = signal(false);

  constructor(private fb: FormBuilder) {
    const savedMatricule = localStorage.getItem(REMEMBER_MATRICULE_KEY) ?? '';
    this.rememberMatricule.set(Boolean(savedMatricule));

    this.loginForm = this.fb.group({
      matricule: [savedMatricule, [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });

    this.passwordResetSuccess.set(this.route.snapshot.queryParamMap.get('motDePasseReinitialise') === '1');

    const reason = this.route.snapshot.queryParamMap.get('reason');
    if (reason === 'expired') {
      this.sessionReasonBanner.set({
        tone: 'warning',
        text: 'Votre session est arrivée à expiration par mesure de sécurité. Veuillez vous reconnecter.'
      });
    } else if (reason === 'unauthorized') {
      this.sessionReasonBanner.set({
        tone: 'warning',
        text: 'Authentification requise pour accéder à cet espace. Veuillez vous identifier.'
      });
    } else if (reason === 'locked') {
      this.sessionReasonBanner.set({
        tone: 'danger',
        text: 'Votre compte a été verrouillé par l\'administration. Contactez un responsable NTFOODS.'
      });
    }
  }

  onKeyEvent(event: KeyboardEvent): void {
    if (typeof event.getModifierState === 'function') {
      this.capsLockOn.set(event.getModifierState('CapsLock'));
    }
  }

  toggleRememberMatricule(checked: boolean): void {
    this.rememberMatricule.set(checked);
    if (!checked) {
      localStorage.removeItem(REMEMBER_MATRICULE_KEY);
    }
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set('');
    this.hasError.set(false);
    this.sessionReasonBanner.set(null);

    const matriculeClean = String(this.loginForm.value.matricule ?? '').trim();
    if (this.rememberMatricule() && matriculeClean) {
      localStorage.setItem(REMEMBER_MATRICULE_KEY, matriculeClean);
    } else {
      localStorage.removeItem(REMEMBER_MATRICULE_KEY);
    }

    const loginRequest: LoginRequest = {
      matricule: matriculeClean,
      motDePasse: this.loginForm.value.password
    };

    this.authService.login(loginRequest).subscribe({
      next: () => {
        this.loading.set(false);
        const user = this.authService.getCurrentUser();
        const primaryRole = (user?.roles?.[0] as UserRole) ?? 'GESTIONNAIRE_STOCK';
        const targetRoute = ROLE_HOMES[primaryRole] ?? '/stock/dashboard';
        this.router.navigate([targetRoute]);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(extractApiError(err));
        this.hasError.set(true);
        setTimeout(() => this.hasError.set(false), 500);
      }
    });
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  goToForgotPassword(): void {
    this.router.navigate(['/auth/forgot-password']);
  }
}
