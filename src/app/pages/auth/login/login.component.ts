import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { inject, signal } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { LoginRequest } from '../../../core/models/auth.models';
import { ROLE_HOMES, UserRole } from '../../../core/models/user.models';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  loginForm: FormGroup;
  loading = signal(false);
  showPassword = false;
  error = signal('');

  constructor(private fb: FormBuilder) {
    this.loginForm = this.fb.group({
      matricule: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  onSubmit() {
    if (this.loginForm.valid) {
      this.loading.set(true);
      this.error.set('');

      const loginRequest: LoginRequest = {
        matricule: this.loginForm.value.matricule,
        password: this.loginForm.value.password
      };

      this.authService.login(loginRequest).subscribe({
        next: (response) => {
          this.loading.set(false);
          const user = this.authService.getCurrentUser();
          const primaryRole = user?.roles?.[0] as UserRole ?? 'GESTIONNAIRE_STOCK';
          const targetRoute = ROLE_HOMES[primaryRole] ?? '/stock/dashboard';
          this.router.navigate([targetRoute]);
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set('Identifiants invalides. Veuillez réessayer.');
          // this.error.set(err.message);
          console.error('Erreur de connexion:', err);
        }
      });
    }
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  goToForgotPassword() {
    this.router.navigate(['/auth/forgot-password']);
  }
}
