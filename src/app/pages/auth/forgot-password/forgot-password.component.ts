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
      telephone: ['', [Validators.required]]
    });
  }

  onSubmit() {
    if (this.forgotForm.invalid) return;
    this.loading.set(true);
    this.error.set('');
    const telephone = (this.forgotForm.value.telephone as string).trim();

    this.authService.requestOtp(telephone, 'MOT_DE_PASSE_OUBLIE').subscribe({
      next: (res) => {
        this.loading.set(false);
        this.submitted.set(true);
        setTimeout(() => {
          // otpRef (référence opaque, jamais le matricule) et telephone (nécessaire pour
          // renvoyer un code) sont portés à l'étape suivante par l'URL.
          this.router.navigate(['/auth/otp'], {
            queryParams: { otpRef: res.otpRef, telephone, motif: 'reset' }
          });
        }, 1200);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.erreur || err?.message || 'Numéro de téléphone invalide.');
      }
    });
  }

  goToLogin() {
    this.router.navigate(['/auth/login']);
  }
}
