import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AdminService, PermissionDto, PermissionsEffectivesBE, UtilisateurBE, TypeOverride,
} from '../../../infrastructure/admin.service';
import { AuthService } from '../../../../../core/auth/auth.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';

/**
 * Gestion des permissions (RBAC) — 2026-10-16.
 *
 * Le moteur existe déjà entièrement côté serveur (PermissionController) : matrice
 * rôle→permission, permissions effectives par utilisateur (base + overrides),
 * ajout/suppression d'un override avec motif obligatoire et auteur tracé. Rien
 * n'était exposé côté frontend — cet écran ne fait qu'ouvrir ce qui existait déjà,
 * sans toucher au backend. Lecture ouverte à AUTH_PERMISSION_CONSULTER (DG,
 * Directeur Commercial, Contrôleur Général) ; les boutons d'override restent
 * masqués sans AUTH_PERMISSION_GERER (DG, Admin) — le serveur reste la seule
 * autorité réelle, ce masquage n'est qu'un confort d'affichage.
 */
/** Icône par préfixe de module (code de permission = MODULE_RESSOURCE_ACTION). */
const MODULE_ICONS: Record<string, string> = {
  STOCK: 'fa-warehouse', PRODUCTION: 'fa-industry', COMMERCIAL: 'fa-handshake',
  COMMERCIALISATION: 'fa-tags', COMPTABILITE: 'fa-calculator', AUTH: 'fa-user-shield',
  ADMINISTRATION: 'fa-screwdriver-wrench', INCIDENT: 'fa-triangle-exclamation',
  NOTIFICATION: 'fa-bell', DG: 'fa-user-tie', RP: 'fa-briefcase', SECRETARIAT: 'fa-cash-register',
  SYNC: 'fa-rotate', IA: 'fa-brain', CONTROLE: 'fa-magnifying-glass-chart',
  RH: 'fa-id-card-clip', SYSTEM: 'fa-gears',
};

function moduleDe(code: string): string {
  return code.split('_')[0] ?? code;
}

interface GroupePermission { module: string; icone: string; items: string[]; }

function grouperParModule(codes: string[]): GroupePermission[] {
  const parModule = new Map<string, string[]>();
  for (const c of codes) {
    const m = moduleDe(c);
    if (!parModule.has(m)) parModule.set(m, []);
    parModule.get(m)!.push(c);
  }
  return Array.from(parModule.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([module, items]) => ({ module, icone: MODULE_ICONS[module] ?? 'fa-circle', items }));
}

