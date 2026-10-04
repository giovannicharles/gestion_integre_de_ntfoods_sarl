import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../../core/http/api.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';
import { ToastService } from '../../../../../core/services/toast.service';
import {
  DelegationDto,
  libelleActionType,
  LIBELLES_ACTION_TYPE,
  PouvoirValidationDto,
  ValidationService,
} from '../../../infrastructure/validation.service';

interface UtilisateurOption {
  id: number;
  matricule: string;
  nomComplet: string;
  role: string;
}

type Onglet = 'pouvoirs' | 'delegations';

/**
 * Écran DG/Admin — pouvoirs de validation et délégations temporaires ("absence").
 *
 * Nouveau (2026-09-30) : jusqu'ici, il n'existait aucun écran pour gérer ces deux ressources — seuls les endpoints
 * backend existaient. Les noms des utilisateurs sont résolus via `/api/dg/utilisateurs` (déjà réservé DG/ADMIN,
 * cohérent avec la restriction de cet écran) : les entités `PouvoirValidation`/`Delegation` ne portent que des IDs.
 */
@Component({
  selector: 'app-pouvoirs-delegations',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pouvoirs-delegations.component.html',
  styleUrls: ['./pouvoirs-delegations.component.css'],
})
export class PouvoirsDelegationsComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly validationService = inject(ValidationService);
  private readonly toast = inject(ToastService);

  onglet = signal<Onglet>('delegations');

  loading = signal(false);
  error = signal<string | null>(null);
  actionEnCours = false;

  utilisateurs = signal<UtilisateurOption[]>([]);
  private utilisateursParId = computed(() => {
    const m = new Map<number, UtilisateurOption>();
    this.utilisateurs().forEach((u) => m.set(u.id, u));
    return m;
  });

  pouvoirs = signal<PouvoirValidationDto[]>([]);
  delegationsRecues = signal<DelegationDto[]>([]);
  delegationsDonnees = signal<DelegationDto[]>([]);

  actionTypes = Object.keys(LIBELLES_ACTION_TYPE);
  libelleActionType = libelleActionType;

  // Formulaire nouvelle délégation
  showNouvelleDelegation = false;
  nouvelleDelegataireId: number | null = null;
  nouvelleActionTypes: string[] = [];
  nouvelleDateDebut = '';
  nouvelleDateFin = '';
  nouvelleMotif = '';

  // Formulaire nouveau pouvoir
  showNouveauPouvoir = false;
  nouveauPouvoirCible: 'role' | 'utilisateur' = 'role';
  nouveauPouvoirRole = '';
  nouveauPouvoirUtilisateurId: number | null = null;
  nouveauPouvoirActionType = '';
  nouveauPouvoirPoids = 1;
  nouveauPouvoirCommentaire = '';

  roles = ['GESTIONNAIRE_STOCK', 'CONTROLEUR_GENERAL', 'DIRECTEUR_GENERAL', 'COMPTABLE', 'CHEF_PRODUCTION', 'ADMIN'];

  ngOnInit() {
    this.chargerUtilisateurs();
    this.chargerTout();
  }

  private chargerUtilisateurs() {
    this.api.get<any[]>('dg/utilisateurs').subscribe({
      next: (data) => {
        const arr = (data as any)?.donnees ?? data;
        this.utilisateurs.set(
          (arr || []).map((u: any) => ({
            id: u.id,
            matricule: u.matricule,
            nomComplet: `${u.prenom ?? ''} ${u.nom ?? ''}`.trim(),
            role: u.role,
          }))
        );
      },
      error: (err) => this.toast.error(extractApiError(err), 'Liste des utilisateurs indisponible'),
    });
  }

  nomUtilisateur(id: number | null): string {
    if (id === null) return '—';
    const u = this.utilisateursParId().get(id);
    return u ? `${u.nomComplet} (${u.matricule})` : `#${id}`;
  }

  chargerTout() {
    this.loading.set(true);
    this.error.set(null);
    Promise.all([
      this.chargerPouvoirs().catch(() => undefined),
      this.chargerDelegationsRecues().catch(() => undefined),
      this.chargerDelegationsDonnees().catch(() => undefined),
    ]).finally(() => this.loading.set(false));
  }

  private chargerPouvoirs(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.validationService.listerPouvoirs().subscribe({
        next: (p) => { this.pouvoirs.set(p); resolve(); },
        error: (err) => { this.error.set(extractApiError(err)); reject(err); },
      });
    });
  }

  private chargerDelegationsRecues(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.validationService.mesDelegationsRecues().subscribe({
        next: (d) => { this.delegationsRecues.set(d); resolve(); },
        error: (err) => { this.error.set(extractApiError(err)); reject(err); },
      });
    });
  }

  private chargerDelegationsDonnees(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.validationService.mesDelegationsDonnees().subscribe({
        next: (d) => { this.delegationsDonnees.set(d); resolve(); },
        error: (err) => { this.error.set(extractApiError(err)); reject(err); },
      });
    });
  }

  ouvrirNouvelleDelegation() {
    this.showNouvelleDelegation = true;
    this.nouvelleDelegataireId = null;
    this.nouvelleActionTypes = [];
    this.nouvelleDateDebut = '';
    this.nouvelleDateFin = '';
    this.nouvelleMotif = '';
  }

  toggleActionType(type: string) {
    const idx = this.nouvelleActionTypes.indexOf(type);
    if (idx >= 0) this.nouvelleActionTypes.splice(idx, 1);
    else this.nouvelleActionTypes.push(type);
  }

  creerDelegation() {
    if (!this.nouvelleDelegataireId || !this.nouvelleDateDebut || !this.nouvelleDateFin || !this.nouvelleMotif || this.actionEnCours) {
      this.toast.warning('Renseignez le délégataire, la période et le motif avant de continuer.');
      return;
    }
    this.actionEnCours = true;
    this.validationService.creerDelegation({
      delegataireId: this.nouvelleDelegataireId,
      actionTypesCsv: this.nouvelleActionTypes.length > 0 ? this.nouvelleActionTypes.join(',') : null,
      dateDebut: this.nouvelleDateDebut,
      dateFin: this.nouvelleDateFin,
      motif: this.nouvelleMotif,
    }).subscribe({
      next: () => {
        this.actionEnCours = false;
        this.showNouvelleDelegation = false;
        this.toast.success('Délégation créée — vos validations seront transférées pendant cette période.');
        this.chargerDelegationsDonnees();
      },
      error: (err) => {
        this.actionEnCours = false;
        this.toast.error(extractApiError(err), 'Délégation impossible');
      },
    });
  }

  revoquerDelegation(d: DelegationDto) {
    const motif = 'Révoquée depuis l\'écran de gestion';
    this.validationService.revoquerDelegation(d.id, motif).subscribe({
      next: () => {
        this.toast.success('Délégation révoquée.');
        this.chargerDelegationsDonnees();
      },
      error: (err) => this.toast.error(extractApiError(err), 'Révocation impossible'),
    });
  }

  ouvrirNouveauPouvoir() {
    this.showNouveauPouvoir = true;
    this.nouveauPouvoirCible = 'role';
    this.nouveauPouvoirRole = '';
    this.nouveauPouvoirUtilisateurId = null;
    this.nouveauPouvoirActionType = '';
    this.nouveauPouvoirPoids = 1;
    this.nouveauPouvoirCommentaire = '';
  }

  creerPouvoir() {
    const cibleRole = this.nouveauPouvoirCible === 'role' ? this.nouveauPouvoirRole : undefined;
    const cibleUtilisateur = this.nouveauPouvoirCible === 'utilisateur' ? this.nouveauPouvoirUtilisateurId ?? undefined : undefined;
    if ((!cibleRole && !cibleUtilisateur) || this.nouveauPouvoirPoids <= 0 || this.actionEnCours) {
      this.toast.warning('Choisissez un rôle ou un utilisateur, et un poids strictement positif.');
      return;
    }
    this.actionEnCours = true;
    this.validationService.attribuerPouvoir({
      role: cibleRole,
      utilisateurId: cibleUtilisateur,
      actionType: this.nouveauPouvoirActionType || undefined,
      poids: this.nouveauPouvoirPoids,
      commentaire: this.nouveauPouvoirCommentaire || undefined,
    }).subscribe({
      next: () => {
        this.actionEnCours = false;
        this.showNouveauPouvoir = false;
        this.toast.success('Pouvoir attribué.');
        this.chargerPouvoirs();
      },
      error: (err) => {
        this.actionEnCours = false;
        this.toast.error(extractApiError(err), 'Attribution impossible');
      },
    });
  }

  revoquerPouvoir(p: PouvoirValidationDto) {
    const motif = 'Révoqué depuis l\'écran de gestion';
    this.validationService.revoquerPouvoir(p.id, motif).subscribe({
      next: () => {
        this.toast.success('Pouvoir révoqué.');
        this.chargerPouvoirs();
      },
      error: (err) => this.toast.error(extractApiError(err), 'Révocation impossible'),
    });
  }

  estActive(d: DelegationDto): boolean {
    const maintenant = new Date();
    return d.actif && new Date(d.dateDebut) <= maintenant && maintenant <= new Date(d.dateFin);
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleString('fr-FR');
  }
}
