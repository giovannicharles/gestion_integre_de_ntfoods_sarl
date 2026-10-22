import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminSystemeService, JournalAuditBE, ActiviteSuspecteBE } from '../../../infrastructure/admin-systeme.service';

/**
 * Suivi de la plateforme (échecs récents, comportements suspects) — journal
 * d'audit transversal déjà construit (`/api/audit`, tous modules confondus),
 * simplement exposé ici côté administrateur système. La gestion des incidents
 * a déjà son propre écran (/admin/incidents) : pas de duplication, simple lien.
 */
@Component({
  selector: 'app-admin-systeme-suivi',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink],
  templateUrl: './admin-systeme-suivi.component.html',
  styleUrls: ['./admin-systeme-suivi.component.css']
})
export class AdminSystemeSuiviComponent implements OnInit {
  private readonly svc = inject(AdminSystemeService);

  echecs = signal<JournalAuditBE[]>([]);
  totalEchecs = signal(0);
  activitesSuspectes = signal<ActiviteSuspecteBE[]>([]);
  nbParametres = signal(0);
  nbCorbeille = signal(0);
  derniereSauvegarde = signal<{ date: string; statut: string } | null>(null);
  loading = signal(false);
  erreur = signal<string | null>(null);

  ngOnInit(): void {
    this.charger();
  }

  /**
   * Vue d'ensemble "santé plateforme" ajoutée le 2026-10-16 — l'écran ne montrait jusqu'ici que
   * deux tableaux bruts (échecs, comportements suspects), aucun repère visuel pour juger en un
   * coup d'œil si la plateforme va bien. Les 3 KPI supplémentaires (paramètres, corbeille,
   * dernière sauvegarde) réutilisent des méthodes déjà existantes du service, jamais appelées
   * depuis cet écran.
   */
  charger(): void {
    this.loading.set(true);
    this.erreur.set(null);
    this.svc.echecs(0, 20).subscribe({
      next: (page) => { this.echecs.set(page.contenu); this.totalEchecs.set(page.totalElements); },
      error: () => this.erreur.set('Impossible de charger le journal des échecs.')
    });
    this.svc.activitesSuspectes(24, 5).subscribe({
      next: (liste) => { this.activitesSuspectes.set(liste); this.loading.set(false); },
      error: () => { this.erreur.set('Impossible de charger les activités suspectes.'); this.loading.set(false); }
    });
    this.svc.lister().subscribe({ next: (list) => this.nbParametres.set(list.length), error: () => {} });
    this.svc.corbeille().subscribe({ next: (list) => this.nbCorbeille.set(list.length), error: () => {} });
    this.svc.historiqueSauvegardes(0, 1).subscribe({
      next: (page) => {
        const dernier = page.contenu[0];
        this.derniereSauvegarde.set(dernier ? { date: dernier.dateFin ?? dernier.dateDebut, statut: dernier.statut } : null);
      },
      error: () => {}
    });
  }
}