@Component({
  selector: 'app-admin-permissions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-permissions.component.html',
  styleUrls: ['./admin-permissions.component.css'],
})
export class AdminPermissionsComponent implements OnInit {
  private readonly svc = inject(AdminService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  peutGerer = computed(() => this.auth.hasAnyRole(['DIRECTEUR_GENERAL', 'ADMIN']));

  loading = signal(true);
  loadError = signal<string | null>(null);

  tousPermissions = signal<PermissionDto[]>([]);
  matrice = signal<Record<string, string[]>>({});
  utilisateurs = signal<UtilisateurBE[]>([]);
  roles = computed(() => Object.keys(this.matrice()).sort());

  roleSelectionne = signal<string | null>(null);
  permissionsDuRole = computed(() => {
    const r = this.roleSelectionne();
    return r ? (this.matrice()[r] ?? []) : [];
  });
  filtrePermission = signal('');
  permissionsFiltrees = computed(() => {
    const f = this.filtrePermission().toUpperCase().trim();
    return f ? this.permissionsDuRole().filter(p => p.includes(f)) : this.permissionsDuRole();
  });
  /** Regroupement par module (2026-10-25) — ~150 permissions à plat étaient illisibles. */
  groupesRole = computed(() => grouperParModule(this.permissionsFiltrees()));
  modulesReplies = signal<Set<string>>(new Set());
  moduleEstOuvert(module: string): boolean { return !this.modulesReplies().has(module); }
  toggleModule(module: string): void {
    this.modulesReplies.update(s => {
      const next = new Set(s);
      if (next.has(module)) next.delete(module); else next.add(module);
      return next;
    });
  }

  /** Vue inverse « qui a cette permission par défaut » — calculée depuis la matrice déjà en mémoire. */
  permissionSelectionnee = signal<string | null>(null);
  rolesAvecPermission = computed(() => {
    const code = this.permissionSelectionnee();
    if (!code) return [];
    return Object.entries(this.matrice())
      .filter(([, perms]) => perms.includes(code))
      .map(([role]) => role)
      .sort();
  });
  ouvrirRolesPour(code: string): void {
    this.permissionSelectionnee.set(this.permissionSelectionnee() === code ? null : code);
  }

  // ── Recherche d'un utilisateur ──────────────────────────────────────────
  matriculeRecherche = '';
  chargementUtilisateur = signal(false);
  erreurUtilisateur = signal<string | null>(null);
  utilisateurCourant = signal<PermissionsEffectivesBE | null>(null);

  showOverrideForm = signal(false);
  savingOverride = signal(false);
  overrideForm = signal<{ permission: string; typeOverride: TypeOverride; motif: string }>({
    permission: '', typeOverride: 'ACCORDER', motif: '',
  });

  ngOnInit(): void {
    this.charger();
    this.svc.getUtilisateurs().subscribe({ next: u => this.utilisateurs.set(u), error: () => {} });
  }

  charger(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.svc.listerPermissions().subscribe({ next: p => this.tousPermissions.set(p), error: () => {} });
    this.svc.consulterMatricePermissions().subscribe({
      next: m => {
        this.matrice.set(m);
        if (!this.roleSelectionne() && Object.keys(m).length > 0) {
          this.roleSelectionne.set(Object.keys(m).sort()[0]);
        }
        this.loading.set(false);
      },
      error: e => { this.loadError.set(extractApiError(e)); this.loading.set(false); },
    });
  }

  libelle(code: string): string {
    return this.tousPermissions().find(p => p.code === code)?.libelle ?? code;
  }

  nomUtilisateur(matricule: string): string {
    return this.utilisateurs().find(u => u.matricule === matricule)?.nomComplet ?? matricule;
  }

  rechercherUtilisateur(): void {
    const m = this.matriculeRecherche.trim().toUpperCase();
    if (!m) return;
    this.chargementUtilisateur.set(true);
    this.erreurUtilisateur.set(null);
    this.utilisateurCourant.set(null);
    this.svc.permissionsEffectives(m).subscribe({
      next: p => { this.utilisateurCourant.set(p); this.chargementUtilisateur.set(false); },
      error: e => { this.erreurUtilisateur.set(extractApiError(e)); this.chargementUtilisateur.set(false); },
    });
  }

  selectionnerUtilisateur(matricule: string): void {
    this.matriculeRecherche = matricule;
    this.rechercherUtilisateur();
  }

  estSurchargee(code: string): TypeOverride | null {
    const u = this.utilisateurCourant();
    const o = u?.overrides.find(x => x.permission === code);
    return o?.typeOverride ?? null;
  }

  ouvrirOverride(): void {
    this.overrideForm.set({ permission: this.tousPermissions()[0]?.code ?? '', typeOverride: 'ACCORDER', motif: '' });
    this.showOverrideForm.set(true);
  }

  majOverride<K extends 'permission' | 'typeOverride' | 'motif'>(champ: K, valeur: any): void {
    this.overrideForm.update(f => ({ ...f, [champ]: valeur }));
  }

  enregistrerOverride(): void {
    const u = this.utilisateurCourant();
    const f = this.overrideForm();
    if (!u || !f.permission || !f.motif.trim()) {
      this.toast.error('Permission et motif sont obligatoires.', 'Formulaire incomplet');
      return;
    }
    this.savingOverride.set(true);
    this.svc.ajouterOverridePermission(u.matricule, f.permission, f.typeOverride, f.motif.trim()).subscribe({
      next: () => {
        this.savingOverride.set(false);
        this.showOverrideForm.set(false);
        this.toast.success(`Override ${f.typeOverride === 'ACCORDER' ? 'accordé' : 'retiré'} sur ${this.libelle(f.permission)}.`);
        this.rechercherUtilisateur();
      },
      error: e => { this.savingOverride.set(false); this.toast.error(extractApiError(e), "Échec de l'enregistrement"); },
    });
  }

  supprimerOverride(code: string): void {
    const u = this.utilisateurCourant();
    if (!u) return;
    this.svc.supprimerOverridePermission(u.matricule, code).subscribe({
      next: () => { this.toast.success('Override supprimé — retour à la permission de base du rôle.'); this.rechercherUtilisateur(); },
      error: e => this.toast.error(extractApiError(e), 'Échec de la suppression'),
    });
  }
}
