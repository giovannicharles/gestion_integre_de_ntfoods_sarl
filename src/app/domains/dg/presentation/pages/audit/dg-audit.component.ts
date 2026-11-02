import { Component, ChangeDetectionStrategy, OnInit, signal, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DgService, JournalAuditBE } from '../../../infrastructure/dg.service';
import { extractApiError } from '../../../../../core/http/api-error-parser';

const TYPES_ACTION = [
  'CONSULTATION', 'CREATION', 'MODIFICATION', 'VALIDATION', 'SUPPRESSION_TENTATIVE',
  'ANNULATION', 'IMPRESSION_EXPORT', 'CONNEXION', 'ECHEC_CONNEXION', 'DEBLOCAGE_PRIX', 'AUTRE',
];

/**
 * Journal d'audit, écran DG propre (2026-11-01), remplace l'alias direct vers admin-audit
 * retiré le même jour. Lecture seule : le DG voit tout (GET /dg/audit, « le DG voit TOUTES les
 * actions tracées », commentaire du contrôleur), la GESTION de l'audit (export avancé,
 * corbeille...) reste côté Admin si elle existe.
 */
@Component({
  selector: 'app-dg-audit',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './dg-audit.component.html',
  styleUrls: ['./dg-audit.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DgAuditComponent implements OnInit {
  private readonly dgSvc = inject(DgService);

  loading = signal(true);
  loadError = signal<string | null>(null);
  entrees = signal<JournalAuditBE[]>([]);

  typesAction = TYPES_ACTION;

  filtreMatricule = '';
  filtreModule = '';
  filtreTypeAction = '';
  filtreDebut = '';
  filtreFin = '';

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.dgSvc.getAudit({
      matricule: this.filtreMatricule || undefined,
      module: this.filtreModule || undefined,
      typeAction: this.filtreTypeAction || undefined,
      debut: this.filtreDebut || undefined,
      fin: this.filtreFin || undefined,
      limite: 200,
    }).subscribe({
      next: e => { this.entrees.set(e); this.loading.set(false); },
      error: e => { this.loadError.set(extractApiError(e)); this.loading.set(false); },
    });
  }

  reinitialiserFiltres(): void {
    this.filtreMatricule = '';
    this.filtreModule = '';
    this.filtreTypeAction = '';
    this.filtreDebut = '';
    this.filtreFin = '';
    this.charger();
  }
}
