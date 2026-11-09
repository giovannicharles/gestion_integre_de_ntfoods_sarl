import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { Location } from '@angular/common';

/**
 * Coquille minimale pour /ia/* (2026-11-09, demande explicite du porteur : « construis-le pour de
 * vrai »). Ce hub était monté comme route de tout premier niveau, sans aucun layout (ni sidebar ni
 * fil d'Ariane) - les 5 pages s'affichaient nues, sans moyen de revenir à son propre module. Hub
 * transversal (accessible à presque tous les rôles, cf. roles sur app.routes.ts), volontairement
 * léger : pas de sidebar complète comme les modules métier, juste un bandeau de navigation entre
 * les 5 capacités IA et un lien de retour.
 */
@Component({
  selector: 'app-ia-hub-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './ia-hub-layout.component.html',
  styleUrls: ['./ia-hub-layout.component.css'],
})
export class IaHubLayoutComponent {
  private readonly location = inject(Location);
  goBack(): void { this.location.back(); }

  tabs = [
    { label: 'Assistant', icon: 'fa-comments', route: '/ia/chat' },
    { label: 'Analyse', icon: 'fa-magnifying-glass-chart', route: '/ia/analyze' },
    { label: 'Prévisions', icon: 'fa-chart-line', route: '/ia/predictions' },
    { label: 'Rapports', icon: 'fa-file-lines', route: '/ia/reports' },
    { label: 'Suggestions', icon: 'fa-lightbulb', route: '/ia/suggestions' },
  ];
}
