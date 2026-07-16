import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../../../../core/auth/auth.service';
import { ApiService } from '../../../../../core/http/api.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']
})
export class SettingsComponent {
  private readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly fb = new FormBuilder();

  profileForm: FormGroup;
  notificationForm: FormGroup;
  securityForm: FormGroup;
  activeTab = signal('profile');
  toastMsg = signal('');
  toastType = signal<'success' | 'error'>('success');
  saving = signal(false);
  passwordError = signal('');

  constructor() {
    const user = this.auth.getCurrentUser();
    const roles = user?.roles?.join(', ') || '—';
    const roleLabel: Record<string, string> = {
      GESTIONNAIRE_STOCK: 'Gestionnaire de Stock',
      CHEF_PRODUCTION: 'Chef de Production',
      COMMERCIAL: 'Commercial',
      CONTROLEUR_GENERAL: 'Contrôleur Général',
      COMPTABLE: 'Comptable',
      DIRECTEUR_GENERAL: 'Directeur Général',
      ADMIN: 'Administrateur'
    };
    const readableRole = user?.roles?.map(r => roleLabel[r] || r).join(', ') || '—';

    this.profileForm = this.fb.group({
      firstName: [user?.firstname || '', Validators.required],
      lastName: [user?.lastname || '', Validators.required],
      matricule: [{ value: user?.matricule || '', disabled: true }],
      email: ['', [Validators.email]],
      phone: ['', []],
      role: [{ value: readableRole, disabled: true }]
    });

    const savedPrefs = this.loadNotifPrefs();
    this.notificationForm = this.fb.group({
      emailNotifications: [savedPrefs.emailNotifications],
      pushNotifications: [savedPrefs.pushNotifications],
      stockAlerts: [savedPrefs.stockAlerts],
      orderUpdates: [savedPrefs.orderUpdates],
      systemUpdates: [savedPrefs.systemUpdates]
    });

    this.securityForm = this.fb.group({
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required]
    });
  }

  setActiveTab(tab: string): void {
    this.activeTab.set(tab);
  }

  saveProfile(): void {
    if (this.profileForm.valid) {
      this.saving.set(true);
      const user = this.auth.getCurrentUser();
      if (!user) { this.saving.set(false); return; }
      const matricule = user.matricule;
      this.api.put(`v1/users/${matricule}/profile`, {
        firstname: this.profileForm.value.firstName,
        lastname: this.profileForm.value.lastName,
        phone: this.profileForm.value.phone || ''
      }).subscribe({
        next: () => {
          const updated = {
            ...user,
            firstname: this.profileForm.value.firstName,
            lastname: this.profileForm.value.lastName
          };
          localStorage.setItem('currentUser', JSON.stringify(updated));
          this.saving.set(false);
          this.showToast('Profil enregistré', 'success');
        },
        error: () => {
          this.saving.set(false);
          this.showToast('Erreur lors de l\'enregistrement du profil', 'error');
        }
      });
    }
  }

  saveNotifications(): void {
    this.saving.set(true);
    const prefs = this.notificationForm.value;
    localStorage.setItem('notifPrefs', JSON.stringify(prefs));
    setTimeout(() => {
      this.saving.set(false);
      this.showToast('Préférences enregistrées', 'success');
    }, 400);
  }

  changePassword(): void {
    this.passwordError.set('');
    if (this.securityForm.valid) {
      const { newPassword, confirmPassword } = this.securityForm.value;
      if (newPassword !== confirmPassword) {
        this.passwordError.set('Les mots de passe ne correspondent pas');
        return;
      }
      this.saving.set(true);
      const user = this.auth.getCurrentUser();
      if (!user) { this.saving.set(false); return; }
      this.api.put(`v1/users/${user.matricule}/password`, {
        currentPassword: this.securityForm.value.currentPassword,
        newPassword: newPassword
      }).subscribe({
        next: () => {
          this.saving.set(false);
          this.securityForm.reset();
          this.showToast('Mot de passe modifié avec succès', 'success');
        },
        error: (err: any) => {
          this.saving.set(false);
          const msg = err?.error?.message || 'Erreur lors du changement de mot de passe';
          this.passwordError.set(msg);
        }
      });
    }
  }

  private loadNotifPrefs(): any {
    const raw = localStorage.getItem('notifPrefs');
    if (raw) {
      try { return JSON.parse(raw); } catch { /* ignore */ }
    }
    return { emailNotifications: true, pushNotifications: true, stockAlerts: true, orderUpdates: true, systemUpdates: false };
  }

  private showToast(msg: string, type: 'success' | 'error'): void {
    this.toastMsg.set(msg);
    this.toastType.set(type);
    setTimeout(() => this.toastMsg.set(''), 4000);
  }
}
