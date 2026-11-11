import { Component, ChangeDetectionStrategy, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminService } from '../../../infrastructure/admin.service';
import { AuditService, JournalAuditBE } from '../../../../../core/audit/audit.service';
import { DgService, IncidentResumeBE } from '../../../../dg/infrastructure/dg.service';
import { ROLE_LABELS } from '../../../../../core/models/user.models';
import { extractApiError } from '../../../../../core/http/api-error-parser';

interface RaccourciAdmin {
  label: string;
  icone: string;
  route: string;
  description: string;
}

/**
 * Tableau de bord Admin (2026-11-01, demande explicite du porteur : « chaque fonctionnalité de
 * chaque module doit être complète » / « monter en abstraction »). Jusqu'ici, `/admin` redirigeait
 * directement vers `/admin/utilisateurs` : aucun écran de synthèse, contrairement aux panneaux
 * d'administration de référence (GitHub Org Settings, Okta, Auth0, Vercel Team Settings) qui
 * ouvrent toujours sur une vue d'ensemble avant le détail.
 *
 * Purement une vue de synthèse : aucune nouvelle donnée calculée, chaque chiffre vient d'un
 * endpoint déjà existant et déjà utilisé ailleurs (utilisateurs, incidents, audit), pas de
 * duplication de logique métier.
 */
@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDashboardComponent implements OnInit {
  private readonly adminSvc = inject(AdminService);
  private readonly auditSvc = inject(AuditService);
  private readonly dgSvc = inject(DgService);

  today = new Date();
  Math = Math;
  loading = signal(true);
  loadError = signal<string | null>(null);
  /** Échecs non bloquants des widgets secondaires (incidents/activité) : signalés, page utilisable quand même. */
  incidentsError = signal<string | null>(null);
  activiteError = signal<string | null>(null);
  ROLE_LABELS = ROLE_LABELS;

  totalUtilisateurs = signal(0);
  nbActifs = signal(0);
  nbBloques = signal(0);
  nbSessionsActives = signal(0);
  repartitionRoles = signal<{ role: string; count: number }[]>([]);

  incidentsResume = signal<IncidentResumeBE | null>(null);
  activiteRecente = signal<JournalAuditBE[]>([]);
  nbEvenements24h = signal(0);

  raccourcis: RaccourciAdmin[] = [
    { label: 'Utilisateurs', icone: 'fa-users-gear', route: '/admin/utilisateurs', description: 'Comptes, rôles, sessions' },
    { label: 'Permissions & RBAC', icone: 'fa-user-shield', route: '/admin/permissions', description: 'Matrice de droits, dérogations' },
    { label: "Journal d'audit", icone: 'fa-clipboard-list', route: '/admin/audit', description: 'Qui a fait quoi, quand' },
    { label: 'Incidents', icone: 'fa-triangle-exclamation', route: '/admin/incidents', description: 'Signalements techniques' },
    { label: 'Codes de validation', icone: 'fa-key', route: '/admin/codes-validation', description: 'Codes de confirmation' },
    { label: 'Codes observation', icone: 'fa-clipboard-question', route: '/admin/codes-observation', description: 'Motifs standardisés' },
    { label: 'Paramètres système', icone: 'fa-gears', route: '/admin-systeme/parametres', description: 'Configuration technique' },
    { label: 'Sauvegardes', icone: 'fa-database', route: '/admin-systeme/sauvegardes', description: 'Planification, historique' },
    { label: 'Corbeille', icone: 'fa-trash-can', route: '/admin-systeme/corbeille', description: 'Éléments supprimés, restauration' },
    { label: 'Suivi', icone: 'fa-chart-line', route: '/admin-systeme/suivi', description: 'Santé du système' },
  ];

  tauxBlocage = computed(() => {
    const total = this.totalUtilisateurs();
    return total === 0 ? 0 : Math.round((this.nbBloques() / total) * 100);
  });

  private dateLocaleIso(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.loadError.set(null);

    this.adminSvc.getUtilisateurs().subscribe({
      next: users => {
        this.totalUtilisateurs.set(users.length);
        this.nbActifs.set(users.filter(u => u.actif).length);
        this.nbBloques.set(users.filter(u => u.compteBloque).length);
        this.nbSessionsActives.set(users.filter(u => u.sessionActive).length);
        const parRole = new Map<string, number>();
        users.forEach(u => parRole.set(u.role, (parRole.get(u.role) ?? 0) + 1));
        this.repartitionRoles.set(
          Array.from(parRole.entries()).map(([role, count]) => ({ role, count })).sort((a, b) => b.count - a.count)
        );
        this.loading.set(false);
      },
      error: (err) => { this.loadError.set(extractApiError(err)); this.loading.set(false); },
    });

    this.incidentsError.set(null);
    this.dgSvc.getIncidentsResume().subscribe({
      next: r => this.incidentsResume.set(r),
      error: (err) => this.incidentsError.set(extractApiError(err)),
    });

    this.activiteError.set(null);
    const hier = this.dateLocaleIso(new Date(Date.now() - 86400000));
    const aujourdhui = this.dateLocaleIso(new Date());
    this.auditSvc.getAuditParPeriode(hier, aujourdhui, { size: 8, sort: 'horodatage,desc' }).subscribe({
      next: page => { this.activiteRecente.set(page.contenu); this.nbEvenements24h.set(page.totalElements); },
      error: (err) => this.activiteError.set(extractApiError(err)),
    });
  }

  getRoleLabel(role: string): string {
    return this.ROLE_LABELS[role as keyof typeof ROLE_LABELS] || role;
  }

  iconeAction(typeAction: string): string {
    switch (typeAction) {
      case 'CREATION': return 'fa-plus';
      case 'MODIFICATION': return 'fa-pen';
      case 'SUPPRESSION_TENTATIVE': return 'fa-trash';
      case 'VALIDATION': return 'fa-check';
      case 'ANNULATION': return 'fa-rotate-left';
      case 'CONNEXION': return 'fa-right-to-bracket';
      case 'ECHEC_CONNEXION': return 'fa-triangle-exclamation';
      case 'DEBLOCAGE_PRIX': return 'fa-unlock';
      default: return 'fa-circle-info';
    }
  }
}
