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
  activitesSuspectes = signal<ActiviteSuspecteBE[]>([]);
  loading = signal(false);
  erreur = signal<string | null>(null);

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.erreur.set(null);
    this.svc.echecs(0, 20).subscribe({
      next: (page) => this.echecs.set(page.contenu),
      error: () => this.erreur.set('Impossible de charger le journal des échecs.')
    });
    this.svc.activitesSuspectes(24, 5).subscribe({
      next: (liste) => { this.activitesSuspectes.set(liste); this.loading.set(false); },
      error: () => { this.erreur.set('Impossible de charger les activités suspectes.'); this.loading.set(false); }
    });
  }
}
