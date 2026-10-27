import { Component, ChangeDetectionStrategy, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, UtilisateurBE } from '../../../infrastructure/admin.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';
import { ROLE_LABELS } from '../../../../../core/models/user.models';
import { CanDirective } from '../../../../../shared/directives/can.directive';

interface UserUI {
  id: string; matricule: string; nom: string; prenom: string | null;
  email: string; role: string; actif: boolean; compteBloque: boolean; dateCreation: Date;
  terminalImei: string | null; derniereConnexion: Date | null;
}

interface NouvelUtilisateurForm {
  prenom: string; nom: string; email: string; motDePasse: string; role: string;
  telephone: string; residence: string; cni: string;
  dateNaissance: string; lieuNaissance: string; dateEmbauche: string; sexe: string;
}

const FORM_VIDE = (): NouvelUtilisateurForm => ({
  prenom: '', nom: '', email: '', motDePasse: '', role: '',
  telephone: '', residence: '', cni: '',
  dateNaissance: '', lieuNaissance: '', dateEmbauche: '', sexe: '',
});

@Component({
  selector: 'app-admin-utilisateurs',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, CanDirective],
  templateUrl: './admin-utilisateurs.component.html',
  styleUrls: ['./admin-utilisateurs.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminUtilisateursComponent implements OnInit {
  private readonly svc = inject(AdminService);
  private readonly toast = inject(ToastService);

  today = new Date();
  ROLE_LABELS = ROLE_LABELS;
  loading  = signal(false);
  saving   = signal(false);
  showModal = signal(false);
  messageForm = signal('');
  erreurForm  = signal('');

  users = signal<UserUI[]>([]);
  filtreRole = signal<string>('TOUS');
  filtreTexte = signal<string>('');
  /** Deux modes d'affichage de la même liste — demande explicite du porteur (2026-10-25). */
  vueAffichage = signal<'table' | 'cartes'>('table');

  form: NouvelUtilisateurForm = FORM_VIDE();

  // ── Détail utilisateur (2026-10-25) : débloquer, réinitialiser le mot de passe, changer le
  // rôle — les trois endpoints existaient déjà côté AdministrationController, jamais appelés
  // depuis cet écran. ──
  showDetailModal = signal(false);
  detailLoading = signal(false);
  detailErreur = signal('');
  utilisateurDetail = signal<UtilisateurBE | null>(null);
  actionDetailEnCours = signal(false);

  showResetPwdModal = signal(false);
  nouveauMotDePasse = '';

  showChangeRoleModal = signal(false);
  nouveauRole = '';

  rolesDisponibles = [
    'TOUS', 'DIRECTEUR_GENERAL', 'DIRECTEUR_COMMERCIAL', 'GESTIONNAIRE_STOCK', 'COMMERCIAL',
    'COMPTABLE', 'SECRETAIRE', 'ADMIN', 'CHARGEE_RP',
    'CHEF_PRODUCTION', 'RESPONSABLE_SALLE', 'CHEF_MACHINISTE', 'MACHINISTE',
    'AGENT_DOSEUR', 'AGENT_PRODUCTION', 'CONTROLEUR_GENERAL', 'RESPONSABLE_RH',
  ];

  rolesCreation = [
    'DIRECTEUR_GENERAL', 'DIRECTEUR_COMMERCIAL', 'GESTIONNAIRE_STOCK', 'COMMERCIAL',
    'COMPTABLE', 'SECRETAIRE', 'ADMIN', 'CHARGEE_RP',
    'CHEF_PRODUCTION', 'RESPONSABLE_SALLE', 'CHEF_MACHINISTE', 'MACHINISTE',
    'AGENT_DOSEUR', 'AGENT_PRODUCTION', 'CONTROLEUR_GENERAL', 'RESPONSABLE_RH',
  ];

  usersFiltres = computed(() => {
    const r = this.filtreRole();
    const t = this.filtreTexte().trim().toLowerCase();
    let list = r === 'TOUS' ? this.users() : this.users().filter(u => u.role === r);
    if (t) {
      list = list.filter(u =>
        u.matricule.toLowerCase().includes(t) || u.nom.toLowerCase().includes(t) || u.email.toLowerCase().includes(t)
      );
    }
    return list;
  });

  nbActifs   = computed(() => this.users().filter(u => u.actif).length);
  nbInactifs = computed(() => this.users().filter(u => !u.actif).length);
  nbBloques  = computed(() => this.users().filter(u => u.compteBloque).length);

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.svc.getUtilisateurs().subscribe({
      next: list => { this.users.set(list.map(u => this.mapU(u))); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  ouvrirModal(): void {
    this.form = FORM_VIDE();
    this.messageForm.set('');
    this.erreurForm.set('');
    this.showModal.set(true);
  }

  fermerModal(): void {
    this.showModal.set(false);
  }

  creerUtilisateur(): void {
    if (!this.form.prenom.trim() || !this.form.nom.trim() ||
        !this.form.email.trim() || !this.form.motDePasse.trim() || !this.form.role) {
      this.erreurForm.set('Les champs Prénom, Nom, Email, Mot de passe et Rôle sont obligatoires.');
      return;
    }
    this.saving.set(true);
    this.erreurForm.set('');
    const payload: Record<string, string> = {
      prenom: this.form.prenom.trim(),
      nom: this.form.nom.trim(),
      email: this.form.email.trim(),
      motDePasse: this.form.motDePasse,
      role: this.form.role,
    };
    if (this.form.telephone)    payload['telephone']    = this.form.telephone;
    if (this.form.residence)    payload['residence']    = this.form.residence;
    if (this.form.cni)          payload['cni']          = this.form.cni;
    if (this.form.dateNaissance) payload['dateNaissance'] = this.form.dateNaissance;
    if (this.form.lieuNaissance) payload['lieuNaissance'] = this.form.lieuNaissance;
    if (this.form.dateEmbauche)  payload['dateEmbauche']  = this.form.dateEmbauche;
    if (this.form.sexe)          payload['sexe']          = this.form.sexe;

    this.svc.creerUtilisateur(payload as any).subscribe({
      next: () => {
        this.saving.set(false);
        this.fermerModal();
        this.charger();
      },
      error: (err) => {
        this.erreurForm.set(err?.error?.message ?? 'Erreur lors de la création du compte.');
        this.saving.set(false);
      }
    });
  }

  getRoleLabel(role: string): string {
    return (ROLE_LABELS as Record<string, string>)[role] ?? role;
  }

  toggleActif(matricule: string): void {
    const user = this.users().find(u => u.matricule === matricule);
    if (!user) return;
    const action$ = user.actif ? this.svc.desactiver(matricule) : this.svc.activer(matricule);
    action$.subscribe({
      next: u => this.users.update(list =>
        list.map(usr => usr.matricule === matricule ? this.mapU(u) : usr)
      ),
      error: (err) => this.toast.error(extractApiError(err), user.actif ? 'Désactivation impossible' : 'Activation impossible'),
    });
  }

  // ── Détail utilisateur ──────────────────────────────────────────────────

  ouvrirDetails(matricule: string): void {
    this.showDetailModal.set(true);
    this.detailLoading.set(true);
    this.detailErreur.set('');
    this.utilisateurDetail.set(null);
    this.svc.consulterUtilisateur(matricule).subscribe({
      next: u => { this.utilisateurDetail.set(u); this.detailLoading.set(false); },
      error: (err) => { this.detailErreur.set(extractApiError(err)); this.detailLoading.set(false); },
    });
  }

  fermerDetailModal(): void {
    this.showDetailModal.set(false);
    this.utilisateurDetail.set(null);
  }

  private rafraichirApresAction(u: UtilisateurBE): void {
    this.utilisateurDetail.set(u);
    this.users.update(list => list.map(usr => usr.matricule === u.matricule ? this.mapU(u) : usr));
  }

  debloquerCompte(): void {
    const u = this.utilisateurDetail();
    if (!u || this.actionDetailEnCours()) return;
    if (!confirm(`Débloquer le compte ${u.matricule} ?`)) return;
    this.actionDetailEnCours.set(true);
    this.svc.debloquer(u.matricule).subscribe({
      next: res => { this.actionDetailEnCours.set(false); this.rafraichirApresAction(res); this.toast.success('Compte débloqué.'); },
      error: (err) => { this.actionDetailEnCours.set(false); this.toast.error(extractApiError(err), 'Déblocage impossible'); },
    });
  }

  ouvrirResetPwd(): void {
    this.nouveauMotDePasse = '';
    this.showResetPwdModal.set(true);
  }
  fermerResetPwd(): void { this.showResetPwdModal.set(false); }

  confirmerResetPwd(): void {
    const u = this.utilisateurDetail();
    if (!u || !this.nouveauMotDePasse.trim() || this.actionDetailEnCours()) return;
    this.actionDetailEnCours.set(true);
    this.svc.reinitialiserMotDePasse(u.matricule, this.nouveauMotDePasse.trim()).subscribe({
      next: res => {
        this.actionDetailEnCours.set(false);
        this.rafraichirApresAction(res);
        this.showResetPwdModal.set(false);
        this.toast.success('Mot de passe réinitialisé.');
      },
      error: (err) => { this.actionDetailEnCours.set(false); this.toast.error(extractApiError(err), 'Réinitialisation impossible'); },
    });
  }

  ouvrirChangeRole(): void {
    this.nouveauRole = this.utilisateurDetail()?.role ?? '';
    this.showChangeRoleModal.set(true);
  }
  fermerChangeRole(): void { this.showChangeRoleModal.set(false); }

  confirmerChangeRole(): void {
    const u = this.utilisateurDetail();
    if (!u || !this.nouveauRole || this.actionDetailEnCours()) return;
    if (!confirm(`Changer le rôle de ${u.matricule} en « ${this.getRoleLabel(this.nouveauRole)} » ?`)) return;
    this.actionDetailEnCours.set(true);
    this.svc.changerRole(u.matricule, this.nouveauRole).subscribe({
      next: res => {
        this.actionDetailEnCours.set(false);
        this.rafraichirApresAction(res);
        this.showChangeRoleModal.set(false);
        this.toast.success('Rôle modifié.');
      },
      error: (err) => { this.actionDetailEnCours.set(false); this.toast.error(extractApiError(err), 'Changement de rôle impossible'); },
    });
  }

  statutDetailLabel(u: UtilisateurBE): string {
    if (u.compteBloque) return 'Bloqué';
    return u.actif ? 'Actif' : 'Inactif';
  }
  statutDetailClasse(u: UtilisateurBE): string {
    if (u.compteBloque) return 'badge bg-red';
    return u.actif ? 'badge bg-success' : 'badge bg-neutral';
  }

  private mapU(u: UtilisateurBE): UserUI {
    return {
      id: u.matricule, matricule: u.matricule, nom: u.nomComplet,
      prenom: null, email: u.email, role: u.role,
      actif: u.actif, compteBloque: u.compteBloque ?? false, dateCreation: new Date(u.dateCreation),
      terminalImei: null, derniereConnexion: null,
    };
  }
}
