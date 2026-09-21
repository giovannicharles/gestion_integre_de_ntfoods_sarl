import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductionService, PPHBE, ComparaisonFutsProductionBE } from '../../../../infrastructure/production.service';

/**
 * COMPARAISON AGENT DOSEUR / PRODUCTION — Responsable de Salle
 * GET /affectations/{referencePPH}/comparaison-futs (réel, autorisé) :
 * quantité théorique attendue (fûts × poudre) vs production réellement
 * enregistrée, écart, pourcentage. Alerte automatique si écart important.
 */
@Component({
  selector: 'app-rs-comparaison-doseur',
  standalone: true,
  imports: [CommonModule, DecimalPipe, FormsModule],
  templateUrl: './rs-comparaison-doseur.component.html',
  styleUrls: ['./rs-comparaison-doseur.component.css', '../_shared.css']
})
export class RsComparaisonDoseurComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  loading = signal(true);
  pphs = signal<PPHBE[]>([]);
  referencePPH = '';
  date = new Date().toISOString().split('T')[0];
  comparaison = signal<ComparaisonFutsProductionBE | null>(null);
  message = signal('');

  alerteEcartImportant = computed(() => {
    const c = this.comparaison();
    return c ? Math.abs(c.ecartPourcentage) > 15 : false;
  });

  ngOnInit(): void {
    this.svc.getPPHs('EN_COURS').subscribe({
      next: p => { this.pphs.set(p); if (p.length) this.referencePPH = p[0].referencePPH; this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  comparer(): void {
    if (!this.referencePPH) { this.message.set('Sélectionnez un PPH'); return; }
    this.svc.getComparaisonFutsProduction(this.referencePPH, this.date).subscribe({
      next: c => this.comparaison.set(c),
      error: () => { this.comparaison.set(null); this.message.set('Erreur lors de la comparaison — aucune donnée pour cette date/PPH'); }
    });
  }
}
