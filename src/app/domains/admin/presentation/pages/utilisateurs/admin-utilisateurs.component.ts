import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, UtilisateurBE } from '../../../infrastructure/admin.service';
import { ROLE_LABELS } from '../../../../../core/models/user.models';

interface UserUI {
  id: string; matricule: string; nom: string; prenom: string | null;
  email: string; role: string; actif: boolean; dateCreation: Date;
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
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './admin-utilisateurs.component.html',
  styleUrls: ['./admin-utilisateurs.component.css']
})
export class AdminUtilisateursComponent implements OnInit {
  private readonly svc = inject(AdminService);

  today = new Date();
  ROLE_LABELS = ROLE_LABELS;
  loading  = signal(false);
  saving   = signal(false);
  showModal = signal(false);
  messageForm = signal('');
  erreurForm  = signal('');

  users = signal<UserUI[]>([]);
  filtreRole = signal<string>('TOUS');

  form: NouvelUtilisateurForm = FORM_VIDE();

  rolesDisponibles = [
    'TOUS', 'DIRECTEUR_GENERAL', 'DIRECTEUR_COMMERCIAL', 'GESTIONNAIRE_STOCK', 'COMMERCIAL',
    'COMPTABLE', 'SECRETAIRE', 'ADMIN', 'CHARGEE_RP',
    'CHEF_PRODUCTION', 'RESPONSABLE_SALLE', 'CHEF_MACHINISTE', 'MACHINISTE',
    'AGENT_DOSEUR', 'AGENT_PRODUCTION', 'CONTROLEUR_GENERAL',
  ];

  rolesCreation = [
    'DIRECTEUR_GENERAL', 'DIRECTEUR_COMMERCIAL', 'GESTIONNAIRE_STOCK', 'COMMERCIAL',
    'COMPTABLE', 'SECRETAIRE', 'ADMIN', 'CHARGEE_RP',
    'CHEF_PRODUCTION', 'RESPONSABLE_SALLE', 'CHEF_MACHINISTE', 'MACHINISTE',
    'AGENT_DOSEUR', 'AGENT_PRODUCTION', 'CONTROLEUR_GENERAL',
  ];

  usersFiltres = computed(() => {
    const r = this.filtreRole();
    return r === 'TOUS' ? this.users() : this.users().filter(u => u.role === r);
  });

  nbActifs   = computed(() => this.users().filter(u => u.actif).length);
  nbInactifs = computed(() => this.users().filter(u => !u.actif).length);

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
    });
  }

  private mapU(u: UtilisateurBE): UserUI {
    return {
      id: u.matricule, matricule: u.matricule, nom: u.nomComplet,
      prenom: null, email: u.email, role: u.role,
      actif: u.actif, dateCreation: new Date(u.dateCreation),
      terminalImei: null, derniereConnexion: null,
    };
  }
}
