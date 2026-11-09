import { Component, ChangeDetectionStrategy, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { ProfilBE } from '../../core/models/auth.models';
import { ROLE_LABELS } from '../../core/models/user.models';
import { ToastService } from '../../core/services/toast.service';
import { extractApiError } from '../../core/http/api-error-parser';
import { ThemeService } from '../../core/services/theme.service';

/**
 * « Mon Profil », écran de libre-service commun à tous les layouts (2026-11-01, demande
 * explicite du porteur : « comme dans les autres, il faut la gestion complète de son profil,
 * ses paramètres utilisateurs »). Un seul composant, monté sous `<prefix>/profil` dans chaque
 * arbre de routes, GET /auth/me et PUT /auth/profil sont déjà ouverts à tout rôle authentifié
 * (AuthController.java), aucun changement serveur nécessaire.
 */
@Component({
  selector: 'app-mon-profil',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mon-profil.component.html',
  styleUrls: ['./mon-profil.component.css'],
})
export class MonProfilComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  /** 2026-11-08 (demande explicite : « bonne gestion ... ses préférences »). Le service existait
   * déjà, complet et fonctionnel (persistance localStorage, écoute du thème système), mais
   * aucun écran n'exposait jamais `toggle()` : le mode sombre s'appliquait seulement au chargement
   * initial, sans possibilité pour l'utilisateur de le choisir lui-même. */
  readonly theme = inject(ThemeService);

  loading = signal(true);
  loadError = signal<string | null>(null);
  profil = signal<ProfilBE | null>(null);
  saving = signal(false);
  savingPwd = signal(false);
  ongletActif = signal<'infos' | 'securite' | 'preferences'>('infos');

  roleLabel = computed(() => {
    const p = this.profil();
    if (!p) return '';
    return ROLE_LABELS[p.role] || p.role;
  });
  initiales = computed(() => {
    const p = this.profil();
    if (!p) return '??';
    return ((p.prenom?.[0] || '') + (p.nom?.[0] || '')).toUpperCase();
  });

  // Champs éditables (ModifierProfilRequest), formulaire séparé du signal `profil` pour ne
  // pousser que des changements volontaires, pas un simple reflet en direct du serveur.
  telephone = '';
  residence = '';
  cni = '';
  lieuNaissance = '';
  sexe = '';
  dateNaissance = '';

  nouveauMotDePasse = '';
  confirmationMotDePasse = '';

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.auth.consulterMonProfil().subscribe({
      next: (p) => {
        this.profil.set(p);
        this.telephone = p.telephone ?? '';
        this.residence = p.residence ?? '';
        this.cni = p.cni ?? '';
        this.lieuNaissance = p.lieuNaissance ?? '';
        this.sexe = p.sexe ?? '';
        this.dateNaissance = p.dateNaissance ?? '';
        this.loading.set(false);
      },
      error: (e) => { this.loadError.set(extractApiError(e)); this.loading.set(false); },
    });
  }

  enregistrerInfos(): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.auth.modifierMonProfil({
      telephone: this.telephone || undefined,
      residence: this.residence || undefined,
      cni: this.cni || undefined,
      lieuNaissance: this.lieuNaissance || undefined,
      sexe: this.sexe || undefined,
      dateNaissance: this.dateNaissance || undefined,
    }).subscribe({
      next: (p) => {
        this.profil.set(p);
        this.saving.set(false);
        this.toast.success('Profil mis à jour.');
      },
      error: (e) => { this.saving.set(false); this.toast.error(extractApiError(e), 'Mise à jour impossible'); },
    });
  }

  enregistrerMotDePasse(): void {
    if (this.savingPwd()) return;
    if (this.nouveauMotDePasse.length < 8) {
      this.toast.error('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (this.nouveauMotDePasse !== this.confirmationMotDePasse) {
      this.toast.error('Les deux mots de passe ne correspondent pas.');
      return;
    }
    this.savingPwd.set(true);
    this.auth.changePassword(this.nouveauMotDePasse).subscribe({
      next: () => {
        this.savingPwd.set(false);
        this.nouveauMotDePasse = '';
        this.confirmationMotDePasse = '';
        this.toast.success('Mot de passe modifié.');
      },
      error: (e) => { this.savingPwd.set(false); this.toast.error(extractApiError(e), 'Échec du changement de mot de passe'); },
    });
  }
}
