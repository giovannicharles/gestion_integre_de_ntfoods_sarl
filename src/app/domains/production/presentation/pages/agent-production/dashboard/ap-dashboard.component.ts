import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProductionService, DashboardAgentBE } from '../../../../infrastructure/production.service';

/**
 * TABLEAU DE BORD — Agent de Production
 *
 * AGENT_PRODUCTION ne détient que deux permissions côté backend
 * (AGENT_PRODUCTION, PRODUCTION_OF_CONSULTER) : cet espace est
 * donc strictement en consultation. GET /production/dashboard/agent renvoie
 * exactement les données utiles à sa journée (OF en cours/planifiés, fiches
 * de la semaine, fiche du jour déjà déclarée ou non).
 */
@Component({
  selector: 'app-ap-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './ap-dashboard.component.html',
  styleUrls: ['./ap-dashboard.component.css', '../_shared.css']
})
export class ApDashboardComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  loading = signal(true);
  erreur = signal('');
  dashboard = signal<DashboardAgentBE | null>(null);

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.erreur.set('');
    this.svc.getDashboardAgent().subscribe({
      next: d => { this.dashboard.set(d); this.loading.set(false); },
      error: () => { this.erreur.set('Erreur lors du chargement du tableau de bord.'); this.loading.set(false); }
    });
  }

  progression(qteDemandee: number, qteRealisee: number): number {
    return qteDemandee > 0 ? Math.min(100, Math.round((qteRealisee / qteDemandee) * 100)) : 0;
  }
}
