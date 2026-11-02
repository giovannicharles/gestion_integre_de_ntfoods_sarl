import { Component, signal, inject, ChangeDetectionStrategy} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']
})
export class SettingsComponent {
  private readonly router = inject(Router);
  private readonly fb = new FormBuilder();

  notificationForm: FormGroup;
  activeTab = signal('profile');
  toastMsg = signal('');
  toastType = signal<'success' | 'error'>('success');
  saving = signal(false);

  /**
   * Les onglets Profil/Sécurité redirigent vers "Mon Profil" (2026-11-02) : ils appelaient
   * v1/users/{matricule}/profile et /password, deux routes qui n'existent nulle part côté
   * API (404 systématique) - l'écran partagé /stock/profil (MonProfilComponent) fait déjà
   * ce travail correctement contre les vraies routes (GET/PUT /api/auth/profil,
   * PUT /api/auth/mon-mot-de-passe). Seules les préférences de notification, propres à cet
   * écran et sans équivalent ailleurs, restent ici.
   */
  constructor() {
    const savedPrefs = this.loadNotifPrefs();
    this.notificationForm = this.fb.group({
      emailNotifications: [savedPrefs.emailNotifications],
      pushNotifications: [savedPrefs.pushNotifications],
      stockAlerts: [savedPrefs.stockAlerts],
      orderUpdates: [savedPrefs.orderUpdates],
      systemUpdates: [savedPrefs.systemUpdates]
    });
  }

  setActiveTab(tab: string): void {
    this.activeTab.set(tab);
  }

  goToMonProfil(): void {
    this.router.navigate(['/stock/profil']);
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
