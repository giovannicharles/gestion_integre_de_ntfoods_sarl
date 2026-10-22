import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.css'
})
export class ForgotPasswordComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  forgotForm: FormGroup;
  loading = signal(false);
  submitted = signal(false);
  error = signal('');

  constructor(private fb: FormBuilder) {
    this.forgotForm = this.fb.group({
      matricule: ['', [Validators.required]]
    });
  }

  onSubmit() {
    if (this.forgotForm.invalid) return;
    this.loading.set(true);
    this.error.set('');
    const matricule = (this.forgotForm.value.matricule as string).trim().toUpperCase();

    this.authService.requestOtp(matricule, 'MOT_DE_PASSE_OUBLIE').subscribe({
      next: () => {
        this.loading.set(false);
        this.submitted.set(true);
        setTimeout(() => {
          this.router.navigate(['/auth/otp'], { queryParams: { matricule, motif: 'reset' } });
        }, 1200);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.erreur || err?.message || 'Matricule invalide. Vérifiez le format (ex: GS-001).');
      }
    });
  }

  goToLogin() {
    this.router.navigate(['/auth/login']);
  }
}
