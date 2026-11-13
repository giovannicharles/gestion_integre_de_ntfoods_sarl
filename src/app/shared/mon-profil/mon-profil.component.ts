import { Component, ChangeDetectionStrategy, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth/auth.service';
import { ProfilBE } from '../../core/models/auth.models';
import { ROLE_LABELS } from '../../core/models/user.models';
import { ToastService } from '../../core/services/toast.service';
import { extractApiError } from '../../core/http/api-error-parser';
import { ThemeService } from '../../core/services/theme.service';

export interface ModuleDroit {
  nom: string;
  code: string;
  icone: string;
  acces: boolean;
  description: string;
}

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
  readonly theme = inject(ThemeService);

  loading = signal(true);
  loadError = signal<string | null>(null);
  profil = signal<ProfilBE | null>(null);
  saving = signal(false);
  savingPwd = signal(false);
  ongletActif = signal<'infos' | 'securite' | 'habilitations' | 'preferences'>('infos');

  roleLabel = computed(() => {
    const p = this.profil();
    if (!p) return '';
    return ROLE_LABELS[p.role] || p.role;
  });

  initiales = computed(() => {
    const p = this.profil();
    if (!p) return 'NT';
    return ((p.prenom?.[0] || '') + (p.nom?.[0] || '')).toUpperCase();
  });

  // Champs éditables
  telephone = '';
  residence = '';
  cni = '';
  lieuNaissance = '';
  sexe = '';
  dateNaissance = '';

  // Sécurité
  motDePasseActuel = '';
  nouveauMotDePasse = '';
  confirmationMotDePasse = '';

  // Préférences sauvegardées
  densiteAffichage = signal<'confortable' | 'compact' | 'dense'>(
    (localStorage.getItem('tanty_ui_density') as 'confortable' | 'compact' | 'dense') || 'confortable'
  );
  modeAffichagePrefere = signal<'table' | 'cards'>(
    (localStorage.getItem('tanty_ui_view_mode') as 'table' | 'cards') || 'table'
  );
  notifSonores = signal<boolean>(localStorage.getItem('tanty_notif_sound') !== 'false');

  // Droits et permissions calculés selon le rôle
  modulesDroits = computed<ModuleDroit[]>(() => {
    const p = this.profil();
    const r = String(p?.role || '');
    const isAdmin = r === 'ADMIN' || r === 'ADMINISTRATEUR';
    const isDg = r === 'DIRECTEUR_GENERAL' || r === 'DG';
    const isComptable = r === 'COMPTABLE';
    const isCommercial = r === 'COMMERCIAL';
    const isRp = r === 'CHARGEE_RP';
    const isStock = r === 'RESPONSABLE_STOCK' || r === 'MAGASINIER' || r === 'GESTIONNAIRE_STOCK';
    const isProd = r === 'RESPONSABLE_PRODUCTION' || r === 'CHEF_EQUIPE' || r === 'AGENT_DOSEUR' || r === 'CHEF_PRODUCTION' || r === 'AGENT_PRODUCTION';

    return [
      {
        nom: 'Direction & Supervision Générale',
        code: 'DG',
        icone: 'fa-briefcase',
        acces: isAdmin || isDg,
        description: 'Tableaux de bord consolidés, arbitrages et validations exécutives.'
      },
      {
        nom: 'Relations Publiques & Grands Comptes',
        code: 'RP',
        icone: 'fa-handshake',
        acces: isAdmin || isDg || isRp,
        description: 'Conventions GMS (DOVV, Carrefour), primes de stimulation et animations de marque.'
      },
      {
        nom: 'Force Commerciale & Ventes Terrain',
        code: 'COMMERCIAL',
        icone: 'fa-truck-fast',
        acces: isAdmin || isDg || isCommercial || isRp,
        description: 'Tournées urbaines, factures comptant/crédit, précommandes et carburant.'
      },
      {
        nom: 'Comptabilité & Trésorerie OHADA',
        code: 'COMPTABILITE',
        icone: 'fa-file-invoice-dollar',
        acces: isAdmin || isDg || isComptable,
        description: 'Bordereaux de caisse, rapprochements bancaires, facturation et créances clients.'
      },
      {
        nom: 'Gestion des Stocks & Entrepôts',
        code: 'STOCK',
        icone: 'fa-warehouse',
        acces: isAdmin || isDg || isStock,
        description: 'Mouvements d\'entrées/sorties, valorisation PMP, alertes de péremption FEFO.'
      },
      {
        nom: 'Production & Unités Industrielles',
        code: 'PRODUCTION',
        icone: 'fa-industry',
        acces: isAdmin || isDg || isProd,
        description: 'Ordres de fabrication, dosage matières premières et ensachage.'
      },
      {
        nom: 'Console d\'Administration & Sécurité',
        code: 'ADMIN',
        icone: 'fa-shield-halved',
        acces: isAdmin,
        description: 'Gestion des utilisateurs, habilitations RBAC, sauvegardes et journal d\'audit ISO.'
      }
    ];
  });

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.auth.consulterMonProfil().subscribe({
      next: p => {
        this.profil.set(p);
        this.telephone = p.telephone ?? '';
        this.residence = p.residence ?? '';
        this.cni = p.cni ?? '';
        this.lieuNaissance = p.lieuNaissance ?? '';
        this.sexe = p.sexe ?? '';
        this.dateNaissance = p.dateNaissance ?? '';
        this.loading.set(false);
      },
      error: e => {
        this.loadError.set(extractApiError(e));
        this.loading.set(false);
      },
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
      next: p => {
        this.profil.set(p);
        this.saving.set(false);
        this.toast.success('Vos informations personnelles ont été mises à jour avec succès.');
      },
      error: e => {
        this.saving.set(false);
        this.toast.error(extractApiError(e));
      },
    });
  }

  enregistrerMotDePasse(): void {
    if (this.savingPwd()) return;
    if (this.nouveauMotDePasse.length < 6) {
      this.toast.error('Le nouveau mot de passe doit contenir au moins 6 caractères.');
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
        this.toast.success('Votre mot de passe a été modifié avec succès.');
      },
      error: (e: unknown) => {
        this.savingPwd.set(false);
        this.toast.error(extractApiError(e));
      },
    });
  }

  changerDensite(d: 'confortable' | 'compact' | 'dense'): void {
    this.densiteAffichage.set(d);
    localStorage.setItem('tanty_ui_density', d);
    document.body.setAttribute('data-density', d);
    this.toast.info(`Densité d'affichage réglée sur : ${d}`);
  }

  changerModeAffichage(m: 'table' | 'cards'): void {
    this.modeAffichagePrefere.set(m);
    localStorage.setItem('tanty_ui_view_mode', m);
    this.toast.info(`Mode d'affichage par défaut : ${m === 'table' ? 'Tableau' : 'Cartes & Grille'}`);
  }

  toggleNotifSon(): void {
    const val = !this.notifSonores();
    this.notifSonores.set(val);
    localStorage.setItem('tanty_notif_sound', String(val));
    this.toast.info(`Notifications sonores : ${val ? 'Activées' : 'Désactivées'}`);
  }
}
