import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-two-fa',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './two-fa.component.html',
  styleUrl: './two-fa.component.css'
})
export class TwoFaComponent {
  otpForm: FormGroup;
  loading = false;
  countdown = 60;
  canResend = false;

  constructor(
    private fb: FormBuilder,
    private router: Router
  ) {
    this.otpForm = this.fb.group({
      otp: ['', [Validators.required, Validators.pattern('^[0-9]{6}$')]]
    });
    this.startCountdown();
  }

  onSubmit() {
    if (this.otpForm.valid) {
      this.loading = true;
      // Simulation de vérification OTP - à remplacer par appel API réel
      setTimeout(() => {
        this.loading = false;
        this.router.navigate(['/auth/reset-password']);
      }, 1500);
    }
  }

  startCountdown() {
    const interval = setInterval(() => {
      this.countdown--;
      if (this.countdown <= 0) {
        clearInterval(interval);
        this.canResend = true;
      }
    }, 1000);
  }

  resendOtp() {
    if (this.canResend) {
      this.canResend = false;
      this.countdown = 60;
      this.startCountdown();
      // Simulation de renvoi OTP - à remplacer par appel API réel
    }
  }

  goToLogin() {
    this.router.navigate(['/auth/login']);
  }
}
