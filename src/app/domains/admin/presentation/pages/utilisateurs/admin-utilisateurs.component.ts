import { Component, ChangeDetectionStrategy, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, UtilisateurBE } from '../../../infrastructure/admin.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';
import { ROLE_LABELS } from '../../../../../core/models/user.models';
import { AuthService } from '../../../../../core/auth/auth.service';

interface UserUI {
  id: string; matricule: string; nom: string; prenom: string | null;
  email: string; role: string; actif: boolean; dateCreation: Date;
  terminalImei: string | null; derniereConnexion: Date | null;
  compteBloque: boolean; tentativesEchouees: number; sessionActive: boolean;
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

/**
 * Politique du serveur (PolitiqueMotDePasse) : 8 caractères minimum, au moins une lettre et un
 * chiffre. Vérifiée ici avant l'envoi pour un message immédiat ; le serveur reste l'autorité.
 */
function erreurPolitiqueMotDePasse(mdp: string): string | null {
  if (mdp.length < 8) return 'Le mot de passe doit contenir au moins 8 caractères.';
  if (!/[A-Za-zÀ-ÿ]/.test(mdp) || !/\d/.test(mdp)) return 'Le mot de passe doit contenir au moins une lettre et un chiffre.';
  return null;
}

@Component({
  selector: 'app-admin-utilisateurs',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './admin-utilisateurs.component.html',
  styleUrls: ['./admin-utilisateurs.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminUtilisateursComponent implements OnInit {
  private readonly svc = inject(AdminService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  today = new Date();
  ROLE_LABELS = ROLE_LABELS;
  loading  = signal(false);
  saving   = signal(false);
  showModal = signal(false);
  messageForm = signal('');
  erreurForm  = signal('');

  users = signal<UserUI[]>([]);
  filtreRole = signal<string>('TOUS');
  recherche = signal('');

  form: NouvelUtilisateurForm = FORM_VIDE();

  // ── Fiche détaillée ──
  fiche = signal<UtilisateurBE | null>(null);
  ficheChargement = signal(false);
  ficheErreur = signal('');

  // ── Réinitialisation du mot de passe ──
  cibleMdp = signal<UserUI | null>(null);
  nouveauMdp = '';
  confirmationMdp = '';
  erreurMdp = signal('');
  savingMdp = signal(false);

  // ── Changement de rôle ──
  /**
   * Réservé au Directeur Général : règle « DG exclusivement » documentée côté serveur (le même écran
   * est monté dans /admin et dans /dg). Le serveur refuse en plus de modifier son propre rôle.
   */
  readonly peutChangerRole = computed(() => this.auth.role() === 'DIRECTEUR_GENERAL');
  private readonly monMatricule = computed(() => this.auth.user()?.matricule ?? null);
  cibleRole = signal<UserUI | null>(null);
  nouveauRole = '';
  erreurRole = signal('');
  savingRole = signal(false);

  /** Matricule dont une action de ligne est en cours (évite les doubles clics). */
  actionEnCours = signal<string | null>(null);

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
    const q = this.recherche().trim().toLowerCase();
    return this.users().filter(u =>
      (r === 'TOUS' || u.role === r) &&
      (!q || u.matricule.toLowerCase().includes(q) || u.nom.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)));
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
      error: (err) => {
        this.loading.set(false);
        this.toast.withAction('Impossible de charger les utilisateurs : ' + extractApiError(err), 'Réessayer', () => this.charger(), 'error');
      },
    });
  }

