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
  loading = signal(false);

  users = signal<UserUI[]>([]);
  filtreRole = signal<string>('TOUS');

  rolesDisponibles = [
    'TOUS', 'DIRECTEUR_GENERAL', 'DIRECTEUR_COMMERCIAL', 'GESTIONNAIRE_STOCK', 'COMMERCIAL',
    'COMPTABLE', 'SECRETAIRE', 'ADMIN', 'CHARGEE_RP',
    'CHEF_PRODUCTION', 'AGENT_PRODUCTION', 'CHEF_MACHINISTE', 'MACHINISTE', 'AGENT_DOSEUR',
    'CONTROLEUR_GENERAL',
  ];

  usersFiltres = computed(() => {
    const r = this.filtreRole();
    return r === 'TOUS' ? this.users() : this.users().filter(u => u.role === r);
  });

  nbActifs = computed(() => this.users().filter(u => u.actif).length);
  nbInactifs = computed(() => this.users().filter(u => !u.actif).length);

  ngOnInit(): void {
    this.loading.set(true);
    this.svc.getUtilisateurs().subscribe({
      next: list => { this.users.set(list.map(this.mapU)); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  getRoleLabel(role: string): string {
    return (ROLE_LABELS as Record<string, string>)[role] ?? role;
  }

  toggleActif(matricule: string): void {
    const user = this.users().find(u => u.matricule === matricule);
    if (!user) return;
    const action$ = user.actif
      ? this.svc.desactiver(matricule)
      : this.svc.activer(matricule);
    action$.subscribe({
      next: u => this.users.update(list =>
        list.map(usr => usr.matricule === matricule ? this.mapU(u) : usr)
      ),
    });
  }

  private mapU(u: UtilisateurBE): UserUI {
    return {
      id: u.matricule,
      matricule: u.matricule,
      nom: u.nomComplet,
      prenom: null,
      email: u.email,
      role: u.role,
      actif: u.actif,
      dateCreation: new Date(u.dateCreation),
      terminalImei: null,
      derniereConnexion: null,
    };
  }
}
