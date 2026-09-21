import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductionService, CODES_POSTE, CodePosteRef } from '../../../../infrastructure/production.service';

/**
 * RÉFÉRENTIEL DES POSTES — Responsable de Salle
 * Référentiel chargé depuis le backend. En cas d'indisponibilité, le fallback
 * local est utilisé.
 */
@Component({
  selector: 'app-rs-referentiel-postes',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rs-referentiel-postes.component.html',
  styleUrls: ['./rs-referentiel-postes.component.css', '../_shared.css']
})
export class RsReferentielPostesComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  postes = signal<CodePosteRef[]>(CODES_POSTE);

  ngOnInit(): void {
    this.svc.getPostesProduction().subscribe({
      next: p => this.postes.set(p.length > 0 ? p : CODES_POSTE),
      error: () => this.postes.set(CODES_POSTE),
    });
  }
}