  // ── Création ──────────────────────────────────────────────────────────────

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
    const politique = erreurPolitiqueMotDePasse(this.form.motDePasse);
    if (politique) { this.erreurForm.set(politique); return; }
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
        this.toast.success(`Compte de ${payload['prenom']} ${payload['nom']} créé.`);
        this.charger();
      },
      error: (err) => {
        this.erreurForm.set(extractApiError(err));
        this.saving.set(false);
      }
    });
  }

  getRoleLabel(role: string): string {
    return (ROLE_LABELS as Record<string, string>)[role] ?? role;
  }

  // ── Actions de ligne ──────────────────────────────────────────────────────

  toggleActif(matricule: string): void {
    const user = this.users().find(u => u.matricule === matricule);
    if (!user || this.actionEnCours()) return;
    if (user.actif && !confirm(`Suspendre le compte ${user.matricule} (${user.nom}) ? L'utilisateur ne pourra plus se connecter.`)) return;
    this.actionEnCours.set(matricule);
    const action$ = user.actif ? this.svc.desactiver(matricule) : this.svc.activer(matricule);
    action$.subscribe({
      next: u => {
        this.remplacer(u);
        this.actionEnCours.set(null);
        this.toast.success(u.actif ? `Compte ${matricule} activé.` : `Compte ${matricule} suspendu.`);
      },
      error: (err) => {
        this.actionEnCours.set(null);
        this.toast.error(extractApiError(err), user.actif ? 'Désactivation impossible' : 'Activation impossible');
      },
    });
  }

  debloquer(user: UserUI): void {
    if (this.actionEnCours()) return;
    this.actionEnCours.set(user.matricule);
    this.svc.debloquer(user.matricule).subscribe({
      next: u => {
        this.remplacer(u);
        this.actionEnCours.set(null);
        if (this.fiche()?.matricule === u.matricule) this.fiche.set(u);
        this.toast.success(`Compte ${user.matricule} débloqué : l'utilisateur peut de nouveau se connecter.`);
      },
      error: (err) => {
        this.actionEnCours.set(null);
        this.toast.error(extractApiError(err), 'Déblocage impossible');
      },
    });
  }

  // ── Fiche détaillée ───────────────────────────────────────────────────────

  ouvrirFiche(user: UserUI): void {
    this.fiche.set(null);
    this.ficheErreur.set('');
    this.ficheChargement.set(true);
    this.svc.consulterUtilisateur(user.matricule).subscribe({
      next: u => { this.fiche.set(u); this.ficheChargement.set(false); },
      error: (err) => { this.ficheErreur.set(extractApiError(err)); this.ficheChargement.set(false); },
    });
  }

  fermerFiche(): void {
    this.fiche.set(null);
    this.ficheErreur.set('');
    this.ficheChargement.set(false);
  }

  ficheOuverte(): boolean {
    return this.ficheChargement() || !!this.fiche() || !!this.ficheErreur();
  }

  libelleSexe(s: string | null | undefined): string {
    return s === 'M' ? 'Masculin' : s === 'F' ? 'Féminin' : (s || '—');
  }

  // ── Réinitialisation du mot de passe ──────────────────────────────────────

  ouvrirMotDePasse(user: UserUI): void {
    this.fermerFiche();
    this.nouveauMdp = '';
    this.confirmationMdp = '';
    this.erreurMdp.set('');
    this.cibleMdp.set(user);
  }

  fermerMotDePasse(): void {
    if (this.savingMdp()) return;
    this.cibleMdp.set(null);
    this.nouveauMdp = '';
    this.confirmationMdp = '';
  }

  reinitialiserMotDePasse(): void {
    const cible = this.cibleMdp();
    if (!cible) return;
    const politique = erreurPolitiqueMotDePasse(this.nouveauMdp);
    if (politique) { this.erreurMdp.set(politique); return; }
    if (this.nouveauMdp !== this.confirmationMdp) { this.erreurMdp.set('Les deux mots de passe ne correspondent pas.'); return; }
    this.erreurMdp.set('');
    this.savingMdp.set(true);
    this.svc.reinitialiserMotDePasse(cible.matricule, this.nouveauMdp).subscribe({
      next: () => {
        this.savingMdp.set(false);
        this.fermerMotDePasse();
        this.toast.success(`Mot de passe de ${cible.matricule} réinitialisé : sa session en cours est fermée. Communiquez-lui le nouveau mot de passe par un canal sûr.`);
      },
      error: (err) => {
        this.savingMdp.set(false);
        this.erreurMdp.set(extractApiError(err));
      },
    });
  }

  // ── Changement de rôle ────────────────────────────────────────────────────

  roleModifiable(u: UserUI): boolean {
    return this.peutChangerRole() && u.matricule !== this.monMatricule();
  }

  ouvrirRole(user: UserUI): void {
    if (!this.roleModifiable(user)) return;
    this.fermerFiche();
    this.nouveauRole = user.role;
    this.erreurRole.set('');
    this.cibleRole.set(user);
  }

  fermerRole(): void {
    if (this.savingRole()) return;
    this.cibleRole.set(null);
  }

  changerRole(): void {
    const cible = this.cibleRole();
    if (!cible) return;
    if (!this.nouveauRole) { this.erreurRole.set('Choisissez le nouveau rôle.'); return; }
    if (this.nouveauRole === cible.role) { this.erreurRole.set('Ce compte a déjà ce rôle.'); return; }
    const libelle = this.getRoleLabel(this.nouveauRole);
    this.erreurRole.set('');
    this.savingRole.set(true);
    this.svc.changerRoleUtilisateur(cible.matricule, this.nouveauRole).subscribe({
      next: () => {
        this.savingRole.set(false);
        this.cibleRole.set(null);
        this.toast.success(`Rôle de ${cible.matricule} changé : ${this.getRoleLabel(cible.role)} → ${libelle}. L'utilisateur est déconnecté : le nouveau rôle s'applique dès sa reconnexion.`);
        // Réponse sans corps : on relit le compte pour afficher la ligne à jour.
        this.svc.consulterUtilisateur(cible.matricule).subscribe({ next: u => this.remplacer(u), error: () => this.charger() });
      },
      error: (err) => {
        this.savingRole.set(false);
        this.erreurRole.set(extractApiError(err));
      },
    });
  }

  // ── Utilitaires ───────────────────────────────────────────────────────────

  private remplacer(u: UtilisateurBE): void {
    this.users.update(list => list.map(usr => usr.matricule === u.matricule ? this.mapU(u) : usr));
  }

  /** Fiche détaillée → ligne de liste (mêmes actions depuis la fiche que depuis le tableau). */
  versUI(u: UtilisateurBE): UserUI { return this.mapU(u); }

  private mapU(u: UtilisateurBE): UserUI {
    return {
      id: u.matricule, matricule: u.matricule, nom: u.nomComplet,
      prenom: u.prenom ?? null, email: u.email, role: u.role,
      actif: u.actif, dateCreation: new Date(u.dateCreation),
      terminalImei: null, derniereConnexion: null,
      compteBloque: !!u.compteBloque, tentativesEchouees: u.tentativesEchouees ?? 0, sessionActive: !!u.sessionActive,
    };
  }
}
