import { Component, ElementRef, OnDestroy, OnInit, QueryList, ViewChildren, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

const CODE_LENGTH = 6;

/**
 * Vérification OTP — parcours « mot de passe oublié par téléphone » (2026-10-25 : identifié par
 * téléphone, pas par matricule — le matricule n'est jamais connu côté client). `verifyOtp` ouvre
 * une vraie session JWT au même titre qu'une connexion normale ; l'étape suivante
 * (reset-password) s'appuie sur cette session.
 */
@Component({
  selector: 'app-two-fa',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './two-fa.component.html',
  styleUrl: './two-fa.component.css'
})
export class TwoFaComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  @ViewChildren('digitInput') digitInputs!: QueryList<ElementRef<HTMLInputElement>>;

  otpForm: FormGroup;
  digits = signal<string[]>(Array(CODE_LENGTH).fill(''));
  loading = signal(false);
  resending = signal(false);
  error = signal('');
  countdown = signal(60);
  canResend = signal(false);
  /** Référence opaque de l'OTP en cours (jamais le matricule — voir auth.service.ts). */
  otpRef = 0;
  /** Numéro de téléphone saisi à l'étape précédente, nécessaire pour un renvoi de code. */
  telephone = '';
  readonly codeLength = CODE_LENGTH;
  readonly indices = Array.from({ length: CODE_LENGTH }, (_, i) => i);

  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(private fb: FormBuilder) {
    this.otpForm = this.fb.group({
      otp: ['', [Validators.required, Validators.pattern(`^[0-9]{${CODE_LENGTH}}$`)]]
    });
  }

  ngOnInit(): void {
    const otpRefParam = this.route.snapshot.queryParamMap.get('otpRef');
    this.telephone = this.route.snapshot.queryParamMap.get('telephone') || '';
    this.otpRef = otpRefParam ? Number(otpRefParam) : NaN;
    if (!this.telephone || Number.isNaN(this.otpRef)) {
      // Cette page n'a de sens qu'après avoir demandé un OTP (elle a besoin de la référence
      // opaque et du téléphone pour un éventuel renvoi) : arrivée directe sans contexte →
      // retour au point de départ du parcours.
      this.router.navigate(['/auth/forgot-password']);
      return;
    }
    this.startCountdown();
  }

  ngOnDestroy(): void {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  onDigitInput(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const raw = input.value.replace(/[^0-9]/g, '');
    const value = raw.slice(-1);
    const next = [...this.digits()];
    next[index] = value;
    this.digits.set(next);
    this.syncForm();
    if (value && index < CODE_LENGTH - 1) {
      this.digitInputs.get(index + 1)?.nativeElement.focus();
    }
  }

  onDigitKeydown(index: number, event: KeyboardEvent): void {
    if (event.key === 'Backspace' && !this.digits()[index] && index > 0) {
      this.digitInputs.get(index - 1)?.nativeElement.focus();
    } else if (event.key === 'ArrowLeft' && index > 0) {
      this.digitInputs.get(index - 1)?.nativeElement.focus();
    } else if (event.key === 'ArrowRight' && index < CODE_LENGTH - 1) {
      this.digitInputs.get(index + 1)?.nativeElement.focus();
    }
  }

  onPaste(event: ClipboardEvent): void {
    const pasted = event.clipboardData?.getData('text').replace(/[^0-9]/g, '').slice(0, CODE_LENGTH);
    if (!pasted) return;
    event.preventDefault();
    const next = Array(CODE_LENGTH).fill('');
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    this.digits.set(next);
    this.syncForm();
    const lastFilled = Math.min(pasted.length, CODE_LENGTH) - 1;
    this.digitInputs.get(Math.max(lastFilled, 0))?.nativeElement.focus();
  }

  private syncForm(): void {
    this.otpForm.get('otp')?.setValue(this.digits().join(''));
  }

  onSubmit() {
    if (this.otpForm.invalid || this.loading()) return;
    this.loading.set(true);
    this.error.set('');

    this.authService.verifyOtp(this.otpRef, this.otpForm.value.otp).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/auth/reset-password']);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.erreur || err?.message || 'Code OTP invalide ou expiré.');
        this.digits.set(Array(CODE_LENGTH).fill(''));
        this.otpForm.get('otp')?.setValue('');
        this.digitInputs.get(0)?.nativeElement.focus();
      }
    });
  }

  startCountdown() {
    this.countdown.set(60);
    this.canResend.set(false);
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = setInterval(() => {
      const next = this.countdown() - 1;
      this.countdown.set(next);
      if (next <= 0) {
        if (this.intervalId) clearInterval(this.intervalId);
        this.canResend.set(true);
      }
    }, 1000);
  }

  resendOtp() {
    if (!this.canResend() || this.resending()) return;
    this.resending.set(true);
    this.error.set('');
    this.authService.requestOtp(this.telephone, 'MOT_DE_PASSE_OUBLIE').subscribe({
      next: (res) => {
        this.otpRef = res.otpRef;
        this.resending.set(false);
        this.digits.set(Array(CODE_LENGTH).fill(''));
        this.otpForm.get('otp')?.setValue('');
        this.startCountdown();
        this.digitInputs.get(0)?.nativeElement.focus();
      },
      error: (err) => {
        this.resending.set(false);
        this.error.set(err?.error?.erreur || err?.message || 'Échec du renvoi du code.');
      }
    });
  }

  goToLogin() {
    this.router.navigate(['/auth/login']);
  }
}
