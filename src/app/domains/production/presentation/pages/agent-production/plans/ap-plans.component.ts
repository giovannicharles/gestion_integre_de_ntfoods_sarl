import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductionService, PPHBE } from '../../../../infrastructure/production.service';

import { BesoinsParJourComponent } from '../../../shared/besoins-par-jour/besoins-par-jour.component';
/**
 * PLANS DE PRODUCTION (PPH) — Agent de Production
 * GET /production/pph (AGENT_PRODUCTION, déjà détenue par ce
 * rôle) — consultation seule : la création/validation/modification d'un PPH
 * exige PRODUCTION_PPH_GERER, réservée au Chef de Production / Responsable
 * de Salle.
 */
@Component({
  selector: 'app-ap-plans',
  standalone: true,
  imports: [BesoinsParJourComponent, CommonModule, DecimalPipe, FormsModule],
  templateUrl: './ap-plans.component.html',
  styleUrls: ['./ap-plans.component.css', '../_shared.css']
})
export class ApPlansComponent implements OnInit {
  private readonly svc = inject(ProductionService);

  loading = signal(true);
  error = signal('');
  pphs = signal<PPHBE[]>([]);

  recherche = signal('');
  filtreStatut = signal('');
  pphSelectionne = signal<PPHBE | null>(null);

  statuts = ['BROUILLON', 'VALIDE', 'EN_COURS', 'CLOTURE'];

  pphsFiltres = computed(() => {
    const r = this.recherche().trim().toLowerCase();
    const statut = this.filtreStatut();
    return this.pphs().filter(p => {
      if (r && !p.referencePPH.toLowerCase().includes(r) && !(p.referenceBC ?? '').toLowerCase().includes(r)) return false;
      if (statut && p.statut !== statut) return false;
      return true;
    });
  });

  ngOnInit(): void { this.charger(); }

  charger(): void {
    this.loading.set(true);
    this.svc.getPPHs().subscribe({
      next: list => { this.pphs.set(list); this.loading.set(false); },
      error: () => { this.error.set('Erreur lors du chargement des PPH'); this.loading.set(false); }
    });
  }

  ouvrirDetail(p: PPHBE): void { this.pphSelectionne.set(p); }
  fermerDetail(): void { this.pphSelectionne.set(null); }

  tauxAvancement(p: PPHBE): number {
    if (!p.lignes.length) return 0;
    const obj = p.lignes.reduce((s, l) => s + l.objectifSemaine, 0);
    const rea = p.lignes.reduce((s, l) => s + l.productionRealisee, 0);
    return obj > 0 ? Math.round((rea / obj) * 1000) / 10 : 0;
  }

  totalFutsPrevus(p: PPHBE): number {
    return p.lignesDetaillees.reduce((s, l) => s + l.futsPrevus, 0);
  }

  statutClass(s: string): string {
    if (s === 'CLOTURE') return 'badge bg-success';
    if (s === 'EN_COURS') return 'badge bg-orange';
    return 'badge bg-neutral';
  }
}
