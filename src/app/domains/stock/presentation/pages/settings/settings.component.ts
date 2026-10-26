import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../../../../../core/auth/auth.service';
import { ApiService } from '../../../../../core/http/api.service';
import { ApiResponse } from '../../../../../core/models/api-response.model';
import { extractApiError } from '../../../../../core/http/api-error-parser';

/** GET /auth/me (ProfilResponse) — champs modifiables par l'utilisateur lui-même compris. */
interface ProfilBE {
  matricule: string; prenom: string; nom: string; email: string; telephone: string | null;
  residence: string | null; cni: string | null; photo: string | null; dateNaissance: string | null;
  lieuNaissance: string | null; sexe: string | null;
}

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
  /** L'API n'a pas d'endpoint « changer mon mot de passe » : réinitialisation par l'administrateur uniquement. */
  readonly motDePasseLibreService = false;
  /** Profil complet chargé : PUT /auth/profil remplace tous les champs, on renvoie donc ceux non édités tels quels. */
  private profil: ProfilBE | null = null;

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

    // Identité (nom, prénom, email) : gérée par l'administrateur, affichée en lecture seule.
    this.profileForm = this.fb.group({
      firstName: [{ value: user?.firstname || '', disabled: true }],
      lastName: [{ value: user?.lastname || '', disabled: true }],
      matricule: [{ value: user?.matricule || '', disabled: true }],
      email: [{ value: '', disabled: true }],
      phone: ['', [Validators.maxLength(30)]],
      residence: ['', [Validators.maxLength(255)]],
      role: [{ value: readableRole, disabled: true }]
    });
    this.chargerProfil();

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

  private chargerProfil(): void {
    this.api.get<ApiResponse<ProfilBE>>('auth/me').subscribe({
      next: r => {
        const p = r.donnees;
        if (!p) return;
        this.profil = p;
        this.profileForm.patchValue({ firstName: p.prenom, lastName: p.nom, email: p.email, phone: p.telephone ?? '', residence: p.residence ?? '' });
      },
      error: e => this.showToast('Impossible de charger votre profil : ' + extractApiError(e), 'error')
    });
  }

  saveProfile(): void {
    if (!this.profileForm.valid) return;
    if (!this.profil) { this.showToast('Profil non chargé : rechargez la page avant d\'enregistrer.', 'error'); return; }
    const p = this.profil;
    this.saving.set(true);
    this.api.put<ApiResponse<ProfilBE>>('auth/profil', {
      telephone: this.profileForm.value.phone || null,
      residence: this.profileForm.value.residence || null,
      photo: p.photo, cni: p.cni, dateNaissance: p.dateNaissance, lieuNaissance: p.lieuNaissance, sexe: p.sexe
    }).subscribe({
      next: r => {
        if (r.donnees) this.profil = r.donnees;
        this.saving.set(false);
        this.showToast('Profil enregistré', 'success');
      },
      error: e => {
        this.saving.set(false);
        this.showToast('Enregistrement impossible : ' + extractApiError(e), 'error');
      }
    });
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
    // Aucun endpoint « changer mon mot de passe » dans l'API : l'administrateur réinitialise.
    this.passwordError.set('Le changement de mot de passe en libre-service n\'est pas disponible. Demandez une réinitialisation à l\'administrateur.');
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
